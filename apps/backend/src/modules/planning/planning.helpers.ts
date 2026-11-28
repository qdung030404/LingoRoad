import { CefrLevel, LearningAttempt, LearningKind, LearningLesson } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AdaptiveReadingTarget } from './skill-level.policy';
import { countFocusQuestions, READING_FOCUS_LABELS, ReadingFocusCode } from './reading-focus.policy';
import {
  DAY_MS,
  finishedOn,
  LEARNING_TIME_ZONE,
  learningDate,
  learningDayStart,
} from './planning-progress.helpers';

export {
  buildCefrMilestones,
  buildLearningWeekWindows,
  buildProgressUnits,
  buildWeekDaySummaries,
  computeScoreStats,
  DAY_MS,
  finishedOn,
  LEARNING_TIME_ZONE,
  learningDate,
  learningDayStart,
  MILESTONE_CEFR_ORDER,
  resolveGrammarTopicCode,
} from './planning-progress.helpers';
export type {
  LearningDaySummary,
  LearningWeekWindow,
  MilestoneLessonInput,
  ProgressMilestone,
  ProgressScoreStats,
  ProgressUnit,
  ProgressUnitStatus,
} from './planning-progress.helpers';

export const CURRENT_PLAN_POLICY_VERSION = 'adaptive-v3';

export type PreferredSkill = LearningKind | 'SPEAKING' | 'WRITING';
export type PlannedSpeakingTopic = {
  id: string;
  code: string;
  title: string;
  text: string;
  sortOrder: number;
};
export type PlannedWritingItem = {
  id: string;
  externalId?: string | null;
  skillCode: string;
  cefrLevel: CefrLevel;
  prompt: string;
  groupTitle?: string | null;
  createdAt?: Date;
};
export type SkillLevelChange = { kind: LearningKind; from: CefrLevel; to: CefrLevel; direction: 'UP' | 'DOWN' };
export type PlanItem = {
  id: string; lessonId: string; title: string; kind: PreferredSkill; estimatedMinutes: number;
  reasonCode: string; reason: string; focusSkillCode?: ReadingFocusCode; cefrLevel?: CefrLevel;
};

