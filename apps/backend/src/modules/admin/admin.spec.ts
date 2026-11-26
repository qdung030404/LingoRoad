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

describe('AdminJwtGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(() => false),
  } as unknown as Reflector;
  const jwtService = { verifyAsync: jest.fn() };
  const prisma = { user: { findUnique: jest.fn() } };
  const firebase = { enabled: true, verify: jest.fn() };
  const firebaseUsers = { resolve: jest.fn() };

  const guard = new AdminJwtGuard(
    reflector,
    jwtService as unknown as JwtService,
    prisma as unknown as PrismaService,
    firebase as unknown as FirebaseTokenService,
    firebaseUsers as unknown as FirebaseUserService,
  );

  const ctx = (headers: Record<string, string | undefined>) =>
    ({
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({
        getRequest: () => ({ headers, user: undefined }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
  });

  it('từ chối request không có Bearer token hoặc token > 4096 ký tự', async () => {
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      guard.canActivate(ctx({ authorization: `Bearer ${'x'.repeat(4097)}` })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('cho phép Admin JWT hợp lệ khi DB ACTIVE và role ADMIN', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'admin-1',
      email: 'admin@lingoroad.local',
      role: UserRole.ADMIN,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@lingoroad.local',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      firebaseUid: null,
    });

    const req = { headers: { authorization: 'Bearer valid-jwt' }, user: undefined };
    const localCtx = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(localCtx)).resolves.toBe(true);
    expect(req.user).toEqual({
      sub: 'admin-1',
      email: 'admin@lingoroad.local',
      role: UserRole.ADMIN,
    });
  });

  it('chặn 403 nếu tài khoản bị SUSPENDED hoặc có vai trò LEARNER', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'u-1',
      email: 'u@example.com',
      role: UserRole.ADMIN,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-1',
      email: 'u@example.com',
      role: UserRole.ADMIN,
      status: UserStatus.SUSPENDED,
      firebaseUid: null,
    });
    await expect(
      guard.canActivate(ctx({ authorization: 'Bearer jwt-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-2',
      email: 'learner@example.com',
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      firebaseUid: null,
    });
    await expect(
      guard.canActivate(ctx({ authorization: 'Bearer jwt-2' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fallback sang Firebase token khi JWT nội bộ không khớp', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    firebase.verify.mockResolvedValue({ uid: 'fb-admin' });
    firebaseUsers.resolve.mockResolvedValue({
      sub: 'admin-fb-id',
      email: 'admin@lingoroad.local',
      role: UserRole.ADMIN,
      firebaseUid: 'fb-admin',
    });

    const req = {
      headers: { authorization: 'Bearer firebase-id-token' },
      user: undefined,
    };
    const localCtx = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(localCtx)).resolves.toBe(true);
    expect(req.user).toEqual({
      sub: 'admin-fb-id',
      email: 'admin@lingoroad.local',
      role: UserRole.ADMIN,
      firebaseUid: 'fb-admin',
    });
  });
});

describe('AdminAuthService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    refreshSession: { create: jest.fn() },
  };
  const passwordService = {
    verify: jest.fn(),
    dummyVerify: jest.fn(),
  };
  const tokenService = {
    generateTokenPair: jest.fn(),
  };

  const service = new AdminAuthService(
    prisma as unknown as PrismaService,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('đăng nhập Admin thành công và tạo refresh session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@lingoroad.local',
      name: 'Admin',
      passwordHash: 'hash',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      avatarUrl: null,
    });
    passwordService.verify.mockResolvedValue(true);
    tokenService.generateTokenPair.mockResolvedValue({
      accessToken: 'acc',
      refreshToken: 'ref',
      tokenHash: 'hash-ref',
      expiresAt: new Date(Date.now() + 3600_000),
    });
    prisma.refreshSession.create.mockResolvedValue({});

    const res = await service.login({
      email: 'Admin@lingoroad.local',
      password: 'Password123!',
    });

    expect(res.accessToken).toBe('acc');
    expect(res.user.role).toBe(UserRole.ADMIN);
    expect(prisma.refreshSession.create).toHaveBeenCalledTimes(1);
  });

  it('từ chối LEARNER hoặc tài khoản SUSPENDED với ForbiddenException (403)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'learner-1',
      email: 'learner@lingoroad.local',
      passwordHash: 'hash',
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
    });
    passwordService.verify.mockResolvedValue(true);

    await expect(
      service.login({
        email: 'learner@lingoroad.local',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'admin-2',
      email: 'locked@lingoroad.local',
      passwordHash: 'hash',
      role: UserRole.ADMIN,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      service.login({
        email: 'locked@lingoroad.local',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AdminUsersService', () => {
  const tx = {
    user: { update: jest.fn(), create: jest.fn() },
    refreshSession: { updateMany: jest.fn() },
  };
  const prisma = {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) =>
      cb(tx),
    ),
  };
  const passwordService = { hash: jest.fn(async (p: string) => `h:${p}`) };
  const firebase = { enabled: true, revoke: jest.fn(async () => undefined) };

  const service = new AdminUsersService(
    prisma as unknown as PrismaService,
    passwordService as unknown as PasswordService,
    firebase as unknown as FirebaseTokenService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('trả về danh sách users kèm summary Legacy', async () => {
    prisma.user.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(17)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(10);
    prisma.user.findMany.mockResolvedValue([]);

    const result = await service.listUsers({ page: 1, limit: 10 });
    expect(result.summary).toEqual({
      total: 20,
      activeLearners30d: 10,
      learners: 17,
      admins: 3,
    });
  });

  it('chặn tự hạ quyền, tự khóa và tự xoá chính mình', async () => {
    await expect(
      service.updateUser('admin-1', 'admin-1', { role: UserRole.LEARNER }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.updateUser('admin-1', 'admin-1', { status: UserStatus.SUSPENDED }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.deleteUser('admin-1', 'admin-1', true),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('khóa user đồng thời thu hồi RefreshSession và Firebase session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      firebaseUid: 'fb-u-1',
    });
    tx.user.update.mockResolvedValue({
      id: 'u-1',
      email: 'u1@example.com',
      name: 'User One',
      avatarUrl: null,
      provider: AuthProvider.LOCAL,
      role: UserRole.LEARNER,
      status: UserStatus.SUSPENDED,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: { targetCefr: CefrLevel.B1, dailyGoalMinutes: 10 },
      _count: {
        learningAttempts: 1,
        placementSessions: 0,
        vocabularyDecks: 0,
        speakingSubmissions: 0,
      },
    });

    const updated = await service.updateUser('admin-1', 'u-1', {
      status: UserStatus.SUSPENDED,
    });

    expect(updated.status).toBe(UserStatus.SUSPENDED);
    expect(tx.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', isRevoked: false },
      data: { isRevoked: true },
    });
    expect(firebase.revoke).toHaveBeenCalledWith('fb-u-1');

    tx.refreshSession.updateMany.mockClear();
    tx.user.update.mockResolvedValueOnce({
      id: 'u-1',
      email: 'u1@example.com',
      name: 'User One',
      avatarUrl: null,
      provider: AuthProvider.LOCAL,
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: { targetCefr: CefrLevel.B1, dailyGoalMinutes: 10 },
      _count: {
        learningAttempts: 1,
        placementSessions: 0,
        vocabularyDecks: 0,
        speakingSubmissions: 0,
      },
    });
    await service.updateUser('admin-1', 'u-1', { role: UserRole.LEARNER });
    expect(tx.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', isRevoked: false },
      data: { isRevoked: true },
    });
  });

  it('hỗ trợ xoá mềm và xoá cứng user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      firebaseUid: null,
    });

    const soft = await service.deleteUser('admin-1', 'u-1', false);
    expect(soft.action).toBe('SOFT_DELETED');
    expect(tx.user.update).toHaveBeenCalled();

    const hard = await service.deleteUser('admin-1', 'u-1', true);
    expect(hard.action).toBe('HARD_DELETED');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u-1' } });
  });
});

describe('AdminContentService', () => {
  const tx = {
    learningAttempt: { deleteMany: jest.fn() },
    learningLesson: { delete: jest.fn() },
    placementSession: { updateMany: jest.fn() },
    assessmentResponse: { deleteMany: jest.fn() },
    assessmentItem: { delete: jest.fn() },
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
      update: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
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
      passage: null,
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
    learningUnit: { upsert: jest.fn(), findMany: jest.fn() },
    learningLesson: { aggregate: jest.fn(), upsert: jest.fn() },
    assessmentItem: { upsert: jest.fn(), create: jest.fn() },
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
        options: ['Anna', "Anna's sister", 'Sam', "Anna's mother"],
        correctOption: "Anna's sister",
      },
      {
        externalId: 'demo-reading-a1-new',
        skill: 'READING',
        cefrLevel: 'A1',
        prompt: 'Where is the cafe?',
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
