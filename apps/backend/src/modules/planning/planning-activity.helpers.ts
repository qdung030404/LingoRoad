import { CefrLevel, LearningAttempt, LearningDayPlan, LearningKind, Prisma } from '@prisma/client';
import {
  finishedOn,
  LEARNING_TIME_ZONE,
  learningDate,
  resolveGrammarTopicCode,
} from './planning-progress.helpers';
import { PlanItem, PlannedWritingItem } from './planning.helpers';

export type RawWritingRow = {
  id: string;
  externalId: string | null;
  skillCode: string;
  cefrLevel: CefrLevel;
  prompt: string;
  createdAt: Date;
  group: { title: string | null } | null;
};

/** Queries active study seconds aggregated via a single user tstzmultirange intersected per window. */
export async function queryHomeActiveSeconds(
  db: { $queryRaw: <T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => Promise<T> },
  userId: string,
  windows: { from: Date; to: Date }[],
): Promise<Map<number, number>> {
  if (!windows.length) return new Map<number, number>();
  const validWindows = windows
    .map((w, index) => ({ index, from: w.from, to: w.to }))
    .filter((w) => w.from < w.to);
  if (!validWindows.length) return new Map<number, number>();
  const minFrom = new Date(Math.min(...validWindows.map((w) => w.from.getTime())));
  const maxTo = new Date(Math.max(...validWindows.map((w) => w.to.getTime())));
  const values = validWindows.map(
    ({ index, from, to }) => Prisma.sql`(${index}::int, ${from}::timestamptz, ${to}::timestamptz)`,
  );
  const rows = await db.$queryRaw<{ idx: number; seconds: number }[]>`
    WITH windows(idx, starts, ends) AS (VALUES ${Prisma.join(values)}),
    user_spans AS (
      SELECT range_agg(
        tstzrange(
          GREATEST(s.start_at AT TIME ZONE 'UTC', ${minFrom}::timestamptz),
          LEAST(s.end_at AT TIME ZONE 'UTC', ${maxTo}::timestamptz),
          '[)'
        )
      ) AS mr
      FROM learning_activity_segments s
      JOIN learning_activity_sessions a ON a.id = s.session_id
      WHERE a.user_id = ${userId}::uuid
        AND s.start_at IS NOT NULL
        AND s.start_at < s.end_at
        AND s.end_at > (${minFrom}::timestamptz AT TIME ZONE 'UTC')
        AND s.start_at < (${maxTo}::timestamptz AT TIME ZONE 'UTC')
    ),
    window_clipped AS (
      SELECT w.idx, (us.mr * tstzmultirange(tstzrange(w.starts, w.ends, '[)'))) AS clipped
      FROM windows w
      CROSS JOIN user_spans us
      WHERE us.mr IS NOT NULL
    )
    SELECT wc.idx, FLOOR(SUM(EXTRACT(EPOCH FROM (upper(span) - lower(span)))))::double precision AS seconds
    FROM window_clipped wc
    CROSS JOIN LATERAL unnest(wc.clipped) AS pieces(span)
    WHERE NOT isempty(span)
    GROUP BY wc.idx`;
  return new Map((rows ?? []).map((row) => [row.idx, Number(row.seconds ?? 0)]));
}

/** Summarizes today's completed speaking topic IDs and most recent practice timestamps. */
export function buildSpeakingPracticeMaps(
  speakingSubmissions: readonly { promptId: string; completedAt: Date | null; createdAt: Date }[],
  voiceConversations: readonly { topicId: string; endedAt: Date | null }[],
  date: string,
): { completedSpeakingIdsToday: Set<string>; practicedSpeakingAt: Map<string, number> } {
  const completedSpeakingIdsToday = new Set<string>();
  const practicedSpeakingAt = new Map<string, number>();
  for (const sub of speakingSubmissions) {
    const stamp = sub.completedAt ?? sub.createdAt;
    if (learningDate(stamp) === date) completedSpeakingIdsToday.add(sub.promptId);
    const prev = practicedSpeakingAt.get(sub.promptId) ?? 0;
    if (stamp.getTime() > prev) practicedSpeakingAt.set(sub.promptId, stamp.getTime());
  }
  for (const conv of voiceConversations) {
    if (!conv.endedAt) continue;
    if (learningDate(conv.endedAt) === date) completedSpeakingIdsToday.add(conv.topicId);
    const prev = practicedSpeakingAt.get(conv.topicId) ?? 0;
    if (conv.endedAt.getTime() > prev) practicedSpeakingAt.set(conv.topicId, conv.endedAt.getTime());
  }
  return { completedSpeakingIdsToday, practicedSpeakingAt };
}

/** Normalizes writing items and extracts today's completions + last-practiced timestamps. */
export function buildWritingPlanPool(
  rawWritingItems: readonly RawWritingRow[],
  writingHistory: Readonly<Record<string, string>>,
  date: string,
): {
  writingItems: PlannedWritingItem[];
  completedWritingIdsToday: Set<string>;
  practicedWritingAt: Map<string, number>;
} {
  const writingItems: PlannedWritingItem[] = rawWritingItems.map((row) => ({
    id: row.id,
    externalId: row.externalId,
    skillCode: row.skillCode,
    cefrLevel: row.cefrLevel,
    prompt: row.prompt,
    groupTitle: row.group?.title ?? null,
    createdAt: row.createdAt,
  }));
  const completedWritingIdsToday = new Set<string>();
  const practicedWritingAt = new Map<string, number>();
  for (const [key, iso] of Object.entries(writingHistory)) {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) continue;
    if (learningDate(parsed) === date) completedWritingIdsToday.add(key);
    const prev = practicedWritingAt.get(key) ?? 0;
    if (parsed.getTime() > prev) practicedWritingAt.set(key, parsed.getTime());
  }
  return { writingItems, completedWritingIdsToday, practicedWritingAt };
}

