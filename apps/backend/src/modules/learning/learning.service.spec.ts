import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningAttempt, LearningAttemptAnswer, LearningLesson, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MlClientService } from '../ml/ml-client.service';
import { LearningService, MAX_READING_EXPLAIN_PASSAGE_CHARS } from './learning.service';
import { LearningContent, validateLearningContent } from './learning.types';

import { content, extractSqlParts, fixture } from './learning-test.fixture';

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
});
