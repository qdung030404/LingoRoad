import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GoogleLoginUseCase } from './google-login.use-case';
import { UserRepository, UserWithProfile } from '../repositories/user.repository';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository';
import { FirebaseAdminService } from '../../security/firebase-admin.service';
import { TokenService } from '../../security/token.service';
import { CefrLevel, Prisma, UserRole, UserStatus } from '@prisma/client';

describe('GoogleLoginUseCase', () => {
  let useCase: GoogleLoginUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let refreshSessionRepository: jest.Mocked<RefreshSessionRepository>;
  let firebaseAdminService: jest.Mocked<FirebaseAdminService>;
  let tokenService: jest.Mocked<TokenService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockActiveUser: UserWithProfile = {
    id: 'user-uuid-1',
    email: 'google.user@example.com',
    passwordHash: null,
    name: 'Google User',
    avatarUrl: 'https://lh3.googleusercontent.com/avatar',
    provider: 'GOOGLE',
    firebaseUid: 'firebase-uid-123',
    role: UserRole.LEARNER,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: {
      id: 'profile-uuid-1',
      userId: 'user-uuid-1',
      targetCefr: CefrLevel.B1,
      dailyGoalMinutes: 10,
      learningPurpose: null,
      selfAssessedCefr: null,
      onboardingCompletedAt: null,
      reminderEnabled: true,
      updatedAt: new Date(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleLoginUseCase,
        {
          provide: UserRepository,
          useValue: {
            findByFirebaseUid: jest.fn(),
            findByEmail: jest.fn(),
            createGoogleLearnerWithProfileAndSession: jest.fn(),
            linkFirebaseUid: jest.fn(),
          },
        },
        {
          provide: RefreshSessionRepository,
          useValue: {
            createSession: jest.fn(),
          },
        },
        {
          provide: FirebaseAdminService,
          useValue: {
            verifyIdToken: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            generateRawRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
            hashToken: jest.fn().mockReturnValue('mock-token-hash'),
            calculateRefreshTokenExpiry: jest.fn().mockReturnValue(new Date('2026-12-01T00:00:00Z')),
            generateAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GoogleLoginUseCase>(GoogleLoginUseCase);
    userRepository = module.get(UserRepository);
    refreshSessionRepository = module.get(RefreshSessionRepository);
    firebaseAdminService = module.get(FirebaseAdminService);
    tokenService = module.get(TokenService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('nên throw UnauthorizedException khi ID token không hợp lệ', async () => {
    firebaseAdminService.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

    await expect(
      useCase.execute({ idToken: 'invalid-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('nên throw BadRequestException khi token không có email', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-123',
    });

    await expect(
      useCase.execute({ idToken: 'token-without-email' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('nên throw BadRequestException khi email chưa được xác thực (email_verified: false)', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-123',
      email: 'unverified@example.com',
      email_verified: false,
    });

    await expect(
      useCase.execute({ idToken: 'unverified-token' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('nên tự động tạo User mới khi chưa từng tồn tại (Auto-provisioning)', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'new-firebase-uid',
      email: 'new.learner@example.com',
      name: 'New Learner',
      picture: 'https://example.com/avatar.jpg',
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.createGoogleLearnerWithProfileAndSession.mockResolvedValue({
      ...mockActiveUser,
      id: 'new-user-uuid',
      email: 'new.learner@example.com',
      firebaseUid: 'new-firebase-uid',
    });

    const result = await useCase.execute(
      { idToken: 'valid-new-token' },
      { ipAddress: '127.0.0.1', deviceIdentifier: 'device-123' },
    );

    expect(userRepository.createGoogleLearnerWithProfileAndSession).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.learner@example.com',
        name: 'New Learner',
        firebaseUid: 'new-firebase-uid',
        avatarUrl: 'https://example.com/avatar.jpg',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith('user.registered', expect.anything());
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');
    expect(result.user.email).toBe('new.learner@example.com');
  });

  it('nên tự động liên kết tài khoản khi email đã tồn tại nhưng chưa có firebaseUid (Account Linking)', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-link',
      email: 'google.user@example.com',
      picture: 'https://example.com/new-avatar.jpg',
      email_verified: true,
    });

    const existingLocalUser: UserWithProfile = {
      ...mockActiveUser,
      firebaseUid: null,
      provider: 'LOCAL',
    };

    userRepository.findByFirebaseUid.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(existingLocalUser);
    userRepository.linkFirebaseUid.mockResolvedValue({
      ...existingLocalUser,
      firebaseUid: 'firebase-uid-link',
    });

    const result = await useCase.execute(
      { idToken: 'valid-linking-token' },
      { ipAddress: '127.0.0.1', deviceIdentifier: 'device-123' },
    );

    expect(userRepository.linkFirebaseUid).toHaveBeenCalledWith('user-uuid-1', {
      firebaseUid: 'firebase-uid-link',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar',
    });
    expect(refreshSessionRepository.createSession).toHaveBeenCalled();
    expect(result.accessToken).toBe('mock-access-token');
  });

  it('nên đăng nhập thành công cho người dùng Google đã tồn tại', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-123',
      email: 'google.user@example.com',
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValue(mockActiveUser);

    const result = await useCase.execute(
      { idToken: 'valid-existing-token' },
      { ipAddress: '127.0.0.1', deviceIdentifier: 'device-123' },
    );

    expect(refreshSessionRepository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid-1',
        tokenHash: 'mock-token-hash',
        ipAddress: '127.0.0.1',
        deviceIdentifier: 'device-123',
      }),
    );
    expect(result.user.id).toBe('user-uuid-1');
  });

  it('nên throw ForbiddenException khi tài khoản Google bị SUSPENDED', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-123',
      email: 'google.user@example.com',
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValue({
      ...mockActiveUser,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      useCase.execute({ idToken: 'valid-token-suspended-user' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('nên throw ForbiddenException và không link khi tài khoản email tồn tại nhưng bị SUSPENDED', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-new',
      email: 'google.user@example.com',
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue({
      ...mockActiveUser,
      status: UserStatus.SUSPENDED,
    });

    await expect(
      useCase.execute({ idToken: 'valid-token-suspended-user' }),
    ).rejects.toThrow(ForbiddenException);
    expect(userRepository.linkFirebaseUid).not.toHaveBeenCalled();
  });

  it('nên throw ForbiddenException khi tài khoản tồn tại là ADMIN', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-new',
      email: 'admin@example.com',
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue({
      ...mockActiveUser,
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    });

    await expect(
      useCase.execute({ idToken: 'valid-token-admin' }),
    ).rejects.toThrow(ForbiddenException);
    expect(userRepository.linkFirebaseUid).not.toHaveBeenCalled();
  });

  it('nên throw ConflictException khi tài khoản đã liên kết với Google UID khác', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-attacker',
      email: 'google.user@example.com',
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue({
      ...mockActiveUser,
      firebaseUid: 'firebase-uid-original',
    });

    await expect(
      useCase.execute({ idToken: 'valid-token-conflict' }),
    ).rejects.toThrow(ConflictException);
    expect(userRepository.linkFirebaseUid).not.toHaveBeenCalled();
  });

  it('nên rethrow ServiceUnavailableException khi Firebase SDK chưa được cấu hình', async () => {
    firebaseAdminService.verifyIdToken.mockRejectedValue(
      new ServiceUnavailableException('Firebase not configured'),
    );

    await expect(
      useCase.execute({ idToken: 'any-token' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('nên throw BadRequestException khi token có email_verified là undefined', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-123',
      email: 'unverified@example.com',
    });

    await expect(
      useCase.execute({ idToken: 'token-missing-verified' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('nên xử lý an toàn và fallback khi gặp lỗi P2002 do race condition', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'concurrent-uid',
      email: 'concurrent@example.com',
      name: 'Concurrent User',
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValueOnce(null);
    userRepository.findByEmail.mockResolvedValueOnce(null);

    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      { code: 'P2002', clientVersion: '5.11.0' },
    );
    userRepository.createGoogleLearnerWithProfileAndSession.mockRejectedValueOnce(prismaError);

    // After P2002, findByEmail will find the newly created user
    const createdUser: UserWithProfile = {
      ...mockActiveUser,
      id: 'concurrent-user-id',
      email: 'concurrent@example.com',
      firebaseUid: 'concurrent-uid',
    };
    userRepository.findByEmail.mockResolvedValueOnce(createdUser);

    const result = await useCase.execute({ idToken: 'concurrent-token' });

    expect(result.user.email).toBe('concurrent@example.com');
    expect(result.user.provider).toBe('GOOGLE');
    expect(refreshSessionRepository.createSession).toHaveBeenCalled();
  });

  it('nên throw ConflictException khi gặp lỗi P2002 nhưng user đã tồn tại với Firebase UID khác', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'incoming-uid',
      email: 'conflict@example.com',
      name: 'Conflict User',
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValueOnce(null);
    userRepository.findByEmail.mockResolvedValueOnce(null);

    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      { code: 'P2002', clientVersion: '5.11.0' },
    );
    userRepository.createGoogleLearnerWithProfileAndSession.mockRejectedValueOnce(prismaError);

    const conflictingUser: UserWithProfile = {
      ...mockActiveUser,
      id: 'existing-conflict-id',
      email: 'conflict@example.com',
      firebaseUid: 'different-uid',
    };
    userRepository.findByEmail.mockResolvedValueOnce(conflictingUser);

    await expect(
      useCase.execute({ idToken: 'conflict-token' }),
    ).rejects.toThrow(ConflictException);
    expect(userRepository.linkFirebaseUid).not.toHaveBeenCalled();
  });

  it('nên throw ForbiddenException khi gặp lỗi P2002 nhưng user đã tồn tại bị SUSPENDED', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'suspended-concurrent-uid',
      email: 'suspended@example.com',
      name: 'Suspended User',
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValueOnce(null);
    userRepository.findByEmail.mockResolvedValueOnce(null);

    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      { code: 'P2002', clientVersion: '5.11.0' },
    );
    userRepository.createGoogleLearnerWithProfileAndSession.mockRejectedValueOnce(prismaError);

    const suspendedUser: UserWithProfile = {
      ...mockActiveUser,
      id: 'suspended-user-id',
      email: 'suspended@example.com',
      status: UserStatus.SUSPENDED,
      firebaseUid: 'suspended-concurrent-uid',
    };
    userRepository.findByEmail.mockResolvedValueOnce(suspendedUser);

    await expect(
      useCase.execute({ idToken: 'suspended-token' }),
    ).rejects.toThrow(ForbiddenException);
    expect(refreshSessionRepository.createSession).not.toHaveBeenCalled();
  });

  it('nên cắt tỉa (truncate) an toàn name và avatarUrl khi vượt quá giới hạn CSDL', async () => {
    const longName = 'A'.repeat(150);
    const longUrl = `https://example.com/avatar?param=${'x'.repeat(600)}`;

    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'truncate-uid',
      email: 'truncate@example.com',
      name: longName,
      picture: longUrl,
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.createGoogleLearnerWithProfileAndSession.mockResolvedValue({
      ...mockActiveUser,
      id: 'truncated-user-id',
      email: 'truncate@example.com',
      name: longName.slice(0, 100),
      avatarUrl: longUrl.slice(0, 500),
    });

    await useCase.execute({ idToken: 'truncate-token' });

    expect(userRepository.createGoogleLearnerWithProfileAndSession).toHaveBeenCalledWith(
      expect.objectContaining({
        name: longName.slice(0, 100),
        avatarUrl: longUrl.slice(0, 500),
      }),
    );
  });

  it('nên cắt tỉa khoảng trắng của name và bỏ qua avatarUrl nếu không phải https', async () => {
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'trim-uid',
      email: 'trim@example.com',
      name: '   John Doe   ',
      picture: 'http://insecure.example.com/avatar.jpg',
      email_verified: true,
    });

    userRepository.findByFirebaseUid.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.createGoogleLearnerWithProfileAndSession.mockResolvedValue({
      ...mockActiveUser,
      id: 'trimmed-user-id',
      email: 'trim@example.com',
      name: 'John Doe',
      avatarUrl: null,
    });

    await useCase.execute({ idToken: 'trim-token' });

    expect(userRepository.createGoogleLearnerWithProfileAndSession).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John Doe',
        avatarUrl: null,
      }),
    );
  });
});
