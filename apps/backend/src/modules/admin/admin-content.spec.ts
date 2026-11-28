import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  AssessmentSkill,
  AuthProvider,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AssessmentMatrixService } from '../assessment/services/assessment-matrix.service';
import { FirebaseTokenService } from '../auth/firebase/firebase-token.service';
import { FirebaseUserService } from '../auth/firebase/firebase-user.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../security/password.service';
import { TokenService } from '../security/token.service';
import { CuratedVocabularyService } from '../vocabulary/curated-vocabulary.service';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminContentService } from './services/admin-content.service';
import { AdminImportService } from './services/admin-import.service';
import { AdminUsersService } from './services/admin-users.service';

jest.mock('firebase-admin/app', () => ({}));
jest.mock('firebase-admin/auth', () => ({}));

describe('AdminContentService', () => {
  const tx = {
    $queryRaw: jest.fn(async () => []),
    learningAttempt: { deleteMany: jest.fn() },
    learningLesson: { delete: jest.fn() },
    placementSession: { updateMany: jest.fn() },
    assessmentResponse: { deleteMany: jest.fn() },
    assessmentItem: { delete: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const prisma = {
    learningLesson: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    assessmentItem: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      update: tx.assessmentItem.update,
      findUnique: tx.assessmentItem.findUnique,
      delete: tx.assessmentItem.delete,
    },
    $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) =>
      cb(tx),
    ),
  };
  const matrixService = {
    invalidateCache: jest.fn(async () => undefined),
  };

  const service = new AdminContentService(
    prisma as unknown as PrismaService,
    matrixService as unknown as AssessmentMatrixService,
  );

  beforeEach(() => jest.clearAllMocks());

  const validLessonContent = {
    steps: [{ id: 's-1', title: 'Intro', body: 'Body text' }],
    questions: [1, 2, 3].map((i) => ({
      id: `q-${i}`,
      type: 'MULTIPLE_CHOICE',
      prompt: `Question ${i}?`,
      options: [
        { id: 'A', text: 'Opt 1' },
        { id: 'B', text: 'Opt 2' },
        { id: 'C', text: 'Opt 3' },
        { id: 'D', text: 'Opt 4' },
      ],
      correctOptionId: 'A',
      explanation: 'Giải thích hợp lệ',
    })),
  };

  it('listLessons và listAssessmentItems trả về summary chuẩn Legacy', async () => {
    prisma.learningLesson.count.mockResolvedValue(2);
    prisma.learningLesson.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { published: true, content: validLessonContent },
        { published: false, content: validLessonContent },
      ]);

    const lessonsRes = await service.listLessons({ page: 1, limit: 10 });
    expect(lessonsRes.summary).toEqual({
      total: 2,
      published: 1,
      drafts: 1,
      linkedQuestions: 6,
    });

    prisma.assessmentItem.count.mockResolvedValue(10);
    prisma.assessmentItem.findMany.mockResolvedValue([]);
    prisma.assessmentItem.groupBy
      .mockResolvedValueOnce([
        { type: ItemType.MULTIPLE_CHOICE, _count: { id: 7 } },
        { type: ItemType.CLOZE, _count: { id: 3 } },
      ])
      .mockResolvedValueOnce([
        { skillCode: 'reading.skimming' },
        { skillCode: 'listening.gist' },
      ]);

    const itemsRes = await service.listAssessmentItems({ page: 1, limit: 10 });
    expect(itemsRes.summary).toEqual({
      total: 10,
      mcqCount: 7,
      clozeAndOtherCount: 3,
      coveredSkillsCount: 2,
    });
  });

  it('tạo LearningLesson hợp lệ và chặn nội dung sai chuẩn', async () => {
    await expect(
      service.createLesson({
        code: 'invalid-lesson',
        kind: LearningKind.GRAMMAR,
        title: 'Bad',
        description: 'Bad content',
        estimatedMinutes: 5,
        content: { steps: [], questions: [] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.learningLesson.findUnique.mockResolvedValue(null);
    prisma.learningLesson.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
    prisma.learningLesson.create.mockResolvedValue({
      id: 'lesson-1',
      code: 'grammar-a1-01',
      kind: LearningKind.GRAMMAR,
      title: 'Present Simple',
      description: 'Desc',
      estimatedMinutes: 5,
      sortOrder: 5,
      published: true,
      contentVersion: 1,
      content: validLessonContent,
      unit: null,
      _count: { attempts: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await service.createLesson({
      code: 'grammar-a1-01',
      kind: LearningKind.GRAMMAR,
      title: 'Present Simple',
      description: 'Desc',
      estimatedMinutes: 5,
      content: validLessonContent,
    });

    expect(created.sortOrder).toBe(5);
    expect(created.questionsCount).toBe(3);
    expect(created.primarySkillCode).toBe('grammar.general');
  });

  it('xoá LearningLesson xử lý đúng theo attempts = 0, > 0 an toàn và force = true', async () => {
    prisma.learningLesson.findUnique.mockResolvedValueOnce({
      id: 'l-1',
      _count: { attempts: 0 },
    });
    const deletedEmpty = await service.deleteLesson('l-1', false);
    expect(deletedEmpty.action).toBe('DELETED');
    expect(prisma.learningLesson.delete).toHaveBeenCalledWith({
      where: { id: 'l-1' },
    });

    prisma.learningLesson.findUnique.mockResolvedValueOnce({
      id: 'l-2',
      _count: { attempts: 4 },
    });
    const unpublished = await service.deleteLesson('l-2', false);
    expect(unpublished).toEqual({
      id: 'l-2',
      action: 'UNPUBLISHED',
      attemptsCount: 4,
    });
    expect(prisma.learningLesson.update).toHaveBeenCalledWith({
      where: { id: 'l-2' },
      data: { published: false },
    });

    prisma.learningLesson.findUnique.mockResolvedValueOnce({
      id: 'l-2',
      _count: { attempts: 4 },
    });
    const forced = await service.deleteLesson('l-2', true);
    expect(forced.action).toBe('DELETED');
    expect(tx.learningAttempt.deleteMany).toHaveBeenCalledWith({
      where: { lessonId: 'l-2' },
    });
    expect(tx.learningLesson.delete).toHaveBeenCalledWith({
      where: { id: 'l-2' },
    });
  });

  it('tạo, sửa và xoá AssessmentItem gọi invalidateCache()', async () => {
    const baseItem = {
      id: 'item-1',
      externalId: null,
      skill: AssessmentSkill.READING,
      skillCode: 'reading.skimming',
      cefrLevel: CefrLevel.B1,
      type: ItemType.MULTIPLE_CHOICE,
      usageScope: ItemUsageScope.ALL,
      passage: 'A short reading passage.',
      prompt: 'Choose the best answer',
      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      correctOption: 'Alpha',
      explanation: 'Giải thích',
      audioUrl: null,
      irtA: 1.0,
      irtB: 0.0,
      irtC: 0.25,
      _count: { responses: 0 },
      createdAt: new Date(),
    };
    prisma.assessmentItem.create.mockResolvedValue(baseItem);

    await service.createAssessmentItem({
      skill: AssessmentSkill.READING,
      skillCode: 'reading.skimming',
      cefrLevel: CefrLevel.B1,
      passage: 'A short reading passage.',
      prompt: 'Choose the best answer',
      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      correctOption: 'Alpha',
      explanation: 'Giải thích',
    });
    expect(matrixService.invalidateCache).toHaveBeenCalledTimes(1);

    prisma.assessmentItem.findUnique.mockResolvedValueOnce(baseItem);
    prisma.assessmentItem.update.mockResolvedValue({
      ...baseItem,
      prompt: 'Updated prompt',
      correctOption: 'Beta',
    });

    const updated = await service.updateAssessmentItem('item-1', {
      prompt: 'Updated prompt',
      correctOption: 'Beta',
    });
    expect(updated.prompt).toBe('Updated prompt');
    expect(matrixService.invalidateCache).toHaveBeenCalledTimes(2);

    prisma.assessmentItem.findUnique.mockResolvedValueOnce({
      id: 'item-1',
      _count: { responses: 2, currentSessions: 0 },
    });
    await expect(service.deleteAssessmentItem('item-1', false)).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.assessmentItem.findUnique.mockResolvedValueOnce({
      id: 'item-1',
      _count: { responses: 2, currentSessions: 1 },
    });
    const deleted = await service.deleteAssessmentItem('item-1', true);
    expect(deleted.action).toBe('DELETED');
    expect(matrixService.invalidateCache).toHaveBeenCalledTimes(3);
  });
});

describe('AdminImportService', () => {
  const tx = {
    $queryRaw: jest.fn(async () => []),
    learningUnit: { upsert: jest.fn(), findMany: jest.fn() },
    learningLesson: { aggregate: jest.fn(), upsert: jest.fn() },
    assessmentItem: { upsert: jest.fn(), create: jest.fn(), findUnique: jest.fn(async () => null) },
    curatedTopic: { upsert: jest.fn() },
    curatedTopicWord: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    learningUnit: { findMany: jest.fn() },
    learningLesson: { findMany: jest.fn() },
    assessmentItem: { findMany: jest.fn() },
    curatedTopic: { findMany: jest.fn() },
    $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) =>
      cb(tx),
    ),
  };
  const matrixService = { invalidateCache: jest.fn(async () => undefined) };
  const curatedVocabularyService = { invalidateTopicsCache: jest.fn() };

  const service = new AdminImportService(
    prisma as unknown as PrismaService,
    matrixService as unknown as AssessmentMatrixService,
    curatedVocabularyService as unknown as CuratedVocabularyService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('validateBundle phát hiện lỗi cấu trúc và báo lỗi cụ thể', async () => {
    prisma.learningUnit.findMany.mockResolvedValue([]);
    prisma.learningLesson.findMany.mockResolvedValue([]);

    const emptyRes = await service.validateBundle({ units: [], lessons: [] });
    expect(emptyRes.isValid).toBe(false);
    expect(emptyRes.errors[0]?.path).toBe('$');

    const badLessonRes = await service.validateBundle({
      lessons: [
        {
          code: 'BAD CODE!',
          kind: 'GRAMMAR',
          title: 'Bad',
          description: 'Desc',
          estimatedMinutes: 5,
          content: { steps: [], questions: [] },
        },
      ],
    });
    expect(badLessonRes.isValid).toBe(false);
    expect(badLessonRes.errors.length).toBeGreaterThanOrEqual(2);

    prisma.curatedTopic.findMany.mockResolvedValue([]);
    const unsafeUrlRes = await service.validateBundle({
      topics: [
        {
          slug: 'safe-slug',
          titleEn: 'Title',
          titleVi: 'Tiêu đề',
          words: [
            {
              word: 'apple',
              meaningVi: 'Quả táo',
              imageUrl: 'javascript:alert(1)',
            },
          ],
        },
      ],
    });
    expect(unsafeUrlRes.isValid).toBe(false);
    expect(unsafeUrlRes.errors[0]?.path).toBe('topics[0].words[0].imageUrl');
  });

  it('validateBundle nhận diện mảng items rời rạc giống demo-content', async () => {
    prisma.learningUnit.findMany.mockResolvedValue([]);
    prisma.assessmentItem.findMany.mockResolvedValue([
      { externalId: 'demo-reading-a1-01' },
    ]);

    const res = await service.validateBundle([
      {
        externalId: 'demo-reading-a1-01',
        skill: 'READING',
        cefrLevel: 'A1',
        prompt: 'Who uses the big bedroom?',
        passage: 'Anna and her sister share the home.',
        options: ['Anna', "Anna's sister", 'Sam', "Anna's mother"],
        correctOption: "Anna's sister",
      },
      {
        externalId: 'demo-reading-a1-new',
        skill: 'READING',
        cefrLevel: 'A1',
        prompt: 'Where is the cafe?',
        passage: 'The cafe is in the park.',
        options: ['Park', 'Station', 'School', 'Bank'],
        correctOption: 'Park',
      },
    ]);

    expect(res.isValid).toBe(true);
    expect(res.preview.counts.items).toEqual({ create: 1, update: 1 });
    expect(res.preview.records[0]?.operation).toBe('UPDATE');
    expect(res.preview.records[1]?.operation).toBe('CREATE');
  });

  it('applyBundle thực thi trong transaction và xoá cache liên quan', async () => {
    prisma.learningUnit.findMany.mockResolvedValue([]);
    prisma.learningLesson.findMany.mockResolvedValue([]);
    prisma.assessmentItem.findMany.mockResolvedValue([]);
    prisma.curatedTopic.findMany.mockResolvedValue([]);

    tx.learningUnit.upsert.mockResolvedValue({
      id: 'unit-uuid',
      code: 'a1-unit-99',
    });
    tx.learningLesson.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
    tx.curatedTopic.upsert.mockResolvedValue({ id: 'topic-uuid' });

    const validLessonContent = {
      steps: [{ id: 's-1', title: 'Intro', body: 'Body' }],
      questions: [1, 2, 3].map((i) => ({
        id: `q-${i}`,
        type: 'MULTIPLE_CHOICE',
        prompt: `Question ${i}?`,
        options: [
          { id: 'A', text: 'A1' },
          { id: 'B', text: 'B1' },
          { id: 'C', text: 'C1' },
          { id: 'D', text: 'D1' },
        ],
        correctOptionId: 'A',
        explanation: 'Giải thích',
      })),
    };

    const result = await service.applyBundle({
      units: [
        {
          code: 'a1-unit-99',
          cefrLevel: 'A1',
          orderIndex: 99,
          title: 'Office Unit',
          description: 'Desc',
        },
      ],
      lessons: [
        {
          code: 'grammar-office-01',
          kind: 'GRAMMAR',
          title: 'Office To Be',
          description: 'Desc',
          estimatedMinutes: 5,
          unitCode: 'a1-unit-99',
          content: validLessonContent,
        },
      ],
      items: [
        {
          externalId: 'cms-item-1',
          skill: 'READING',
          cefrLevel: 'A1',
          skillCode: 'reading.scanning',
          prompt: 'Prompt question?',
          passage: 'A short reading passage.',
          options: ['Yes', 'No', 'Maybe', 'Never'],
          correctOption: 'Yes',
        },
      ],
      topics: [
        {
          slug: 'office-basics',
          titleEn: 'Office Basics',
          titleVi: 'Công sở cơ bản',
          words: [{ word: 'desk', meaningVi: 'Bàn làm việc' }],
        },
      ],
    });

    expect(result.preview.totalRecords).toBe(4);
    expect(tx.learningUnit.upsert).toHaveBeenCalledTimes(1);
    expect(tx.learningLesson.upsert).toHaveBeenCalledTimes(1);
    expect(tx.assessmentItem.upsert).toHaveBeenCalledTimes(1);
    expect(tx.curatedTopic.upsert).toHaveBeenCalledTimes(1);
    expect(tx.curatedTopicWord.createMany).toHaveBeenCalledTimes(1);
    expect(matrixService.invalidateCache).toHaveBeenCalledTimes(1);
    expect(curatedVocabularyService.invalidateTopicsCache).toHaveBeenCalledTimes(1);
  });
});
