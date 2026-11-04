import { BadRequestException, ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { LearningAttempt, LearningKind, LearningLesson } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { chooseDailyItems, learningDate, learningDayStart, PlanningService } from './planning.service';

const now = new Date('2026-11-02T06:00:00Z');
function lesson(id: string, kind: LearningKind = 'READING', minutes = 5, order = 1): LearningLesson {
  return { id, code: id, kind, title: id, description: id, estimatedMinutes: minutes, sortOrder: order,
    published: true, contentVersion: 1, content: {}, createdAt: now, updatedAt: now };
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
