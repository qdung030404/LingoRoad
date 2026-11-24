import { CefrLevel, LearningAttempt, LearningKind, LearningLesson, LearningUnit } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AdaptiveReadingTarget } from './skill-level.policy';
import { countFocusQuestions, READING_FOCUS_LABELS, ReadingFocusCode } from './reading-focus.policy';

export const LEARNING_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const CURRENT_PLAN_POLICY_VERSION = 'adaptive-v2';
export const DAY_MS = 86400000;

export type SkillLevelChange = { kind: LearningKind; from: CefrLevel; to: CefrLevel; direction: 'UP' | 'DOWN' };
export type PlanItem = {
  id: string; lessonId: string; title: string; kind: LearningKind; estimatedMinutes: number;
  reasonCode: string; reason: string; focusSkillCode?: ReadingFocusCode;
};
export type PlannedLesson = LearningLesson & {
  unit?: { cefrLevel: CefrLevel } | null;
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

/** Filters daily plan suggestions by adaptive READING level (when adjusted) or skill Placement ceiling (minimum A2). */
export function isCefrEligible(
  lesson: PlannedLesson,
  placement?: Record<string, unknown> | null,
  readingTarget?: AdaptiveReadingTarget | null,
): boolean {
  const lessonCefr = lesson.unit?.cefrLevel;
  if (!lessonCefr) return true;

  if (lesson.kind === 'READING' && readingTarget) {
    const targetRank = CEFR_RANK[readingTarget.cefrLevel];
    const maxAllowedRank = readingTarget.strictCeiling
      ? targetRank
      : Math.max(CEFR_RANK.A2, targetRank);
    return CEFR_RANK[lessonCefr] <= maxAllowedRank;
  }

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
  const maxAllowedRank = Math.max(CEFR_RANK.A2, userSkillRank);
  return CEFR_RANK[lessonCefr] <= maxAllowedRank;
}

export type ProgressUnitStatus = 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
export type ProgressUnit = {
  id: string;
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
  totalLessons: number;
  completedLessonCount: number;
  status: ProgressUnitStatus;
};
export type ProgressScoreStats = {
  averageScore: number | null;
  completedAttemptCount: number;
  currentWeekAverage: number | null;
  previousWeekAverage: number | null;
  deltaPercent: number | null;
};

export const learningDate = (now: Date): string => new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
export const learningDayStart = (date: string): Date => new Date(`${date}T00:00:00+07:00`);
export const finishedOn = (a: Pick<LearningAttempt, 'status' | 'submittedAt'>, date: string): boolean =>
  a.status === 'COMPLETED' && a.submittedAt != null && learningDate(a.submittedAt) === date;
const recentFinished = (attempts: LearningAttempt[], id: string) => attempts.filter(a => a.lessonId === id && a.status === 'COMPLETED')
  .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0) || b.id.localeCompare(a.id))[0];

/** Maps published lessons and distinct completed lesson IDs onto ordered curriculum stages. */
export function buildProgressUnits(
  units: Pick<LearningUnit, 'id' | 'code' | 'cefrLevel' | 'orderIndex' | 'title' | 'description'>[],
  lessons: Pick<LearningLesson, 'id' | 'unitId'>[],
  completedLessonIds: Set<string>,
): ProgressUnit[] {
  const byUnit = new Map<string, string[]>();
  for (const lesson of lessons) {
    if (!lesson.unitId) continue;
    const list = byUnit.get(lesson.unitId) ?? [];
    list.push(lesson.id);
    byUnit.set(lesson.unitId, list);
  }
  let assignedActive = false;
  return units.map((unit) => {
    const lessonIds = byUnit.get(unit.id) ?? [];
    const totalLessons = lessonIds.length;
    const completedLessonCount = lessonIds.filter((id) => completedLessonIds.has(id)).length;
    const isCompleted = totalLessons > 0 && completedLessonCount >= totalLessons;
    let status: ProgressUnitStatus = 'UPCOMING';
    if (isCompleted) {
      status = 'COMPLETED';
    } else if (!assignedActive && totalLessons > 0) {
      status = 'IN_PROGRESS';
      assignedActive = true;
    }
    return {
      id: unit.id,
      code: unit.code,
      cefrLevel: unit.cefrLevel,
      orderIndex: unit.orderIndex,
      title: unit.title,
      description: unit.description,
      totalLessons,
      completedLessonCount,
      status,
    };
  });
}

/** Computes 0-100 practice attempt average and 7-day Vietnam-timezone trend; never alters CEFR. */
export function computeScoreStats(attempts: LearningAttempt[], now: Date): ProgressScoreStats {
  const valid = attempts.filter(
    (a) => a.status === 'COMPLETED' && a.submittedAt != null && a.correctCount != null && a.totalQuestions > 0,
  );
  const average = (rows: LearningAttempt[]): number | null => {
    if (!rows.length) return null;
    const total = rows.reduce((sum, a) => sum + (a.correctCount! / a.totalQuestions) * 100, 0);
    return Math.round(total / rows.length);
  };
  const todayStart = learningDayStart(learningDate(now));
  const currentWeekStart = new Date(todayStart.getTime() - 6 * DAY_MS);
  const previousWeekStart = new Date(todayStart.getTime() - 13 * DAY_MS);
  const currentWeekAverage = average(valid.filter((a) => a.submittedAt! >= currentWeekStart && a.submittedAt! <= now));
  const previousWeekAverage = average(
    valid.filter((a) => a.submittedAt! >= previousWeekStart && a.submittedAt! < currentWeekStart),
  );
  return {
    averageScore: average(valid),
    completedAttemptCount: valid.length,
    currentWeekAverage,
    previousWeekAverage,
    deltaPercent:
      currentWeekAverage != null && previousWeekAverage != null
        ? currentWeekAverage - previousWeekAverage
        : null,
  };
}

/** Deterministic baseline; completion is activity, not mastery. */
export function chooseDailyItems(lessons: PlannedLesson[], attempts: LearningAttempt[], date: string,
  minutes: number, preferred: LearningKind[], previous: PlanItem[] = [], placement?: Record<string, unknown> | null,
  readingTarget?: AdaptiveReadingTarget | null, readingFocus?: ReadingFocusCode): PlanItem[] {
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
  const ordered = [...lessons].sort((a, b) => Number(!preferred.includes(a.kind)) - Number(!preferred.includes(b.kind))
    || (['READING', 'LISTENING'].includes(a.kind) && ['READING', 'LISTENING'].includes(b.kind) ? placementScore(a.kind) - placementScore(b.kind) : 0)
    || mixOrder(a) - mixOrder(b)
    || a.code.localeCompare(b.code));
  const eligible = ordered.filter(l => isCefrEligible(l, placement, readingTarget));
  const fresh = rankReadingFocus(eligible.filter(l => !recentFinished(attempts, l.id) && !seen.has(l.id)));
  // Reserve an opportunity to progress before offering a review.
  for (const lesson of fresh) if (add(lesson, 'NEW', newReason(lesson))) break;
  const review = eligible.filter(l => {
    const latest = recentFinished(attempts, l.id);
    return latest && latest.correctCount! / latest.totalQuestions < .8 && !seen.has(l.id) && !completeToday.has(l.id);
  }).sort((a, b) => {
    const x = recentFinished(attempts, a.id)!, y = recentFinished(attempts, b.id)!;
    return Number(!preferred.includes(a.kind)) - Number(!preferred.includes(b.kind))
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
