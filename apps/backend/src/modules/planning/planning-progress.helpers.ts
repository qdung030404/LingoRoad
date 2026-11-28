import { CefrLevel, LearningAttempt, LearningKind, LearningLesson, LearningUnit } from '@prisma/client';

export const LEARNING_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const DAY_MS = 86400000;
export const MILESTONE_CEFR_ORDER: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type ProgressUnitStatus = 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
export type ProgressMilestone = {
  cefrLevel: CefrLevel;
  totalLessons: number;
  completedLessonCount: number;
  status: ProgressUnitStatus;
};
export type MilestoneLessonInput = Pick<LearningLesson, 'id' | 'unitId' | 'kind' | 'grammarTopicId'> & {
  grammarTopic?: { cefrLevel: CefrLevel } | null;
};
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
export type LearningWeekWindow = { date: string; from: Date; to: Date };
export type LearningDaySummary = {
  date: string;
  dailyGoalMinutes: number | null;
  activeSeconds: number;
  goalMet: boolean;
  completedLessonCount: number;
  completedAttemptCount: number;
  hasActivity: boolean;
  timeMeasured: boolean;
};

export const learningDate = (now: Date): string =>
  new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);

export const learningDayStart = (date: string): Date => new Date(`${date}T00:00:00+07:00`);

export const finishedOn = (
  a: Pick<LearningAttempt, 'status' | 'submittedAt'>,
  date: string,
): boolean => a.status === 'COMPLETED' && a.submittedAt != null && learningDate(a.submittedAt) === date;

/** Resolves the grammar topic code for a grammar lesson, preserving legacy fallback mapping. */
export function resolveGrammarTopicCode(
  kind: LearningKind,
  code: string,
  grammarTopicCode?: string | null,
): string | null {
  if (kind !== 'GRAMMAR') return null;
  return grammarTopicCode ?? (code === 'grammar-pronouns-to-be' ? 'grammar.pronouns' : null);
}

/** Builds the 7 Vietnam-timezone day windows ending on todayDate. */
export function buildLearningWeekWindows(now: Date, todayDate: string): LearningWeekWindow[] {
  const start = learningDayStart(todayDate);
  return Array.from({ length: 7 }, (_, i) => {
    const from = new Date(start.getTime() - (6 - i) * DAY_MS);
    return {
      date: learningDate(from),
      from,
      to: new Date(Math.min(from.getTime() + DAY_MS, now.getTime())),
    };
  });
}

/** Summarizes 7-day learning activity, goals, and completed lessons for home/progress views. */
export function buildWeekDaySummaries(
  week: readonly LearningWeekWindow[],
  todayDate: string,
  defaultDailyGoalMinutes: number,
  goalByDate: ReadonlyMap<string, number>,
  completedAttempts: readonly { lessonId: string; submittedAt: Date | null }[],
  secondsByWindowIndex: ReadonlyMap<number, number>,
  firstAnchorAt: Date | null,
): LearningDaySummary[] {
  const firstActivityDate = firstAnchorAt ? learningDate(firstAnchorAt) : null;
  return week.map((day, index) => {
    const completed = completedAttempts.filter(
      (a) => a.submittedAt != null && learningDate(a.submittedAt) === day.date,
    );
    const activeSeconds = secondsByWindowIndex.get(index) ?? 0;
    const dailyGoalMinutes =
      goalByDate.get(day.date) ?? (day.date === todayDate ? defaultDailyGoalMinutes : null);
    return {
      date: day.date,
      dailyGoalMinutes,
      activeSeconds,
      goalMet: dailyGoalMinutes != null && activeSeconds >= dailyGoalMinutes * 60,
      completedLessonCount: new Set(completed.map((a) => a.lessonId)).size,
      completedAttemptCount: completed.length,
      hasActivity: activeSeconds > 0 || completed.length > 0,
      timeMeasured: firstActivityDate != null && firstActivityDate <= day.date,
    };
  });
}

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

/** Aggregates server-synced objective lessons (linked GRAMMAR, READING, LISTENING) into A1..C2 milestones. */
export function buildCefrMilestones(
  lessons: readonly MilestoneLessonInput[],
  units: readonly Pick<LearningUnit, 'id' | 'cefrLevel'>[],
  completedLessonIds: ReadonlySet<string>,
  startCefr?: CefrLevel | null,
): ProgressMilestone[] {
  const unitLevelById = new Map<string, CefrLevel>(units.map((u) => [u.id, u.cefrLevel]));
  const countsByLevel = new Map<CefrLevel, { total: number; completed: number }>(
    MILESTONE_CEFR_ORDER.map((level) => [level, { total: 0, completed: 0 }]),
  );

  for (const lesson of lessons) {
    let level: CefrLevel | undefined;
    if (lesson.kind === 'GRAMMAR' && lesson.grammarTopicId != null) {
      level = lesson.grammarTopic?.cefrLevel ?? unitLevelById.get(lesson.unitId ?? '');
    } else if (lesson.kind === 'READING' || lesson.kind === 'LISTENING') {
      level = unitLevelById.get(lesson.unitId ?? '');
    }
    if (!level) continue;
    const bucket = countsByLevel.get(level);
    if (!bucket) continue;
    bucket.total += 1;
    if (completedLessonIds.has(lesson.id)) {
      bucket.completed += 1;
    }
  }

  const startRank = Math.max(0, MILESTONE_CEFR_ORDER.indexOf(startCefr ?? 'A1'));
  const hasLessonsAtOrAboveStart = MILESTONE_CEFR_ORDER.some(
    (level, rank) => rank >= startRank && countsByLevel.get(level)!.total > 0,
  );
  let assignedActive = false;

  return MILESTONE_CEFR_ORDER.map((cefrLevel, rank) => {
    const { total: totalLessons, completed: completedLessonCount } = countsByLevel.get(cefrLevel)!;
    let status: ProgressUnitStatus = 'UPCOMING';
    if (totalLessons > 0 && completedLessonCount >= totalLessons) {
      status = 'COMPLETED';
    } else if (!hasLessonsAtOrAboveStart) {
      if (rank === startRank) {
        status = 'IN_PROGRESS';
        assignedActive = true;
      }
    } else if (!assignedActive && rank >= startRank && totalLessons > 0) {
      status = 'IN_PROGRESS';
      assignedActive = true;
    }
    return {
      cefrLevel,
      totalLessons,
      completedLessonCount,
      status,
    };
  });
}

/** Computes 0-100 practice attempt average and 7-day Vietnam-timezone trend; never alters CEFR. */
export function computeScoreStats(
  attempts: Pick<LearningAttempt, 'status' | 'submittedAt' | 'correctCount' | 'totalQuestions'>[],
  now: Date,
): ProgressScoreStats {
  const valid = attempts.filter(
    (a) => a.status === 'COMPLETED' && a.submittedAt != null && a.correctCount != null && a.totalQuestions > 0,
  );
  const average = (rows: Pick<LearningAttempt, 'correctCount' | 'totalQuestions'>[]): number | null => {
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
