import {
  CefrLevel,
  LearningAttempt,
  LearningAttemptAnswer,
  LearningLesson,
} from '@prisma/client';
import { LearningContent, LessonSnapshot } from './learning.types';

export const MAX_READING_EXPLAIN_PASSAGE_CHARS = 4000;
const GLOBAL_READING_SKILLS = new Set([
  'reading.main_idea',
  'reading.text_structure',
  'reading.author_purpose',
  'reading.critical_reading',
]);

export type AttemptWithAnswers = LearningAttempt & {
  answers: LearningAttemptAnswer[];
};

export interface CatalogueLessonRow {
  id: string;
  code: string;
  kind: LearningLesson['kind'];
  title: string;
  description: string;
  estimatedMinutes: number;
  contentVersion: number;
  questionCount: number;
  audioDurationMs: number | null;
  cefrLevel: CefrLevel | null;
  coverImageUrl: string | null;
  grammarTopicCode: string | null;
}

export function extractBoundedPassage(
  passage: string,
  skillCode?: string,
  questionType?: string,
  evidence?: string,
): string | null {
  const clean = passage.trim();
  if (clean.length <= MAX_READING_EXPLAIN_PASSAGE_CHARS) return clean;
  if (questionType === 'TRUE_FALSE_NOT_GIVEN') return null;
  if (skillCode && GLOBAL_READING_SKILLS.has(skillCode)) return null;
  const trimmedEvidence = evidence?.trim();
  if (!trimmedEvidence) return null;
  const idx = clean.indexOf(trimmedEvidence);
  if (idx === -1) return null;
  const half = Math.floor(
    (MAX_READING_EXPLAIN_PASSAGE_CHARS - trimmedEvidence.length) / 2,
  );
  const start = Math.max(0, idx - Math.max(0, half));
  const end = Math.min(clean.length, start + MAX_READING_EXPLAIN_PASSAGE_CHARS);
  const excerpt = clean.slice(start, end);
  return excerpt.includes(trimmedEvidence) ? excerpt : null;
}

export function buildLessonSnapshot(
  lesson: Pick<
    LearningLesson,
    | 'id'
    | 'code'
    | 'kind'
    | 'title'
    | 'description'
    | 'estimatedMinutes'
    | 'contentVersion'
  >,
  questionCount: number,
  audioDurationMs?: number | null,
  cefrLevel?: CefrLevel | null,
  coverImageUrl?: string | null,
  grammarTopicCode?: string | null,
): LessonSnapshot {
  return {
    id: lesson.id,
    code: lesson.code,
    kind: lesson.kind,
    title: lesson.title,
    description: lesson.description,
    estimatedMinutes: Number(lesson.estimatedMinutes),
    contentVersion: Number(lesson.contentVersion),
    questionCount: Number(questionCount),
    ...(audioDurationMs ? { audioDurationMs: Number(audioDurationMs) } : {}),
    ...(cefrLevel ? { cefrLevel } : {}),
    ...(coverImageUrl ? { coverImageUrl } : {}),
    ...(grammarTopicCode ? { grammarTopicCode } : {}),
  };
}

