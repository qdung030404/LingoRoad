import { BadRequestException, ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { CefrLevel, LearningAttempt, LearningKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildProgressUnits, chooseDailyItems, computeScoreStats, isCefrEligible, learningDate, learningDayStart, PlannedLesson, PlanningService } from './planning.service';

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
    published: true, contentVersion: 1, unitId, unit: cefrLevel ? { cefrLevel } : null,
    content: {}, createdAt: now, updatedAt: now,
  };
}
function attempt(id: string, lessonId: string, score: number | null, submittedAt = new Date('2026-11-01T06:00:00Z')): LearningAttempt {
  return { id, userId: 'u', lessonId, status: score == null ? 'IN_PROGRESS' : 'COMPLETED', version: 0, phase: 'QUIZ', positionIndex: 0,
    lessonSnapshot: {}, contentSnapshot: {}, correctCount: score, totalQuestions: 5, startedAt: submittedAt, updatedAt: submittedAt,
    submittedAt: score == null ? null : submittedAt };
}
const kinds = Object.values(LearningKind);

describe('Daily planning policy', () => {
  it('uses the Vietnam midnight boundary without the phone timezone', () => {
    expect(learningDate(new Date('2026-11-01T16:59:59Z'))).toBe('2026-11-01');
    expect(learningDate(new Date('2026-11-01T17:00:00Z'))).toBe('2026-11-02');
    expect(learningDayStart('2026-11-02').toISOString()).toBe('2026-11-01T17:00:00.000Z');
  });
  it('prioritizes an unfinished lesson before new material', () => {
    const result = chooseDailyItems([lesson('new'), lesson('active')], [attempt('a', 'active', null)], '2026-11-02', 5, kinds);
    expect(result.map(i => i.lessonId)).toEqual(['active']);
    expect(result[0].reasonCode).toBe('RESUME');
  });
  it('chooses new material before at most one low-score review', () => {
    const lessons = [lesson('weak'), lesson('otherweak'), lesson('new')];
    const history = [attempt('w', 'weak', 0), attempt('o', 'otherweak', 2)];
    expect(chooseDailyItems(lessons, history, '2026-11-02', 5, kinds).map(i => i.lessonId)).toEqual(['new']);
    expect(chooseDailyItems(lessons, history, '2026-11-02', 20, kinds).map(i => i.lessonId)).toEqual(['new', 'weak']);
  });
  it('uses the latest result instead of the worst historical attempt', () => {
    const history = [attempt('old', 'improved', 0), attempt('new', 'improved', 5, new Date('2026-11-01T12:00:00Z'))];
    const result = chooseDailyItems([lesson('improved'), lesson('new')], history, '2026-11-02', 20, kinds);
    expect(result.map(i => i.lessonId)).toEqual(['new']);
  });
  it('does not classify 4/5 as a low-score review', () => {
    expect(chooseDailyItems([lesson('four'), lesson('new')], [attempt('a', 'four', 4)], '2026-11-02', 20, kinds).map(i => i.lessonId)).toEqual(['new']);
  });
  it('allows one oversized lesson but never duplicates curriculum to fill a large budget', () => {
    expect(chooseDailyItems([lesson('long', 'GRAMMAR', 10)], [], '2026-11-02', 5, kinds)).toHaveLength(1);
    const lessons = [lesson('a'), lesson('b')];
    const result = chooseDailyItems(lessons, [], '2026-11-02', 120, kinds);
    expect(result).toHaveLength(2);
    expect(new Set(result.map(i => i.lessonId)).size).toBe(2);
    expect(chooseDailyItems([lesson('long', 'GRAMMAR', 10), lesson('fits')], [], '2026-11-02', 5, kinds).map(i => i.lessonId)).toEqual(['fits']);
  });
  it('preserves completed and active snapshots when lowering the goal', () => {
    const lessons = [lesson('done'), lesson('active'), lesson('fresh')];
    const previous = chooseDailyItems(lessons, [], '2026-11-02', 20, kinds);
    const history = [attempt('done', 'done', 0, now), attempt('active', 'active', null)];
    const result = chooseDailyItems(lessons, history, '2026-11-02', 5, kinds, previous);
    expect(result.map(i => i.lessonId)).toEqual(['done', 'active']);
    expect(result[0].id).toBe(previous.find(i => i.lessonId === 'done')!.id);
  });
  it('rotates previously completed lessons by oldest practice, not repeatedly by weakest score', () => {
    const result = chooseDailyItems([lesson('old'), lesson('weak')], [attempt('o', 'old', 5), attempt('w', 'weak', 0, new Date('2026-11-01T12:00:00Z'))], '2026-11-02', 5, kinds);
    expect(result[0].lessonId).toBe('old');
    expect(result[0].reasonCode).toBe('ROTATION');
  });
  it('uses preferred groups, then weaker reading/listening placement to break unseen ordering', () => {
    const lessons = [lesson('listen', 'LISTENING'), lesson('read', 'READING')];
    const placement = { reading: { correctCount: 1, totalItems: 5 }, listening: { correctCount: 4, totalItems: 5 } };
    expect(chooseDailyItems(lessons, [], '2026-11-02', 5, kinds, [], placement)[0].lessonId).toBe('read');
    expect(chooseDailyItems(lessons, [], '2026-11-02', 5, ['LISTENING'], [], placement)[0].lessonId).toBe('listen');
  });
  it('defaults placement ceiling to A2 when placement is missing or A1, while allowing unassigned-unit lessons', () => {
    const catalog = [
      lesson('unassigned', 'READING', 5, 1, null, null),
      lesson('read-a1', 'READING', 5, 2, 'u-a1', 'A1'),
      lesson('read-a2', 'READING', 5, 3, 'u-a2', 'A2'),
      lesson('read-b1', 'READING', 5, 4, 'u-b1', 'B1'),
      lesson('read-c1', 'READING', 5, 5, 'u-c1', 'C1'),
    ];
    expect(chooseDailyItems(catalog, [], '2026-11-02', 120, kinds).map(i => i.lessonId)).toEqual(['unassigned', 'read-a1', 'read-a2']);
    const a1Placement = { reading: { estimatedCefr: 'A1', correctCount: 1, totalItems: 5 }, listening: { estimatedCefr: 'A1', correctCount: 1, totalItems: 5 } };
    expect(chooseDailyItems(catalog, [], '2026-11-02', 120, kinds, [], a1Placement).map(i => i.lessonId)).toEqual(['unassigned', 'read-a1', 'read-a2']);
    expect(isCefrEligible(lesson('orphan', 'GRAMMAR', 5, 1, null, null), a1Placement)).toBe(true);
  });
  it('filters READING and LISTENING independently by each skill Placement ceiling (Reading B1 / Listening A2)', () => {
    const catalog = [
      lesson('read-a2', 'READING', 5, 1, 'u-a2', 'A2'),
      lesson('read-b1', 'READING', 5, 2, 'u-b1', 'B1'),
      lesson('read-b2', 'READING', 5, 3, 'u-b2', 'B2'),
      lesson('read-c1', 'READING', 5, 4, 'u-c1', 'C1'),
      lesson('listen-a2', 'LISTENING', 5, 5, 'u-a2', 'A2'),
      lesson('listen-b1', 'LISTENING', 5, 6, 'u-b1', 'B1'),
      lesson('grammar-b1', 'GRAMMAR', 5, 7, 'u-b1', 'B1'),
      lesson('vocab-b2', 'VOCABULARY', 5, 8, 'u-b2', 'B2'),
    ];
    const placement = {
      reading: { estimatedCefr: 'B1', correctCount: 3, totalItems: 5 },
      listening: { estimatedCefr: 'A2', correctCount: 2, totalItems: 5 },
    };
    const ids = chooseDailyItems(catalog, [], '2026-11-02', 120, kinds, [], placement).map(i => i.lessonId);
    expect(ids).toContain('read-a2');
    expect(ids).toContain('read-b1');
    expect(ids).toContain('listen-a2');
    expect(ids).toContain('grammar-b1');
    expect(ids).not.toContain('read-b2');
    expect(ids).not.toContain('read-c1');
    expect(ids).not.toContain('listen-b1');
    expect(ids).not.toContain('vocab-b2');
  });
  it('applies CEFR ceiling across REVIEW, ROTATION, and fallback, returning empty when only over-level lessons exist', () => {
    const placement = { reading: { estimatedCefr: 'A2', correctCount: 2, totalItems: 5 } };
    const yesterday = new Date('2026-11-01T06:00:00Z');
    const a2Lesson = lesson('read-a2', 'READING', 5, 1, 'u-a2', 'A2');
    const b1Lesson = lesson('read-b1', 'READING', 5, 2, 'u-b1', 'B1');
    const b2Lesson = lesson('read-b2', 'READING', 5, 3, 'u-b2', 'B2');

    // REVIEW branch: weak B1 attempt (2/5) must not be re-suggested to an A2 reader even with fresh A2 room
    const reviewPlan = chooseDailyItems(
      [a2Lesson, b1Lesson],
      [attempt('prev-b1-weak', 'read-b1', 2, yesterday)],
      '2026-11-02',
      30,
      kinds,
      [],
      placement,
    );
    expect(reviewPlan.map(i => i.lessonId)).toEqual(['read-a2']);

    // ROTATION branch: all eligible completed at 100%, B1 previously completed must not rotate back in
    const rotationPlan = chooseDailyItems(
      [a2Lesson, b1Lesson],
      [attempt('prev-a2-full', 'read-a2', 5, yesterday), attempt('prev-b1-full', 'read-b1', 5, new Date('2026-10-30T06:00:00Z'))],
      '2026-11-02',
      30,
      kinds,
      [],
      placement,
    );
    expect(rotationPlan.map(i => i.lessonId)).toEqual(['read-a2']);
    expect(rotationPlan[0].reasonCode).toBe('ROTATION');

    // Fallback branch: when catalogue only contains over-level lessons and no active attempt, plan is empty
    const overLevelOnly = chooseDailyItems([b1Lesson, b2Lesson], [], '2026-11-02', 5, kinds, [], placement);
    expect(overLevelOnly).toEqual([]);
  });
  it('keeps over-level IN_PROGRESS (RESUME) and COMPLETED_TODAY items in the daily plan', () => {
    const placement = { reading: { estimatedCefr: 'A2', correctCount: 2, totalItems: 5 } };
    const c1Active = lesson('read-c1-active', 'READING', 5, 1, 'u-c1', 'C1');
    const c1DoneToday = lesson('read-c1-done', 'READING', 5, 2, 'u-c1', 'C1');
    const b1Over = lesson('read-b1-over', 'READING', 5, 3, 'u-b1', 'B1');
    const history = [
      attempt('att-active', 'read-c1-active', null, yesterdayOrToday()),
      attempt('att-done', 'read-c1-done', 4, now),
    ];
    function yesterdayOrToday() { return new Date('2026-11-02T04:00:00Z'); }
    const result = chooseDailyItems([c1Active, c1DoneToday, b1Over], history, '2026-11-02', 30, kinds, [], placement);
    expect(result.map(i => [i.lessonId, i.reasonCode])).toEqual([
      ['read-c1-done', 'COMPLETED_TODAY'],
      ['read-c1-active', 'RESUME'],
    ]);
  });
});

