import { CefrLevel, LearningAttempt } from '@prisma/client';
import { chooseReadingFocus, selectReadingFocusAttempts } from './reading-focus.policy';

const now = new Date('2026-11-17T12:00:00Z');
const day = 86_400_000;
const level = { cefrLevel: CefrLevel.A2, changedAt: null };

function attempt(id: string, daysAgo = 1, overrides: Partial<LearningAttempt> = {}): LearningAttempt {
  return {
    id, lessonId: id, status: 'COMPLETED', submittedAt: new Date(now.getTime() - daysAgo * day),
    totalQuestions: 3, correctCount: 1, eligibleForLevelEval: true, contentVersion: 4,
    lessonSnapshot: { kind: 'READING', cefrLevel: 'A2', code: id },
    contentSnapshot: {
      questions: [
        { id: 'detail', skillCode: 'reading.scanning' },
        { id: 'inference', skillCode: 'reading.inference' },
        { id: 'unmapped' },
      ],
    },
    ...overrides,
  } as LearningAttempt;
}

function answer(attemptId: string, questionId: string, isCorrect: boolean | null = false) {
  return { attemptId, questionId, isCorrect };
}

describe('Reading focus evidence', () => {
  it('limits evidence to the latest ten valid first exposures at the current level within 30 days', () => {
    const valid = Array.from({ length: 11 }, (_, index) => attempt(`valid-${index}`, index + 1));
    const excluded = [
      attempt('too-old', 31), attempt('future', -1),
      attempt('cancelled', 1, { status: 'IN_PROGRESS' }),
      attempt('retake', 1, { eligibleForLevelEval: false }),
      attempt('already-exposed'),
      attempt('without-focus-tags', 1, { contentSnapshot: { questions: [{ id: 'unknown' }] } }),
      attempt('reading-a2-club-meeting', 1, { contentVersion: 3 }),
      attempt('wrong-level', 1, { lessonSnapshot: { kind: 'READING', cefrLevel: 'B1' } }),
    ];
    const all = [...excluded, ...valid.reverse()];
    const exposures = new Map(all.map(row => [row.lessonId, row.id]));
    exposures.set('already-exposed', 'deleted-first-attempt');
    const selected = selectReadingFocusAttempts(all, exposures, level, now);
    expect(selected.map(row => row.id)).toEqual(Array.from({ length: 10 }, (_, index) => `valid-${index}`));
    const cutoff = { ...level, changedAt: new Date(now.getTime() - 2 * day) };
    expect(selectReadingFocusAttempts(all, exposures, cutoff, now).map(row => row.id)).toEqual(['valid-0']);
  });

  it('requires misses across distinct lessons and uses only mapped, graded snapshot questions', () => {
    const attempts = [attempt('a'), attempt('b'), attempt('retry', 1, { lessonId: 'a' })];
    expect(chooseReadingFocus(attempts, [
      answer('a', 'detail'), answer('retry', 'detail'), answer('b', 'unmapped'),
      answer('b', 'detail', null), answer('unknown', 'detail'),
    ])).toBeUndefined();
    expect(chooseReadingFocus(attempts, [
      answer('a', 'detail'), answer('b', 'detail'),
    ])).toBe('reading.scanning');
  });

  it('breaks ties by error count then code, and skips an accuracy of exactly 80%', () => {
    const attempts = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(id => attempt(id));
    const tied = [answer('a', 'detail'), answer('b', 'detail'), answer('a', 'inference'), answer('b', 'inference')];
    expect(chooseReadingFocus(attempts, tied)).toBe('reading.inference');
    expect(chooseReadingFocus(attempts, [...tied, answer('c', 'detail')])).toBe('reading.scanning');
    expect(chooseReadingFocus(attempts, [
      ...tied, answer('c', 'detail'), answer('d', 'detail', true),
    ])).toBe('reading.inference');
    expect(chooseReadingFocus(attempts, attempts.map((row, index) => answer(row.id, 'detail', index >= 2))))
      .toBeUndefined();
  });
});
