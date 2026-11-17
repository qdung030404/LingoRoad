import { CefrLevel, SkillLevelSource } from '@prisma/client';

export const CEFR_ORDER: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const PROMOTE_RATIO = 0.8;
export const DEMOTE_RATIO = 0.5;
export const REQUIRED_DISTINCT_LESSONS = 2;

/** Reject evidence recorded under pre-fix versions whose preparation leaked answers. */
export const MIN_EVALUABLE_CONTENT_VERSION_BY_CODE: Readonly<Record<string, number>> = {
  'reading-a2-club-meeting': 4,
};

export type AdaptiveReadingTarget = {
  cefrLevel: CefrLevel;
  strictCeiling: boolean;
};

export type ReadingEvidenceCandidate = {
  id: string;
  lessonId: string;
  lessonCode?: string | null;
  contentVersion?: number;
  status: string;
  submittedAt: Date | null;
  correctCount: number | null;
  totalQuestions: number;
  eligibleForLevelEval: boolean;
  exposedAttemptId: string | null;
  lessonSnapshotKind: string | null;
  lessonSnapshotCefr: CefrLevel | null;
};

/** Determines initial READING level from Placement or defaults cleanly to A1. */
export function initialReadingLevel(
  placement?: Record<string, unknown> | null,
  placementCompletedAt?: Date | null,
): { cefrLevel: CefrLevel; source: SkillLevelSource; changedAt: Date | null } {
  const reading = placement?.reading;
  const estimated =
    reading && typeof reading === 'object'
      ? (reading as { estimatedCefr?: unknown }).estimatedCefr
      : undefined;
  if (typeof estimated === 'string' && (CEFR_ORDER as readonly string[]).includes(estimated)) {
    return {
      cefrLevel: estimated as CefrLevel,
      source: 'PLACEMENT',
      changedAt: placementCompletedAt ?? null,
    };
  }
  return {
    cefrLevel: 'A1',
    source: 'DEFAULT',
    changedAt: null,
  };
}

/**
 * Pure policy for adaptive READING level transitions.
 * `attempts` must be ordered newest-first (`submittedAt DESC, id DESC`).
 */
export function decideReadingLevel(input: {
  current: CefrLevel;
  changedAt: Date | null;
  attempts: ReadonlyArray<ReadingEvidenceCandidate>;
  publishedCountAt: (level: CefrLevel) => number;
  unexposedPublishedCountAt: (level: CefrLevel) => number;
}): { next: CefrLevel; direction: 'UP' | 'DOWN' } | null {
  const seenLessons = new Set<string>();
  const evidence: ReadingEvidenceCandidate[] = [];

  for (const attempt of input.attempts) {
    if (
      attempt.status !== 'COMPLETED' ||
      !attempt.submittedAt ||
      attempt.totalQuestions <= 0 ||
      attempt.correctCount == null
    ) {
      continue;
    }
    if (input.changedAt && attempt.submittedAt <= input.changedAt) continue;
    if (!attempt.eligibleForLevelEval || attempt.exposedAttemptId !== attempt.id) continue;
    if (attempt.lessonSnapshotKind !== 'READING' || attempt.lessonSnapshotCefr !== input.current) {
      continue;
    }
    const minVersion = attempt.lessonCode ? MIN_EVALUABLE_CONTENT_VERSION_BY_CODE[attempt.lessonCode] : undefined;
    if (minVersion != null && (attempt.contentVersion ?? 0) < minVersion) continue;
    if (seenLessons.has(attempt.lessonId)) continue;
    seenLessons.add(attempt.lessonId);
    evidence.push(attempt);
    if (evidence.length === REQUIRED_DISTINCT_LESSONS) break;
  }

  if (evidence.length < REQUIRED_DISTINCT_LESSONS) return null;

  const ratios = evidence.map((item) => item.correctCount! / item.totalQuestions);
  const idx = CEFR_ORDER.indexOf(input.current);

  if (ratios.every((ratio) => ratio >= PROMOTE_RATIO) && idx < CEFR_ORDER.length - 1) {
    const next = CEFR_ORDER[idx + 1];
    if (input.publishedCountAt(next) >= 1) {
      return { next, direction: 'UP' };
    }
  }

  // Require at least two unexposed published lessons in the target lower tier to avoid recovery dead-ends.
  if (ratios.every((ratio) => ratio < DEMOTE_RATIO) && idx > 0) {
    const prev = CEFR_ORDER[idx - 1];
    if (input.unexposedPublishedCountAt(prev) >= REQUIRED_DISTINCT_LESSONS) {
      return { next: prev, direction: 'DOWN' };
    }
  }

  return null;
}
