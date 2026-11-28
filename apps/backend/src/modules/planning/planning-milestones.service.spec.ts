import { CefrLevel, LearningAttempt, LearningKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildCefrMilestones,
  chooseDailyItems,
  isCefrEligible,
  MilestoneLessonInput,
  PlannedLesson,
  PlanningService,
} from './planning.service';

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

describe('CEFR progress milestones and PlanningService home/progress integration', () => {
  const units = [
    { id: 'u-a1', cefrLevel: CefrLevel.A1 },
    { id: 'u-a2', cefrLevel: CefrLevel.A2 },
    { id: 'u-b1', cefrLevel: CefrLevel.B1 },
    { id: 'u-b2', cefrLevel: CefrLevel.B2 },
  ];

  it('builds per-level Y totals, excludes orphan grammar and vocabulary lessons, and resolves active milestone', () => {
    const milestoneLessons: MilestoneLessonInput[] = [
      { id: 'g-a1', unitId: 'u-b1', kind: 'GRAMMAR', grammarTopicId: 'topic-a1', grammarTopic: { cefrLevel: 'A1' } },
      { id: 'r-a1', unitId: 'u-a1', kind: 'READING', grammarTopicId: null },
      { id: 'l-a2', unitId: 'u-a2', kind: 'LISTENING', grammarTopicId: null },
      { id: 'g-b1', unitId: null, kind: 'GRAMMAR', grammarTopicId: 'topic-b1', grammarTopic: { cefrLevel: 'B1' } },
      { id: 'r-b1', unitId: 'u-b1', kind: 'READING', grammarTopicId: null },
      { id: 'g-b2', unitId: 'u-b2', kind: 'GRAMMAR', grammarTopicId: 'topic-b2', grammarTopic: null },
      { id: 'g-orphan', unitId: 'u-a1', kind: 'GRAMMAR', grammarTopicId: null, grammarTopic: null },
      { id: 'v-a1', unitId: 'u-a1', kind: 'VOCABULARY', grammarTopicId: null },
    ];

    // B1 user with A2 completed and 1/2 B1 completed -> B1 is IN_PROGRESS, A2 is COMPLETED, A1 & B2..C2 are UPCOMING
    const b1Active = buildCefrMilestones(
      milestoneLessons,
      units,
      new Set(['l-a2', 'g-b1']),
      'B1',
    );
    expect(b1Active).toEqual([
      { cefrLevel: 'A1', totalLessons: 2, completedLessonCount: 0, status: 'UPCOMING' },
      { cefrLevel: 'A2', totalLessons: 1, completedLessonCount: 1, status: 'COMPLETED' },
      { cefrLevel: 'B1', totalLessons: 2, completedLessonCount: 1, status: 'IN_PROGRESS' },
      { cefrLevel: 'B2', totalLessons: 1, completedLessonCount: 0, status: 'UPCOMING' },
      { cefrLevel: 'C1', totalLessons: 0, completedLessonCount: 0, status: 'UPCOMING' },
      { cefrLevel: 'C2', totalLessons: 0, completedLessonCount: 0, status: 'UPCOMING' },
    ]);

    // When all levels >= startCefr with lessons are completed, none is IN_PROGRESS
    const allAboveB1Done = buildCefrMilestones(
      milestoneLessons,
      units,
      new Set(['g-b1', 'r-b1', 'g-b2']),
      'B1',
    );
    expect(allAboveB1Done.map((m) => [m.cefrLevel, m.status])).toEqual([
      ['A1', 'UPCOMING'],
      ['A2', 'UPCOMING'],
      ['B1', 'COMPLETED'],
      ['B2', 'COMPLETED'],
      ['C1', 'UPCOMING'],
      ['C2', 'UPCOMING'],
    ]);

    // When all levels >= startCefr have 0 lessons, mark startCefr itself IN_PROGRESS
    const emptyAboveC1 = buildCefrMilestones(milestoneLessons, units, new Set(), 'C1');
    expect(emptyAboveC1.map((m) => [m.cefrLevel, m.status])).toEqual([
      ['A1', 'UPCOMING'],
      ['A2', 'UPCOMING'],
      ['B1', 'UPCOMING'],
      ['B2', 'UPCOMING'],
      ['C1', 'IN_PROGRESS'],
      ['C2', 'UPCOMING'],
    ]);
  });

  it('returns placementCefr and milestones from PlanningService.home and PlanningService.progress', async () => {
    const mockNow = new Date('2026-11-13T05:00:00Z');
    jest.useFakeTimers().setSystemTime(mockNow);
    try {
      const milestoneLessons: MilestoneLessonInput[] = [
        { id: 'r-a1', unitId: 'u-a1', kind: 'READING', grammarTopicId: null },
        { id: 'g-b1', unitId: 'u-b1', kind: 'GRAMMAR', grammarTopicId: 'topic-b1', grammarTopic: { cefrLevel: 'B1' } },
        { id: 'r-b1', unitId: 'u-b1', kind: 'READING', grammarTopicId: null },
        { id: 'g-orphan', unitId: 'u-b1', kind: 'GRAMMAR', grammarTopicId: null, grammarTopic: null },
        { id: 'v-b1', unitId: 'u-b1', kind: 'VOCABULARY', grammarTopicId: null },
      ];
      const fullUnits = [
        { id: 'u-a1', code: 'u-a1', cefrLevel: CefrLevel.A1, orderIndex: 1, title: 'A1', description: 'A1' },
        { id: 'u-a2', code: 'u-a2', cefrLevel: CefrLevel.A2, orderIndex: 2, title: 'A2', description: 'A2' },
        { id: 'u-b1', code: 'u-b1', cefrLevel: CefrLevel.B1, orderIndex: 3, title: 'B1', description: 'B1' },
      ];

      const db = {
        userProfile: {
          findUnique: jest.fn(async () => ({
            userId: 'u',
            dailyGoalMinutes: 10,
            preferredKinds: [LearningKind.READING],
            preferencesVersion: 0,
          })),
        },
        learningDayPlan: { findMany: jest.fn(async () => []) },
        learningAttempt: {
          findMany: jest.fn(async () => [
            {
              ...attempt('a1', 'g-b1', 5, new Date('2026-11-13T02:00:00Z')),
              lessonSnapshot: { kind: 'GRAMMAR', title: 'Grammar B1' },
            },
          ]),
        },
        learningLesson: {
          count: jest.fn(async () => 1),
          findFirst: jest.fn(async () => null),
          findMany: jest.fn(async () => milestoneLessons),
        },
        learningUnit: { findMany: jest.fn(async () => fullUnits) },
        learningActivitySession: { findFirst: jest.fn(async () => null) },
        placementSession: {
          findFirst: jest.fn(async () => ({
            estimatedCefr: CefrLevel.B1,
            skillResults: { reading: { estimatedCefr: 'B1' } },
            completedAt: new Date('2026-11-01T00:00:00Z'),
          })),
        },
        learningSkillLevel: {
          findUnique: jest.fn(async () => ({
            cefrLevel: CefrLevel.B1,
            source: 'PLACEMENT',
            previousCefr: null,
            changedAt: new Date('2026-11-01T00:00:00Z'),
          })),
        },
        $queryRaw: jest.fn(async () => []),
      };

      const svc = new PlanningService(db as unknown as PrismaService);
      const homeRes = await svc.home('u');
      expect(homeRes.placementCefr).toBe('B1');
      expect(homeRes.milestones).toEqual([
        { cefrLevel: 'A1', totalLessons: 1, completedLessonCount: 0, status: 'UPCOMING' },
        { cefrLevel: 'A2', totalLessons: 0, completedLessonCount: 0, status: 'UPCOMING' },
        { cefrLevel: 'B1', totalLessons: 2, completedLessonCount: 1, status: 'IN_PROGRESS' },
        { cefrLevel: 'B2', totalLessons: 0, completedLessonCount: 0, status: 'UPCOMING' },
        { cefrLevel: 'C1', totalLessons: 0, completedLessonCount: 0, status: 'UPCOMING' },
        { cefrLevel: 'C2', totalLessons: 0, completedLessonCount: 0, status: 'UPCOMING' },
      ]);

      const progressRes = await svc.progress('u');
      expect(progressRes.placementCefr).toBe('B1');
      expect(progressRes.units).toHaveLength(3);
      expect(progressRes.milestones).toEqual(homeRes.milestones);
    } finally {
      jest.useRealTimers();
    }
  });

  it('gracefully returns empty-count milestones in PlanningService.home when minimal mocks omit learningUnit.findMany or learningLesson.findMany', async () => {
    const minimalDb = {
      userProfile: {
        findUnique: jest.fn(async () => ({
          userId: 'u',
          dailyGoalMinutes: 10,
          preferredKinds: [LearningKind.READING],
          preferencesVersion: 0,
        })),
      },
      learningDayPlan: { findMany: jest.fn(async () => []) },
      learningAttempt: { findMany: jest.fn(async () => []) },
      learningLesson: {
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => null),
      },
      learningActivitySession: { findFirst: jest.fn(async () => null) },
      placementSession: { findFirst: jest.fn(async () => null) },
      learningSkillLevel: { findUnique: jest.fn(async () => null) },
      $queryRaw: jest.fn(async () => []),
    };

    const svc = new PlanningService(minimalDb as unknown as PrismaService);
    const homeRes = await svc.home('u');
    expect(homeRes.placementCefr).toBeNull();
    expect(homeRes.milestones).toHaveLength(6);
    expect(homeRes.milestones[0]).toEqual({
      cefrLevel: 'A1',
      totalLessons: 0,
      completedLessonCount: 0,
      status: 'IN_PROGRESS',
    });
  });

  it('enforces minimumCefr >= placementCefr in chooseDailyItems and isCefrEligible', () => {
    const catalog = [
      lesson('grammar-a1', 'GRAMMAR', 5, 1, 'u-a1', 'A1'),
      lesson('vocab-a1', 'VOCABULARY', 5, 2, 'u-a1', 'A1'),
      lesson('read-a2', 'READING', 5, 3, 'u-a2', 'A2'),
      lesson('grammar-b1', 'GRAMMAR', 5, 4, 'u-b1', 'B1'),
      lesson('read-b1', 'READING', 5, 5, 'u-b1', 'B1'),
      lesson('read-b2', 'READING', 5, 6, 'u-b2', 'B2'),
    ];
    const b1Placement = {
      reading: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5 },
      listening: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5 },
    };

    const b1Ids = chooseDailyItems(
      catalog,
      [],
      '2026-11-27',
      120,
      kinds,
      [],
      b1Placement,
      null,
      undefined,
      'B1',
    ).map((i) => i.lessonId);
    expect(b1Ids).toEqual(['grammar-b1', 'read-b1']);

    expect(isCefrEligible(catalog[0], b1Placement, null, 'B1')).toBe(false);
    expect(isCefrEligible(catalog[2], b1Placement, null, 'B1')).toBe(false);
    expect(isCefrEligible(catalog[3], b1Placement, null, 'B1')).toBe(true);
    expect(isCefrEligible(catalog[0], b1Placement, null, 'A1')).toBe(true);
  });

  it('clamps minimumCefr to reading ceiling so split-skill or adaptive-downgraded learners keep eligible READING lessons', () => {
    const readA1 = lesson('read-a1', 'READING', 5, 1, 'u-a1', 'A1');
    const readA2 = lesson('read-a2', 'READING', 5, 2, 'u-a2', 'A2');
    const readB1 = lesson('read-b1', 'READING', 5, 3, 'u-b1', 'B1');
    const splitPlacement = {
      reading: { estimatedCefr: 'A2', correctCount: 2, totalItems: 5 },
      listening: { estimatedCefr: 'B2', correctCount: 5, totalItems: 5 },
    };

    expect(isCefrEligible(readA1, splitPlacement, null, 'B1')).toBe(false);
    expect(isCefrEligible(readA2, splitPlacement, null, 'B1')).toBe(true);
    expect(isCefrEligible(readB1, splitPlacement, null, 'B1')).toBe(false);

    const downgradedTarget = {
      cefrLevel: CefrLevel.A2,
      source: 'ADAPTIVE' as const,
      strictCeiling: true,
    };
    expect(isCefrEligible(readA1, splitPlacement, downgradedTarget, 'B1')).toBe(false);
    expect(isCefrEligible(readA2, splitPlacement, downgradedTarget, 'B1')).toBe(true);
    expect(isCefrEligible(readB1, splitPlacement, downgradedTarget, 'B1')).toBe(false);
  });
});
