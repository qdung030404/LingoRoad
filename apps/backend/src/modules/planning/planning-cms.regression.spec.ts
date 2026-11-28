import { LearningAttempt, LearningKind } from '@prisma/client';
import { PlanningService, learningDate, PlannedLesson } from './planning.service';
import { PrismaService } from '../prisma/prisma.service';
import { CURRENT_PLAN_POLICY_VERSION } from './planning.helpers';
describe('Daily plan reconciles CMS changes', () => {
  it.each([false, true])('replaces removed pending lessons and retains completed snapshots (completed=%s)', async completed => {
    const now = new Date();
    const oldItem = { id: 'old-slot', lessonId: 'removed', title: 'Removed', kind: LearningKind.GRAMMAR, estimatedMinutes: 5, reasonCode: 'NEW', reason: 'New' };
    const oldPlan = { id: 'plan', userId: 'user', date: learningDate(now), policyVersion: CURRENT_PLAN_POLICY_VERSION, preferencesVersion: 0, dailyGoalMinutes: 10, version: 0, items: [oldItem], updatedAt: now };
    const fresh: PlannedLesson = { id: 'fresh', code: 'fresh', kind: 'GRAMMAR', title: 'Fresh', description: 'Fresh', estimatedMinutes: 5, sortOrder: 1, published: true, contentVersion: 1, content: {}, unitId: null, createdAt: now, updatedAt: now };
    const attempts = completed ? [{ id: 'done', userId: 'user', lessonId: 'removed', status: 'COMPLETED', submittedAt: now, updatedAt: now, correctCount: 5, totalQuestions: 5, historyHiddenAt: null } as LearningAttempt] : [];
    const db = {
      $queryRaw: jest.fn(async () => []),
      learningDayPlan: { findUnique: jest.fn(async () => oldPlan), upsert: jest.fn(async ({ update }) => ({ ...oldPlan, ...update, version: 1 })) },
      userProfile: { findUnique: jest.fn(async () => ({ preferencesVersion: 0, dailyGoalMinutes: 10, preferredKinds: ['GRAMMAR'] })) },
      placementSession: { findFirst: jest.fn(async () => null) },
      learningAttempt: { findMany: jest.fn(async () => attempts) },
      learningLesson: { findMany: jest.fn(async () => [fresh]) },
    };
    const prisma = { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) };
    const result = await new PlanningService(prisma as unknown as PrismaService).today('user');
    expect(result.plan?.continueLessonId).toBe('fresh');
    expect(result.plan?.items.filter(item => item.lessonId === 'removed')).toHaveLength(completed ? 1 : 0);
    if (completed) expect(result.plan?.items[0]).toMatchObject({ ...oldItem, completed: true });
  });

  it('skips row locks and heavy content reads on today() when the existing plan already matches live lessons', async () => {
    const now = new Date();
    const existingItem = { id: 'slot-1', lessonId: 'fresh', title: 'Fresh', kind: LearningKind.GRAMMAR, estimatedMinutes: 5, reasonCode: 'NEW', reason: 'Bài mới' };
    const existingPlan = { id: 'plan', userId: 'user', date: learningDate(now), policyVersion: CURRENT_PLAN_POLICY_VERSION, preferencesVersion: 0, dailyGoalMinutes: 10, version: 0, items: [existingItem], updatedAt: now };
    const fresh: PlannedLesson = { id: 'fresh', code: 'fresh', kind: 'GRAMMAR', title: 'Fresh', estimatedMinutes: 5, sortOrder: 1, unit: null };
    const db = {
      $queryRaw: jest.fn(async () => []),
      learningDayPlan: { findUnique: jest.fn(async () => existingPlan), upsert: jest.fn() },
      userProfile: { findUnique: jest.fn(async () => ({ preferencesVersion: 0, dailyGoalMinutes: 10, preferredKinds: ['GRAMMAR'] })) },
      placementSession: { findFirst: jest.fn(async () => null) },
      learningAttempt: { findMany: jest.fn(async () => []) },
      learningLesson: { findMany: jest.fn(async () => [fresh]) },
    };
    const transaction = jest.fn(async (fn: (tx: typeof db) => unknown) => fn(db));
    const prisma = { ...db, $transaction: transaction };
    const result = await new PlanningService(prisma as unknown as PrismaService).today('user');
    expect(result.plan?.items.map(item => item.lessonId)).toEqual(['fresh']);
    expect(transaction).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.learningDayPlan.upsert).not.toHaveBeenCalled();
    expect(db.learningLesson.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { published: true },
      select: expect.not.objectContaining({ content: true }),
    }));
  });

  it('fetches content only for target-tier reading lessons when reading focus ranking is active', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const completedAttempts = ['prev-1', 'prev-2'].map(id => ({
      id,
      userId: 'user',
      lessonId: id,
      status: 'COMPLETED',
      submittedAt: yesterday,
      updatedAt: yesterday,
      correctCount: 1,
      totalQuestions: 3,
      eligibleForLevelEval: true,
      contentVersion: 4,
      lessonSnapshot: { kind: 'READING', cefrLevel: 'A2', code: id },
      contentSnapshot: { questions: [{ id: 'q1', skillCode: 'reading.scanning' }] },
      historyHiddenAt: null,
    })) as unknown as LearningAttempt[];
    const metadataLessons: PlannedLesson[] = [
      { id: 'r-plain', code: 'r-plain', kind: 'READING', title: 'Plain', estimatedMinutes: 5, sortOrder: 1, unit: { cefrLevel: 'A2' } },
      { id: 'g-1', code: 'g-1', kind: 'GRAMMAR', title: 'Grammar', estimatedMinutes: 5, sortOrder: 2, unit: { cefrLevel: 'A2' } },
      { id: 'r-drill', code: 'r-drill', kind: 'READING', title: 'Drill', estimatedMinutes: 5, sortOrder: 3, unit: { cefrLevel: 'A2' } },
      { id: 'r-a1', code: 'r-a1', kind: 'READING', title: 'Lower', estimatedMinutes: 5, sortOrder: 4, unit: { cefrLevel: 'A1' } },
    ];
    const findLessons = jest.fn(async (args: { select?: Record<string, unknown> }) => {
      if (args.select?.content) {
        return [
          { id: 'r-plain', content: { questions: [{ id: 'q1' }] } },
          { id: 'r-drill', content: { questions: [{ id: 'q1', skillCode: 'reading.scanning' }, { id: 'q2', skillCode: 'reading.scanning' }] } },
        ];
      }
      return metadataLessons;
    });
    const db = {
      $queryRaw: jest.fn(async () => []),
      learningDayPlan: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async ({ create }) => ({ id: 'plan', version: 0, updatedAt: now, ...create })),
      },
      userProfile: { findUnique: jest.fn(async () => ({ preferencesVersion: 0, dailyGoalMinutes: 5, preferredKinds: ['READING', 'GRAMMAR'] })) },
      placementSession: { findFirst: jest.fn(async () => null) },
      learningSkillLevel: { findUnique: jest.fn(async () => ({ id: 'sl', userId: 'user', kind: 'READING', cefrLevel: 'A2', source: 'ADAPTIVE', previousCefr: null, changedAt: null })) },
      learningAnswerExposure: { findMany: jest.fn(async () => completedAttempts.map(a => ({ lessonId: a.lessonId, firstAttemptId: a.id }))) },
      learningAttemptAnswer: { findMany: jest.fn(async () => completedAttempts.map(a => ({ attemptId: a.id, questionId: 'q1', isCorrect: false }))) },
      learningAttempt: { findMany: jest.fn(async () => completedAttempts) },
      learningLesson: { findMany: findLessons },
    };
    const prisma = { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) };
    const result = await new PlanningService(prisma as unknown as PrismaService).ensureToday('user');
    expect(result.plan?.items[0]).toMatchObject({ lessonId: 'r-drill', focusSkillCode: 'reading.scanning' });
    expect(findLessons).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { published: true },
      select: expect.not.objectContaining({ content: true }),
    }));
    expect(findLessons).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ['r-plain', 'r-drill'] } },
      select: { id: true, content: true },
    });
  });

  it('omits contentSnapshot from main learningAttempt.findMany reads and hydrates snapshots only for eligible reading-focus candidates', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const slimAttempts = [
      {
        id: 'att-grammar',
        lessonId: 'g-1',
        status: 'COMPLETED',
        submittedAt: yesterday,
        correctCount: 5,
        totalQuestions: 5,
        contentVersion: 1,
        eligibleForLevelEval: true,
        lessonSnapshot: { kind: 'GRAMMAR', cefrLevel: 'A2', code: 'g-1' },
      },
      {
        id: 'att-r1',
        lessonId: 'r-1',
        status: 'COMPLETED',
        submittedAt: yesterday,
        correctCount: 1,
        totalQuestions: 3,
        contentVersion: 4,
        eligibleForLevelEval: true,
        lessonSnapshot: { kind: 'READING', cefrLevel: 'A2', code: 'r-1' },
      },
      {
        id: 'att-r2',
        lessonId: 'r-2',
        status: 'COMPLETED',
        submittedAt: yesterday,
        correctCount: 1,
        totalQuestions: 3,
        contentVersion: 4,
        eligibleForLevelEval: true,
        lessonSnapshot: { kind: 'READING', cefrLevel: 'A2', code: 'r-2' },
      },
    ];

    const findAttempts = jest.fn(async (args: { select?: Record<string, unknown> }) => {
      if (args.select?.contentSnapshot) {
        return [
          { id: 'att-r1', contentSnapshot: { questions: [{ id: 'q1', skillCode: 'reading.scanning' }] } },
          { id: 'att-r2', contentSnapshot: { questions: [{ id: 'q1', skillCode: 'reading.scanning' }] } },
        ];
      }
      return slimAttempts;
    });
    const metadataLessons: PlannedLesson[] = [
      { id: 'r-plain', code: 'r-plain', kind: 'READING', title: 'Plain', estimatedMinutes: 5, sortOrder: 1, unit: { cefrLevel: 'A2' } },
      { id: 'r-drill', code: 'r-drill', kind: 'READING', title: 'Drill', estimatedMinutes: 5, sortOrder: 2, unit: { cefrLevel: 'A2' } },
    ];
    const findLessons = jest.fn(async (args: { select?: Record<string, unknown> }) => {
      if (args.select?.content) {
        return [
          { id: 'r-plain', content: { questions: [{ id: 'q1' }] } },
          { id: 'r-drill', content: { questions: [{ id: 'q1', skillCode: 'reading.scanning' }] } },
        ];
      }
      return metadataLessons;
    });

    const db = {
      $queryRaw: jest.fn(async () => []),
      learningDayPlan: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(async ({ create }) => ({ id: 'plan', version: 0, updatedAt: now, ...create })),
      },
      userProfile: { findUnique: jest.fn(async () => ({ preferencesVersion: 0, dailyGoalMinutes: 5, preferredKinds: ['READING'] })) },
      placementSession: { findFirst: jest.fn(async () => null) },
      learningSkillLevel: { findUnique: jest.fn(async () => ({ id: 'sl', userId: 'user', kind: 'READING', cefrLevel: 'A2', source: 'ADAPTIVE', previousCefr: null, changedAt: null })) },
      learningAnswerExposure: {
        findMany: jest.fn(async () => [
          { lessonId: 'r-1', firstAttemptId: 'att-r1' },
          { lessonId: 'r-2', firstAttemptId: 'att-r2' },
        ]),
      },
      learningAttemptAnswer: {
        findMany: jest.fn(async () => [
          { attemptId: 'att-r1', questionId: 'q1', isCorrect: false },
          { attemptId: 'att-r2', questionId: 'q1', isCorrect: false },
        ]),
      },
      learningAttempt: { findMany: findAttempts },
      learningLesson: { findMany: findLessons },
    };
    const prisma = { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) };

    const result = await new PlanningService(prisma as unknown as PrismaService).ensureToday('user');
    expect(result.plan?.items[0]).toMatchObject({ lessonId: 'r-drill', focusSkillCode: 'reading.scanning' });
    expect(findAttempts).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { userId: 'user' },
      select: expect.not.objectContaining({ contentSnapshot: true }),
    }));
    expect(findAttempts).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ['att-r1', 'att-r2'] } },
      select: { id: true, contentSnapshot: true },
    });
  });
});
