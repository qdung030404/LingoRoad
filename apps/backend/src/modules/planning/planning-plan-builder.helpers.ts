import {
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import {
  CefrLevel,
  LearningAttempt,
  LearningDayPlan,
  LearningKind,
  LearningSkillLevel,
  Prisma,
  UserProfile,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  assemblePlanDto,
  buildSpeakingPracticeMaps,
  buildWritingPlanPool,
  queryHomeActiveSeconds,
} from './planning-activity.helpers';
import { ActivityBatchDto, PreferredSkill } from './planning.dto';
import {
  buildDailyRoadmapItems,
  DAY_MS,
  learningDate,
  learningDayStart,
  PlanItem,
  PlannedLesson,
  PlannedSpeakingTopic,
} from './planning.helpers';
import {
  readPreferredSkillsForUser,
  readWritingHistoryForUser,
  resolvePreferredSkills,
} from './planning-receipts.helpers';
import {
  chooseReadingFocus,
  ReadingFocusCode,
  selectReadingFocusAttempts,
} from './reading-focus.policy';
import { AdaptiveReadingTarget } from './skill-level.policy';

type Db = Prisma.TransactionClient;

const PLAN_LESSON_SELECT = {
  id: true,
  code: true,
  kind: true,
  title: true,
  estimatedMinutes: true,
  sortOrder: true,
  unit: { select: { cefrLevel: true } },
  grammarTopic: { select: { cefrLevel: true } },
} as const;

export async function computeDailyPlanItemsHelper(params: {
  db: Db;
  userId: string;
  now: Date;
  date: string;
  profile: UserProfile;
  placement: {
    estimatedCefr?: CefrLevel | null;
    skillResults: unknown;
    completedAt: Date | null;
  } | null;
  skillLevel: LearningSkillLevel | null;
  existingItems: PlanItem[];
  exposureByLesson?: ReadonlyMap<string, string>;
  preferredSkillsOverride?: PreferredSkill[] | null;
}): Promise<PlanItem[]> {
  const {
    db,
    userId,
    now,
    date,
    profile,
    placement,
    skillLevel,
    existingItems,
    exposureByLesson,
    preferredSkillsOverride,
  } = params;

  const storedSkills =
    preferredSkillsOverride !== undefined
      ? preferredSkillsOverride
      : await readPreferredSkillsForUser(db, userId, profile.preferredKinds);
  const preferredSkills = resolvePreferredSkills(profile, storedSkills);
  const wantsSpeaking =
    preferredSkills.includes('SPEAKING') ||
    existingItems.some((i) => i.kind === 'SPEAKING');
  const wantsWriting =
    preferredSkills.includes('WRITING') ||
    existingItems.some((i) => i.kind === 'WRITING');

  const [
    lessons,
    attempts,
    speakingTopics,
    speakingSubmissions,
    voiceConversations,
    rawWritingItems,
    writingHistory,
  ] = await Promise.all([
    db.learningLesson.findMany({
      where: { published: true },
      select: PLAN_LESSON_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    }),
    db.learningAttempt.findMany({ where: { userId } }),
    wantsSpeaking && db.speakingPrompt?.findMany
      ? db.speakingPrompt.findMany({
          where: { mode: 'TOPIC', published: true },
          select: { id: true, code: true, title: true, text: true, sortOrder: true },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        })
      : Promise.resolve([] as PlannedSpeakingTopic[]),
    wantsSpeaking && db.speakingSubmission?.findMany
      ? db.speakingSubmission.findMany({
          where: { userId, status: 'SUCCEEDED' },
          select: { promptId: true, completedAt: true, createdAt: true },
        })
      : Promise.resolve(
          [] as { promptId: string; completedAt: Date | null; createdAt: Date }[],
        ),
    wantsSpeaking && db.voiceConversation?.findMany
      ? db.voiceConversation.findMany({
          where: { userId, endedAt: { not: null } },
          select: { topicId: true, endedAt: true },
        })
      : Promise.resolve([] as { topicId: string; endedAt: Date | null }[]),
    wantsWriting && db.assessmentItem?.findMany
      ? db.assessmentItem.findMany({
          where: { skill: 'WRITING', usageScope: { in: ['PRACTICE', 'ALL'] } },
          select: {
            id: true,
            externalId: true,
            skillCode: true,
            cefrLevel: true,
            prompt: true,
            createdAt: true,
            group: { select: { title: true } },
          },
          orderBy: [{ cefrLevel: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve(
          [] as {
            id: string;
            externalId: string | null;
            skillCode: string;
            cefrLevel: CefrLevel;
            prompt: string;
            createdAt: Date;
            group: { title: string | null } | null;
          }[],
        ),
    wantsWriting
      ? readWritingHistoryForUser(db, userId)
      : Promise.resolve({} as Record<string, string>),
  ]);

  const { completedSpeakingIdsToday, practicedSpeakingAt } =
    buildSpeakingPracticeMaps(speakingSubmissions, voiceConversations, date);
  const { writingItems, completedWritingIdsToday, practicedWritingAt } =
    buildWritingPlanPool(rawWritingItems, writingHistory, date);
  const readingTarget: AdaptiveReadingTarget | null = skillLevel
    ? {
        cefrLevel: skillLevel.cefrLevel,
        strictCeiling: skillLevel.source === 'ADAPTIVE',
      }
    : null;

  let readingFocus: ReadingFocusCode | undefined;
  if (skillLevel && attempts.some((attempt) => attempt.status === 'COMPLETED')) {
    const resolvedExposure =
      exposureByLesson ??
      new Map(
        (
          await db.learningAnswerExposure.findMany({
            where: { userId },
            select: { lessonId: true, firstAttemptId: true },
          })
        ).map((exposure) => [exposure.lessonId, exposure.firstAttemptId]),
      );
    const evidence = selectReadingFocusAttempts(
      attempts,
      resolvedExposure,
      skillLevel,
      now,
    );
    if (evidence.length >= 2) {
      const answers = await db.learningAttemptAnswer.findMany({
        where: {
          attemptId: { in: evidence.map((attempt) => attempt.id) },
          checked: true,
        },
        select: { attemptId: true, questionId: true, isCorrect: true },
      });
      readingFocus = chooseReadingFocus(evidence, answers);
    }
  }

  let plannedLessons: PlannedLesson[] = lessons;
  if (readingFocus && readingTarget) {
    const missingContentIds = lessons
      .filter(
        (lesson) =>
          lesson.kind === 'READING' &&
          lesson.unit?.cefrLevel === readingTarget.cefrLevel &&
          (lesson as PlannedLesson).content === undefined,
      )
      .map((lesson) => lesson.id);
    if (missingContentIds.length > 0) {
      const contentRows = await db.learningLesson.findMany({
        where: { id: { in: missingContentIds } },
        select: { id: true, content: true },
      });
      const contentById = new Map(contentRows.map((row) => [row.id, row.content]));
      plannedLessons = lessons.map((lesson) =>
        contentById.has(lesson.id)
          ? { ...lesson, content: contentById.get(lesson.id) }
          : lesson,
      );
    }
  }

  return buildDailyRoadmapItems(
    plannedLessons,
    attempts,
    date,
    profile.dailyGoalMinutes,
    preferredSkills,
    existingItems,
    placement?.skillResults as Record<string, unknown> | undefined,
    readingTarget,
    readingFocus,
    speakingTopics,
    completedSpeakingIdsToday,
    practicedSpeakingAt,
    writingItems,
    completedWritingIdsToday,
    practicedWritingAt,
    placement?.estimatedCefr ?? null,
  );
}

export async function buildPlanDtoHelper(
  prisma: PrismaService,
  plan: LearningDayPlan,
  isLessonKind: (value: string) => value is LearningKind,
) {
  const planItems = plan.items as unknown as PlanItem[];
  const start = learningDayStart(plan.date);
  const end = new Date(start.getTime() + DAY_MS);
  const lessonItemIds = planItems
    .filter((i) => isLessonKind(i.kind))
    .map((i) => i.lessonId);
  const speakingItemIds = planItems
    .filter((i) => i.kind === 'SPEAKING')
    .map((i) => i.lessonId);
  const hasWritingItems = planItems.some((i) => i.kind === 'WRITING');

  const [attempts, speakingSubs, voiceConvs, writingHistory, lessonMeta] =
    await Promise.all([
      lessonItemIds.length === 0
        ? Promise.resolve(
            [] as {
              id: string;
              lessonId: string;
              status: LearningAttempt['status'];
              submittedAt: Date | null;
              historyHiddenAt: Date | null;
            }[],
          )
        : prisma.learningAttempt.findMany({
            where: {
              userId: plan.userId,
              lessonId: { in: lessonItemIds },
              status: 'COMPLETED',
              submittedAt: { gte: start, lt: end },
            },
            select: {
              id: true,
              lessonId: true,
              status: true,
              submittedAt: true,
              historyHiddenAt: true,
            },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          }),
      speakingItemIds.length === 0 || !prisma.speakingSubmission?.findMany
        ? Promise.resolve([] as { promptId: string }[])
        : prisma.speakingSubmission.findMany({
            where: {
              userId: plan.userId,
              promptId: { in: speakingItemIds },
              status: 'SUCCEEDED',
              OR: [
                { completedAt: { gte: start, lt: end } },
                { completedAt: null, createdAt: { gte: start, lt: end } },
              ],
            },
            select: { promptId: true },
          }),
      speakingItemIds.length === 0 || !prisma.voiceConversation?.findMany
        ? Promise.resolve([] as { topicId: string }[])
        : prisma.voiceConversation.findMany({
            where: {
              userId: plan.userId,
              topicId: { in: speakingItemIds },
              endedAt: { gte: start, lt: end },
            },
            select: { topicId: true },
          }),
      hasWritingItems
        ? readWritingHistoryForUser(prisma, plan.userId)
        : Promise.resolve({} as Record<string, string>),
      lessonItemIds.length === 0 || !prisma.learningLesson?.findMany
        ? Promise.resolve(
            [] as {
              id: string;
              code: string;
              kind: LearningKind;
              grammarTopic: { code: string } | null;
            }[],
          )
        : prisma.learningLesson.findMany({
            where: { id: { in: lessonItemIds } },
            select: {
              id: true,
              code: true,
              kind: true,
              grammarTopic: { select: { code: true } },
            },
          }),
    ]);

  return assemblePlanDto({
    plan,
    planItems,
    attempts,
    speakingSubs,
    voiceConvs,
    writingHistory,
    lessonMeta,
    isLessonKind,
  });
}

export async function openActivityOp(
  prisma: PrismaService,
  userId: string,
  attemptId: string,
  clientRunId: string,
) {
  const session = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    const attempt = await tx.learningAttempt.findFirst({
      where: { id: attemptId, userId },
    });
    if (!attempt) {
      throw new NotFoundException({
        code: 'LEARNING_RECORD_NOT_FOUND',
        message: 'Không tìm thấy dữ liệu học tập.',
      });
    }
    const old = await tx.learningActivitySession.findUnique({
      where: { userId_attemptId_clientRunId: { userId, attemptId, clientRunId } },
    });
    if (old) return old;
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException({
        code: 'LEARNING_INVALID_ACTIVITY',
        message: 'Lượt đã hoàn thành không mở phiên đo mới.',
      });
    }
    return tx.learningActivitySession.create({
      data: { userId, attemptId, clientRunId },
    });
  });

  return {
    sessionId: session.id,
    anchorAt: session.anchorAt,
    serverNow: new Date(),
    collectUntil: new Date(session.anchorAt.getTime() + DAY_MS),
    uploadUntil: new Date(session.anchorAt.getTime() + 7 * DAY_MS),
  };
}

export async function segmentsOp(
  prisma: PrismaService,
  userId: string,
  sessionId: string,
  dto: ActivityBatchDto,
  notifications?: NotificationsService,
) {
  return prisma.$transaction(
    async (tx) => {
      let session = await tx.learningActivitySession.findFirst({
        where: { id: sessionId, userId },
        include: { attempt: { select: { submittedAt: true } } },
      });
      if (!session) {
        throw new NotFoundException({
          code: 'LEARNING_RECORD_NOT_FOUND',
          message: 'Không tìm thấy dữ liệu học tập.',
        });
      }
      await tx.$queryRaw`SELECT id FROM learning_activity_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM learning_attempts WHERE id = ${session.attemptId}::uuid FOR UPDATE`;
      session = await tx.learningActivitySession.findFirst({
        where: { id: sessionId, userId },
        include: { attempt: { select: { submittedAt: true } } },
      });
      if (!session) {
        throw new NotFoundException({
          code: 'LEARNING_RECORD_NOT_FOUND',
          message: 'Không tìm thấy dữ liệu học tập.',
        });
      }

      const now = new Date();
      const acks: { seq: number; startAt: Date | null; endAt: Date | null }[] = [];
      let hasNewActiveSegment = false;

      for (const segment of dto.segments) {
        const { seq, startOffsetMs, endOffsetMs } = segment;
        if (
          endOffsetMs <= startOffsetMs ||
          endOffsetMs - startOffsetMs > 15000 ||
          endOffsetMs > DAY_MS
        ) {
          throw new BadRequestException({
            code: 'LEARNING_INVALID_ACTIVITY',
            message: 'Khoảng hoạt động không hợp lệ.',
          });
        }
        const old = await tx.learningActivitySegment.findUnique({
          where: { sessionId_seq: { sessionId, seq } },
        });
        if (old) {
          if (
            old.startOffsetMs !== startOffsetMs ||
            old.endOffsetMs !== endOffsetMs
          ) {
            throw new ConflictException({
              code: 'LEARNING_ACTIVITY_CONFLICT',
              message: 'Receipt hoạt động đã có nội dung khác.',
            });
          }
          acks.push({ seq, startAt: old.startAt, endAt: old.endAt });
          continue;
        }
        if (now.getTime() > session.anchorAt.getTime() + 7 * DAY_MS) {
          throw new GoneException({
            code: 'LEARNING_ACTIVITY_UPLOAD_EXPIRED',
            message: 'Khoảng hoạt động đã hết hạn đồng bộ.',
          });
        }
        const start = session.anchorAt.getTime() + startOffsetMs;
        const end = Math.min(
          session.anchorAt.getTime() + endOffsetMs,
          now.getTime(),
          session.attempt.submittedAt?.getTime() ?? Infinity,
        );
        const saved = await tx.learningActivitySegment.create({
          data: {
            sessionId,
            seq,
            startOffsetMs,
            endOffsetMs,
            startAt: end > start ? new Date(start) : null,
            endAt: end > start ? new Date(end) : null,
          },
        });
        if (saved.startAt != null) hasNewActiveSegment = true;
        acks.push({ seq, startAt: saved.startAt, endAt: saved.endAt });
      }

      let goalJustMet = false;
      if (hasNewActiveSegment && notifications) {
        const today = learningDate(now);
        const dayStart = learningDayStart(today);
        const [todayPlan, userProfile, activeMap] = await Promise.all([
          tx.learningDayPlan?.findUnique({
            where: { userId_date: { userId, date: today } },
            select: { dailyGoalMinutes: true },
          }) ?? Promise.resolve(null),
          tx.userProfile?.findUnique({
            where: { userId },
            select: { dailyGoalMinutes: true },
          }) ?? Promise.resolve(null),
          queryHomeActiveSeconds(tx, userId, [
            {
              from: dayStart,
              to: new Date(Math.min(dayStart.getTime() + DAY_MS, now.getTime())),
            },
          ]),
        ]);
        const dailyGoalMinutes =
          todayPlan?.dailyGoalMinutes ?? userProfile?.dailyGoalMinutes ?? null;
        const activeSeconds = activeMap.get(0) ?? 0;
        if (
          dailyGoalMinutes != null &&
          dailyGoalMinutes > 0 &&
          activeSeconds >= dailyGoalMinutes * 60
        ) {
          const { created } = await notifications.createNotification(
            {
              userId,
              type: 'DAILY_GOAL_MET',
              title: 'Hoàn thành mục tiêu hôm nay!',
              body: `Bạn đã đạt mục tiêu ${dailyGoalMinutes} phút học hôm nay. Tuyệt vời!`,
              targetType: 'DAILY_PLAN',
              targetPayload: { date: today, dailyGoalMinutes },
              dedupeKey: `daily_goal_met:${today}`,
            },
            tx,
          );
          goalJustMet = created;
        }
      }

      return { acks, serverNow: now, goalJustMet };
    },
    { timeout: 10000 },
  );
}
