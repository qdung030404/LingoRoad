import { CefrLevel, LearningDayPlan, LearningKind, LearningSkillLevel, Prisma, UserProfile } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { queryHomeActiveSeconds } from './planning-activity.helpers';
import type { buildPlanDtoHelper } from './planning-plan-builder.helpers';
import type { PreferredSkill } from './planning.dto';
import {
  buildCefrMilestones,
  buildLearningWeekWindows,
  buildProgressUnits,
  buildWeekDaySummaries,
  CURRENT_PLAN_POLICY_VERSION,
  DAY_MS,
  learningDate,
  learningDayStart,
  MILESTONE_CEFR_ORDER,
  MilestoneLessonInput,
  resolveGrammarTopicCode,
} from './planning.helpers';
import { readPreferredSkillsForUser } from './planning-receipts.helpers';
import { initialReadingLevel } from './skill-level.policy';

export async function fetchHomeLessonHelper(
  prisma: PrismaService,
  userId: string,
  lessonId: string | null,
  useFallback = false,
  minimumCefr?: CefrLevel | null,
) {
  if (!lessonId && !useFallback) return null;
  const minRank = minimumCefr ? MILESTONE_CEFR_ORDER.indexOf(minimumCefr) : -1;
  const allowedLevels = minRank > 0 ? MILESTONE_CEFR_ORDER.slice(minRank) : null;
  const row = await prisma.learningLesson.findFirst({
    where: {
      published: true,
      ...(lessonId
        ? { id: lessonId }
        : {
          attempts: { none: { userId, status: 'COMPLETED' as const } },
          ...(allowedLevels
            ? {
              OR: [
                { grammarTopic: { cefrLevel: { in: [...allowedLevels] } } },
                {
                  grammarTopicId: null,
                  unit: { cefrLevel: { in: [...allowedLevels] } },
                },
              ],
            }
            : {}),
        }),
    },
    select: {
      id: true,
      code: true,
      kind: true,
      title: true,
      description: true,
      estimatedMinutes: true,
      grammarTopic: { select: { code: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
  });
  if (!row) return null;
  const grammarTopicCode = resolveGrammarTopicCode(
    row.kind,
    row.code,
    row.grammarTopic?.code,
  );
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    title: row.title,
    description: row.description,
    estimatedMinutes: row.estimatedMinutes,
    ...(grammarTopicCode ? { grammarTopicCode } : {}),
  };
}

export async function buildHomeResponseHelper(params: {
  prisma: PrismaService;
  userId: string;
  notifications?: NotificationsService;
  getProfile: (db: Prisma.TransactionClient | PrismaService, uid: string) => Promise<UserProfile>;
  shouldUpgradeFromPlacement: (
    existing: Pick<LearningSkillLevel, 'source' | 'changedAt'>,
    init: ReturnType<typeof initialReadingLevel>,
  ) => boolean;
  planDto: (plan: LearningDayPlan) => ReturnType<typeof buildPlanDtoHelper>;
  preferenceDto: (
    profile: UserProfile,
    storedSkills?: PreferredSkill[] | null,
  ) => {
    learningPurpose: UserProfile['learningPurpose'];
    targetCefr: CefrLevel;
    dailyGoalMinutes: number;
    preferredKinds: PreferredSkill[];
    version: number;
  };
}) {
  const {
    prisma,
    userId,
    notifications,
    getProfile,
    shouldUpgradeFromPlacement,
    planDto,
    preferenceDto,
  } = params;
  const now = new Date();
  const date = learningDate(now);
  const week = buildLearningWeekWindows(now, date);

  const [
    profile,
    plans,
    attempts,
    completedLessons,
    first,
    placement,
    skill,
    seconds,
    unreadNotificationCount,
    milestoneLessons,
    milestoneUnits,
    completedAttemptRows,
  ] = await Promise.all([
    getProfile(prisma, userId),
    prisma.learningDayPlan.findMany({
      where: { userId, date: { gte: week[0].date, lte: date } },
    }),
    prisma.learningAttempt.findMany({
      where: { userId, status: 'COMPLETED', submittedAt: { gte: week[0].from, lte: now } },
      select: { lessonId: true, submittedAt: true },
    }),
    prisma.learningLesson.count({
      where: { published: true, attempts: { some: { userId, status: 'COMPLETED' } } },
    }),
    prisma.learningActivitySession.findFirst({
      where: { userId },
      orderBy: { anchorAt: 'asc' },
      select: { anchorAt: true },
    }),
    prisma.placementSession.findFirst({
      where: { userId, status: 'COMPLETED' },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      select: { estimatedCefr: true, skillResults: true, completedAt: true },
    }),
    prisma.learningSkillLevel.findUnique({
      where: { userId_kind: { userId, kind: 'READING' } },
    }),
    queryHomeActiveSeconds(prisma, userId, [...week, { from: new Date(0), to: now }]),
    (async () => {
      if (!notifications) return 0;
      try {
        await notifications.ensureDailyNotifications(userId);
        return await notifications.unreadCount(userId);
      } catch {
        return 0;
      }
    })(),
    prisma.learningLesson?.findMany?.({
      where: { published: true },
      select: {
        id: true,
        unitId: true,
        kind: true,
        grammarTopicId: true,
        grammarTopic: { select: { cefrLevel: true } },
      },
    }) ?? Promise.resolve([] as MilestoneLessonInput[]),
    prisma.learningUnit?.findMany?.({
      orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }],
      select: { id: true, cefrLevel: true },
    }) ?? Promise.resolve([] as { id: string; cefrLevel: CefrLevel }[]),
    prisma.learningAttempt?.findMany?.({
      where: { userId, status: 'COMPLETED' },
      select: { lessonId: true },
      distinct: ['lessonId'],
    }) ?? Promise.resolve([] as { lessonId: string }[]),
  ]);

  const storedSkills = await readPreferredSkillsForUser(
    prisma,
    userId,
    profile.preferredKinds,
  );
  const byDate = new Map(plans.map((plan) => [plan.date, plan]));
  const goalByDate = new Map(plans.map((plan) => [plan.date, plan.dailyGoalMinutes]));
  const current = byDate.get(date);
  const initial = initialReadingLevel(
    placement?.skillResults as Record<string, unknown> | undefined,
    placement?.completedAt,
  );
  const planStatus = !current
    ? 'missing'
    : current.policyVersion !== CURRENT_PLAN_POLICY_VERSION ||
      current.preferencesVersion !== profile.preferencesVersion ||
      current.dailyGoalMinutes !== profile.dailyGoalMinutes ||
      (placement?.completedAt != null && current.updatedAt < placement.completedAt) ||
      (skill != null && shouldUpgradeFromPlacement(skill, initial))
      ? 'stale'
      : 'ready';
  const plan = current && planStatus === 'ready' ? await planDto(current) : null;
  const days = buildWeekDaySummaries(
    week,
    date,
    profile.dailyGoalMinutes,
    goalByDate,
    attempts,
    seconds,
    first?.anchorAt ?? null,
  );
  const placementCefr = placement?.estimatedCefr ?? null;
  const completedMilestoneIds = new Set(
    completedAttemptRows.map((row) => row.lessonId),
  );
  const milestones = buildCefrMilestones(
    milestoneLessons,
    milestoneUnits,
    completedMilestoneIds,
    placementCefr,
  );

  return {
    date,
    planStatus,
    plan,
    preferences: preferenceDto(profile, storedSkills),
    today: days[6],
    days,
    totals: {
      completedLessonCount: completedLessons,
      activeSeconds: seconds.get(week.length) ?? 0,
    },
    continueLesson: await fetchHomeLessonHelper(
      prisma,
      userId,
      plan?.continueLessonId ?? null,
      plan == null,
      placement?.estimatedCefr ?? null,
    ),
    unreadNotificationCount,
    placementCefr,
    milestones,
  };
}

