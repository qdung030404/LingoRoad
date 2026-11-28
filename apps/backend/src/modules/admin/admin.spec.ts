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