export function buildPublicContent(
  content: LearningContent,
  completed: boolean,
) {
  return {
    steps: content.steps.map((step) => ({
      id: step.id,
      title: step.title,
      body: step.body,
      ...(step.word ? { word: step.word } : {}),
      ...(step.phonetic ? { phonetic: step.phonetic } : {}),
      ...(step.meaning ? { meaning: step.meaning } : {}),
      ...(step.example ? { example: step.example } : {}),
      ...(step.audioUrl ? { audioUrl: step.audioUrl } : {}),
    })),
    ...(content.coverImageUrl ? { coverImageUrl: content.coverImageUrl } : {}),
    ...(content.listeningVersion !== 1 && content.passage
      ? { passage: content.passage }
      : {}),
    ...(content.keyVocabulary?.length
      ? {
          keyVocabulary: content.keyVocabulary.map((item) => ({
            id: item.id,
            word: item.word,
            meaning: item.meaning,
            ...(item.phonetic ? { phonetic: item.phonetic } : {}),
            ...(item.example ? { example: item.example } : {}),
            ...(item.translation ? { translation: item.translation } : {}),
            ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
          })),
        }
      : {}),
    ...(content.audioUrl ? { audioUrl: content.audioUrl } : {}),
    ...(content.listeningVersion === 1
      ? {
          listeningVersion: 1,
          audioDurationMs: content.audioDurationMs,
          preparation: {
            situation: content.preparation?.situation,
            objective: content.preparation?.objective,
          },
        }
      : {}),
    ...(completed && content.transcript
      ? { transcript: content.transcript }
      : {}),
    ...(completed && content.transcriptSegments
      ? {
          transcriptSegments: content.transcriptSegments.map((segment) => ({
            id: segment.id,
            speaker: segment.speaker,
            ...(segment.speakerAvatar
              ? { speakerAvatar: segment.speakerAvatar }
              : {}),
            startMs: segment.startMs,
            endMs: segment.endMs,
            text: segment.text,
            translationVi: segment.translationVi,
          })),
        }
      : {}),
  };
}

export function buildPublicQuestions(content: LearningContent) {
  return content.questions.map((question) => ({
    id: question.id,
    type: question.type ?? 'MULTIPLE_CHOICE',
    prompt: question.prompt,
    ...(question.skillCode ? { skillCode: question.skillCode } : {}),
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
      ...(option.imageUrl ? { imageUrl: option.imageUrl } : {}),
    })),
  }));
}

export function formatAttemptResult(
  attempt: Pick<LearningAttempt, 'status' | 'correctCount' | 'totalQuestions'>,
) {
  return attempt.status === 'COMPLETED'
    ? {
        correctCount: attempt.correctCount!,
        totalQuestions: attempt.totalQuestions,
        scoreRatio: attempt.correctCount! / attempt.totalQuestions,
      }
    : null;
}

export function buildAttemptSummaryItem(attempt: LearningAttempt) {
  const rawLesson = attempt.lessonSnapshot as unknown as LessonSnapshot;
  const lesson: LessonSnapshot = {
    ...rawLesson,
    questionCount: rawLesson.questionCount ?? attempt.totalQuestions,
  };
  return {
    id: attempt.id,
    lesson,
    status: attempt.status,
    position: { phase: attempt.phase, index: attempt.positionIndex },
    result: formatAttemptResult(attempt),
    startedAt: attempt.startedAt,
    updatedAt: attempt.updatedAt,
    submittedAt: attempt.submittedAt,
  };
}

export function buildPublicAttempt(attempt: AttemptWithAnswers) {
  const content = attempt.contentSnapshot as unknown as LearningContent;
  const answers = new Map(
    attempt.answers.map((answer) => [answer.questionId, answer]),
  );
  return {
    ...buildAttemptSummaryItem(attempt),
    version: attempt.version,
    content: buildPublicContent(content, attempt.status === 'COMPLETED'),
    questions: buildPublicQuestions(content),
    answers: content.questions.map((question) => {
      const answer = answers.get(question.id);
      return {
        questionId: question.id,
        optionId: answer?.optionId ?? null,
        checked: answer?.checked ?? false,
        ...(answer?.checked
          ? {
              isCorrect: answer.isCorrect,
              correctOptionId: question.correctOptionId,
              explanation: question.explanation,
              ...(content.listeningVersion !== 1 && question.evidence
                ? { evidence: question.evidence }
                : {}),
              ...(attempt.status === 'COMPLETED' && question.evidenceSegmentIds
                ? { evidenceSegmentIds: [...question.evidenceSegmentIds] }
                : {}),
            }
          : {}),
      };
    }),
  };
}