async function progressAttemptSummaryHelper(
  prisma: PrismaService,
  userId: string,
  weekStartFrom: Date,
  afterTodayEnd: Date,
  currentWeekStart: Date,
  previousWeekStart: Date,
  now: Date,
) {
  const [row] = await prisma.$queryRaw<
    Array<{
      completedAttemptCount: number;
      activeAttemptCount: number;
      completedPublishedIds: string[] | null;
      validScoreCount: number;
      allScoreSum: number | null;
      currentWeekCount: number;
      currentWeekSum: number | null;
      previousWeekCount: number;
      previousWeekSum: number | null;
      dailyCounts: Array<{
        date: string;
        completedLessonCount: number;
        completedAttemptCount: number;
      }> | null;
      latestByKind: Array<{
        kind: LearningKind;
        correctCount: number;
        totalQuestions: number;
        submittedAtIso: string | null;
        lessonTitle: string;
      }> | null;
    }>
  >`
    WITH user_attempts AS (
      SELECT
        a.id,
        a.lesson_id,
        a.status,
        a.correct_count,
        a.total_questions,
        a.submitted_at,
        a.history_hidden_at,
        (a.lesson_snapshot ->> 'kind') AS snapshot_kind,
        (a.lesson_snapshot ->> 'title') AS snapshot_title
      FROM learning_attempts a
      WHERE a.user_id = ${userId}::uuid
    ),
    counts_and_scores AS (
      SELECT
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_attempt_count,
        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS active_attempt_count,
        COUNT(*) FILTER (
          WHERE status = 'COMPLETED'
            AND submitted_at IS NOT NULL
            AND correct_count IS NOT NULL
            AND total_questions > 0
        )::int AS valid_score_count,
        SUM(
          ((correct_count::double precision / total_questions::double precision) * 100.0)
          ORDER BY submitted_at DESC, id DESC
        ) FILTER (
          WHERE status = 'COMPLETED'
            AND submitted_at IS NOT NULL
            AND correct_count IS NOT NULL
            AND total_questions > 0
        )::double precision AS all_score_sum,
        COUNT(*) FILTER (
          WHERE status = 'COMPLETED'
            AND submitted_at IS NOT NULL
            AND correct_count IS NOT NULL
            AND total_questions > 0
            AND (submitted_at AT TIME ZONE 'UTC') >= ${currentWeekStart}::timestamptz
            AND (submitted_at AT TIME ZONE 'UTC') <= ${now}::timestamptz
        )::int AS current_week_count,
        SUM(
          ((correct_count::double precision / total_questions::double precision) * 100.0)
          ORDER BY submitted_at DESC, id DESC
        ) FILTER (
          WHERE status = 'COMPLETED'
            AND submitted_at IS NOT NULL
            AND correct_count IS NOT NULL
            AND total_questions > 0
            AND (submitted_at AT TIME ZONE 'UTC') >= ${currentWeekStart}::timestamptz
            AND (submitted_at AT TIME ZONE 'UTC') <= ${now}::timestamptz
        )::double precision AS current_week_sum,
        COUNT(*) FILTER (
          WHERE status = 'COMPLETED'
            AND submitted_at IS NOT NULL
            AND correct_count IS NOT NULL
            AND total_questions > 0
            AND (submitted_at AT TIME ZONE 'UTC') >= ${previousWeekStart}::timestamptz
            AND (submitted_at AT TIME ZONE 'UTC') < ${currentWeekStart}::timestamptz
        )::int AS previous_week_count,
        SUM(
          ((correct_count::double precision / total_questions::double precision) * 100.0)
          ORDER BY submitted_at DESC, id DESC
        ) FILTER (
          WHERE status = 'COMPLETED'
            AND submitted_at IS NOT NULL
            AND correct_count IS NOT NULL
            AND total_questions > 0
            AND (submitted_at AT TIME ZONE 'UTC') >= ${previousWeekStart}::timestamptz
            AND (submitted_at AT TIME ZONE 'UTC') < ${currentWeekStart}::timestamptz
        )::double precision AS previous_week_sum
      FROM user_attempts
    ),
    daily_rows AS (
      SELECT
        to_char(submitted_at + interval '7 hours', 'YYYY-MM-DD') AS day_date,
        COUNT(DISTINCT lesson_id)::int AS completed_lesson_count,
        COUNT(*)::int AS completed_attempt_count
      FROM user_attempts
      WHERE status = 'COMPLETED'
        AND submitted_at IS NOT NULL
        AND (submitted_at AT TIME ZONE 'UTC') >= ${weekStartFrom}::timestamptz
        AND (submitted_at AT TIME ZONE 'UTC') < ${afterTodayEnd}::timestamptz
      GROUP BY 1
    ),
    latest_rows AS (
      SELECT DISTINCT ON (snapshot_kind)
        snapshot_kind AS kind,
        correct_count,
        total_questions,
        CASE
          WHEN submitted_at IS NULL THEN NULL
          ELSE to_char(submitted_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        END AS submitted_at_iso,
        snapshot_title AS lesson_title
      FROM user_attempts
      WHERE status = 'COMPLETED'
        AND history_hidden_at IS NULL
        AND snapshot_kind IN ('GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING')
      ORDER BY snapshot_kind, submitted_at DESC, id DESC
    )
    SELECT
      cs.completed_attempt_count AS "completedAttemptCount",
      cs.active_attempt_count AS "activeAttemptCount",
      ARRAY(
        SELECT DISTINCT ua.lesson_id::text
        FROM user_attempts ua
        INNER JOIN learning_lessons l ON l.id = ua.lesson_id AND l.published = true
        WHERE ua.status = 'COMPLETED'
      ) AS "completedPublishedIds",
      cs.valid_score_count AS "validScoreCount",
      cs.all_score_sum AS "allScoreSum",
      cs.current_week_count AS "currentWeekCount",
      cs.current_week_sum AS "currentWeekSum",
      cs.previous_week_count AS "previousWeekCount",
      cs.previous_week_sum AS "previousWeekSum",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'date', dr.day_date,
              'completedLessonCount', dr.completed_lesson_count,
              'completedAttemptCount', dr.completed_attempt_count
            )
          )
          FROM daily_rows dr
        ),
        '[]'::json
      ) AS "dailyCounts",
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'kind', lr.kind,
              'correctCount', lr.correct_count,
              'totalQuestions', lr.total_questions,
              'submittedAtIso', lr.submitted_at_iso,
              'lessonTitle', lr.lesson_title
            )
          )
          FROM latest_rows lr
        ),
        '[]'::json
      ) AS "latestByKind"
    FROM counts_and_scores cs
  `;
  return row;
}

