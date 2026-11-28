import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningAttempt, LearningAttemptAnswer, LearningLesson, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MlClientService } from '../ml/ml-client.service';
import { LearningService, MAX_READING_EXPLAIN_PASSAGE_CHARS } from './learning.service';
import { LearningContent, validateLearningContent } from './learning.types';

import { content, fixture } from './learning-test.fixture';

describe('LearningService (explainAnswer & adaptive)', () => {
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
  });
});
