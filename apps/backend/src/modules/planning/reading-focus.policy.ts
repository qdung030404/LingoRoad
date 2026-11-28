import { CefrLevel, LearningAttempt, LearningAttemptAnswer, Prisma } from '@prisma/client';
import { isEligibleReadingEvidence, ReadingEvidenceCandidate } from './skill-level.policy';

export const READING_FOCUS_LABELS = {
  'reading.scanning': 'Tìm chi tiết',
  'reading.inference': 'Suy luận',
} as const;
export type ReadingFocusCode = keyof typeof READING_FOCUS_LABELS;

const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export type ReadingEvidenceAttempt = Pick<
  LearningAttempt,
  | 'id'
  | 'lessonId'
  | 'contentVersion'
  | 'status'
  | 'submittedAt'
  | 'correctCount'
  | 'totalQuestions'
  | 'eligibleForLevelEval'
  | 'lessonSnapshot'
>;

export type ReadingFocusAttempt = ReadingEvidenceAttempt & {
  contentSnapshot?: Prisma.JsonValue | null;
};

export function readingEvidence(
  attempt: ReadingEvidenceAttempt,
  exposedAttemptId: string | null,
): ReadingEvidenceCandidate {
  const snapshot = attempt.lessonSnapshot as { kind?: string; cefrLevel?: CefrLevel; code?: string } | null;
  return {
    id: attempt.id,
    lessonId: attempt.lessonId,
    lessonCode: snapshot?.code,
    contentVersion: attempt.contentVersion,
    status: attempt.status,
    submittedAt: attempt.submittedAt,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.totalQuestions,
    eligibleForLevelEval: attempt.eligibleForLevelEval,
    exposedAttemptId,
    lessonSnapshotKind: snapshot?.kind ?? null,
    lessonSnapshotCefr: snapshot?.cefrLevel ?? null,
  };
}

function focusQuestions(content: unknown): Map<string, ReadingFocusCode> {
  const entries = (content as { questions?: unknown } | null)?.questions;
  const questions = new Map<string, ReadingFocusCode>();
  if (!Array.isArray(entries)) return questions;
  for (const question of entries) {
    if (typeof question?.id !== 'string') continue;
    const code: unknown = question.skillCode;
    if (code === 'reading.scanning' || code === 'reading.inference') questions.set(question.id, code);
  }
  return questions;
}

export function countFocusQuestions(content: unknown, code: ReadingFocusCode): number {
  return [...focusQuestions(content).values()].filter(tag => tag === code).length;
}

export function isReadingFocusCandidate(
  attempt: ReadingEvidenceAttempt,
  exposureByLesson: ReadonlyMap<string, string>,
  level: { cefrLevel: CefrLevel; changedAt: Date | null },
  now: Date,
): boolean {
  const earliest = now.getTime() - LOOKBACK_MS;
  return (
    attempt.submittedAt != null &&
    attempt.submittedAt.getTime() >= earliest &&
    attempt.submittedAt <= now &&
    isEligibleReadingEvidence(
      readingEvidence(attempt, exposureByLesson.get(attempt.lessonId) ?? null),
      level.cefrLevel,
      level.changedAt,
    )
  );
}

export function selectReadingFocusAttempts<T extends ReadingFocusAttempt>(
  attempts: readonly T[],
  exposureByLesson: ReadonlyMap<string, string>,
  level: { cefrLevel: CefrLevel; changedAt: Date | null },
  now: Date,
): T[] {
  return attempts
    .filter(
      (attempt) =>
        isReadingFocusCandidate(attempt, exposureByLesson, level, now) &&
        focusQuestions(attempt.contentSnapshot).size > 0,
    )
    .sort((a, b) => b.submittedAt!.getTime() - a.submittedAt!.getTime() || b.id.localeCompare(a.id))
    .slice(0, MAX_ATTEMPTS);
}

type FocusAnswer = Pick<LearningAttemptAnswer, 'attemptId' | 'questionId' | 'isCorrect'>;

export function chooseReadingFocus(
  attempts: readonly Pick<ReadingFocusAttempt, 'id' | 'lessonId' | 'contentSnapshot'>[],
  checkedAnswers: readonly FocusAnswer[],
): ReadingFocusCode | undefined {
  const snapshots = new Map(attempts.map(attempt => [attempt.id, {
    lessonId: attempt.lessonId,
    questions: focusQuestions(attempt.contentSnapshot),
  }]));
  const counts = new Map<ReadingFocusCode, { total: number; wrong: number; missedLessons: Set<string> }>();
  for (const answer of checkedAnswers) {
    const snapshot = snapshots.get(answer.attemptId);
    const code = snapshot?.questions.get(answer.questionId);
    if (!snapshot || !code || answer.isCorrect == null) continue;
    const count = counts.get(code) ?? { total: 0, wrong: 0, missedLessons: new Set<string>() };
    count.total++;
    if (!answer.isCorrect) {
      count.wrong++;
      count.missedLessons.add(snapshot.lessonId);
    }
    counts.set(code, count);
  }
  return [...counts]
    .filter(([, count]) => count.missedLessons.size >= 2 && count.wrong * 5 > count.total)
    .sort(([codeA, a], [codeB, b]) =>
      b.wrong * a.total - a.wrong * b.total || b.wrong - a.wrong || codeA.localeCompare(codeB),
    )[0]?.[0];
}