export async function buildProgressResponseHelper(params: {
  prisma: PrismaService;
  userId: string;
  now?: Date;
  getProfile: (db: Prisma.TransactionClient | PrismaService, uid: string) => Promise<UserProfile>;
  shouldUpgradeFromPlacement: (
    existing: Pick<LearningSkillLevel, 'source' | 'changedAt'>,
    init: ReturnType<typeof initialReadingLevel>,
  ) => boolean;
  syncPlacementSkillLevel: (
    userId: string,
    today: string,
    placement: { skillResults: unknown; completedAt: Date | null } | null,
  ) => Promise<LearningSkillLevel>;
}) {
  const {
    prisma,
    userId,
    now = new Date(),
    getProfile,
    shouldUpgradeFromPlacement,
    syncPlacementSkillLevel,
  } = params;
  const today = learningDate(now);
  const start = learningDayStart(today);
  const currentWeekStart = new Date(start.getTime() - 6 * DAY_MS);
  const previousWeekStart = new Date(start.getTime() - 13 * DAY_MS);
  const afterTodayEnd = new Date(start.getTime() + DAY_MS);
  const week = buildLearningWeekWindows(now, today);

  const [
    profile,
    plans,
    attemptStats,
    totalLessons,
    units,
    first,
    placement,
    skillLevel,
    seconds,
  ] = await Promise.all([
    getProfile(prisma, userId),
    prisma.learningDayPlan.findMany({
      where: { userId, date: { gte: week[0].date, lte: today } },
      select: { date: true, dailyGoalMinutes: true },
    }),
    progressAttemptSummaryHelper(
      prisma,
      userId,
      currentWeekStart,
      afterTodayEnd,
      currentWeekStart,
      previousWeekStart,
      now,
    ),
    prisma.learningLesson.findMany({
      where: { published: true },
      select: {
        id: true,
        unitId: true,
        kind: true,
        grammarTopicId: true,
        grammarTopic: { select: { cefrLevel: true } },
      },
    }),
    prisma.learningUnit.findMany({
      orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }],
    }),
    prisma.learningActivitySession.findFirst({
      where: { userId },
      orderBy: { anchorAt: 'asc' },
      select: { anchorAt: true },
    }),
    prisma.placementSession.findFirst({
      where: { userId, status: 'COMPLETED' },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      select: { estimatedCefr: true, skillResults: true, completedAt: true },
    }),
    prisma.learningSkillLevel?.findUnique({
      where: { userId_kind: { userId, kind: 'READING' } },
    }) ?? Promise.resolve(null),
    queryHomeActiveSeconds(prisma, userId, [...week, { from: new Date(0), to: now }]),
  ]);

  const goalByDate = new Map(plans.map((p) => [p.date, p.dailyGoalMinutes]));
  const dailyByDate = new Map(
    (attemptStats?.dailyCounts ?? []).map((d) => [d.date, d]),
  );
  const days = week.map((day, index) => {
    const dayStats = dailyByDate.get(day.date);
    const completedLessonCount = Number(dayStats?.completedLessonCount ?? 0);
    const completedAttemptCount = Number(dayStats?.completedAttemptCount ?? 0);
    const activeSeconds = seconds.get(index) ?? 0;
    const target =
      goalByDate.get(day.date) ??
      (day.date === today ? profile.dailyGoalMinutes : null);
    return {
      date: day.date,
      dailyGoalMinutes: target,
      activeSeconds,
      goalMet: target != null && activeSeconds >= target * 60,
      completedLessonCount,
      completedAttemptCount,
      hasActivity: activeSeconds > 0 || completedAttemptCount > 0,
      timeMeasured: first != null && learningDate(first.anchorAt) <= day.date,
    };
  });
  const completedPublishedIds = new Set<string>(
    attemptStats?.completedPublishedIds ?? [],
  );
  const measuredDays = days.filter((d) => d.timeMeasured);
  const averageActiveSeconds = measuredDays.length
    ? Math.round(
      measuredDays.reduce((sum, d) => sum + d.activeSeconds, 0) /
      measuredDays.length,
    )
    : 0;
  const latestByKindMap = new Map(
    (attemptStats?.latestByKind ?? []).map((r) => [r.kind, r]),
  );
  const latestResults = Object.values(LearningKind).flatMap((kind) => {
    const a = latestByKindMap.get(kind);
    if (!a) return [];
    const correctCount = Number(a.correctCount);
    const totalQuestions = Number(a.totalQuestions);
    return [
      {
        kind,
        correctCount,
        totalQuestions,
        scoreRatio: correctCount / totalQuestions,
        submittedAt: a.submittedAtIso ? new Date(a.submittedAtIso) : null,
        lessonTitle: a.lessonTitle,
      },
    ];
  });
  const validScoreCount = Number(attemptStats?.validScoreCount ?? 0);
  const currentWeekCount = Number(attemptStats?.currentWeekCount ?? 0);
  const previousWeekCount = Number(attemptStats?.previousWeekCount ?? 0);
  const averageScore =
    validScoreCount > 0
      ? Math.round(Number(attemptStats?.allScoreSum ?? 0) / validScoreCount)
      : null;
  const currentWeekAverage =
    currentWeekCount > 0
      ? Math.round(Number(attemptStats?.currentWeekSum ?? 0) / currentWeekCount)
      : null;
  const previousWeekAverage =
    previousWeekCount > 0
      ? Math.round(Number(attemptStats?.previousWeekSum ?? 0) / previousWeekCount)
      : null;
  const scoreStats = {
    averageScore,
    completedAttemptCount: validScoreCount,
    currentWeekAverage,
    previousWeekAverage,
    deltaPercent:
      currentWeekAverage != null && previousWeekAverage != null
        ? currentWeekAverage - previousWeekAverage
        : null,
  };

  const placementInit = initialReadingLevel(
    placement?.skillResults as Record<string, unknown> | undefined,
    placement?.completedAt,
  );
  let activeSkill = skillLevel;
  if (
    activeSkill &&
    shouldUpgradeFromPlacement(activeSkill, placementInit) &&
    typeof prisma.$transaction === 'function'
  ) {
    activeSkill = await syncPlacementSkillLevel(userId, today, placement);
  }
  const readingLevel = activeSkill
    ? {
      cefrLevel: activeSkill.cefrLevel,
      source: activeSkill.source,
      previousCefr: activeSkill.previousCefr,
      changedAt: activeSkill.changedAt,
    }
    : { ...placementInit, previousCefr: null };
  const placementCefr = placement?.estimatedCefr ?? null;

  return {
    today: days[6],
    days,
    totals: {
      totalLessons: totalLessons.length,
      completedLessonCount: completedPublishedIds.size,
      completedAttemptCount: Number(attemptStats?.completedAttemptCount ?? 0),
      activeAttemptCount: Number(attemptStats?.activeAttemptCount ?? 0),
      activeSeconds: seconds.get(week.length) ?? 0,
      averageActiveSeconds,
      averageStudyMinutes: Math.floor(averageActiveSeconds / 60),
    },
    units: buildProgressUnits(units, totalLessons, completedPublishedIds),
    milestones: buildCefrMilestones(
      totalLessons,
      units,
      completedPublishedIds,
      placementCefr,
    ),
    scoreStats,
    latestResults,
    placement: placement?.skillResults ?? null,
    placementCefr,
    recommendedLevels: { reading: readingLevel },
    trackingStartedAt: first?.anchorAt ?? null,
  };
}
