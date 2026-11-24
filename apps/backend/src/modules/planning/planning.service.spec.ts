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
    contentVersion: 1, eligibleForLevelEval: true,
    lessonSnapshot: {}, contentSnapshot: {}, correctCount: score, totalQuestions: 5, startedAt: submittedAt, updatedAt: submittedAt,
    submittedAt: score == null ? null : submittedAt, historyHiddenAt: null };
}
const kinds = Object.values(LearningKind);

describe('Daily planning policy', () => {
  it('reorders only target-tier Reading positions and preserves completion and budget', () => {
    const a2 = { cefrLevel: CefrLevel.A2, strictCeiling: true };
    const detail = (id: string, order: number, count: number, tier: CefrLevel = 'A2'): PlannedLesson => ({
      ...lesson(id, 'READING', 5, order, tier, tier),
      content: { questions: Array.from({ length: count }, (_, i) => ({ id: String(i), skillCode: 'reading.scanning' })) },
    });
    const catalog = [detail('plain', 1, 0), lesson('listen', 'LISTENING', 5, 2), detail('drill', 3, 2),
      detail('too-high', 4, 3, 'B1'), detail('too-low', 5, 3, 'A1')];
    const makePlan = (history: LearningAttempt[], budget: number) =>
      chooseDailyItems(catalog, history, '2026-11-02', budget, kinds, [], null, a2, 'reading.scanning');
    expect(makePlan([], 10).map(item => item.lessonId)).toEqual(['drill', 'listen']);
    expect(makePlan([], 5)[0]).toMatchObject({ reasonCode: 'NEW', focusSkillCode: 'reading.scanning', reason: 'Luyện thêm · Tìm chi tiết' });
    const history = [attempt('plain', 'plain', 0), attempt('drill', 'drill', 3)];
    expect(makePlan(history, 10).map(item => [item.lessonId, item.reasonCode])).toEqual([['listen', 'NEW'], ['drill', 'REVIEW']]);
    const done = attempt('today', 'listen', 5, now);
    const all = [...history, done, attempt('lower', 'too-low', 4)];
    expect(makePlan(all, 10).map(item => [item.lessonId, item.reasonCode])).toEqual([['listen', 'COMPLETED_TODAY'], ['drill', 'ROTATION']]);
    expect(makePlan(all, 120).find(item => item.lessonId === 'too-low')?.focusSkillCode).toBeUndefined();
    expect(makePlan(all, 10).filter(item => item.focusSkillCode)).toHaveLength(1);
  });
  it('uses the Vietnam midnight boundary without the phone timezone', () => {
    expect(learningDate(new Date('2026-11-01T16:59:59Z'))).toBe('2026-11-01');
    expect(learningDate(new Date('2026-11-01T17:00:00Z'))).toBe('2026-11-02');
    expect(learningDayStart('2026-11-02').toISOString()).toBe('2026-11-01T17:00:00.000Z');
  });
  it('does not prioritize unfinished IN_PROGRESS attempts ahead of new material', () => {
    const result = chooseDailyItems([lesson('new', 'READING', 5, 1), lesson('abandoned', 'READING', 5, 2)], [attempt('a', 'abandoned', null)], '2026-11-02', 5, kinds);
    expect(result.map(i => i.lessonId)).toEqual(['new']);
    expect(result[0].reasonCode).toBe('NEW');
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
  it('preserves completed snapshots when lowering the goal without keeping unsubmitted progress', () => {
    const lessons = [lesson('done'), lesson('second'), lesson('fresh')];
    const previous = chooseDailyItems(lessons, [], '2026-11-02', 20, kinds);
    const history = [attempt('done', 'done', 0, now), attempt('second', 'second', null)];
    const result = chooseDailyItems(lessons, history, '2026-11-02', 5, kinds, previous);
    expect(result.map(i => i.lessonId)).toEqual(['done']);
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
  it('keeps COMPLETED_TODAY items in the daily plan while ignoring over-level IN_PROGRESS attempts', () => {
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
    ]);
  });
  it('enforces strict A1 ceiling across all branches after adaptive demotion while keeping completed A2 today', () => {
    const a1Done = lesson('read-a1-old', 'READING', 5, 1, 'u-a1', 'A1');
    const a1Fresh = lesson('read-a1-fresh', 'READING', 5, 2, 'u-a1', 'A1');
    const a2CompletedToday = lesson('read-a2-done-today', 'READING', 5, 3, 'u-a2', 'A2');
    const a2Unseen = lesson('read-a2-unseen', 'READING', 5, 4, 'u-a2', 'A2');
    const yesterday = new Date('2026-11-01T06:00:00Z');
    const demotedA1 = { cefrLevel: 'A1' as const, strictCeiling: true };

    // 1. Fresh + COMPLETED_TODAY branch: A2 done today stays, unseen A2 excluded, fresh A1 chosen.
    const freshAfterDemote = chooseDailyItems(
      [a1Fresh, a2CompletedToday, a2Unseen],
      [attempt('done-a2', 'read-a2-done-today', 1, now)],
      '2026-11-02',
      30,
      kinds,
      [],
      null,
      demotedA1,
    );
    expect(freshAfterDemote.map(i => [i.lessonId, i.reasonCode])).toEqual([
      ['read-a2-done-today', 'COMPLETED_TODAY'],
      ['read-a1-fresh', 'NEW'],
    ]);
    expect(freshAfterDemote[1].reason).toBe('Bài mới · đúng mức A1');

    // 2. REVIEW branch: weak A2 from yesterday must NOT be suggested when demoted to A1.
    const reviewAfterDemote = chooseDailyItems(
      [a1Fresh, a2Unseen],
      [attempt('weak-a2', 'read-a2-unseen', 1, yesterday)],
      '2026-11-02',
      30,
      kinds,
      [],
      null,
      demotedA1,
    );
    expect(reviewAfterDemote.map(i => i.lessonId)).toEqual(['read-a1-fresh']);

    // 3. ROTATION branch: with only a1Done & yesterday-completed A2, rotates only A1.
    const rotationAfterDemote = chooseDailyItems(
      [a1Done, a2Unseen],
      [attempt('old-a1', 'read-a1-old', 4, yesterday), attempt('old-a2', 'read-a2-unseen', 1, yesterday)],
      '2026-11-02',
      30,
      kinds,
      [],
      null,
      demotedA1,
    );
    expect(rotationAfterDemote.map(i => [i.lessonId, i.reasonCode])).toEqual([['read-a1-old', 'ROTATION']]);

    // 4. Fallback branch when only A2 exists -> empty plan (no over-level leak).
    expect(chooseDailyItems([a2Unseen], [], '2026-11-02', 5, kinds, [], null, demotedA1)).toEqual([]);
  });
  it('separates remaining today budget vs next-day schedule when promoted to B1', () => {
    const a2a = lesson('a2-a', 'READING', 5, 1, 'u-a2', 'A2');
    const a2b = lesson('a2-b', 'READING', 5, 2, 'u-a2', 'A2');
    const b1 = lesson('b1-1', 'READING', 8, 3, 'u-b1', 'B1');
    const completedBothA2Today = [attempt('att1', 'a2-a', 5, now), attempt('att2', 'a2-b', 5, now)];
    const promotedB1 = { cefrLevel: 'B1' as const, strictCeiling: true };

    // Remaining today budget (20m - 10m = 10m >= 8m): adds B1 immediately today.
    const withRoom = chooseDailyItems([a2a, a2b, b1], completedBothA2Today, '2026-11-02', 20, kinds, [], null, promotedB1);
    expect(withRoom.map(i => [i.lessonId, i.reasonCode])).toEqual([
      ['a2-a', 'COMPLETED_TODAY'],
      ['a2-b', 'COMPLETED_TODAY'],
      ['b1-1', 'NEW'],
    ]);
    expect(withRoom[2].reason).toBe('Bài mới · đúng mức B1');

    // Full today budget (10m used out of 10m): does NOT overflow today; B1 schedules first on next day.
    const fullBudget = chooseDailyItems([a2a, a2b, b1], completedBothA2Today, '2026-11-02', 10, kinds, [], null, promotedB1);
    expect(fullBudget.map(i => [i.lessonId, i.reasonCode])).toEqual([
      ['a2-a', 'COMPLETED_TODAY'],
      ['a2-b', 'COMPLETED_TODAY'],
    ]);
    const nextDay = chooseDailyItems([a2a, a2b, b1], completedBothA2Today, '2026-11-03', 10, kinds, [], null, promotedB1);
    expect(nextDay.map(i => [i.lessonId, i.reasonCode])).toEqual([['b1-1', 'NEW']]);
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
        placementSession: { findFirst: jest.fn(async () => ({ skillResults: { reading: { estimatedCefr: 'B1' } }, completedAt: new Date('2026-11-01T00:00:00Z') })) },
        learningSkillLevel: { findUnique: jest.fn(async () => ({ cefrLevel: 'B2', source: 'ADAPTIVE', previousCefr: 'B1', changedAt: new Date('2026-11-12T10:00:00Z') })) },
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
      expect(res.recommendedLevels.reading).toEqual({
        cefrLevel: 'B2',
        source: 'ADAPTIVE',
        previousCefr: 'B1',
        changedAt: new Date('2026-11-12T10:00:00Z'),
      });
      expect(res.totals.averageStudyMinutes).toBe(2);
      expect(res.totals.averageActiveSeconds).toBe(120);
    } finally {
      jest.useRealTimers();
    }
  });
  it.each(['baseline-v1', 'adaptive-v1'])('upgrades persisted %s plans to adaptive-v2 on today() / ensureToday()', async (oldPolicyVersion) => {
    jest.useFakeTimers().setSystemTime(now);
    try {
      const legacyPlan = {
        id: 'plan-1', userId: 'u', date: '2026-11-02', version: 0,
        preferencesVersion: 2, dailyGoalMinutes: 15, policyVersion: oldPolicyVersion,
        items: [{ id: 'old-item', lessonId: 'read-a2', title: 'Old', kind: 'READING', estimatedMinutes: 5, reasonCode: 'NEW', reason: 'Bài mới' }],
        createdAt: now, updatedAt: now,
      };
      let stored = legacyPlan;
      const upsert = jest.fn(async ({ create, update }: any) => {
        stored = { ...stored, ...create, ...update, version: stored.version + 1 };
        return stored;
      });
      const db: Record<string, any> = {
        userProfile: { findUnique: jest.fn(async () => ({ userId: 'u', dailyGoalMinutes: 15, preferredKinds: ['READING'], preferencesVersion: 2 })) },
        learningDayPlan: {
          findUnique: jest.fn(async () => stored),
          upsert,
        },
        learningLesson: { findMany: jest.fn(async () => [lesson('read-b1', 'READING', 8, 1, 'u-b1', 'B1'), lesson('read-a2', 'READING', 5, 2, 'u-a2', 'A2')]) },
        learningAttempt: { findMany: jest.fn(async () => []) },
        placementSession: { findFirst: jest.fn(async () => ({ skillResults: { reading: { estimatedCefr: 'B1' } }, completedAt: now })) },
        learningSkillLevel: {
          findUnique: jest.fn(async () => ({ id: 'sl-1', userId: 'u', kind: 'READING', cefrLevel: 'B1', source: 'PLACEMENT', previousCefr: null, changedAt: now })),
          create: jest.fn(),
        },
        $queryRaw: jest.fn(async () => []),
      };
      db.$transaction = jest.fn(async (work: (tx: unknown) => Promise<unknown>): Promise<unknown> => work(db));
      const svc = new PlanningService(db as unknown as PrismaService);
      const res = await svc.today('u');
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(res.plan?.policyVersion).toBe('adaptive-v2');
      expect(res.plan?.items.map((i: any) => [i.lessonId, i.reason])).toEqual([
        ['read-b1', 'Bài mới · đúng mức B1'],
        ['read-a2', 'Bài mới'],
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

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
          policyVersion: 'adaptive-v2',
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
});
