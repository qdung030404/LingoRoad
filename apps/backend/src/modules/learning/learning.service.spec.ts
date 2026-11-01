import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LearningAttempt, LearningAttemptAnswer, LearningLesson, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LearningService } from './learning.service';
import { LearningContent, validateLearningContent } from './learning.types';

const content: LearningContent = {
  steps: [{ id: 'theory', title: 'To be', body: 'I am. She is. They are.' }],
  audioUrl: '/media/learning/v1/listening.wav', transcript: 'Private transcript.',
  questions: Array.from({ length: 5 }, (_, index) => ({ id: `q${index}`, prompt: `Question ${index}`,
    options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: id })), correctOptionId: 'A', explanation: `Explanation ${index}` })),
};

function fixture() {
  const now = new Date('2026-11-01T00:00:00Z');
  const lesson: LearningLesson = { id: 'lesson', code: 'test-lesson', kind: 'GRAMMAR', title: 'A lesson', description: 'Practice',
    estimatedMinutes: 10, sortOrder: 1, published: true, contentVersion: 1, content: structuredClone(content) as unknown as Prisma.JsonValue,
    createdAt: now, updatedAt: now };
  const attempt: LearningAttempt & { answers: LearningAttemptAnswer[] } = { id: 'attempt', userId: 'owner', lessonId: lesson.id,
    status: 'IN_PROGRESS', version: 0, phase: 'STUDY', positionIndex: 0, totalQuestions: 5, correctCount: null,
    lessonSnapshot: { id: lesson.id, code: lesson.code, kind: lesson.kind, title: lesson.title, description: lesson.description, estimatedMinutes: 10, contentVersion: 1 },
    contentSnapshot: structuredClone(content) as unknown as Prisma.JsonValue, startedAt: now, updatedAt: now, submittedAt: null, answers: [] };
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
    },
    learningAttemptAnswer: {
      upsert: jest.fn(async ({ where, create, update }: { where: { attemptId_questionId: { questionId: string } }; create: LearningAttemptAnswer; update: Partial<LearningAttemptAnswer> }) => {
        const saved = attempt.answers.find((answer) => answer.questionId === where.attemptId_questionId.questionId);
        if (saved) Object.assign(saved, update);
        else attempt.answers.push(Object.assign({ id: `answer-${attempt.answers.length}`, checked: false, isCorrect: null, checkedAt: null }, create));
      }),
    },
    learningLesson: { findMany: jest.fn(async () => [lesson]), findFirst: jest.fn(async () => lesson) },
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work(db));
  return { db, attempt, lesson, service: new LearningService(db as unknown as PrismaService) };
}

