import { CefrLevel } from '@prisma/client';
import {
  decideReadingLevel,
  initialReadingLevel,
  MIN_EVALUABLE_CONTENT_VERSION_BY_CODE,
  ReadingEvidenceCandidate,
} from './skill-level.policy';
import {
  loadLearningContent,
  validateLearningSeeds,
  validateReadingPrepNoAnswerLeak,
} from '../../../prisma/seed-learning';

const baseTime = new Date('2026-11-16T00:00:00Z');

function candidate(overrides: Partial<ReadingEvidenceCandidate> & { id: string; lessonId: string }): ReadingEvidenceCandidate {
  return {
    status: 'COMPLETED',
    submittedAt: new Date(baseTime.getTime() + 60_000),
    correctCount: 5,
    totalQuestions: 5,
    eligibleForLevelEval: true,
    exposedAttemptId: overrides.id,
    lessonSnapshotKind: 'READING',
    lessonSnapshotCefr: 'A2',
    ...overrides,
  };
}

describe('Adaptive Reading skill-level policy', () => {
  it('initializes from Placement or falls back to DEFAULT A1 with null baseline', () => {
    const placedAt = new Date('2026-11-15T10:00:00Z');
    expect(initialReadingLevel({ reading: { estimatedCefr: 'B1' } }, placedAt)).toEqual({
      cefrLevel: 'B1',
      source: 'PLACEMENT',
      changedAt: placedAt,
    });
    expect(initialReadingLevel(null, null)).toEqual({
      cefrLevel: 'A1',
      source: 'DEFAULT',
      changedAt: null,
    });
    expect(initialReadingLevel({ reading: { estimatedCefr: 'INVALID' } }, placedAt)).toEqual({
      cefrLevel: 'A1',
      source: 'DEFAULT',
      changedAt: null,
    });
  });

  it('promotes by one CEFR step when two distinct unexposed lessons score >= 80% and next tier has a lesson', () => {
    const res = decideReadingLevel({
      current: 'A2',
      changedAt: null,
      attempts: [
        candidate({ id: 'a2', lessonId: 'l2', correctCount: 4, submittedAt: new Date(baseTime.getTime() + 2000) }),
        candidate({ id: 'a1', lessonId: 'l1', correctCount: 5, submittedAt: new Date(baseTime.getTime() + 1000) }),
      ],
      publishedCountAt: (lvl: CefrLevel) => (lvl === 'B1' ? 1 : 0),
      unexposedPublishedCountAt: () => 2,
    });
    expect(res).toEqual({ next: 'B1', direction: 'UP' });
  });

  it('does not promote when next tier has zero published reading lessons', () => {
    const res = decideReadingLevel({
      current: 'C1',
      changedAt: null,
      attempts: [
        candidate({ id: 'a2', lessonId: 'l2', lessonSnapshotCefr: 'C1', correctCount: 5 }),
        candidate({ id: 'a1', lessonId: 'l1', lessonSnapshotCefr: 'C1', correctCount: 5 }),
      ],
      publishedCountAt: (lvl: CefrLevel) => (lvl === 'C2' ? 0 : 1),
      unexposedPublishedCountAt: () => 2,
    });
    expect(res).toBeNull();
  });

  it('ignores repeated attempts on the same lessonId and exposed retries after cancel', () => {
    expect(decideReadingLevel({
      current: 'A2',
      changedAt: null,
      attempts: [
        candidate({ id: 'a2', lessonId: 'l1', correctCount: 5 }),
        candidate({ id: 'a1', lessonId: 'l1', correctCount: 5 }),
      ],
      publishedCountAt: () => 1,
      unexposedPublishedCountAt: () => 2,
    })).toBeNull();

    // Cancelled-after-check retry has mismatched exposedAttemptId or eligibleForLevelEval=false.
    expect(decideReadingLevel({
      current: 'A2',
      changedAt: null,
      attempts: [
        candidate({ id: 'a2', lessonId: 'l2', correctCount: 5, eligibleForLevelEval: false }),
        candidate({ id: 'a1', lessonId: 'l1', correctCount: 5 }),
      ],
      publishedCountAt: () => 1,
      unexposedPublishedCountAt: () => 2,
    })).toBeNull();

    expect(decideReadingLevel({
      current: 'A2',
      changedAt: null,
      attempts: [
        candidate({ id: 'a2', lessonId: 'l2', correctCount: 5, exposedAttemptId: 'cancelled-attempt' }),
        candidate({ id: 'a1', lessonId: 'l1', correctCount: 5 }),
      ],
      publishedCountAt: () => 1,
      unexposedPublishedCountAt: () => 2,
    })).toBeNull();
  });

  it('demotes only when target lower tier has >= 2 unexposed published lessons to avoid dead-ends', () => {
    const weakAttempts = [
      candidate({ id: 'a2', lessonId: 'l2', lessonSnapshotCefr: 'A2', correctCount: 2 }),
      candidate({ id: 'a1', lessonId: 'l1', lessonSnapshotCefr: 'A2', correctCount: 1 }),
    ];

    // Real catalog A1 currently has only 1 reading lesson -> stay A2 (no dead-end).
    expect(decideReadingLevel({
      current: 'A2',
      changedAt: null,
      attempts: weakAttempts,
      publishedCountAt: () => 1,
      unexposedPublishedCountAt: (lvl: CefrLevel) => (lvl === 'A1' ? 1 : 0),
    })).toBeNull();

    // With 2 unexposed A1 lessons in the target tier -> demotes to A1.
    expect(decideReadingLevel({
      current: 'A2',
      changedAt: null,
      attempts: weakAttempts,
      publishedCountAt: () => 1,
      unexposedPublishedCountAt: (lvl: CefrLevel) => (lvl === 'A1' ? 2 : 0),
    })).toEqual({ next: 'A1', direction: 'DOWN' });

    // Already at A1 -> cannot demote below A1.
    expect(decideReadingLevel({
      current: 'A1',
      changedAt: null,
      attempts: [
        candidate({ id: 'a2', lessonId: 'l2', lessonSnapshotCefr: 'A1', correctCount: 0 }),
        candidate({ id: 'a1', lessonId: 'l1', lessonSnapshotCefr: 'A1', correctCount: 0 }),
      ],
      publishedCountAt: () => 2,
      unexposedPublishedCountAt: () => 2,
    })).toBeNull();
  });

  it('ignores attempts at or before changedAt, wrong tier, non-READING kind, and mixed scores', () => {
    const cutoff = new Date('2026-11-16T05:00:00Z');
    const res = decideReadingLevel({
      current: 'B1',
      changedAt: cutoff,
      attempts: [
        candidate({ id: 'a5', lessonId: 'l5', lessonSnapshotCefr: 'B1', correctCount: 5, submittedAt: new Date(cutoff.getTime() + 1000) }),
        candidate({ id: 'a4', lessonId: 'l4', lessonSnapshotCefr: 'B1', correctCount: 5, lessonSnapshotKind: 'LISTENING', submittedAt: new Date(cutoff.getTime() + 500) }),
        candidate({ id: 'a3', lessonId: 'l3', lessonSnapshotCefr: 'A2', correctCount: 5, submittedAt: new Date(cutoff.getTime() + 400) }),
        candidate({ id: 'a2', lessonId: 'l2', lessonSnapshotCefr: 'B1', correctCount: 5, submittedAt: cutoff }),
        candidate({ id: 'a1', lessonId: 'l1', lessonSnapshotCefr: 'B1', correctCount: 5, submittedAt: new Date(cutoff.getTime() - 1000) }),
      ],
      publishedCountAt: () => 2,
      unexposedPublishedCountAt: () => 2,
    });
    expect(res).toBeNull();

    // Mixed: one >= 80%, one < 50% -> keeps current level.
    expect(decideReadingLevel({
      current: 'B1',
      changedAt: null,
      attempts: [
        candidate({ id: 'b2', lessonId: 'l2', lessonSnapshotCefr: 'B1', correctCount: 5 }),
        candidate({ id: 'b1', lessonId: 'l1', lessonSnapshotCefr: 'B1', correctCount: 2 }),
      ],
      publishedCountAt: () => 2,
      unexposedPublishedCountAt: () => 2,
    })).toBeNull();
  });

  it('excludes pre-v4 attempts of reading-a2-club-meeting from promotion evidence and accepts v4', () => {
    expect(MIN_EVALUABLE_CONTENT_VERSION_BY_CODE['reading-a2-club-meeting']).toBe(4);

    const common = {
      current: 'A2' as CefrLevel,
      changedAt: null,
      publishedCountAt: (tier: CefrLevel) => (tier === 'B1' ? 1 : 2),
      unexposedPublishedCountAt: () => 2,
    };

    const withV3 = decideReadingLevel({
      ...common,
      attempts: [
        candidate({
          id: 'club-v3',
          lessonId: 'club-id',
          lessonCode: 'reading-a2-club-meeting',
          contentVersion: 3,
          lessonSnapshotCefr: 'A2',
          correctCount: 5,
          submittedAt: new Date(baseTime.getTime() + 10_000),
        }),
        candidate({
          id: 'market-v1',
          lessonId: 'market-id',
          lessonCode: 'reading-a2-weekend-market',
          contentVersion: 1,
          lessonSnapshotCefr: 'A2',
          correctCount: 5,
          submittedAt: new Date(baseTime.getTime() + 20_000),
        }),
      ],
    });
    expect(withV3).toBeNull();

    const withV4 = decideReadingLevel({
      ...common,
      attempts: [
        candidate({
          id: 'club-v4',
          lessonId: 'club-id',
          lessonCode: 'reading-a2-club-meeting',
          contentVersion: 4,
          lessonSnapshotCefr: 'A2',
          correctCount: 5,
          submittedAt: new Date(baseTime.getTime() + 10_000),
        }),
        candidate({
          id: 'market-v1',
          lessonId: 'market-id',
          lessonCode: 'reading-a2-weekend-market',
          contentVersion: 1,
          lessonSnapshotCefr: 'A2',
          correctCount: 5,
          submittedAt: new Date(baseTime.getTime() + 20_000),
        }),
      ],
    });
    expect(withV4).toEqual({
      next: 'B1',
      direction: 'UP',
    });
  });

  it('validates reading-a2-club-meeting v4 without prep leaks and rejects leaked scanning answers', () => {
    const content = loadLearningContent();
    expect(() => validateLearningSeeds(content)).not.toThrow();

    const clubLesson = content.find((l) => l.code === 'reading-a2-club-meeting');
    expect(clubLesson?.contentVersion).toBeGreaterThanOrEqual(4);
    expect(() => validateReadingPrepNoAnswerLeak(clubLesson!)).not.toThrow();

    const leakedTimeLesson = structuredClone(clubLesson!);
    leakedTimeLesson.content.keyVocabulary![1].example =
      'Instead of Friday, our club will meet on Thursday at 3:30 p.m. to finish posters.';
    expect(() => validateReadingPrepNoAnswerLeak(leakedTimeLesson)).toThrow();

    const leakedRoomLesson = structuredClone(clubLesson!);
    leakedRoomLesson.content.keyVocabulary![1].example =
      'Instead of the gym, please bring the chairs to Room 12 after lunch.';
    expect(() => validateReadingPrepNoAnswerLeak(leakedRoomLesson)).toThrow();
  });
});