/** Guarantees at most one entry per `(kind, lessonId)` while preserving original timeline order. */
export function dedupePlanItems<T extends Pick<PlanItem, 'kind' | 'lessonId'>>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    if (!item || typeof item.lessonId !== 'string') continue;
    const key = `${item.kind}:${item.lessonId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}
export type PlannedLesson = Pick<
  LearningLesson,
  'id' | 'code' | 'kind' | 'title' | 'estimatedMinutes' | 'sortOrder'
> &
  Partial<LearningLesson> & {
    unit?: { cefrLevel: CefrLevel } | null;
    grammarTopic?: { cefrLevel: CefrLevel } | null;
  };

const CEFR_RANK: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

function skillCefrRank(
  placement: Record<string, unknown> | null | undefined,
  skillKey: 'reading' | 'listening',
): number {
  const entry = placement?.[skillKey];
  if (!entry || typeof entry !== 'object') return 0;
  const estimated = (entry as { estimatedCefr?: unknown }).estimatedCefr;
  if (typeof estimated === 'string' && estimated in CEFR_RANK) {
    return CEFR_RANK[estimated as CefrLevel];
  }
  return 0;
}

/** Filters daily plan suggestions by adaptive READING level (when adjusted) or skill Placement ceiling (minimum A2), and optional placement floor. */
export function isCefrEligible(
  lesson: PlannedLesson,
  placement?: Record<string, unknown> | null,
  readingTarget?: AdaptiveReadingTarget | null,
  minimumCefr?: CefrLevel | null,
): boolean {
  const lessonCefr = lesson.grammarTopic?.cefrLevel ?? lesson.unit?.cefrLevel;
  if (!lessonCefr) return true;

  let maxAllowedRank = CEFR_RANK.A2;
  if (lesson.kind === 'READING' && readingTarget) {
    const targetRank = CEFR_RANK[readingTarget.cefrLevel];
    maxAllowedRank = readingTarget.strictCeiling
      ? targetRank
      : Math.max(CEFR_RANK.A2, targetRank);
  } else {
    let userSkillRank = 0;
    if (lesson.kind === 'READING') {
      userSkillRank = skillCefrRank(placement, 'reading');
    } else if (lesson.kind === 'LISTENING') {
      userSkillRank = skillCefrRank(placement, 'listening');
    } else {
      userSkillRank = Math.max(
        skillCefrRank(placement, 'reading'),
        skillCefrRank(placement, 'listening'),
      );
    }
    // Accounts without Placement or estimated at A1 still receive A1-A2 foundation lessons.
    maxAllowedRank = Math.max(CEFR_RANK.A2, userSkillRank);
  }

  const rawMinRank = minimumCefr ? CEFR_RANK[minimumCefr] : 0;
  const effectiveMinRank = rawMinRank > CEFR_RANK.A1 ? Math.min(rawMinRank, maxAllowedRank) : 0;
  const lessonRank = CEFR_RANK[lessonCefr];
  return lessonRank >= effectiveMinRank && lessonRank <= maxAllowedRank;
}

const recentFinished = (attempts: readonly PlannedAttempt[], id: string) => attempts.filter(a => a.lessonId === id && a.status === 'COMPLETED')
  .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0) || b.id.localeCompare(a.id))[0];

export type PlannedAttempt = Pick<
  LearningAttempt,
  'id' | 'lessonId' | 'status' | 'submittedAt' | 'correctCount' | 'totalQuestions'
>;

/** Deterministic baseline; completion is activity, not mastery. */
export function chooseDailyItems(lessons: PlannedLesson[], attempts: readonly PlannedAttempt[], date: string,
  minutes: number, preferred: LearningKind[], previous: PlanItem[] = [], placement?: Record<string, unknown> | null,
  readingTarget?: AdaptiveReadingTarget | null, readingFocus?: ReadingFocusCode, minimumCefr?: CefrLevel | null): PlanItem[] {
  const selected: PlanItem[] = [];
  const seen = new Set<string>();
  const completeToday = new Set(attempts.filter(a => finishedOn(a, date)).map(a => a.lessonId));
  const focusCounts = new Map<string, number>();
  if (readingFocus && readingTarget) {
    for (const lesson of lessons) {
      if (lesson.kind === 'READING' && lesson.unit?.cefrLevel === readingTarget.cefrLevel) {
        focusCounts.set(lesson.id, countFocusQuestions(lesson.content, readingFocus));
      }
    }
  }
  const rankReadingFocus = (candidates: PlannedLesson[]): PlannedLesson[] => {
    if (!focusCounts.size) return candidates;
    const matchingTier = candidates.filter(lesson => focusCounts.has(lesson.id)).sort(
      (a, b) => focusCounts.get(b.id)! - focusCounts.get(a.id)!,
    );
    let index = 0;
    return candidates.map(lesson => focusCounts.has(lesson.id) ? matchingTier[index++] : lesson);
  };
  const add = (lesson: PlannedLesson, reasonCode: string, reason: string, force = false) => {
    if (seen.has(lesson.id)) return false;
    const used = selected.reduce((sum, item) => sum + item.estimatedMinutes, 0);
    if (!force && used + lesson.estimatedMinutes > minutes) return false;
    const old = previous.find(item => item.lessonId === lesson.id);
    if (old && completeToday.has(lesson.id)) {
      selected.push(old);
    } else {
      const focusSkillCode = !completeToday.has(lesson.id) && (focusCounts.get(lesson.id) ?? 0) > 0 ? readingFocus : undefined;
      selected.push({
        id: old?.id ?? randomUUID(), lessonId: lesson.id, title: lesson.title, kind: lesson.kind,
        estimatedMinutes: lesson.estimatedMinutes, reasonCode,
        reason: focusSkillCode ? `Luyện thêm · ${READING_FOCUS_LABELS[focusSkillCode]}` : reason,
        ...(focusSkillCode ? { focusSkillCode } : {}),
      });
    }
    seen.add(lesson.id); return true;
  };
  // Keep already completed snapshots, even if the catalogue was unpublished or ceiling lowered later.
  for (const item of previous) if (completeToday.has(item.lessonId)) { selected.push(item); seen.add(item.lessonId); }
  for (const lesson of lessons) if (completeToday.has(lesson.id)) add(lesson, 'COMPLETED_TODAY', 'Đã hoàn thành hôm nay', true);
  const placementScore = (kind: LearningKind): number => {
    const key = kind === 'READING' ? 'reading' : kind === 'LISTENING' ? 'listening' : null;
    const value = key && placement?.[key] as { correctCount?: number; totalItems?: number } | undefined;
    return value && value.correctCount != null && value.totalItems ? value.correctCount / value.totalItems : 1;
  };
  const targetReadingRank = readingTarget ? CEFR_RANK[readingTarget.cefrLevel] : null;
  const readingDistance = (lesson: PlannedLesson): number => {
    if (lesson.kind !== 'READING' || targetReadingRank == null || !lesson.unit?.cefrLevel) return 0;
    return Math.abs(CEFR_RANK[lesson.unit.cefrLevel] - targetReadingRank);
  };
  // Rank READING strictly by target CEFR distance first, then reassign the group's sortOrder slots
  // so cross-kind sorting maintains strict weak ordering without non-transitive cycles.
  const readingOrderMap = new Map<string, number>();
  if (readingTarget) {
    const readingGroup = lessons
      .filter(l => l.kind === 'READING')
      .sort((a, b) => readingDistance(a) - readingDistance(b) || a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    const slots = [...readingGroup].map(l => l.sortOrder).sort((x, y) => x - y);
    readingGroup.forEach((l, i) => readingOrderMap.set(l.id, slots[i]));
  }
  const mixOrder = (lesson: PlannedLesson): number => readingOrderMap.get(lesson.id) ?? lesson.sortOrder;
  const newReason = (lesson: PlannedLesson): string =>
    lesson.kind === 'READING' && readingTarget && lesson.unit?.cefrLevel === readingTarget.cefrLevel
      ? `Bài mới · đúng mức ${readingTarget.cefrLevel}`
      : 'Bài mới';
  const preferredUnique = [...new Set(preferred)];
  const allKinds: LearningKind[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'];
  const preferredRank = (kind: LearningKind): number => {
    const idx = preferredUnique.indexOf(kind);
    return idx >= 0 ? idx : preferredUnique.length + 1;
  };
  const unpreferredKinds = allKinds
    .filter(k => !preferredUnique.includes(k))
    .sort((a, b) =>
      (['READING', 'LISTENING'].includes(a) && ['READING', 'LISTENING'].includes(b)
        ? placementScore(a) - placementScore(b)
        : 0));
  const interleaveByKinds = (candidates: PlannedLesson[], tierKinds: LearningKind[]): PlannedLesson[] => {
    if (!tierKinds.length || !candidates.length) return [];
    const buckets = new Map<LearningKind, PlannedLesson[]>();
    for (const kind of tierKinds) buckets.set(kind, []);
    for (const lesson of candidates) buckets.get(lesson.kind)?.push(lesson);
    const activeCount = new Map<LearningKind, number>();
    for (const item of selected) {
      if (item.kind === 'SPEAKING' || item.kind === 'WRITING') continue;
      activeCount.set(item.kind, (activeCount.get(item.kind) ?? 0) + 1);
    }
    const result: PlannedLesson[] = [];
    let round = 0;
    let remaining = tierKinds.reduce((sum, k) => sum + (buckets.get(k)?.length ?? 0), 0);
    while (remaining > 0) {
      for (const kind of tierKinds) {
        const bucket = buckets.get(kind)!;
        if (!bucket.length) continue;
        if ((activeCount.get(kind) ?? 0) > round) continue;
        result.push(bucket.shift()!);
        remaining--;
      }
      round++;
    }
    return result;
  };

  const ordered = [...lessons].sort((a, b) =>
    preferredRank(a.kind) - preferredRank(b.kind)
    || (['READING', 'LISTENING'].includes(a.kind) && ['READING', 'LISTENING'].includes(b.kind) ? placementScore(a.kind) - placementScore(b.kind) : 0)
    || mixOrder(a) - mixOrder(b)
    || a.code.localeCompare(b.code));
  const eligible = ordered.filter(l => isCefrEligible(l, placement, readingTarget, minimumCefr));
  const rawFresh = rankReadingFocus(eligible.filter(l => !recentFinished(attempts, l.id) && !seen.has(l.id)));
  const onTargetFresh = rawFresh.filter(l => readingDistance(l) === 0);
  const offTargetFresh = rawFresh.filter(l => readingDistance(l) > 0);
  const fresh = [
    ...interleaveByKinds(onTargetFresh, preferredUnique),
    ...interleaveByKinds(offTargetFresh, preferredUnique),
    ...interleaveByKinds(onTargetFresh, unpreferredKinds),
    ...interleaveByKinds(offTargetFresh, unpreferredKinds),
  ];
  // Reserve an opportunity to progress before offering a review.
  for (const lesson of fresh) if (add(lesson, 'NEW', newReason(lesson))) break;
  const review = eligible.filter(l => {
    const latest = recentFinished(attempts, l.id);
    return latest && latest.correctCount! / latest.totalQuestions < .8 && !seen.has(l.id) && !completeToday.has(l.id);
  }).sort((a, b) => {
    const x = recentFinished(attempts, a.id)!, y = recentFinished(attempts, b.id)!;
    return preferredRank(a.kind) - preferredRank(b.kind)
      || x.correctCount! / x.totalQuestions - y.correctCount! / y.totalQuestions
      || x.submittedAt!.getTime() - y.submittedAt!.getTime()
      || mixOrder(a) - mixOrder(b);
  });
  let rotationFallback: PlannedLesson | undefined;
  if (fresh.length) {
    for (const lesson of rankReadingFocus(review)) {
      const result = recentFinished(attempts, lesson.id)!;
      if (add(lesson, 'REVIEW', `Kết quả gần nhất ${result.correctCount}/${result.totalQuestions}`)) break;
    }
    for (const lesson of fresh) add(lesson, 'NEW', newReason(lesson));
  } else {
    const pool = eligible.filter(l => !seen.has(l.id) && !completeToday.has(l.id));
    const practicedAt = (lesson: PlannedLesson): number => recentFinished(attempts, lesson.id)?.submittedAt?.getTime() ?? 0;
    // Prioritize target-tier READING within READING's own practicedAt slots, using oldest practice to break ties within a tier.
    const rotationTimeMap = new Map<string, number>();
    const rotationSubRank = new Map<string, number>();
    if (readingTarget) {
      const readingPool = pool
        .filter(l => l.kind === 'READING')
        .sort((a, b) =>
          readingDistance(a) - readingDistance(b)
          || practicedAt(a) - practicedAt(b)
          || mixOrder(a) - mixOrder(b)
          || a.code.localeCompare(b.code));
      const timeSlots = [...readingPool].map(practicedAt).sort((x, y) => x - y);
      readingPool.forEach((l, i) => {
        rotationTimeMap.set(l.id, timeSlots[i]);
        rotationSubRank.set(l.id, i);
      });
    }
    const rotationTime = (lesson: PlannedLesson): number => rotationTimeMap.get(lesson.id) ?? practicedAt(lesson);
    const rotation = rankReadingFocus(pool.sort((a, b) =>
      Number(!preferred.includes(a.kind)) - Number(!preferred.includes(b.kind))
      || rotationTime(a) - rotationTime(b)
      || (rotationSubRank.get(a.id) ?? 0) - (rotationSubRank.get(b.id) ?? 0)
      || mixOrder(a) - mixOrder(b)
      || a.code.localeCompare(b.code)));
    rotationFallback = rotation[0];
    for (const lesson of rotation) add(lesson, 'ROTATION', 'Luyện lại bài lâu chưa học');
  }
  if (!selected.length) {
    const candidate = fresh[0] ?? rotationFallback ?? eligible[0];
    if (candidate) {
      add(
        candidate,
        fresh.includes(candidate) ? 'NEW' : 'ROTATION',
        fresh.includes(candidate) ? newReason(candidate) : 'Luyện lại bài lâu chưa học',
        true,
      );
    }
  }
  return selected;
}

const WRITING_EXTERNAL_TITLES: Record<string, string> = {
  'cefr-write-a2-001': 'Forgotten Jacket at a Hotel',
  'cefr-write-a2-002': "Missing Tomorrow's English Class",
  'cefr-write-b1-001': 'Hometown Travel Advice for Alex',
  'cefr-write-b1-002': 'Feedback on Birthday Dinner Service',
  'cefr-write-b2-001': 'Working from Home vs. Office',
  'cefr-write-b2-002': 'Free University Tuition Debate',
  'cefr-write-b2-003': 'Smartphones and Personal Relationships',
};

export function deriveWritingTitle(item: PlannedWritingItem): string {
  const groupTitle = item.groupTitle?.trim();
  if (groupTitle) return groupTitle;
  if (item.externalId && WRITING_EXTERNAL_TITLES[item.externalId]) {
    return WRITING_EXTERNAL_TITLES[item.externalId];
  }
  const firstSentence = item.prompt.split(/[.!?]/)[0]?.trim() ?? item.prompt.trim();
  if (firstSentence.length <= 56) return firstSentence;
  const sliced = firstSentence.slice(0, 56);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${(lastSpace > 24 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}

function writingGenreReason(item: PlannedWritingItem): string {
  const code = item.skillCode.toLowerCase();
  if (code.includes('letter') || code.includes('email')) return 'Thư / Email';
  if (code.includes('essay')) return 'Bài luận';
  return 'Bài tập viết';
}

/**
 * Builds the live daily roadmap so EVERY user-selected priority skill (1..6, including SPEAKING & WRITING)
 * gets 1 concrete step in exact priority order without an earlier 10-minute lesson truncating
 * downstream skills, then fills any remaining minute budget round-robin.
 */
export function buildDailyRoadmapItems(
  lessons: PlannedLesson[],
  attempts: readonly PlannedAttempt[],
  date: string,
  minutes: number,
  preferredSkills: PreferredSkill[],
  previous: PlanItem[] = [],
  placement?: Record<string, unknown> | null,
  readingTarget?: AdaptiveReadingTarget | null,
  readingFocus?: ReadingFocusCode,
  speakingTopics: PlannedSpeakingTopic[] = [],
  completedSpeakingIdsToday: ReadonlySet<string> = new Set(),
  practicedSpeakingAt: ReadonlyMap<string, number> = new Map(),
  writingItems: PlannedWritingItem[] = [],
  completedWritingIdsToday: ReadonlySet<string> = new Set(),
  practicedWritingAt: ReadonlyMap<string, number> = new Map(),
  minimumCefr?: CefrLevel | null,
): PlanItem[] {
  const normalizedPrevious = dedupePlanItems(previous);
  const uniqueSkills = [...new Set(preferredSkills)];
  const selected: PlanItem[] = [];
  const seenIds = new Set<string>();
  const completeLessonToday = new Set(attempts.filter(a => finishedOn(a, date)).map(a => a.lessonId));

  const focusCounts = new Map<string, number>();
  if (readingFocus && readingTarget) {
    for (const lesson of lessons) {
      if (lesson.kind === 'READING' && lesson.unit?.cefrLevel === readingTarget.cefrLevel) {
        focusCounts.set(lesson.id, countFocusQuestions(lesson.content, readingFocus));
      }
    }
  }
  const rankReadingFocus = (candidates: PlannedLesson[]): PlannedLesson[] => {
    if (!focusCounts.size) return candidates;
    const matchingTier = candidates
      .filter(lesson => focusCounts.has(lesson.id))
      .sort((a, b) => focusCounts.get(b.id)! - focusCounts.get(a.id)!);
    let idx = 0;
    return candidates.map(lesson => (focusCounts.has(lesson.id) ? matchingTier[idx++] : lesson));
  };

  const targetReadingRank = readingTarget ? CEFR_RANK[readingTarget.cefrLevel] : null;
  const readingDistance = (lesson: PlannedLesson): number => {
    if (lesson.kind !== 'READING' || targetReadingRank == null || !lesson.unit?.cefrLevel) return 0;
    return Math.abs(CEFR_RANK[lesson.unit.cefrLevel] - targetReadingRank);
  };

  const makeLessonPlanItem = (lesson: PlannedLesson, reasonCode: string, reason: string): PlanItem => {
    const old = normalizedPrevious.find(item => item.lessonId === lesson.id);
    if (old && completeLessonToday.has(lesson.id)) return old;
    const focusSkillCode =
      !completeLessonToday.has(lesson.id) && (focusCounts.get(lesson.id) ?? 0) > 0
        ? readingFocus
        : undefined;
    return {
      id: old?.id ?? randomUUID(),
      lessonId: lesson.id,
      title: lesson.title,
      kind: lesson.kind,
      estimatedMinutes: lesson.estimatedMinutes,
      reasonCode,
      reason: focusSkillCode ? `Luyện thêm · ${READING_FOCUS_LABELS[focusSkillCode]}` : reason,
      ...(focusSkillCode ? { focusSkillCode } : {}),
    };
  };

  const makeSpeakingPlanItem = (
    topic: PlannedSpeakingTopic,
    reasonCode: string,
    reason: string,
  ): PlanItem => {
    const old = normalizedPrevious.find(item => item.lessonId === topic.id && item.kind === 'SPEAKING');
    if (old && completedSpeakingIdsToday.has(topic.id)) return old;
    return {
      id: old?.id ?? randomUUID(),
      lessonId: topic.id,
      title: topic.title.trim() || topic.text.trim(),
      kind: 'SPEAKING',
      estimatedMinutes: 5,
      reasonCode,
      reason,
    };
  };

  const isWritingCompletedToday = (w: PlannedWritingItem): boolean =>
    completedWritingIdsToday.has(w.id) ||
    (w.externalId != null && completedWritingIdsToday.has(w.externalId));

  const writingPracticedTimestamp = (w: PlannedWritingItem): number | undefined => {
    const byId = practicedWritingAt.get(w.id);
    const byExt = w.externalId ? practicedWritingAt.get(w.externalId) : undefined;
    if (byId !== undefined && byExt !== undefined) return Math.max(byId, byExt);
    return byId ?? byExt;
  };

  const makeWritingPlanItem = (
    item: PlannedWritingItem,
    reasonCode: string,
    reason: string,
  ): PlanItem => {
    const old = normalizedPrevious.find(p => p.lessonId === item.id && p.kind === 'WRITING');
    if (old && isWritingCompletedToday(item)) return old;
    const estimatedMinutes =
      item.cefrLevel === 'A1' || item.cefrLevel === 'A2' ? 8 : 10;
    return {
      id: old?.id ?? randomUUID(),
      lessonId: item.id,
      title: deriveWritingTitle(item),
      kind: 'WRITING',
      estimatedMinutes,
      reasonCode,
      reason,
      cefrLevel: item.cefrLevel,
    };
  };

  // Keep all snapshots completed today first (even if unpublished or skill removed from preferences)
  for (const prev of normalizedPrevious) {
    const isDone =
      prev.kind === 'SPEAKING'
        ? completedSpeakingIdsToday.has(prev.lessonId)
        : prev.kind === 'WRITING'
          ? completedWritingIdsToday.has(prev.lessonId)
          : completeLessonToday.has(prev.lessonId);
    if (isDone && !seenIds.has(prev.lessonId)) {
      seenIds.add(prev.lessonId);
      selected.push(prev);
    }
  }
  for (const lesson of lessons) {
    if (completeLessonToday.has(lesson.id) && !seenIds.has(lesson.id)) {
      seenIds.add(lesson.id);
      selected.push(makeLessonPlanItem(lesson, 'COMPLETED_TODAY', 'Đã hoàn thành hôm nay'));
    }
  }
  for (const topic of speakingTopics) {
    if (completedSpeakingIdsToday.has(topic.id) && !seenIds.has(topic.id)) {
      seenIds.add(topic.id);
      selected.push(makeSpeakingPlanItem(topic, 'COMPLETED_TODAY', 'Đã hoàn thành hôm nay'));
    }
  }
  for (const w of writingItems) {
    if (isWritingCompletedToday(w) && !seenIds.has(w.id)) {
      seenIds.add(w.id);
      selected.push(makeWritingPlanItem(w, 'COMPLETED_TODAY', 'Đã hoàn thành hôm nay'));
    }
  }

  // Build per-skill candidate queues
  const candidatesBySkill = new Map<PreferredSkill, PlanItem[]>();
  const lessonKinds: LearningKind[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'];
  for (const kind of lessonKinds) {
    const kindLessons = lessons
      .filter(l => l.kind === kind)
      .sort((a, b) => readingDistance(a) - readingDistance(b) || a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

    const doneToday = kindLessons
      .filter(l => completeLessonToday.has(l.id) && !seenIds.has(l.id))
      .map(l => makeLessonPlanItem(l, 'COMPLETED_TODAY', 'Đã hoàn thành hôm nay'));

    const eligible = kindLessons.filter(
      l => !completeLessonToday.has(l.id) && isCefrEligible(l, placement, readingTarget, minimumCefr),
    );
    const unseen = rankReadingFocus(eligible.filter(l => !recentFinished(attempts, l.id)));
    const onTargetNew = unseen
      .filter(l => readingDistance(l) === 0)
      .map(l =>
        makeLessonPlanItem(
          l,
          'NEW',
          l.kind === 'READING' && readingTarget && l.unit?.cefrLevel === readingTarget.cefrLevel
            ? `Bài mới · đúng mức ${readingTarget.cefrLevel}`
            : 'Bài mới',
        ),
      );
    const weakReview = rankReadingFocus(
      eligible
        .filter(l => {
          const latest = recentFinished(attempts, l.id);
          return latest != null && latest.correctCount! / latest.totalQuestions < 0.8;
        })
        .sort((a, b) => {
          const x = recentFinished(attempts, a.id)!;
          const y = recentFinished(attempts, b.id)!;
          return (
            x.correctCount! / x.totalQuestions - y.correctCount! / y.totalQuestions ||
            x.submittedAt!.getTime() - y.submittedAt!.getTime() ||
            a.sortOrder - b.sortOrder
          );
        }),
    ).map(l => {
      const res = recentFinished(attempts, l.id)!;
      return makeLessonPlanItem(l, 'REVIEW', `Kết quả gần nhất ${res.correctCount}/${res.totalQuestions}`);
    });
    const offTargetNew = unseen
      .filter(l => readingDistance(l) > 0)
      .map(l => makeLessonPlanItem(l, 'NEW', 'Bài mới'));
    const rotation = rankReadingFocus(
      eligible
        .filter(l => {
          const latest = recentFinished(attempts, l.id);
          return latest != null && latest.correctCount! / latest.totalQuestions >= 0.8;
        })
        .sort(
          (a, b) =>
            readingDistance(a) - readingDistance(b) ||
            (recentFinished(attempts, a.id)?.submittedAt?.getTime() ?? 0) -
              (recentFinished(attempts, b.id)?.submittedAt?.getTime() ?? 0) ||
            a.sortOrder - b.sortOrder ||
            a.code.localeCompare(b.code),
        ),
    ).map(l => makeLessonPlanItem(l, 'ROTATION', 'Luyện lại bài lâu chưa học'));

    // Also include low-score attempts in rotation fallback if unseen is empty and weakReview was already consumed
    const deduped: PlanItem[] = [];
    const seenInKind = new Set<string>();
    for (const item of [...doneToday, ...onTargetNew, ...weakReview, ...offTargetNew, ...rotation]) {
      if (!seenInKind.has(item.lessonId)) {
        seenInKind.add(item.lessonId);
        deduped.push(item);
      }
    }
    candidatesBySkill.set(kind, deduped);
  }

  if (speakingTopics.length > 0) {
    const orderedTopics = [...speakingTopics].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    const doneSpeaking = orderedTopics
      .filter(t => completedSpeakingIdsToday.has(t.id) && !seenIds.has(t.id))
      .map(t => makeSpeakingPlanItem(t, 'COMPLETED_TODAY', 'Đã hoàn thành hôm nay'));
    const freshSpeaking = orderedTopics
      .filter(t => !completedSpeakingIdsToday.has(t.id) && !practicedSpeakingAt.has(t.id))
      .map(t => makeSpeakingPlanItem(t, 'NEW', 'Chủ đề luyện nói'));
    const rotateSpeaking = orderedTopics
      .filter(t => !completedSpeakingIdsToday.has(t.id) && practicedSpeakingAt.has(t.id))
      .sort((a, b) => (practicedSpeakingAt.get(a.id) ?? 0) - (practicedSpeakingAt.get(b.id) ?? 0) || a.sortOrder - b.sortOrder)
      .map(t => makeSpeakingPlanItem(t, 'ROTATION', 'Luyện nói lại chủ đề'));
    candidatesBySkill.set('SPEAKING', [...doneSpeaking, ...freshSpeaking, ...rotateSpeaking]);
  } else {
    candidatesBySkill.set('SPEAKING', []);
  }

  if (writingItems.length > 0) {
    const maxWritingRank = Math.max(
      CEFR_RANK.A2,
      skillCefrRank(placement, 'reading'),
      skillCefrRank(placement, 'listening'),
      readingTarget ? CEFR_RANK[readingTarget.cefrLevel] : 0,
    );
    const orderedWriting = [...writingItems].sort(
      (a, b) =>
        CEFR_RANK[a.cefrLevel] - CEFR_RANK[b.cefrLevel] ||
        (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) ||
        (a.externalId ?? a.id).localeCompare(b.externalId ?? b.id),
    );
    const eligibleWriting = orderedWriting.filter(w => CEFR_RANK[w.cefrLevel] <= maxWritingRank);
    const poolWriting = eligibleWriting.length > 0 ? eligibleWriting : orderedWriting;
    const doneWriting = poolWriting
      .filter(w => isWritingCompletedToday(w) && !seenIds.has(w.id))
      .map(w => makeWritingPlanItem(w, 'COMPLETED_TODAY', 'Đã hoàn thành hôm nay'));
    const freshWriting = poolWriting
      .filter(w => !isWritingCompletedToday(w) && writingPracticedTimestamp(w) === undefined)
      .map(w => makeWritingPlanItem(w, 'NEW', writingGenreReason(w)));
    const rotateWriting = poolWriting
      .filter(w => !isWritingCompletedToday(w) && writingPracticedTimestamp(w) !== undefined)
      .sort(
        (a, b) =>
          (writingPracticedTimestamp(a) ?? 0) - (writingPracticedTimestamp(b) ?? 0) ||
          CEFR_RANK[a.cefrLevel] - CEFR_RANK[b.cefrLevel],
      )
      .map(w => makeWritingPlanItem(w, 'ROTATION', 'Luyện viết lại đề bài'));
    candidatesBySkill.set('WRITING', [...doneWriting, ...freshWriting, ...rotateWriting]);
  } else {
    candidatesBySkill.set('WRITING', []);
  }

  // Phase 1: Give each selected priority skill up to 1 step in exact order 1 -> k within dailyGoalMinutes,
  // surfacing at most one low-score (<80%) REVIEW after at least one NEW item has been placed.
  let usedMinutes = selected.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  let hasNewItem = selected.some(item => item.reasonCode === 'NEW');
  let reviewCount = selected.filter(item => item.reasonCode === 'REVIEW').length;

  const pickNextForSkill = (skill: PreferredSkill): PlanItem | null => {
    const queue = candidatesBySkill.get(skill) ?? [];
    if (hasNewItem && reviewCount < 1) {
      const weakIdx = queue.findIndex(
        item =>
          item.reasonCode === 'REVIEW' &&
          !seenIds.has(item.lessonId) &&
          usedMinutes + item.estimatedMinutes <= minutes,
      );
      if (weakIdx >= 0) {
        const [weak] = queue.splice(weakIdx, 1);
        seenIds.add(weak.lessonId);
        selected.push(weak);
        usedMinutes += weak.estimatedMinutes;
        reviewCount += 1;
        return weak;
      }
    }
    const nextIdx = queue.findIndex(
      item =>
        !seenIds.has(item.lessonId) &&
        usedMinutes + item.estimatedMinutes <= minutes &&
        (item.reasonCode !== 'REVIEW' || reviewCount < 1 || !queue.some(other => other.reasonCode !== 'REVIEW' && !seenIds.has(other.lessonId) && usedMinutes + other.estimatedMinutes <= minutes)),
    );
    if (nextIdx < 0) return null;
    const [picked] = queue.splice(nextIdx, 1);
    seenIds.add(picked.lessonId);
    selected.push(picked);
    usedMinutes += picked.estimatedMinutes;
    if (picked.reasonCode === 'NEW') hasNewItem = true;
    if (picked.reasonCode === 'REVIEW') reviewCount += 1;
    return picked;
  };

  for (const skill of uniqueSkills) {
    if (selected.some(item => item.kind === skill)) continue;
    pickNextForSkill(skill);
  }

  // Phase 2: If total estimated minutes is still below dailyGoalMinutes, round-robin remaining items
  let addedInPass = true;
  while (usedMinutes < minutes && addedInPass) {
    addedInPass = false;
    for (const skill of uniqueSkills) {
      if (pickNextForSkill(skill)) {
        addedInPass = true;
      }
    }
  }

  // Fallback: never return an empty plan when eligible content exists even if the shortest item exceeds dailyGoalMinutes
  if (selected.length === 0) {
    for (const skill of uniqueSkills) {
      const queue = candidatesBySkill.get(skill) ?? [];
      const nextIdx = queue.findIndex(item => !seenIds.has(item.lessonId));
      if (nextIdx >= 0) {
        const [next] = queue.splice(nextIdx, 1);
        seenIds.add(next.lessonId);
        selected.push(next);
        break;
      }
    }
  }

  return selected;
}
