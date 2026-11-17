import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LearningAttempt, LearningAttemptAnswer, LearningLesson, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MlClientService } from '../ml/ml-client.service';
import { LearningService, MAX_READING_EXPLAIN_PASSAGE_CHARS } from './learning.service';
import { LearningContent, validateLearningContent } from './learning.types';

const content: LearningContent = {
  steps: [{ id: 'theory', title: 'To be', body: 'I am. She is. They are.' }],
  audioUrl: '/media/learning/v1/listening.wav', transcript: 'Private transcript.',
  questions: Array.from({ length: 5 }, (_, index) => ({ id: `q${index}`, prompt: `Question ${index}`,
    options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: id })), correctOptionId: 'A', explanation: `Explanation ${index}` })),
};

function fixture(ml?: Partial<MlClientService>) {
  const now = new Date('2026-11-01T00:00:00Z');
  const lesson: LearningLesson = { id: 'lesson', code: 'test-lesson', kind: 'GRAMMAR', title: 'A lesson', description: 'Practice',
    estimatedMinutes: 10, sortOrder: 1, published: true, contentVersion: 1, unitId: null, content: structuredClone(content) as unknown as Prisma.JsonValue,
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
    learningLesson: { findMany: jest.fn(async () => [lesson]), findFirst: jest.fn(async () => lesson) },
    $queryRaw: jest.fn(async () => []),
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work(db));
  return { db, attempt, lesson, service: new LearningService(db as unknown as PrismaService, undefined, ml as MlClientService | undefined) };
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

  it('counts distinct completed lessons without resuming unsubmitted attempts', async () => {
    const { service, db, attempt } = fixture();
    db.learningAttempt.findMany.mockResolvedValue([
      { ...attempt, id: 'active' },
      { ...attempt, id: 'old1', status: 'COMPLETED', correctCount: 5 },
      { ...attempt, id: 'old2', status: 'COMPLETED', correctCount: 0 },
    ]);
    const summary = await service.summary('owner');
    expect(summary).toMatchObject({ totalLessons: 1, completedLessonCount: 1, completedAttemptCount: 2, activeAttemptCount: 0, continueAttemptId: null });
    const catalogue = await service.catalogue('owner');
    expect(catalogue.items[0]).toMatchObject({ state: 'COMPLETED', activeAttemptId: null });
  });

  it('starts a fresh attempt by discarding leftover IN_PROGRESS progress and supports explicit cancel', async () => {
    const { service, db, attempt } = fixture();
    const fresh = await service.start('owner', 'lesson');
    expect(db.learningAttempt.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'owner', lessonId: 'lesson', status: 'IN_PROGRESS' },
    });
    expect(fresh.id).toBe('fresh-attempt');
    expect(fresh.position).toEqual({ phase: 'STUDY', index: 0 });

    await expect(service.cancel('other', 'attempt')).rejects.toBeInstanceOf(NotFoundException);
    const cancelled = await service.cancel('owner', 'attempt');
    expect(cancelled).toEqual({ cancelledAttemptId: 'attempt' });
    expect(db.learningAttempt.delete).toHaveBeenCalledWith({ where: { id: 'attempt' } });

    attempt.status = 'COMPLETED';
    await expect(service.cancel('owner', 'attempt')).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates 3-10 questions, GAP_FILL, TRUE_FALSE_NOT_GIVEN, keyVocabulary, and reading evidence constraints', () => {
    expect(() => validateLearningContent(content)).not.toThrow();
    expect(() => validateLearningContent({ ...content, questions: content.questions.slice(0, 3) })).not.toThrow();
    expect(() => validateLearningContent({ ...content, questions: content.questions.slice(0, 2) })).toThrow();
    const tenQuestions = Array.from({ length: 10 }, (_, idx) => ({ ...content.questions[0], id: `q-${idx}` }));
    expect(() => validateLearningContent({ ...content, questions: tenQuestions })).not.toThrow();
    expect(() => validateLearningContent({ ...content, questions: [...tenQuestions, { ...content.questions[0], id: 'q-10' }] })).toThrow();
    expect(() => validateLearningContent({ ...content, questions: content.questions.map((question) => ({ ...question, correctOptionId: 'Z' })) })).toThrow();

    const passage = 'Sentence one introduces Anna. Sentence two explains the club schedule. Repeated note. Repeated note.';
    const withReading = (patch: Partial<LearningContent['questions'][number]>, customPassage?: string): LearningContent => ({
      steps: [],
      passage: customPassage,
      questions: content.questions.map((question, index) => (index === 0 ? { ...question, ...patch } : question)),
    });
    expect(() => validateLearningContent(withReading({ evidence: 'sentence two explains the club schedule.', skillCode: 'reading.scanning' }, passage))).not.toThrow();
    for (const advancedCode of [
      'reading.author_purpose',
      'reading.fact_opinion',
      'reading.critical_reading',
      'reading.context_clues',
      'reading.main_idea',
      'reading.text_structure',
    ] as const) {
      expect(() => validateLearningContent(withReading({ skillCode: advancedCode }, passage))).not.toThrow();
    }
    expect(() => validateLearningContent(withReading({ evidence: '   ' }, passage))).toThrow();
    expect(() => validateLearningContent(withReading({ evidence: 'Sentence one introduces Anna.' }))).toThrow();
    expect(() => validateLearningContent(withReading({ evidence: 'Missing from passage.' }, passage))).toThrow();
    expect(() => validateLearningContent(withReading({ evidence: 'Repeated note.' }, passage))).toThrow();
    expect(() => validateLearningContent(withReading({ skillCode: 'reading.unknown' as never }, passage))).toThrow();

    // GAP_FILL validation
    expect(() => validateLearningContent(withReading({
      type: 'GAP_FILL',
      prompt: 'The club schedule is explained in _____ two.',
      evidence: 'Sentence two explains the club schedule.',
    }, passage))).not.toThrow();
    expect(() => validateLearningContent(withReading({
      type: 'GAP_FILL',
      prompt: 'No blank marker here.',
    }, passage))).toThrow();
    expect(() => validateLearningContent(withReading({
      type: 'GAP_FILL',
      prompt: 'Choose _____ option.',
      options: content.questions[0].options.slice(0, 3),
    }, passage))).toThrow();

    // TRUE_FALSE_NOT_GIVEN validation (Not Given allows omitting evidence)
    expect(() => validateLearningContent(withReading({
      type: 'TRUE_FALSE_NOT_GIVEN',
      prompt: 'Anna started the club last summer.',
      options: [{ id: 'A', text: 'True' }, { id: 'B', text: 'False' }, { id: 'C', text: 'Not Given' }],
      correctOptionId: 'C',
      evidence: undefined,
    }, passage))).not.toThrow();
    expect(() => validateLearningContent(withReading({
      type: 'TRUE_FALSE_NOT_GIVEN',
      prompt: 'Invalid option labels.',
      options: [{ id: 'A', text: 'Yes' }, { id: 'B', text: 'No' }, { id: 'C', text: 'Not Given' }],
      correctOptionId: 'C',
    }, passage))).toThrow();

    // keyVocabulary validation
    expect(() => validateLearningContent({
      ...content,
      keyVocabulary: [{ id: 'kv-1', word: 'schedule', phonetic: '/ˈskedʒuːl/', meaning: 'lịch trình', example: 'Check the schedule.' }],
    })).not.toThrow();
    expect(() => validateLearningContent({
      ...content,
      keyVocabulary: [
        { id: 'kv-1', word: 'schedule', meaning: 'lịch trình' },
        { id: 'kv-2', word: 'Schedule', meaning: 'Lịch trình' },
      ],
    })).toThrow();
  });

  it('hides reading evidence until checked, exposes type/skillCode/keyVocabulary, and falls back questionCount for legacy snapshots', async () => {
    const readingContent: LearningContent = {
      steps: [],
      passage: 'Sentence zero. Sentence one. Sentence two. Sentence three. Sentence four.',
      keyVocabulary: [{ id: 'kv-0', word: 'sentence', phonetic: '/ˈsentəns/', meaning: 'câu văn' }],
      questions: content.questions.map((question, index) => ({
        ...question,
        ...(index === 1 ? { type: 'GAP_FILL' as const, prompt: 'Sentence _____.' } : {}),
        skillCode: 'reading.scanning',
        evidence: ['Sentence zero.', 'Sentence one.', 'Sentence two.', 'Sentence three.', 'Sentence four.'][index],
      })),
    };
    const { service, db, lesson, attempt } = fixture();
    lesson.kind = 'READING';
    lesson.content = structuredClone(readingContent) as unknown as Prisma.JsonValue;
    attempt.phase = 'QUIZ';
    attempt.contentSnapshot = structuredClone(readingContent) as unknown as Prisma.JsonValue;
    attempt.lessonSnapshot = { id: lesson.id, code: lesson.code, kind: 'READING', title: 'Reading v1', description: 'Desc', estimatedMinutes: 5, contentVersion: 1 };

    const initial = await service.attempt('owner', 'attempt');
    expect(initial.lesson.questionCount).toBe(5);
    expect(initial.questions[0]).toMatchObject({ type: 'MULTIPLE_CHOICE', skillCode: 'reading.scanning' });
    expect(initial.questions[1]).toMatchObject({ type: 'GAP_FILL' });
    expect(initial.content.keyVocabulary).toEqual([{ id: 'kv-0', word: 'sentence', phonetic: '/ˈsentəns/', meaning: 'câu văn' }]);
    expect(initial.answers[0]).not.toHaveProperty('evidence');

    const checked = await service.check('owner', 'attempt', 'q0', { expectedVersion: 0, optionId: 'B' });
    expect(checked.answers[0]).toMatchObject({ checked: true, evidence: 'Sentence zero.' });
    expect(checked.answers[1]).not.toHaveProperty('evidence');

    const listed = await service.history('owner');
    expect(db.learningAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner', status: 'COMPLETED' } }));
    expect(listed.items[0].lesson.questionCount).toBe(5);
  });

  describe('explainReadingAnswer', () => {
    function readingFixture(passage = 'Pocket parks cool urban streets by two degrees.') {
      const ml = { explainReadingAnswer: jest.fn() };
      const tfngContent: LearningContent = {
        steps: [],
        passage,
        questions: [
          {
            id: 'q0',
            type: 'MULTIPLE_CHOICE',
            skillCode: 'reading.scanning',
            prompt: 'How much do pocket parks cool streets?',
            options: [
              { id: 'A', text: 'Two degrees' },
              { id: 'B', text: 'Ten degrees' },
            ],
            correctOptionId: 'A',
            explanation: 'Đoạn văn nêu công viên bỏ túi làm mát hai độ.',
            evidence: 'cool urban streets by two degrees',
          },
          {
            id: 'q1',
            type: 'TRUE_FALSE_NOT_GIVEN',
            skillCode: 'reading.inference',
            prompt: 'Cities will double park budgets next year.',
            options: [
              { id: 'A', text: 'True' },
              { id: 'B', text: 'False' },
              { id: 'C', text: 'Not Given' },
            ],
            correctOptionId: 'C',
            explanation: 'Bài đọc không đề cập ngân sách năm sau.',
          },
          {
            id: 'q2',
            type: 'MULTIPLE_CHOICE',
            skillCode: 'reading.main_idea',
            prompt: 'What is the main idea?',
            options: [
              { id: 'A', text: 'Small parks cool cities' },
              { id: 'B', text: 'Subways are faster' },
            ],
            correctOptionId: 'A',
            explanation: 'Ý chính nói về lợi ích làm mát của công viên nhỏ.',
            evidence: 'Pocket parks cool urban streets',
          },
        ],
      };
      const base = fixture(ml);
      base.lesson.kind = 'READING';
      base.lesson.content = structuredClone(tfngContent) as unknown as Prisma.JsonValue;
      base.attempt.phase = 'QUIZ';
      base.attempt.totalQuestions = tfngContent.questions.length;
      base.attempt.contentSnapshot = structuredClone(tfngContent) as unknown as Prisma.JsonValue;
      base.attempt.lessonSnapshot = {
        id: base.lesson.id,
        code: base.lesson.code,
        kind: 'READING',
        title: 'Pocket parks',
        description: 'Reading',
        estimatedMinutes: 8,
        contentVersion: 3,
      };
      return { ...base, ml };
    }

    it('rejects foreign attempts and unchecked answers before calling ML', async () => {
      const { service, ml } = readingFixture();
      await expect(service.explainReadingAnswer('stranger', 'attempt', 'q0')).rejects.toThrow(NotFoundException);
      await expect(service.explainReadingAnswer('owner', 'attempt', 'q0')).rejects.toThrow(BadRequestException);
      expect(ml.explainReadingAnswer).not.toHaveBeenCalled();
    });

    it('returns grounded AI explanation after check and falls back to CURRICULUM on ML timeout/error', async () => {
      const { service, ml } = readingFixture();
      await service.check('owner', 'attempt', 'q0', { expectedVersion: 0, optionId: 'B' });

      ml.explainReadingAnswer.mockResolvedValueOnce({
        explanation: 'Đáp án đúng là Two degrees vì đoạn văn nói "cool urban streets by two degrees".',
        model_version: 'gemini-2.5-flash',
      });
      const aiRes = await service.explainReadingAnswer('owner', 'attempt', 'q0');
      expect(aiRes).toEqual({
        questionId: 'q0',
        explanation: 'Đáp án đúng là Two degrees vì đoạn văn nói "cool urban streets by two degrees".',
        source: 'AI',
      });
      expect(ml.explainReadingAnswer).toHaveBeenCalledWith(expect.objectContaining({
        selected_option: 'Ten degrees',
        correct_option: 'Two degrees',
        evidence: 'cool urban streets by two degrees',
        locale: 'vi',
      }));

      ml.explainReadingAnswer.mockRejectedValueOnce(new Error('timeout of 12000ms exceeded'));
      const fallbackRes = await service.explainReadingAnswer('owner', 'attempt', 'q0');
      expect(fallbackRes).toEqual({
        questionId: 'q0',
        explanation: 'Đoạn văn nêu công viên bỏ túi làm mát hai độ.',
        source: 'CURRICULUM',
        retryable: true,
      });
    });

    it('returns non-retryable CURRICULUM without calling ML when a truncated long passage loses full Not Given or main-idea context', async () => {
      const longPassage = `Pocket parks cool urban streets. ${'Filler sentence about trees and shade. '.repeat(120)}`;
      expect(longPassage.length).toBeGreaterThan(MAX_READING_EXPLAIN_PASSAGE_CHARS);
      const { service, ml } = readingFixture(longPassage);

      await service.check('owner', 'attempt', 'q1', { expectedVersion: 0, optionId: 'C' });
      const notGivenRes = await service.explainReadingAnswer('owner', 'attempt', 'q1');
      expect(notGivenRes).toEqual({
        questionId: 'q1',
        explanation: 'Bài đọc không đề cập ngân sách năm sau.',
        source: 'CURRICULUM',
        retryable: false,
      });

      await service.check('owner', 'attempt', 'q2', { expectedVersion: 1, optionId: 'A' });
      const mainIdeaRes = await service.explainReadingAnswer('owner', 'attempt', 'q2');
      expect(mainIdeaRes).toEqual({
        questionId: 'q2',
        explanation: 'Ý chính nói về lợi ích làm mát của công viên nhỏ.',
        source: 'CURRICULUM',
        retryable: false,
      });

      expect(ml.explainReadingAnswer).not.toHaveBeenCalled();
    });
  });
});
