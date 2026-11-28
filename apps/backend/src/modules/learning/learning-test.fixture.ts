import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningAttempt, LearningAttemptAnswer, LearningLesson, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MlClientService } from '../ml/ml-client.service';
import { LearningService, MAX_READING_EXPLAIN_PASSAGE_CHARS } from './learning.service';
import { LearningContent, validateLearningContent } from './learning.types';


export const content: LearningContent = {
  steps: [{ id: 'theory', title: 'To be', body: 'I am. She is. They are.' }],
  audioUrl: '/media/learning/v1/listening.wav', transcript: 'Private transcript.',
  questions: Array.from({ length: 5 }, (_, index) => ({
    id: `q${index}`, prompt: `Question ${index}`,
    options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: id })), correctOptionId: 'A', explanation: `Explanation ${index}`
  })),
};

function collectSqlArg(arg: unknown, textParts: string[], values: unknown[]) {
  if (arg && typeof arg === 'object' && Array.isArray((arg as { strings?: unknown }).strings)) {
    const sqlObj = arg as { strings: readonly string[]; values?: readonly unknown[] };
    textParts.push(sqlObj.strings.join(' '));
    for (const val of sqlObj.values ?? []) collectSqlArg(val, textParts, values);
  } else {
    values.push(arg);
  }
}

export function extractSqlParts(args: unknown[]) {
  const textParts: string[] = [];
  const values: unknown[] = [];
  if (Array.isArray(args[0])) {
    textParts.push((args[0] as readonly string[]).join(' '));
    for (const val of args.slice(1)) collectSqlArg(val, textParts, values);
  } else if (args.length > 0) {
    collectSqlArg(args[0], textParts, values);
    if (textParts.length === 0) textParts.push(String(args[0]));
  }
  return { sql: textParts.join(' '), values };
}

export function fixture(
  ml?: Partial<MlClientService>,
  extraLessons: Array<LearningLesson & { unit?: { cefrLevel: string } | null; grammarTopic?: { code: string } | null }> = [],
) {
  const now = new Date('2026-11-01T00:00:00Z');
  const lesson: LearningLesson = {
    id: 'lesson', code: 'test-lesson', kind: 'GRAMMAR', title: 'A lesson', description: 'Practice',
    estimatedMinutes: 10, sortOrder: 1, published: true, contentVersion: 1, unitId: null, grammarTopicId: null, content: structuredClone(content) as unknown as Prisma.JsonValue,
    createdAt: now, updatedAt: now
  };
  const attempt: LearningAttempt & { answers: LearningAttemptAnswer[] } = {
    id: 'attempt', userId: 'owner', lessonId: lesson.id,
    status: 'IN_PROGRESS', version: 0, phase: 'STUDY', positionIndex: 0, contentVersion: 1, eligibleForLevelEval: true, totalQuestions: 5, correctCount: null,
    lessonSnapshot: { id: lesson.id, code: lesson.code, kind: lesson.kind, title: lesson.title, description: lesson.description, estimatedMinutes: 10, contentVersion: 1 },
    contentSnapshot: structuredClone(content) as unknown as Prisma.JsonValue, startedAt: now, updatedAt: now, submittedAt: null, historyHiddenAt: null, answers: []
  };
  const exposures: Array<{ id: string; userId: string; lessonId: string; contentVersion: number; firstAttemptId: string }> = [];
  let savedLevelEvent: { kind: string; fromCefr: string; toCefr: string; direction: string } | null = null;
  const db = {
    learningAttempt: {
      findFirst: jest.fn(async ({ where }: { where: { id?: string; userId: string; lessonId?: string; status?: string } }) => {
        return (!where.id || where.id === attempt.id) && where.userId === attempt.userId && (!where.lessonId || where.lessonId === attempt.lessonId)
          && (!where.status || where.status === attempt.status) ? structuredClone(attempt) : null;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { version: number }; data: Record<string, unknown> }) => {
        if (where.version !== attempt.version || attempt.status !== 'IN_PROGRESS') return { count: 0 };
        const { version: _version, ...updates } = data;
        Object.assign(attempt, updates); attempt.version++; return { count: 1 };
      }),
      findMany: jest.fn(async () => [structuredClone(attempt)]),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...structuredClone(attempt),
        ...data,
        id: 'fresh-attempt',
        status: 'IN_PROGRESS',
        version: 0,
        positionIndex: 0,
        answers: [],
      })),
      delete: jest.fn(async () => structuredClone(attempt)),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    learningAttemptAnswer: {
      upsert: jest.fn(async ({ where, create, update }: { where: { attemptId_questionId: { questionId: string } }; create: LearningAttemptAnswer; update: Partial<LearningAttemptAnswer> }) => {
        const saved = attempt.answers.find((answer) => answer.questionId === where.attemptId_questionId.questionId);
        if (saved) Object.assign(saved, update);
        else attempt.answers.push(Object.assign({ id: `answer-${attempt.answers.length}`, checked: false, isCorrect: null, checkedAt: null }, create));
      }),
    },
    learningAnswerExposure: {
      findUnique: jest.fn(async ({ where }: { where: { userId_lessonId: { userId: string; lessonId: string } } }) =>
        exposures.find((e) => e.userId === where.userId_lessonId.userId && e.lessonId === where.userId_lessonId.lessonId) ?? null),
      create: jest.fn(async ({ data }: { data: { userId: string; lessonId: string; contentVersion: number; firstAttemptId: string } }) => {
        const row = { id: `exp-${exposures.length}`, ...data };
        exposures.push(row);
        return row;
      }),
    },
    learningSkillLevel: { findUnique: jest.fn(async () => null) },
    learningSkillLevelEvent: { findUnique: jest.fn(async () => savedLevelEvent) },
    learningLesson: { findMany: jest.fn(async () => [lesson, ...extraLessons]), findFirst: jest.fn(async () => lesson) },
    $queryRaw: jest.fn(async (...args: unknown[]) => {
      const { sql, values } = extractSqlParts(args);
      if (!sql.includes('FROM learning_lessons')) return [];
      const kindFilter = values.length > 0 ? String(values[0]) : undefined;
      return [lesson as LearningLesson & { unit?: { cefrLevel: string } | null }, ...extraLessons]
        .filter((row) => row.published && (!kindFilter || row.kind === kindFilter))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
        .map((row) => {
          const lessonContent = row.content as Partial<LearningContent> | null;
          const withMeta = row as LearningLesson & { unit?: { cefrLevel: string } | null; grammarTopic?: { code: string } | null };
          const grammarTopicCode = withMeta.grammarTopic?.code
            ?? (row.code === 'grammar-pronouns-to-be' ? 'grammar.pronouns' : null);
          return {
            id: row.id,
            code: row.code,
            kind: row.kind,
            title: row.title,
            description: row.description,
            estimatedMinutes: row.estimatedMinutes,
            contentVersion: row.contentVersion,
            questionCount: Array.isArray(lessonContent?.questions) ? lessonContent.questions.length : 5,
            audioDurationMs: typeof lessonContent?.audioDurationMs === 'number' ? lessonContent.audioDurationMs : null,
            cefrLevel: withMeta.unit?.cefrLevel ?? null,
            coverImageUrl: typeof lessonContent?.coverImageUrl === 'string' ? lessonContent.coverImageUrl : null,
            grammarTopicCode,
          };
        });
    }),
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work(db));
  return {
    db, attempt, lesson, exposures,
    setSavedLevelEvent: (evt: typeof savedLevelEvent) => { savedLevelEvent = evt; },
    service: new LearningService(db as unknown as PrismaService, undefined, ml as MlClientService | undefined),
  };
}
