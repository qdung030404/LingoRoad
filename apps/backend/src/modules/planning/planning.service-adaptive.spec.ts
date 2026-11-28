import { BadRequestException, ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { CefrLevel, LearningAttempt, LearningKind } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildDailyRoadmapItems, buildProgressUnits, chooseDailyItems, computeScoreStats, isCefrEligible, learningDate, learningDayStart, PlannedLesson, PlanningService } from './planning.service';

const now = new Date('2026-11-02T06:00:00Z');
function lesson(
  id: string,
  kind: LearningKind = 'READING',
  minutes = 5,
  order = 1,
  unitId: string | null = null,
  cefrLevel: CefrLevel | null = null,
): PlannedLesson {
  return {
    id, code: id, kind, title: id, description: id, estimatedMinutes: minutes, sortOrder: order,
    published: true, contentVersion: 1, unitId, grammarTopicId: null, unit: cefrLevel ? { cefrLevel } : null,
    content: {}, createdAt: now, updatedAt: now,
  };
}
function attempt(id: string, lessonId: string, score: number | null, submittedAt = new Date('2026-11-01T06:00:00Z')): LearningAttempt {
  return { id, userId: 'u', lessonId, status: score == null ? 'IN_PROGRESS' : 'COMPLETED', version: 0, phase: 'QUIZ', positionIndex: 0,
    contentVersion: 1, eligibleForLevelEval: true,
    lessonSnapshot: {}, contentSnapshot: {}, correctCount: score, totalQuestions: 5, startedAt: submittedAt, updatedAt: submittedAt,
    submittedAt: score == null ? null : submittedAt, historyHiddenAt: null };
}
const kinds = Object.values(LearningKind);