describe('Activity receipt persistence', () => {
  const anchor = new Date('2026-11-02T05:00:00Z');
  let service: PlanningService;
  let db: { [key: string]: any };
  let receipts: any[];
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    receipts = [];
    db = {
      learningActivitySession: { findFirst: jest.fn(async () => ({ id: 'session', userId: 'u', anchorAt: anchor, attempt: { submittedAt: null } })) },
      learningActivitySegment: {
        findUnique: jest.fn(async ({ where }: any) => receipts.find(r => r.seq === where.sessionId_seq.seq) ?? null),
        create: jest.fn(async ({ data }: any) => { receipts.push(data); return data; }),
      },
      $queryRaw: jest.fn(), $transaction: jest.fn(async (work: (tx: unknown) => unknown) => work(db)),
    };
    service = new PlanningService(db as unknown as PrismaService);
  });
  afterEach(() => jest.useRealTimers());
  it('ACKs exact receipts after retries and accepts out-of-order sequence numbers', async () => {
    const segments = [{ seq: 8, startOffsetMs: 1000, endOffsetMs: 15000 }, { seq: 2, startOffsetMs: 15000, endOffsetMs: 30000 }];
    const first = await service.segments('u', 'session', { segments });
    expect(await service.segments('u', 'session', { segments })).toEqual(first);
    expect(first.acks.map(a => a.seq)).toEqual([8, 2]);
    expect(receipts).toHaveLength(2);
  });
  it('rejects reuse of an accepted sequence with different offsets', async () => {
    await service.segments('u', 'session', { segments: [{ seq: 1, startOffsetMs: 0, endOffsetMs: 1000 }] });
    await expect(service.segments('u', 'session', { segments: [{ seq: 1, startOffsetMs: 0, endOffsetMs: 2000 }] })).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects invalid lengths, expired uploads, and foreign activity sessions', async () => {
    await expect(service.segments('u', 'session', { segments: [{ seq: 1, startOffsetMs: 0, endOffsetMs: 15001 }] })).rejects.toBeInstanceOf(BadRequestException);
    jest.setSystemTime(new Date(anchor.getTime() + 8 * 86400000));
    await expect(service.segments('u', 'session', { segments: [{ seq: 2, startOffsetMs: 0, endOffsetMs: 1000 }] })).rejects.toBeInstanceOf(GoneException);
    db.learningActivitySession.findFirst.mockResolvedValue(null);
    await expect(service.segments('other', 'session', { segments: [{ seq: 2, startOffsetMs: 0, endOffsetMs: 1000 }] })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('limits accepted intervals to server time and the actual submission boundary', async () => {
    db.learningActivitySession.findFirst.mockResolvedValue({ id: 'session', anchorAt: now, attempt: { submittedAt: new Date(now.getTime() - 1000) } });
    const result = await service.segments('u', 'session', { segments: [{ seq: 0, startOffsetMs: 0, endOffsetMs: 10000 }] });
    expect(result.acks[0]).toEqual({ seq: 0, startAt: null, endAt: null });
  });
});

describe('Progress roadmap units and score stats', () => {
  const units = [
    { id: 'u1', code: 'a1-unit-1', cefrLevel: 'A1' as const, orderIndex: 1, title: 'Chặng 1', description: 'Mô tả 1' },
    { id: 'u2', code: 'a1-unit-2', cefrLevel: 'A1' as const, orderIndex: 2, title: 'Chặng 2', description: 'Mô tả 2' },
    { id: 'u3', code: 'a1-unit-3', cefrLevel: 'A1' as const, orderIndex: 3, title: 'Chặng 3', description: 'Mô tả 3' },
  ];
  const lessons = [
    { id: 'l1', unitId: 'u1' },
    { id: 'l2', unitId: 'u1' },
    { id: 'l3', unitId: 'u2' },
  ];

  it('marks the first incomplete unit as IN_PROGRESS and transitions when completed', () => {
    const initial = buildProgressUnits(units, lessons, new Set(['l1']));
    expect(initial.map((u) => [u.code, u.completedLessonCount, u.totalLessons, u.status])).toEqual([
      ['a1-unit-1', 1, 2, 'IN_PROGRESS'],
      ['a1-unit-2', 0, 1, 'UPCOMING'],
      ['a1-unit-3', 0, 0, 'UPCOMING'],
    ]);

    const stageOneDone = buildProgressUnits(units, lessons, new Set(['l1', 'l2']));
    expect(stageOneDone.map((u) => [u.code, u.completedLessonCount, u.totalLessons, u.status])).toEqual([
      ['a1-unit-1', 2, 2, 'COMPLETED'],
      ['a1-unit-2', 0, 1, 'IN_PROGRESS'],
      ['a1-unit-3', 0, 0, 'UPCOMING'],
    ]);
  });

  it('computes 0-100 practice averages and Vietnam-timezone 7-day trend', () => {
    const currentNow = new Date('2026-11-13T05:00:00Z'); // 12:00 VN on 2026-11-13
    const attempts = [
      attempt('prev-1', 'l1', 3, new Date('2026-11-05T10:00:00Z')), // 60% in previous 7-day window
      attempt('prev-2', 'l2', 4, new Date('2026-11-06T10:00:00Z')), // 80% -> prev avg 70
      attempt('curr-1', 'l1', 4, new Date('2026-11-10T10:00:00Z')), // 80% in current 7-day window
      attempt('curr-2', 'l2', 5, new Date('2026-11-13T02:00:00Z')), // 100% -> curr avg 90
      attempt('draft', 'l3', null, new Date('2026-11-13T03:00:00Z')),
    ];
    expect(computeScoreStats(attempts, currentNow)).toEqual({
      averageScore: 80,
      completedAttemptCount: 4,
      currentWeekAverage: 90,
      previousWeekAverage: 70,
      deltaPercent: 20,
    });
    expect(computeScoreStats([], currentNow)).toEqual({
      averageScore: null,
      completedAttemptCount: 0,
      currentWeekAverage: null,
      previousWeekAverage: null,
      deltaPercent: null,
    });
  });

  it('returns units, scoreStats, and averageStudyMinutes from PlanningService.progress', async () => {
    const mockNow = new Date('2026-11-13T05:00:00Z');
    jest.useFakeTimers().setSystemTime(mockNow);
    try {
      const db = {
        userProfile: { findUnique: jest.fn(async () => ({ userId: 'u', dailyGoalMinutes: 10, preferredKinds: ['READING'], preferencesVersion: 0 })) },
        learningDayPlan: { findMany: jest.fn(async () => []) },
        learningAttempt: {
          findMany: jest.fn(async () => [
            { ...attempt('a1', 'l1', 4, new Date('2026-11-13T02:00:00Z')), lessonSnapshot: { kind: 'READING', title: 'R1' } },
            { ...attempt('a0', 'l1', 3, new Date('2026-11-05T02:00:00Z')), lessonSnapshot: { kind: 'READING', title: 'R1' } },
          ]),
        },
        learningLesson: { findMany: jest.fn(async () => lessons) },
        learningUnit: { findMany: jest.fn(async () => units) },
        learningActivitySession: { findFirst: jest.fn(async () => ({ anchorAt: new Date('2026-11-12T00:00:00Z') })) },
        placementSession: { findFirst: jest.fn(async () => null) },
        $queryRaw: jest.fn(async () => [{ milliseconds: 120000 }]),
      };
      const svc = new PlanningService(db as unknown as PrismaService);
      const res = await svc.progress('u');
      expect(res.units).toHaveLength(3);
      expect(res.units[0].completedLessonCount).toBe(1);
      expect(res.scoreStats).toEqual({
        averageScore: 70,
        completedAttemptCount: 2,
        currentWeekAverage: 80,
        previousWeekAverage: 60,
        deltaPercent: 20,
      });
      expect(res.totals.averageStudyMinutes).toBe(2);
      expect(res.totals.averageActiveSeconds).toBe(120);
    } finally {
      jest.useRealTimers();
    }
  });
});