/** Assembles the daily plan DTO with completion status, grammar topic links, and next lesson pointer. */
export function assemblePlanDto(params: {
  plan: LearningDayPlan;
  planItems: PlanItem[];
  attempts: readonly {
    id: string;
    lessonId: string;
    status: LearningAttempt['status'];
    submittedAt: Date | null;
    historyHiddenAt: Date | null;
  }[];
  speakingSubs: readonly { promptId: string }[];
  voiceConvs: readonly { topicId: string }[];
  writingHistory: Readonly<Record<string, string>>;
  lessonMeta: readonly { id: string; code: string; kind: LearningKind; grammarTopic: { code: string } | null }[];
  isLessonKind: (value: string) => value is LearningKind;
}) {
  const { plan, planItems, attempts, speakingSubs, voiceConvs, writingHistory, lessonMeta, isLessonKind } = params;
  const doneSpeakingIds = new Set<string>([
    ...speakingSubs.map((s) => s.promptId),
    ...voiceConvs.map((c) => c.topicId),
  ]);
  const doneWritingIds = new Set<string>();
  for (const [key, iso] of Object.entries(writingHistory)) {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime()) && learningDate(parsed) === plan.date) {
      doneWritingIds.add(key);
    }
  }
  const topicCodeByLessonId = new Map<string, string>();
  for (const row of lessonMeta) {
    const resolved = resolveGrammarTopicCode(row.kind, row.code, row.grammarTopic?.code);
    if (resolved) topicCodeByLessonId.set(row.id, resolved);
  }
  const items = planItems.map((item) => {
    if (item.kind === 'SPEAKING') {
      const isDone = doneSpeakingIds.has(item.lessonId) || item.reasonCode === 'COMPLETED_TODAY';
      return { ...item, completed: isDone, activeAttemptId: null, completedAttemptId: null };
    }
    if (item.kind === 'WRITING') {
      const isDone = doneWritingIds.has(item.lessonId) || item.reasonCode === 'COMPLETED_TODAY';
      return { ...item, completed: isDone, activeAttemptId: null, completedAttemptId: null };
    }
    const completed = attempts.filter((a) => a.lessonId === item.lessonId && finishedOn(a, plan.date));
    const visibleAttempt = completed.find((a) => a.historyHiddenAt == null);
    const normalized = item.reasonCode === 'RESUME'
      ? {
          ...item,
          reasonCode: completed.length ? 'COMPLETED_TODAY' : 'NEW',
          reason: completed.length ? 'Đã hoàn thành hôm nay' : 'Bài mới',
        }
      : item;
    const grammarTopicCode = topicCodeByLessonId.get(item.lessonId);
    return {
      ...normalized,
      ...(grammarTopicCode ? { grammarTopicCode } : {}),
      completed: completed.length > 0,
      activeAttemptId: null,
      completedAttemptId: visibleAttempt?.id ?? null,
    };
  });
  const nextLesson = items.find((item) => !item.completed && isLessonKind(item.kind));
  return {
    id: plan.id,
    date: plan.date,
    timeZone: LEARNING_TIME_ZONE,
    version: plan.version,
    policyVersion: plan.policyVersion,
    dailyGoalMinutes: plan.dailyGoalMinutes,
    estimatedMinutes: items.reduce((sum, item) => sum + item.estimatedMinutes, 0),
    completedCount: items.filter((item) => item.completed).length,
    totalCount: items.length,
    items,
    continueLessonId: nextLesson?.lessonId ?? null,
    continueAttemptId: null,
  };
}

/** Builds notification payload when placement completes. */
export function buildPlacementNotification(
  userId: string,
  placementKey: string,
  estimatedCefr: string | null | undefined,
) {
  return {
    userId,
    type: 'PLACEMENT_COMPLETED' as const,
    title: 'Hoàn thành kiểm tra đầu vào',
    body: estimatedCefr
      ? `Trình độ ước tính của bạn là ${estimatedCefr}. Lộ trình học đã được cá nhân hóa.`
      : 'Lộ trình học của bạn đã được cá nhân hóa theo kết quả kiểm tra đầu vào.',
    targetType: 'DAILY_PLAN' as const,
    targetPayload: { estimatedCefr: estimatedCefr ?? null },
    dedupeKey: `placement:${placementKey}`,
  };
}

/** Builds notification payload when adaptive reading level changes. */
export function buildSkillLevelNotification(
  userId: string,
  attemptId: string,
  fromCefr: CefrLevel,
  toCefr: CefrLevel,
  direction: 'UP' | 'DOWN',
) {
  const isUp = direction === 'UP';
  return {
    userId,
    type: 'SKILL_LEVEL_CHANGED' as const,
    title: isUp ? `Trình độ Đọc hiểu nâng lên ${toCefr}` : `Điều chỉnh trình độ Đọc hiểu sang ${toCefr}`,
    body: isUp
      ? `Chúc mừng! Mức Đọc hiểu của bạn đã tăng từ ${fromCefr} lên ${toCefr}.`
      : `Mức Đọc hiểu đã được điều chỉnh từ ${fromCefr} xuống ${toCefr} để phù hợp hơn.`,
    targetType: 'PROFILE' as const,
    targetPayload: { kind: 'READING', fromCefr, toCefr, direction },
    dedupeKey: `skill_level:${attemptId}`,
  };
}

