import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RegisterUseCase } from './register.use-case';
import { UserRepository, UserWithProfile } from '../repositories/user.repository';
import { PasswordService } from '../../security/password.service';
import { TokenService } from '../../security/token.service';
import { CefrLevel, UserRole, UserStatus } from '@prisma/client';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let passwordService: jest.Mocked<PasswordService>;
  let tokenService: jest.Mocked<TokenService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockUserRepository = {
      findByEmail: jest.fn(),
      createLearnerWithProfileAndSession: jest.fn(),
    };

    const mockPasswordService = {
      hash: jest.fn(),
    };

    const mockTokenService = {
      generateRawRefreshToken: jest.fn(),
      hashToken: jest.fn(),
      calculateRefreshTokenExpiry: jest.fn(),
      generateAccessToken: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterUseCase,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    useCase = module.get<RegisterUseCase>(RegisterUseCase);
    userRepository = module.get(UserRepository);
    passwordService = module.get(PasswordService);
    tokenService = module.get(TokenService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should register a new user successfully and emit event', async () => {
    const dto = {
      email: 'newuser@lingoroad.com',
      password: 'Password123!',
      name: 'Nguyen Van A',
    };

    userRepository.findByEmail.mockResolvedValue(null);
    passwordService.hash.mockResolvedValue('hashed_pw_123');
    tokenService.generateRawRefreshToken.mockReturnValue('raw_refresh_token_32_bytes');
    tokenService.hashToken.mockReturnValue('sha256_hash_value');
    tokenService.calculateRefreshTokenExpiry.mockReturnValue(new Date('2026-11-08T00:00:00Z'));

    const mockCreatedUser: UserWithProfile = {
      id: 'uuid-user-1',
      email: dto.email,
      passwordHash: 'hashed_pw_123',
      name: dto.name,
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-10-08T00:00:00Z'),
      updatedAt: new Date('2026-10-08T00:00:00Z'),
      profile: {
        learningPurpose: null,
        selfAssessedCefr: null,
        onboardingCompletedAt: null,
        id: 'uuid-profile-1',
        userId: 'uuid-user-1',
        targetCefr: CefrLevel.B1,
        dailyGoalMinutes: 15,
        reminderEnabled: true,
        updatedAt: new Date('2026-10-08T00:00:00Z'),
      },
    };

    userRepository.createLearnerWithProfileAndSession.mockResolvedValue(mockCreatedUser);
    tokenService.generateAccessToken.mockResolvedValue('jwt_access_token_xyz');

    const result = await useCase.execute(dto, { ipAddress: '127.0.0.1' });

    expect(result.accessToken).toBe('jwt_access_token_xyz');
    expect(result.refreshToken).toBe('raw_refresh_token_32_bytes');
    expect(result.user.email).toBe(dto.email);
    expect(result.user.role).toBe(UserRole.LEARNER);
    expect(result.user.profile?.targetCefr).toBe(CefrLevel.B1);
    expect(eventEmitter.emit).toHaveBeenCalledWith('user.registered', expect.anything());
  });

  it('should throw ConflictException if email already exists', async () => {
    const dto = {
      email: 'existing@lingoroad.com',
      password: 'Password123!',
      name: 'Nguyen Van B',
    };

    userRepository.findByEmail.mockResolvedValue({
      id: 'existing-id',
      email: dto.email,
      passwordHash: 'hash',
      name: 'Existing',
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: null,
    });

    await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
    expect(userRepository.createLearnerWithProfileAndSession).not.toHaveBeenCalled();
  });
});