describe('LearningService', () => {
  it('does not reveal ungraded keys, explanations or listening transcript', async () => {
    const { service } = fixture();
    const state = await service.attempt('owner', 'attempt');
    expect(state.questions[0]).not.toHaveProperty('correctOptionId');
    expect(state.answers[0]).not.toHaveProperty('explanation');
    expect(state.content).not.toHaveProperty('transcript');
    expect(state.answers[0]).toEqual({ questionId: 'q0', optionId: null, checked: false });
  });

  it('does not expose another account attempt', async () => {
    const { service } = fixture();
    await expect(service.attempt('other', 'attempt')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.check('other', 'attempt', 'q0', { optionId: 'A', expectedVersion: 0 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('saves current study position and draft with version concurrency protection', async () => {
    const { service } = fixture();
    const saved = await service.progress('owner', 'attempt', { expectedVersion: 0, phase: 'QUIZ', index: 2, questionId: 'q2', optionId: 'B' });
    expect(saved.position).toEqual({ phase: 'QUIZ', index: 2 });
    expect(saved.answers[2]).toEqual({ questionId: 'q2', optionId: 'B', checked: false });
    await expect(service.progress('owner', 'attempt', { expectedVersion: 0, phase: 'QUIZ', index: 1 })).rejects.toBeInstanceOf(ConflictException);
    const reloaded = await service.attempt('owner', 'attempt');
    expect(reloaded.position.index).toBe(2);
    expect(reloaded.version).toBe(1);
  });

  it('rejects invalid position, question, missing choice and option before mutations', async () => {
    const { service, db } = fixture();
    for (const dto of [
      { expectedVersion: 0, phase: 'STUDY' as const, index: 1 },
      { expectedVersion: 0, phase: 'QUIZ' as const, index: 0, questionId: 'q0' },
      { expectedVersion: 0, phase: 'QUIZ' as const, index: 0, questionId: 'q9', optionId: 'A' },
      { expectedVersion: 0, phase: 'QUIZ' as const, index: 0, questionId: 'q0', optionId: 'Z' },
    ]) await expect(service.progress('owner', 'attempt', dto)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.check('owner', 'attempt', 'q0', { expectedVersion: 0, optionId: 'Z' })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.learningAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('checks on server, reveals only that feedback and retries idempotently', async () => {
    const { service, db } = fixture();
    const state = await service.check('owner', 'attempt', 'q0', { expectedVersion: 0, optionId: 'B' });
    expect(state.answers[0]).toMatchObject({ checked: true, isCorrect: false, correctOptionId: 'A', explanation: 'Explanation 0' });
    expect(state.answers[1]).not.toHaveProperty('correctOptionId');
    const replay = await service.check('owner', 'attempt', 'q0', { expectedVersion: 0, optionId: 'B' });
    expect(replay.version).toBe(state.version);
    expect(db.learningAttemptAnswer.upsert).toHaveBeenCalledTimes(1);
    await expect(service.check('owner', 'attempt', 'q0', { expectedVersion: 1, optionId: 'A' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.progress('owner', 'attempt', { expectedVersion: 1, phase: 'QUIZ', index: 0, questionId: 'q0', optionId: 'A' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires all five checked, then completes even with zero correct and replays submit', async () => {
    const { service, attempt } = fixture();
    await expect(service.submit('owner', 'attempt', 0)).rejects.toBeInstanceOf(BadRequestException);
    for (let index = 0; index < 5; index++) await service.check('owner', 'attempt', `q${index}`, { expectedVersion: index, optionId: 'B' });
    const result = await service.submit('owner', 'attempt', 5);
    expect(result.status).toBe('COMPLETED');
    expect(result.result).toEqual({ correctCount: 0, totalQuestions: 5, scoreRatio: 0 });
    expect(result.content.transcript).toBe('Private transcript.');
    expect((await service.submit('owner', 'attempt', 0)).version).toBe(6);
    expect(attempt.version).toBe(6);
    await expect(service.progress('owner', 'attempt', { expectedVersion: 6, phase: 'QUIZ', index: 0 })).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses immutable attempt snapshots after catalogue content changes', async () => {
    const { service, lesson } = fixture();
    lesson.title = 'Changed title';
    lesson.content = {};
    const state = await service.check('owner', 'attempt', 'q0', { expectedVersion: 0, optionId: 'A' });
    expect(state.lesson.title).toBe('A lesson');
    expect(state.answers[0].isCorrect).toBe(true);
  });

  it('recovers an identical concurrent answer after a transaction version conflict', async () => {
    const { service, db, attempt } = fixture();
    db.learningAttempt.updateMany.mockImplementationOnce(async () => {
      attempt.version = 1;
      attempt.answers.push({ id: 'winner', attemptId: attempt.id, questionId: 'q0', optionId: 'B', checked: true, isCorrect: false, checkedAt: new Date() });
      return { count: 0 };
    });
    const state = await service.check('owner', 'attempt', 'q0', { expectedVersion: 0, optionId: 'B' });
    expect(state.version).toBe(1);
    expect(state.answers[0]).toMatchObject({ optionId: 'B', checked: true });
  });

  it('recovers canonical completed result after a concurrent submit wins', async () => {
    const { service, db, attempt } = fixture();
    attempt.answers = content.questions.map((question) => ({ id: question.id, attemptId: attempt.id, questionId: question.id, optionId: 'A', checked: true, isCorrect: true, checkedAt: new Date() }));
    db.learningAttempt.updateMany.mockImplementationOnce(async () => {
      attempt.status = 'COMPLETED'; attempt.correctCount = 5; attempt.version = 1; attempt.submittedAt = new Date();
      return { count: 0 };
    });
    const state = await service.submit('owner', 'attempt', 0);
    expect(state.status).toBe('COMPLETED');
    expect(state.result?.correctCount).toBe(5);
  });

  it('counts distinct lessons separately from attempts and chooses latest active', async () => {
    const { service, db, attempt } = fixture();
    db.learningAttempt.findMany.mockResolvedValue([
      { ...attempt, id: 'active' },
      { ...attempt, id: 'old1', status: 'COMPLETED', correctCount: 5 },
      { ...attempt, id: 'old2', status: 'COMPLETED', correctCount: 0 },
    ]);
    const summary = await service.summary('owner');
    expect(summary).toMatchObject({ totalLessons: 1, completedLessonCount: 1, completedAttemptCount: 2, activeAttemptCount: 1, continueAttemptId: 'active' });
  });

  it('validates the five-question grading bank', () => {
    expect(() => validateLearningContent(content)).not.toThrow();
    expect(() => validateLearningContent({ ...content, questions: content.questions.slice(1) })).toThrow();
    expect(() => validateLearningContent({ ...content, questions: content.questions.map((question) => ({ ...question, correctOptionId: 'Z' })) })).toThrow();
  });
});