describe('PlanningService adaptive & CEFR ceiling', () => {
  it('keeps B1 reading ahead of a lower-tier reading+listening pair when reading and listening placement tie', () => {
    const lessons = [
      lesson('grammar-a1', 'GRAMMAR', 10, 1, 'u-a1', 'A1'),
      lesson('vocab-a1', 'VOCABULARY', 10, 2, 'u-a1', 'A1'),
      lesson('read-a1', 'READING', 5, 3, 'u-a1', 'A1'),
      lesson('listen-a1', 'LISTENING', 5, 4, 'u-a1', 'A1'),
      lesson('read-a2', 'READING', 5, 5, 'u-a2', 'A2'),
      lesson('read-b1', 'READING', 8, 7, 'u-b1', 'B1'),
    ];
    const placement = {
      reading: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5 },
      listening: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5 },
    };
    const result = chooseDailyItems(
      lessons,
      [],
      '2026-11-16',
      10,
      ['READING', 'LISTENING'],
      [],
      placement,
      { cefrLevel: 'B1', strictCeiling: true },
    );
    expect(result.map((i) => i.lessonId)).toEqual(['read-b1']);
    expect(result[0].reasonCode).toBe('NEW');
  });

  it('upgrades persisted DEFAULT A1 skill level to PLACEMENT B1 and replans stale plans across event, today, and progress', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-16T06:00:00Z'));
    try {
      const stalePlanAt = new Date('2026-11-16T02:00:00Z');
      const placementCompletedAt = new Date('2026-11-16T04:00:00Z');

      const lessons = [
        lesson('read-a1', 'READING', 5, 1, 'u-a1', 'A1'),
        lesson('listen-a1', 'LISTENING', 5, 2, 'u-a1', 'A1'),
        lesson('read-b1', 'READING', 8, 3, 'u-b1', 'B1'),
      ];
      const placement = {
        status: 'COMPLETED',
        estimatedCefr: 'B1',
        completedAt: placementCompletedAt,
        skillResults: {
          reading: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5 },
          listening: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5 },
        },
      };

      const makeStatefulDb = () => {
        let skillRow = {
          id: 'sk-1',
          userId: 'u',
          kind: LearningKind.READING,
          cefrLevel: CefrLevel.A1,
          source: 'DEFAULT',
          previousCefr: null as CefrLevel | null,
          changedAt: null as Date | null,
          updatedAt: stalePlanAt,
        };
        let planRow = {
          id: 'plan-1',
          userId: 'u',
          date: '2026-11-16',
          version: 0,
          preferencesVersion: 0,
          dailyGoalMinutes: 10,
          policyVersion: 'adaptive-v3',
          createdAt: stalePlanAt,
          updatedAt: stalePlanAt,
          items: [
            {
              id: 'stale-1',
              lessonId: 'read-a1',
              code: 'read-a1',
              title: 'read-a1',
              kind: 'READING',
              cefrLevel: 'A1',
              estimatedMinutes: 5,
              reasonCode: 'NEW',
              reason: 'Bài mới',
            },
          ],
        };

        const tx: any = {
          $queryRaw: jest.fn(async () => [{ id: 'u' }]),
          user: { findUnique: jest.fn(async () => ({ id: 'u' })) },
          userProfile: {
            findUnique: jest.fn(async () => ({
              userId: 'u',
              dailyGoalMinutes: 10,
              preferencesVersion: 0,
              preferredKinds: [LearningKind.READING, LearningKind.LISTENING],
            })),
          },
          placementSession: {
            findFirst: jest.fn(async () => placement),
          },
          learningSkillLevel: {
            findUnique: jest.fn(async () => ({ ...skillRow })),
            findMany: jest.fn(async () => [{ ...skillRow }]),
            upsert: jest.fn(async ({ create, update }: any) => {
              skillRow = skillRow ? { ...skillRow, ...update, updatedAt: new Date() } : { id: 'sk-1', ...create, updatedAt: new Date() };
              return { ...skillRow };
            }),
            update: jest.fn(async ({ data }: any) => {
              skillRow = { ...skillRow, ...data, updatedAt: new Date() };
              return { ...skillRow };
            }),
          },
          learningLesson: {
            findMany: jest.fn(async () => lessons),
          },
          learningUnit: {
            findMany: jest.fn(async () => [
              { id: 'u-a1', code: 'u-a1', title: 'A1', cefrLevel: 'A1', orderIndex: 1, lessons: [lessons[0], lessons[1]] },
              { id: 'u-b1', code: 'u-b1', title: 'B1', cefrLevel: 'B1', orderIndex: 2, lessons: [lessons[2]] },
            ]),
          },
          learningActivitySession: {
            findFirst: jest.fn(async () => null),
          },
          learningAttempt: {
            findMany: jest.fn(async () => []),
            findFirst: jest.fn(async () => null),
          },
          learningSkillLevelEvent: {
            findFirst: jest.fn(async () => null),
          },
          learningAnswerExposure: {
            findMany: jest.fn(async () => []),
          },
          learningDayPlan: {
            findUnique: jest.fn(async () => ({ ...planRow })),
            findMany: jest.fn(async () => [{ ...planRow }]),
            upsert: jest.fn(async ({ create, update }: any) => {
              planRow = {
                ...planRow,
                ...(planRow ? update : create),
                version: (planRow?.version ?? 0) + 1,
                updatedAt: new Date(),
              };
              return { ...planRow };
            }),
          },
        };
        tx.$transaction = jest.fn(async (cb: (client: any) => Promise<any>) => cb(tx));
        return {
          tx,
          getSkillRow: () => skillRow,
          getPlanRow: () => planRow,
        };
      };

      // 1) Placement completion event upgrades DEFAULT A1 -> PLACEMENT B1
      const eventDb = makeStatefulDb();
      const eventSvc = new PlanningService(eventDb.tx as unknown as PrismaService);
      await eventSvc.onPlacementCompleted({ userId: 'u' });
      expect(eventDb.getSkillRow()).toEqual(expect.objectContaining({
        cefrLevel: 'B1',
        source: 'PLACEMENT',
        changedAt: placementCompletedAt,
      }));

      // 2) today() upgrades DEFAULT A1 -> PLACEMENT B1 and replans stale plan
      const todayDb = makeStatefulDb();
      const todaySvc = new PlanningService(todayDb.tx as unknown as PrismaService);
      const todayRes = await todaySvc.today('u');
      expect(todayDb.getSkillRow()).toEqual(expect.objectContaining({
        cefrLevel: 'B1',
        source: 'PLACEMENT',
        changedAt: placementCompletedAt,
      }));
      expect(todayRes.plan?.items.map((i: any) => [i.lessonId, i.reason])).toEqual([
        ['read-b1', 'Bài mới · đúng mức B1'],
      ]);

      // 3) progress() also self-heals DEFAULT A1 -> PLACEMENT B1
      const progressDb = makeStatefulDb();
      const progressSvc = new PlanningService(progressDb.tx as unknown as PrismaService);
      const progressRes: any = await progressSvc.progress('u');
      expect(progressDb.getSkillRow()).toEqual(expect.objectContaining({
        cefrLevel: 'B1',
        source: 'PLACEMENT',
      }));
      expect(progressRes.recommendedLevels?.reading).toEqual(expect.objectContaining({
        cefrLevel: 'B1',
        source: 'PLACEMENT',
      }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('prioritizes target-level reading lessons in ROTATION while keeping oldest practice within the same tier', () => {
    const t0 = new Date('2026-11-01T06:00:00Z');
    const t1 = new Date('2026-11-02T06:00:00Z');
    const t2 = new Date('2026-11-03T06:00:00Z');
    const t3 = new Date('2026-11-04T06:00:00Z');
    const t4 = new Date('2026-11-05T06:00:00Z');

    // 1) All Reading lessons completed earlier at lower levels (A1, A2) than B1 under 10m budget -> rotates B1 (8m), not A1+A2.
    const curriculum = [
      lesson('read-a1', 'READING', 5, 3, 'u-a1', 'A1'),
      lesson('read-a2-1', 'READING', 5, 5, 'u-a2', 'A2'),
      lesson('read-a2-2', 'READING', 5, 6, 'u-a2', 'A2'),
      lesson('read-b1', 'READING', 8, 7, 'u-b1', 'B1'),
    ];
    const completedAsc = [
      attempt('att-a1', 'read-a1', 5, t0),
      attempt('att-a2-1', 'read-a2-1', 5, t1),
      attempt('att-a2-2', 'read-a2-2', 5, t2),
      attempt('att-b1', 'read-b1', 5, t3),
    ];
    const rotated = chooseDailyItems(
      curriculum,
      completedAsc,
      '2026-11-16',
      10,
      ['READING'],
      [],
      undefined,
      { cefrLevel: 'B1', strictCeiling: true },
    );
    expect(rotated.map(i => [i.lessonId, i.reasonCode])).toEqual([['read-b1', 'ROTATION']]);

    // 2) Duplicate lower-tier timestamps (t0, t0) + opposite sortOrder must still pick older B1 (t1) before newer B1 (t2) and newer non-Reading (t4).
    const sameTierLessons = [
      lesson('read-a1-x', 'READING', 5, 3, 'u-a1', 'A1'),
      lesson('listen-a1', 'LISTENING', 5, 4, 'u-a1', 'A1'),
      lesson('read-a1-y', 'READING', 5, 5, 'u-a1', 'A1'),
      lesson('read-b1-new', 'READING', 8, 7, 'u-b1', 'B1'),
      lesson('read-b1-old', 'READING', 8, 9, 'u-b1', 'B1'),
    ];
    const sameTierHistory = [
      attempt('sx', 'read-a1-x', 5, t0),
      attempt('sy', 'read-a1-y', 5, t0),
      attempt('bo', 'read-b1-old', 5, t1),
      attempt('bn', 'read-b1-new', 5, t2),
      attempt('la', 'listen-a1', 5, t4),
    ];
    const rotatedSameTier = chooseDailyItems(
      sameTierLessons,
      sameTierHistory,
      '2026-11-16',
      10,
      ['READING', 'LISTENING'],
      [],
      undefined,
      { cefrLevel: 'B1', strictCeiling: true },
    );
    expect(rotatedSameTier.map(i => [i.lessonId, i.reasonCode])).toEqual([['read-b1-old', 'ROTATION']]);

    // 3) Cross-kind chronological fairness: oldest non-Reading (t0) still precedes Reading's reassigned slot (t1 -> read-b1 ahead of read-a1).
    const crossKindLessons = [
      lesson('listen-oldest', 'LISTENING', 2, 4, 'u-a1', 'A1'),
      lesson('read-a1-older', 'READING', 5, 3, 'u-a1', 'A1'),
      lesson('read-b1-newer', 'READING', 8, 7, 'u-b1', 'B1'),
    ];
    const crossKindHistory = [
      attempt('c-listen', 'listen-oldest', 5, t0),
      attempt('c-r1', 'read-a1-older', 5, t1),
      attempt('c-rb1', 'read-b1-newer', 5, t3),
    ];
    const rotatedCross = chooseDailyItems(
      crossKindLessons,
      crossKindHistory,
      '2026-11-16',
      10,
      ['READING', 'LISTENING'],
      [],
      undefined,
      { cefrLevel: 'B1', strictCeiling: true },
    );
    expect(rotatedCross.map(i => [i.lessonId, i.reasonCode])).toEqual([
      ['listen-oldest', 'ROTATION'],
      ['read-b1-newer', 'ROTATION'],
    ]);
  });

  it('returns and atomically updates learningPurpose, targetCefr, dailyGoalMinutes, and preferredKinds with version protection', async () => {
    let profileRow = {
      userId: 'u',
      learningPurpose: 'STUDY' as any,
      targetCefr: CefrLevel.B1,
      dailyGoalMinutes: 10,
      preferredKinds: [LearningKind.GRAMMAR, LearningKind.READING],
      preferencesVersion: 2,
    };
    let planRow: any = {
      id: 'plan-1',
      userId: 'u',
      date: '2026-11-16',
      version: 0,
      preferencesVersion: 2,
      dailyGoalMinutes: 10,
      policyVersion: 'adaptive-v2',
      createdAt: now,
      updatedAt: now,
      items: [],
    };
    const db: any = {
      $queryRaw: jest.fn(async () => [{ id: 'u' }]),
      userProfile: {
        findUnique: jest.fn(async () => ({ ...profileRow })),
        update: jest.fn(async ({ data }: any) => {
          profileRow = {
            ...profileRow,
            ...data,
            preferencesVersion: data.preferencesVersion?.increment
              ? profileRow.preferencesVersion + data.preferencesVersion.increment
              : profileRow.preferencesVersion,
          };
          return { ...profileRow };
        }),
      },
      learningSkillLevel: {
        findUnique: jest.fn(async () => ({
          userId: 'u',
          kind: LearningKind.READING,
          cefrLevel: CefrLevel.B1,
          source: 'ADAPTIVE',
          changedAt: now,
        })),
      },
      placementSession: { findFirst: jest.fn(async () => null) },
      learningDayPlan: {
        findUnique: jest.fn(async () => ({ ...planRow })),
        upsert: jest.fn(async ({ update }: any) => {
          planRow = { ...planRow, ...update, version: planRow.version + 1 };
          return { ...planRow };
        }),
      },
      learningLesson: { findMany: jest.fn(async () => [lesson('l-gram', 'GRAMMAR', 10, 1)]) },
      learningAttempt: { findMany: jest.fn(async () => []) },
      learningAttemptAnswer: { findMany: jest.fn(async () => []) },
      learningAnswerExposure: { findMany: jest.fn(async () => []) },
    };
    db.$transaction = jest.fn(async (cb: (tx: any) => Promise<any>) => cb(db));
    const svc = new PlanningService(db as unknown as PrismaService);

    jest.useFakeTimers().setSystemTime(new Date('2026-11-16T06:00:00Z'));
    try {
      expect(await svc.preferences('u')).toEqual({
        learningPurpose: 'STUDY',
        targetCefr: 'B1',
        dailyGoalMinutes: 10,
        preferredKinds: ['GRAMMAR', 'READING'],
        version: 2,
        readingLevel: { cefrLevel: 'B1', source: 'ADAPTIVE' },
      });

      const saved = await svc.updatePreferences('u', {
        expectedVersion: 2,
        learningPurpose: 'WORK',
        targetCefr: 'B2',
        dailyGoalMinutes: 20,
        preferredKinds: [LearningKind.VOCABULARY, LearningKind.LISTENING],
      });
      expect(saved).toEqual({
        learningPurpose: 'WORK',
        targetCefr: 'B2',
        dailyGoalMinutes: 20,
        preferredKinds: ['VOCABULARY', 'LISTENING'],
        version: 3,
      });
      expect(planRow.preferencesVersion).toBe(3);

      // Reordering the same set of preferredKinds (including SPEAKING & WRITING) increments version and persists exact priority order
      const reordered = await svc.updatePreferences('u', {
        expectedVersion: 3,
        dailyGoalMinutes: 20,
        preferredKinds: ['WRITING', 'SPEAKING', 'LISTENING', 'VOCABULARY'],
      });
      expect(reordered).toMatchObject({
        preferredKinds: ['WRITING', 'SPEAKING', 'LISTENING', 'VOCABULARY'],
        version: 4,
      });
      expect(planRow.preferencesVersion).toBe(4);

      // Verify buildDailyRoadmapItems covers all selected skills (1..6) in priority order within budget,
      // enforces dailyGoalMinutes on tight budgets, and never duplicates completed-today snapshots.
      const fullCurriculum = [
        lesson('gram-1', 'GRAMMAR', 10, 1, 'u-a1', 'A1'),
        lesson('vocab-1', 'VOCABULARY', 10, 2, 'u-a1', 'A1'),
        lesson('read-1', 'READING', 5, 3, 'u-a1', 'A1'),
        lesson('listen-1', 'LISTENING', 5, 4, 'u-a1', 'A1'),
      ];
      const roadmap = buildDailyRoadmapItems(
        fullCurriculum,
        [],
        '2026-11-16',
        45,
        ['GRAMMAR', 'VOCABULARY', 'LISTENING', 'READING', 'SPEAKING', 'WRITING'],
        [],
        null,
        null,
        undefined,
        [{ id: 'spk-1', code: 'topic-1', title: 'Introduce yourself', text: 'Introduce yourself', sortOrder: 1 }],
        new Set(),
        new Map(),
        [{
          id: 'wrt-1',
          externalId: 'cefr-write-a2-001',
          skillCode: 'writing.transactional_letter',
          cefrLevel: 'A2',
          prompt: 'Write an email to the hotel receptionist.',
        }],
      );
      expect(roadmap.map(i => [i.kind, i.lessonId])).toEqual([
        ['GRAMMAR', 'gram-1'],
        ['VOCABULARY', 'vocab-1'],
        ['LISTENING', 'listen-1'],
        ['READING', 'read-1'],
        ['SPEAKING', 'spk-1'],
        ['WRITING', 'wrt-1'],
      ]);
      expect(roadmap[5]).toMatchObject({
        title: 'Forgotten Jacket at a Hotel',
        cefrLevel: 'A2',
        reason: 'Thư / Email',
      });

      // Tight 5-minute budget skips 10m GRAMMAR/VOCABULARY and picks a single 5m lesson.
      const tightPlan = buildDailyRoadmapItems(
        fullCurriculum,
        [],
        '2026-11-16',
        5,
        ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'],
      );
      expect(tightPlan.map(i => i.lessonId)).toEqual(['read-1']);

      // Recomputing after completing a lesson today never duplicates the completed item.
      const doneTodayAttempt = attempt('att-read-1', 'read-1', 5, new Date('2026-11-16T05:00:00Z'));
      const afterDone = buildDailyRoadmapItems(
        fullCurriculum,
        [doneTodayAttempt],
        '2026-11-16',
        10,
        ['READING', 'LISTENING'],
        tightPlan,
      );
      expect(afterDone.filter(i => i.lessonId === 'read-1')).toHaveLength(1);
      expect(afterDone.reduce((sum, i) => sum + i.estimatedMinutes, 0)).toBe(10);

      await expect(
        svc.updatePreferences('u', {
          expectedVersion: 2,
          dailyGoalMinutes: 30,
          preferredKinds: [LearningKind.GRAMMAR],
        }),
      ).rejects.toThrow(ConflictException);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('PlanningService notification triggers and home unread count', () => {
  const fixedNow = new Date('2026-11-16T06:00:00Z'); // 13:00 VN on 2026-11-16

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates PLACEMENT_COMPLETED notification on placement.completed event', async () => {
    const notifications = { createNotification: jest.fn(async () => ({ created: true })) };
    const tx: any = {
      $queryRaw: jest.fn(async () => [{ id: 'u' }]),
      placementSession: {
        findFirst: jest.fn(async () => ({
          id: 'placement-sess-1',
          estimatedCefr: CefrLevel.B1,
          completedAt: fixedNow,
          skillResults: { reading: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5 } },
        })),
      },
      learningSkillLevel: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: any) => ({ id: 'sl-1', ...data })),
      },
      learningDayPlan: { findUnique: jest.fn(async () => null) },
    };
    tx.$transaction = jest.fn(async (cb: (client: any) => Promise<any>) => cb(tx));
    const svc = new PlanningService(
      tx as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );

    await svc.onPlacementCompleted({ userId: 'u', sessionId: 'placement-sess-1', estimatedCefr: 'B1' });

    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u',
        type: 'PLACEMENT_COMPLETED',
        targetType: 'DAILY_PLAN',
        targetPayload: { estimatedCefr: 'B1' },
        dedupeKey: 'placement:placement-sess-1',
      }),
      tx,
    );
  });

  it('creates SKILL_LEVEL_CHANGED inside tx when evaluateReadingLevel changes READING level', async () => {
    const notifications = { createNotification: jest.fn(async () => ({ created: true })) };
    const readingAttempts: LearningAttempt[] = [
      {
        ...attempt('att-2', 'r-a2-2', 5, new Date('2026-11-16T05:00:00Z')),
        lessonSnapshot: { kind: 'READING', cefrLevel: 'A2', code: 'r-a2-2' },
      },
      {
        ...attempt('att-1', 'r-a2-1', 5, new Date('2026-11-16T04:00:00Z')),
        lessonSnapshot: { kind: 'READING', cefrLevel: 'A2', code: 'r-a2-1' },
      },
    ];
    const tx: any = {
      learningSkillLevel: {
        findUnique: jest.fn(async () => ({
          id: 'sl-1',
          userId: 'u',
          kind: LearningKind.READING,
          cefrLevel: CefrLevel.A2,
          source: 'PLACEMENT',
          previousCefr: null,
          changedAt: new Date('2026-11-10T00:00:00Z'),
        })),
        update: jest.fn(async ({ data }: any) => ({
          id: 'sl-1',
          userId: 'u',
          kind: LearningKind.READING,
          ...data,
        })),
      },
      placementSession: { findFirst: jest.fn(async () => null) },
      learningAttempt: { findMany: jest.fn(async () => readingAttempts) },
      learningAnswerExposure: {
        findMany: jest.fn(async () => [
          { lessonId: 'r-a2-1', firstAttemptId: 'att-1' },
          { lessonId: 'r-a2-2', firstAttemptId: 'att-2' },
        ]),
      },
      learningLesson: {
        findMany: jest.fn(async () => [
          { id: 'r-a2-1', unit: { cefrLevel: CefrLevel.A2 } },
          { id: 'r-a2-2', unit: { cefrLevel: CefrLevel.A2 } },
          { id: 'r-b1-1', unit: { cefrLevel: CefrLevel.B1 } },
        ]),
      },
      learningSkillLevelEvent: { create: jest.fn(async ({ data }: any) => data) },
      learningDayPlan: { findUnique: jest.fn(async () => null) },
    };
    const svc = new PlanningService(
      tx as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );

    const change = await svc.evaluateReadingLevel(tx, 'u', readingAttempts[0]);

    expect(change).toEqual({ kind: 'READING', from: 'A2', to: 'B1', direction: 'UP' });
    expect(tx.learningSkillLevelEvent.create).toHaveBeenCalledTimes(1);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u',
        type: 'SKILL_LEVEL_CHANGED',
        targetType: 'PROFILE',
        targetPayload: { kind: 'READING', fromCefr: 'A2', toCefr: 'B1', direction: 'UP' },
        dedupeKey: 'skill_level:att-2',
      }),
      tx,
    );
  });

  it('calls ensureDailyNotifications and returns unreadNotificationCount in home() with safe fallback', async () => {
    const notifications = {
      ensureDailyNotifications: jest.fn(async () => undefined),
      unreadCount: jest.fn(async () => 3),
    };
    const db: any = {
      userProfile: {
        findUnique: jest.fn(async () => ({
          userId: 'u',
          learningPurpose: null,
          targetCefr: CefrLevel.B1,
          dailyGoalMinutes: 10,
          preferredKinds: [LearningKind.READING],
          preferencesVersion: 0,
        })),
      },
      learningDayPlan: { findMany: jest.fn(async () => []) },
      learningAttempt: { findMany: jest.fn(async () => []) },
      learningLesson: { count: jest.fn(async () => 0), findFirst: jest.fn(async () => null) },
      learningActivitySession: { findFirst: jest.fn(async () => null) },
      placementSession: { findFirst: jest.fn(async () => null) },
      learningSkillLevel: { findUnique: jest.fn(async () => null) },
      $queryRaw: jest.fn(async () => []),
    };
    const svc = new PlanningService(
      db as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );

    const homeRes = await svc.home('u');
    expect(notifications.ensureDailyNotifications).toHaveBeenCalledWith('u');
    expect(homeRes.unreadNotificationCount).toBe(3);

    // Failure in notification helper must not break home()
    notifications.ensureDailyNotifications.mockRejectedValueOnce(new Error('db mock missing'));
    const fallbackRes = await svc.home('u');
    expect(fallbackRes.unreadNotificationCount).toBe(0);
  });

  it('sets goalJustMet true only on the first segment batch that meets the daily goal', async () => {
    const anchor = new Date('2026-11-16T05:00:00Z');
    const receipts: any[] = [];
    let todaySeconds = 590;
    const createdKeys = new Set<string>();
    const notifications = {
      createNotification: jest.fn(async (input: any) => {
        if (createdKeys.has(input.dedupeKey)) return { created: false };
        createdKeys.add(input.dedupeKey);
        return { created: true };
      }),
    };
    const db: any = {
      learningActivitySession: {
        findFirst: jest.fn(async () => ({
          id: 'session',
          userId: 'u',
          anchorAt: anchor,
          attempt: { submittedAt: null },
        })),
      },
      learningActivitySegment: {
        findUnique: jest.fn(async ({ where }: any) => receipts.find((r) => r.seq === where.sessionId_seq.seq) ?? null),
        create: jest.fn(async ({ data }: any) => {
          receipts.push(data);
          return data;
        }),
      },
      learningDayPlan: { findUnique: jest.fn(async () => ({ dailyGoalMinutes: 10 })) },
      userProfile: { findUnique: jest.fn(async () => ({ dailyGoalMinutes: 10 })) },
      $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join('');
        if (sql.includes('learning_activity_segments')) {
          return [{ idx: 0, seconds: todaySeconds }];
        }
        return [];
      }),
    };
    db.$transaction = jest.fn(async (cb: (tx: any) => Promise<any>) => cb(db));

    const svc = new PlanningService(
      db as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );

    // 1) Still below 600s -> goalJustMet = false
    const below = await svc.segments('u', 'session', {
      segments: [{ seq: 1, startOffsetMs: 0, endOffsetMs: 10000 }],
    });
    expect(below.goalJustMet).toBe(false);
    expect(notifications.createNotification).not.toHaveBeenCalled();

    // 2) Crosses 600s -> goalJustMet = true and creates DAILY_GOAL_MET
    todaySeconds = 605;
    const reached = await svc.segments('u', 'session', {
      segments: [{ seq: 2, startOffsetMs: 10000, endOffsetMs: 25000 }],
    });
    expect(reached.goalJustMet).toBe(true);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u',
        type: 'DAILY_GOAL_MET',
        targetType: 'DAILY_PLAN',
        targetPayload: { date: '2026-11-16', dailyGoalMinutes: 10 },
        dedupeKey: 'daily_goal_met:2026-11-16',
      }),
      db,
    );

    // 3) Subsequent segment later same day -> goalJustMet = false (already created)
    todaySeconds = 620;
    const after = await svc.segments('u', 'session', {
      segments: [{ seq: 3, startOffsetMs: 25000, endOffsetMs: 40000 }],
    });
    expect(after.goalJustMet).toBe(false);
  });
});
