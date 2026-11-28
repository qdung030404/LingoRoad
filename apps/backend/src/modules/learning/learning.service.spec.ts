import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningAttempt, LearningAttemptAnswer, LearningLesson, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MlClientService } from '../ml/ml-client.service';
import { LearningService, MAX_READING_EXPLAIN_PASSAGE_CHARS } from './learning.service';
import { LearningContent, validateLearningContent } from './learning.types';

const content: LearningContent = {
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

function extractSqlParts(args: unknown[]) {
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

function fixture(
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

describe('LearningService', () => {
  function listeningFixture() {
    const state = fixture();
    const listening = JSON.parse(readFileSync(join(__dirname, '../../../prisma/listening-content/campus-cafe-v1.json'), 'utf8')) as LearningContent;
    state.lesson.kind = 'LISTENING';
    state.lesson.content = structuredClone(listening) as unknown as Prisma.JsonValue;
    state.attempt.phase = 'QUIZ';
    state.attempt.contentSnapshot = structuredClone(listening) as unknown as Prisma.JsonValue;
    state.attempt.lessonSnapshot = { ...(state.attempt.lessonSnapshot as object), kind: 'LISTENING' };
    return { ...state, listening };
  }

  function expectNoListeningReview(value: unknown): void {
    if (value === null || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      expect(['transcript', 'transcriptSegments', 'translationVi', 'evidenceSegmentIds', 'evidence', 'contentSnapshot']).not.toContain(key);
      expectNoListeningReview(child);
    }
  }

  it('exposes listening preparation and duration but keeps review private through detail/start/progress/check', async () => {
    const { service, listening } = listeningFixture();
    const catalogue = await service.catalogue('owner', 'LISTENING');
    expect(catalogue.items[0].audioDurationMs).toBe(listening.audioDurationMs);
    const detail = await service.lesson('owner', 'lesson');
    expect(detail.content.preparation).toEqual(listening.preparation);
    expectNoListeningReview(detail);
    const started = await service.start('owner', 'lesson');
    expect(started.position.phase).toBe('QUIZ');
    expectNoListeningReview(started);
    const saved = await service.progress('owner', 'attempt', { expectedVersion: 0, phase: 'QUIZ', index: 0 });
    expectNoListeningReview(saved);
    const checked = await service.check('owner', 'attempt', listening.questions[0].id, {
      optionId: listening.questions[0].correctOptionId, expectedVersion: saved.version,
    });
    expect(checked.answers[0].explanation).toBe(listening.questions[0].explanation);
    expectNoListeningReview(checked);
    expectNoListeningReview(await service.attempt('owner', 'attempt'));
    await expect(service.attempt('stranger', 'attempt')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('opens only whitelisted listening segments and evidence after submit, using immutable snapshots and retry', async () => {
    const { service, attempt, lesson, listening } = listeningFixture();
    (attempt.contentSnapshot as unknown as LearningContent).transcriptSegments![0] = {
      ...listening.transcriptSegments![0], privateField: 'never public',
    } as unknown as NonNullable<LearningContent['transcriptSegments']>[number];
    let version = 0;
    for (const question of listening.questions) {
      const checked = await service.check('owner', 'attempt', question.id, { optionId: question.correctOptionId, expectedVersion: version });
      version = checked.version;
    }
    lesson.content = {};
    const result = await service.submit('owner', 'attempt', version);
    expect(result.result?.correctCount).toBe(5);
    expect(result.content.transcript).toBe(listening.transcript);
    expect(result.content.transcriptSegments).toEqual(listening.transcriptSegments);
    expect(result.answers[0].evidenceSegmentIds).toEqual(listening.questions[0].evidenceSegmentIds);
    expect(result.questions[0]).not.toHaveProperty('evidenceSegmentIds');
    expect(result.levelChange).toBeNull();
    const retry = await service.submit('owner', 'attempt', version);
    expect(retry.version).toBe(result.version);
    expect(retry.content).toEqual(result.content);
  });

  it('does not leak review through legacy passage/evidence fields accidentally added to a v1 record', async () => {
    const { service, lesson, attempt, listening } = listeningFixture();
    const corrupt = structuredClone(listening);
    corrupt.passage = 'Private transcript accidentally assigned to legacy passage.';
    corrupt.questions[0].evidence = 'Private listening evidence.';
    lesson.content = corrupt as unknown as Prisma.JsonValue;
    attempt.contentSnapshot = corrupt as unknown as Prisma.JsonValue;
    expectNoListeningReview(await service.lesson('owner', 'lesson'));
    const checked = await service.check('owner', 'attempt', corrupt.questions[0].id, {
      expectedVersion: 0, optionId: corrupt.questions[0].correctOptionId,
    });
    expectNoListeningReview(checked);
    expect(checked.content).not.toHaveProperty('passage');
  });

  it('validates listening kind/profile and media before deleting an unfinished attempt', async () => {
    for (const patch of [
      { audioUrl: '/media/learning/v1/does-not-exist.wav' },
      { audioDurationMs: 90001 }, { preparation: null },
    ]) {
      const { service, db, lesson, listening } = listeningFixture();
      lesson.content = { ...listening, ...patch } as unknown as Prisma.JsonValue;
      await expect(service.start('owner', 'lesson')).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(db.learningAttempt.deleteMany).not.toHaveBeenCalled();
      expect(db.learningAttempt.create).not.toHaveBeenCalled();
    }
    const { service, lesson, db } = listeningFixture();
    lesson.kind = 'READING';
    await expect(service.start('owner', 'lesson')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(db.learningAttempt.deleteMany).not.toHaveBeenCalled();
  });

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

  it('extracts catalogue metadata via $queryRaw without calling learningLesson.findMany, preserves defaults, filters by kind, and isolates latestResult per learner', async () => {
    const now = new Date('2026-11-01T00:00:00Z');
    const listening = JSON.parse(readFileSync(join(__dirname, '../../../prisma/listening-content/campus-cafe-v1.json'), 'utf8')) as LearningContent;
    const extra: Array<LearningLesson & { unit?: { cefrLevel: string } | null }> = [
      {
        id: 'legacy-lesson',
        code: 'a-legacy',
        kind: 'GRAMMAR',
        title: 'Legacy',
        description: 'No questions field',
        estimatedMinutes: 6,
        sortOrder: 0,
        published: true,
        contentVersion: 1,
        unitId: null,
        grammarTopicId: null,
        content: {} as Prisma.JsonValue,
        createdAt: now,
        updatedAt: now,
        unit: null,
      },
      {
        id: 'listening-lesson',
        code: 'z-listening',
        kind: 'LISTENING',
        title: 'Cafe',
        description: 'Listening',
        estimatedMinutes: 8,
        sortOrder: 5,
        published: true,
        contentVersion: 1,
        unitId: 'unit-b1',
        grammarTopicId: null,
        content: structuredClone(listening) as unknown as Prisma.JsonValue,
        createdAt: now,
        updatedAt: now,
        unit: { cefrLevel: 'B1' },
      },
    ];
    const { service, db, attempt } = fixture(undefined, extra);
    db.learningAttempt.findMany.mockResolvedValue([
      { ...attempt, lessonId: 'listening-lesson', status: 'COMPLETED', correctCount: 4, totalQuestions: 5, historyHiddenAt: null },
      { ...attempt, lessonId: 'legacy-lesson', status: 'COMPLETED', correctCount: 2, totalQuestions: 5, historyHiddenAt: new Date() },
    ]);

    const all = await service.catalogue('owner');
    expect(db.learningLesson.findMany).not.toHaveBeenCalled();
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(all.items.map(i => i.code)).toEqual(['a-legacy', 'test-lesson', 'z-listening']);
    expect(all.items[0]).toMatchObject({
      id: 'legacy-lesson',
      questionCount: 5,
      state: 'COMPLETED',
      latestResult: null,
    });
    expect(all.items[0]).not.toHaveProperty('audioDurationMs');
    expect(all.items[0]).not.toHaveProperty('cefrLevel');
    expect(all.items[2]).toMatchObject({
      id: 'listening-lesson',
      cefrLevel: 'B1',
      questionCount: 5,
      audioDurationMs: listening.audioDurationMs,
      state: 'COMPLETED',
      latestResult: { correctCount: 4, totalQuestions: 5, scoreRatio: 0.8 },
    });

    const filtered = await service.catalogue('owner', 'LISTENING');
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].id).toBe('listening-lesson');
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
    expect(db.learningAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner', status: 'COMPLETED', historyHiddenAt: null } }));
    expect(listed.items[0].lesson.questionCount).toBe(5);
  });

  it('uses the same completed skill filter for the history cursor and page', async () => {
    const { service, db, attempt } = fixture();
    attempt.status = 'COMPLETED';
    const where = { userId: 'owner', status: 'COMPLETED', lessonSnapshot: { path: ['kind'], equals: 'LISTENING' } };

    await service.history('owner', attempt.id, 1, 'LISTENING');
    expect(db.learningAttempt.findFirst).toHaveBeenCalledWith({ where: { ...where, id: attempt.id }, select: { id: true, updatedAt: true } });
    expect(db.learningAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ...where, historyHiddenAt: null, OR: [
        { updatedAt: { lt: attempt.updatedAt } },
        { updatedAt: attempt.updatedAt, id: { lt: attempt.id } },
      ] },
      take: 2,
    }));
    db.learningAttempt.findMany.mockClear();
    db.learningAttempt.findFirst.mockResolvedValueOnce(null);
    await expect(service.history('owner', 'other-skill', 1, 'LISTENING')).rejects.toThrow(NotFoundException);
    expect(db.learningAttempt.findMany).not.toHaveBeenCalled();
  });

  describe('explainAnswer', () => {
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
      await expect(service.explainAnswer('stranger', 'attempt', 'q0')).rejects.toThrow(NotFoundException);
      await expect(service.explainAnswer('owner', 'attempt', 'q0')).rejects.toThrow(BadRequestException);
      expect(ml.explainReadingAnswer).not.toHaveBeenCalled();
    });

    it('returns grounded AI explanation after check and falls back to CURRICULUM on ML timeout/error', async () => {
      const { service, ml } = readingFixture();
      await service.check('owner', 'attempt', 'q0', { expectedVersion: 0, optionId: 'B' });

      ml.explainReadingAnswer.mockResolvedValueOnce({
        explanation: 'Đáp án đúng là Two degrees vì đoạn văn nói "cool urban streets by two degrees".',
        model_version: 'gemini-2.5-flash',
      });
      const aiRes = await service.explainAnswer('owner', 'attempt', 'q0');
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
      const fallbackRes = await service.explainAnswer('owner', 'attempt', 'q0');
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
      const notGivenRes = await service.explainAnswer('owner', 'attempt', 'q1');
      expect(notGivenRes).toEqual({
        questionId: 'q1',
        explanation: 'Bài đọc không đề cập ngân sách năm sau.',
        source: 'CURRICULUM',
        retryable: false,
      });

      await service.check('owner', 'attempt', 'q2', { expectedVersion: 1, optionId: 'A' });
      const mainIdeaRes = await service.explainAnswer('owner', 'attempt', 'q2');
      expect(mainIdeaRes).toEqual({
        questionId: 'q2',
        explanation: 'Ý chính nói về lợi ích làm mát của công viên nhỏ.',
        source: 'CURRICULUM',
        retryable: false,
      });

      expect(ml.explainReadingAnswer).not.toHaveBeenCalled();
    });

    it('uses only the completed listening question’s evidence and the saved choice', async () => {
      const { service, attempt, ml } = readingFixture();
      const content = attempt.contentSnapshot as unknown as LearningContent;
      const question = content.questions[0];
      await service.check('owner', 'attempt', 'q0', { expectedVersion: 0, optionId: 'B' });
      attempt.lessonSnapshot = { ...(attempt.lessonSnapshot as object), kind: 'LISTENING' };
      question.evidenceSegmentIds = ['s2'];
      content.listeningVersion = 1;
      content.transcriptSegments = [
        { id: 's1', startMs: 0, endMs: 1000, speaker: 'Ben', text: 'Hello.', translationVi: 'Xin chào.' },
        { id: 's2', startMs: 1000, endMs: 2000, speaker: 'Staff', text: 'It costs two pounds.', translationVi: 'Giá hai bảng.' },
      ];
      await expect(service.explainAnswer('owner', 'attempt', 'q0')).rejects.toThrow(BadRequestException);
      expect(ml.explainReadingAnswer).not.toHaveBeenCalled();
      attempt.status = 'COMPLETED';
      ml.explainReadingAnswer.mockResolvedValue({ explanation: 'Chi tiết nghe được là two pounds.' });
      await expect(service.explainAnswer('owner', 'attempt', 'q0')).resolves.toMatchObject({ source: 'AI' });
      expect(ml.explainReadingAnswer).toHaveBeenCalledWith(expect.objectContaining({
        source_kind: 'LISTENING', passage: 'Staff: It costs two pounds.', selected_option: 'Ten degrees',
      }));
      expect(ml.explainReadingAnswer.mock.calls[0][0]).not.toHaveProperty('evidence');
      ml.explainReadingAnswer.mockRejectedValueOnce(new Error('Unavailable'));
      await expect(service.explainAnswer('owner', 'attempt', 'q0')).resolves.toMatchObject({
        source: 'CURRICULUM', retryable: true, explanation: question.explanation,
      });
    });
  });

  describe('Adaptive level lock order, exposure guard, and idempotent submit', () => {
    it('acquires user lock before reading attempt and records exposure across version bumps and cancel', async () => {
      const { db, lesson, exposures, service } = fixture();
      const callOrder: string[] = [];
      db.$queryRaw.mockImplementation(async () => { callOrder.push('lock_users'); return []; });
      const origFindFirst = db.learningAttempt.findFirst.getMockImplementation()!;
      db.learningAttempt.findFirst.mockImplementation(async (arg: any) => {
        callOrder.push('read_attempt');
        return origFindFirst(arg);
      });

      await service.check('owner', 'attempt', 'q0', { expectedVersion: 0, optionId: 'A' });
      expect(callOrder.slice(0, 2)).toEqual(['lock_users', 'read_attempt']);
      expect(exposures).toHaveLength(1);
      expect(exposures[0].firstAttemptId).toBe('attempt');

      // Canceling does not erase LearningAnswerExposure; bumping lesson.contentVersion still marks restart ineligible.
      await service.cancel('owner', 'attempt');
      expect(exposures).toHaveLength(1);
      lesson.contentVersion = 4;
      const restarted = await service.start('owner', lesson.id);
      expect(restarted.id).toBe('fresh-attempt');
      expect(db.learningAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contentVersion: 4, eligibleForLevelEval: false }),
        }),
      );
    });

    it('keeps attempt eligible if canceled before any check() revealed answers', async () => {
      const { db, lesson, exposures, service } = fixture();
      await service.cancel('owner', 'attempt');
      expect(exposures).toHaveLength(0);
      await service.start('owner', lesson.id);
      expect(db.learningAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eligibleForLevelEval: true }),
        }),
      );
    });

    it('locks users before submit, calls evaluateReadingLevel once, and returns saved levelChange on retry', async () => {
      const { db, lesson, setSavedLevelEvent } = fixture();
      lesson.kind = 'READING';
      const evaluateReadingLevel = jest.fn(async () => {
        const evt = { kind: 'READING' as const, from: 'A2' as const, to: 'B1' as const, direction: 'UP' as const };
        setSavedLevelEvent({ kind: 'READING', fromCefr: 'A2', toCefr: 'B1', direction: 'UP' });
        return evt;
      });
      const planningMock = { evaluateReadingLevel } as unknown as any;
      const svc = new LearningService(db as unknown as PrismaService, planningMock);
      const readingContent = { ...content, passage: 'Sample passage' };
      // Check all 5 questions first.
      for (let i = 0; i < 5; i++) {
        await svc.check('owner', 'attempt', `q${i}`, { expectedVersion: i, optionId: 'A' });
      }
      // Patch attempt snapshot kind for submission evaluation check.
      const firstRow = await db.learningAttempt.findFirst({ where: { id: 'attempt', userId: 'owner' } });
      expect(firstRow).not.toBeNull();
      // Mutate underlying attempt via updateMany or direct call sequence after resetting query log.
      const order: string[] = [];
      db.$queryRaw.mockImplementation(async () => { order.push('lock_users'); return []; });
      const prevFindFirst = db.learningAttempt.findFirst.getMockImplementation()!;
      db.learningAttempt.findFirst.mockImplementation(async (args: any) => {
        order.push('read_attempt');
        const res = await prevFindFirst(args);
        if (res) {
          res.lessonSnapshot = { ...res.lessonSnapshot as object, kind: 'READING', cefrLevel: 'A2' };
          res.contentSnapshot = readingContent as unknown as Prisma.JsonValue;
        }
        return res;
      });

      const submitted = await svc.submit('owner', 'attempt', 5);
      expect(order.slice(0, 2)).toEqual(['lock_users', 'read_attempt']);
      expect(evaluateReadingLevel).toHaveBeenCalledTimes(1);
      expect(submitted.levelChange).toEqual({ kind: 'READING', from: 'A2', to: 'B1', direction: 'UP' });

      // Retry after lost response must return exact stored levelChange and never re-evaluate.
      const retried = await svc.submit('owner', 'attempt', 5);
      expect(evaluateReadingLevel).toHaveBeenCalledTimes(1);
      expect(retried.levelChange).toEqual({ kind: 'READING', from: 'A2', to: 'B1', direction: 'UP' });
    });

    it('exposes visual covers and option images before completion while gating speakerAvatar until submit', async () => {
      const firstClass = JSON.parse(readFileSync(join(__dirname, '../../../prisma/listening-content/first-class-v1.json'), 'utf8')) as LearningContent;
      const now = new Date('2026-11-01T00:00:00Z');
      const lesson: LearningLesson & { unit?: { cefrLevel: string } | null } = {
        id: 'fc-lesson',
        code: 'listening-first-class',
        kind: 'LISTENING',
        title: 'Checking Tomorrow’s Timetable',
        description: 'Visual listening',
        estimatedMinutes: 5,
        sortOrder: 49,
        published: true,
        contentVersion: 1,
        unitId: 'a1-u1',
        grammarTopicId: null,
        content: structuredClone(firstClass) as unknown as Prisma.JsonValue,
        createdAt: now,
        updatedAt: now,
        unit: { cefrLevel: 'A1' },
      };
      const { service, db, attempt } = fixture(undefined, [lesson]);
      db.learningLesson.findFirst.mockResolvedValue(lesson);

      const catalogue = await service.catalogue('owner', 'LISTENING');
      expect(catalogue.items.find((i) => i.id === 'fc-lesson')).toMatchObject({
        coverImageUrl: firstClass.coverImageUrl,
      });

      const detail = await service.lesson('owner', 'fc-lesson');
      expect(detail.content.coverImageUrl).toBe(firstClass.coverImageUrl);
      expect(detail.content.keyVocabulary?.every((v) => Boolean(v.imageUrl))).toBe(true);
      expect(detail.content).not.toHaveProperty('transcriptSegments');
      expect(detail.questions.find((q) => q.id === 'q02')?.options.every((o) => Boolean(o.imageUrl))).toBe(true);

      const started = await service.start('owner', 'fc-lesson');
      expect(started.content).not.toHaveProperty('transcriptSegments');
      expect((started.lesson as { coverImageUrl?: string }).coverImageUrl).toBe(firstClass.coverImageUrl);

      attempt.lessonId = 'fc-lesson';
      attempt.lessonSnapshot = { id: 'fc-lesson', code: 'listening-first-class', kind: 'LISTENING', title: lesson.title, description: lesson.description, estimatedMinutes: 5, contentVersion: 1, questionCount: firstClass.questions.length, audioDurationMs: firstClass.audioDurationMs, coverImageUrl: firstClass.coverImageUrl };
      attempt.contentSnapshot = structuredClone(firstClass) as unknown as Prisma.JsonValue;
      attempt.totalQuestions = firstClass.questions.length;
      for (let i = 0; i < firstClass.questions.length; i++) {
        await service.check('owner', attempt.id, firstClass.questions[i].id, { expectedVersion: i, optionId: 'A' });
      }
      const submitted = await service.submit('owner', attempt.id, firstClass.questions.length);
      expect(submitted.content.transcriptSegments?.[0]).toMatchObject({
        speaker: 'Noah',
        speakerAvatar: '/media/learning/v1/images/avatar-noah.jpg',
      });
    });

    it('exposes coverImageUrl for READING lessons in catalogue and lesson detail', async () => {
      const now = new Date('2026-11-01T00:00:00Z');
      const readingLesson: LearningLesson & { unit?: { cefrLevel: string } | null } = {
        id: 'rd-cover',
        code: 'reading-a2-club-meeting',
        kind: 'READING',
        title: 'A New Time for the Club Meeting',
        description: 'Reading cover',
        estimatedMinutes: 5,
        sortOrder: 5,
        published: true,
        contentVersion: 5,
        unitId: 'a2-u1',
        grammarTopicId: null,
        content: {
          steps: [],
          coverImageUrl: '/media/learning/v1/images/scene-reading-book-club.jpg',
          passage: ['Paragraph 1'],
          questions: [],
        } as unknown as Prisma.JsonValue,
        createdAt: now,
        updatedAt: now,
        unit: { cefrLevel: 'A2' },
      };
      const { service, db } = fixture(undefined, [readingLesson]);
      db.learningLesson.findFirst.mockResolvedValue(readingLesson);

      const catalogue = await service.catalogue('owner', 'READING');
      expect(catalogue.items.find((i) => i.id === 'rd-cover')).toMatchObject({
        coverImageUrl: '/media/learning/v1/images/scene-reading-book-club.jpg',
      });

      const detail = await service.lesson('owner', 'rd-cover');
      expect(detail.content.coverImageUrl).toBe('/media/learning/v1/images/scene-reading-book-club.jpg');
    });

    it('loads single lesson detail without scanning full catalogue and preserves hidden-history completion rules', async () => {
      const { service, db, lesson, attempt } = fixture();
      db.$queryRaw.mockClear();

      const hiddenCompleted = {
        ...structuredClone(attempt),
        id: 'att-hidden',
        lessonId: lesson.id,
        status: 'COMPLETED' as const,
        correctCount: 5,
        totalQuestions: 5,
        historyHiddenAt: new Date('2026-11-02T00:00:00Z'),
      };
      db.learningAttempt.findMany.mockResolvedValueOnce([hiddenCompleted]);

      const hiddenDetail = await service.lesson('owner', lesson.id);
      expect(db.$queryRaw).not.toHaveBeenCalled();
      expect(db.learningAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'owner', lessonId: lesson.id, status: 'COMPLETED' },
        }),
      );
      expect(hiddenDetail.state).toBe('COMPLETED');
      expect(hiddenDetail.latestResult).toBeNull();

      const visibleCompleted = {
        ...structuredClone(attempt),
        id: 'att-visible',
        lessonId: lesson.id,
        status: 'COMPLETED' as const,
        correctCount: 4,
        totalQuestions: 5,
        historyHiddenAt: null,
      };
      db.learningAttempt.findMany.mockResolvedValueOnce([hiddenCompleted, visibleCompleted]);

      const visibleDetail = await service.lesson('owner', lesson.id);
      expect(db.$queryRaw).not.toHaveBeenCalled();
      expect(visibleDetail.state).toBe('COMPLETED');
      expect(visibleDetail.latestResult).toEqual({
        correctCount: 4,
        totalQuestions: 5,
        scoreRatio: 0.8,
      });
    });

    it('exposes grammarTopicCode in catalogue for linked grammar lessons and legacy fallback while omitting null', async () => {
      const now = new Date('2026-11-01T00:00:00Z');
      const linkedGrammar: LearningLesson & { unit?: { cefrLevel: string } | null; grammarTopic?: { code: string } | null } = {
        id: 'gr-linked',
        code: 'qz-grammar-tenses-present-perfect',
        kind: 'GRAMMAR',
        title: 'Present Perfect',
        description: 'Linked grammar lesson',
        estimatedMinutes: 6,
        sortOrder: 2,
        published: true,
        contentVersion: 1,
        unitId: 'b1-u1',
        grammarTopicId: 'topic-pp',
        content: structuredClone(content) as unknown as Prisma.JsonValue,
        createdAt: now,
        updatedAt: now,
        unit: { cefrLevel: 'B1' },
        grammarTopic: { code: 'grammar.tenses.present_perfect' },
      };
      const legacyGrammar: LearningLesson & { unit?: { cefrLevel: string } | null; grammarTopic?: { code: string } | null } = {
        id: 'gr-legacy',
        code: 'grammar-pronouns-to-be',
        kind: 'GRAMMAR',
        title: 'Pronouns and to be',
        description: 'Legacy grammar lesson',
        estimatedMinutes: 5,
        sortOrder: 3,
        published: true,
        contentVersion: 1,
        unitId: 'a1-u1',
        grammarTopicId: null,
        content: structuredClone(content) as unknown as Prisma.JsonValue,
        createdAt: now,
        updatedAt: now,
        unit: { cefrLevel: 'A1' },
        grammarTopic: null,
      };
      const { service } = fixture(undefined, [linkedGrammar, legacyGrammar]);

      const catalogue = await service.catalogue('owner', 'GRAMMAR');
      const unlinkedItem = catalogue.items.find((i) => i.id === 'lesson');
      const linkedItem = catalogue.items.find((i) => i.id === 'gr-linked');
      const legacyItem = catalogue.items.find((i) => i.id === 'gr-legacy');

      expect(unlinkedItem?.grammarTopicCode).toBeUndefined();
      expect(linkedItem?.grammarTopicCode).toBe('grammar.tenses.present_perfect');
      expect(legacyItem?.grammarTopicCode).toBe('grammar.pronouns');
    });

    it('reads owned attempt only once per progress(), check(), and submit() transaction', async () => {
      const readingContent: LearningContent = {
        steps: [{ id: 's0', title: 'Intro', body: 'Passage intro' }],
        passage: 'Short passage.',
        questions: content.questions.map((question) => ({
          ...question,
          skillCode: 'reading.scanning',
          evidence: 'Short passage.',
        })),
      };
      const clean = fixture();
      clean.lesson.kind = 'READING';
      clean.attempt.lessonSnapshot = {
        ...(clean.attempt.lessonSnapshot as object),
        kind: 'READING',
        cefrLevel: 'A2',
      };
      clean.attempt.contentSnapshot = structuredClone(readingContent) as unknown as Prisma.JsonValue;

      clean.db.learningAttempt.findFirst.mockClear();
      const progressed = await clean.service.progress('owner', 'attempt', {
        expectedVersion: 0,
        phase: 'QUIZ',
        index: 0,
        questionId: 'q0',
        optionId: 'B',
      });
      expect(clean.db.learningAttempt.findFirst).toHaveBeenCalledTimes(1);
      expect(progressed.version).toBe(1);
      expect(progressed.position).toEqual({ phase: 'QUIZ', index: 0 });
      expect(progressed.answers[0]).toEqual({ questionId: 'q0', optionId: 'B', checked: false });

      let version = progressed.version;
      for (let i = 0; i < 5; i++) {
        clean.db.learningAttempt.findFirst.mockClear();
        const checked = await clean.service.check('owner', 'attempt', `q${i}`, {
          expectedVersion: version,
          optionId: 'A',
        });
        expect(clean.db.learningAttempt.findFirst).toHaveBeenCalledTimes(1);
        expect(checked.answers[i]).toMatchObject({
          questionId: `q${i}`,
          optionId: 'A',
          checked: true,
          isCorrect: true,
        });
        version = checked.version;
      }

      clean.db.learningAttempt.findFirst.mockClear();
      const submitted = await clean.service.submit('owner', 'attempt', version);
      expect(clean.db.learningAttempt.findFirst).toHaveBeenCalledTimes(1);
      expect(submitted.status).toBe('COMPLETED');
      expect(submitted.result).toEqual({ correctCount: 5, totalQuestions: 5, scoreRatio: 1 });
    });
  });
});
