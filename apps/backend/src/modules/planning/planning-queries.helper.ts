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
  computeScoreStats,
  CURRENT_PLAN_POLICY_VERSION,
  learningDate,
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

export async function buildProgressResponseHelper(params: {
  prisma: PrismaService;
  userId: string;
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
    getProfile,
    shouldUpgradeFromPlacement,
    syncPlacementSkillLevel,
  } = params;
  const now = new Date();
  const today = learningDate(now);
  const week = buildLearningWeekWindows(now, today);

  const [
    profile,
    plans,
    attempts,
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
    prisma.learningAttempt.findMany({
      where: { userId },
      select: {
        id: true,
        lessonId: true,
        status: true,
        lessonSnapshot: true,
        correctCount: true,
        totalQuestions: true,
        submittedAt: true,
        historyHiddenAt: true,
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    }),
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
  const completed = attempts.filter((a) => a.status === 'COMPLETED');
  const days = buildWeekDaySummaries(
    week,
    today,
    profile.dailyGoalMinutes,
    goalByDate,
    completed,
    seconds,
    first?.anchorAt ?? null,
  );
  const publishedIds = new Set(totalLessons.map((l) => l.id));
  const completedPublishedIds = new Set(
    completed.filter((a) => publishedIds.has(a.lessonId)).map((a) => a.lessonId),
  );
  const measuredDays = days.filter((d) => d.timeMeasured);
  const averageActiveSeconds = measuredDays.length
    ? Math.round(
        measuredDays.reduce((sum, d) => sum + d.activeSeconds, 0) /
          measuredDays.length,
      )
    : 0;
  const latestResults = Object.values(LearningKind).flatMap((kind) => {
    const a = completed.find(
      (row) =>
        row.historyHiddenAt == null &&
        (row.lessonSnapshot as { kind?: string })?.kind === kind,
    );
    return a
      ? [
          {
            kind,
            correctCount: a.correctCount!,
            totalQuestions: a.totalQuestions,
            scoreRatio: a.correctCount! / a.totalQuestions,
            submittedAt: a.submittedAt,
            lessonTitle: (a.lessonSnapshot as { title: string }).title,
          },
        ]
      : [];
  });

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
      completedAttemptCount: completed.length,
      activeAttemptCount: attempts.filter((a) => a.status === 'IN_PROGRESS').length,
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
    scoreStats: computeScoreStats(completed, now),
    latestResults,
    placement: placement?.skillResults ?? null,
    placementCefr,
    recommendedLevels: { reading: readingLevel },
    trackingStartedAt: first?.anchorAt ?? null,
  };
}
