import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { LoginUseCase } from './login.use-case';
import { UserRepository, UserWithProfile } from '../repositories/user.repository';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository';
import { PasswordService } from '../../security/password.service';
import { TokenService } from '../../security/token.service';
import { CefrLevel, UserRole, UserStatus } from '@prisma/client';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let refreshSessionRepository: jest.Mocked<RefreshSessionRepository>;
  let passwordService: jest.Mocked<PasswordService>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    const mockUserRepository = {
      findByEmail: jest.fn(),
    };

    const mockRefreshSessionRepository = {
      createSession: jest.fn(),
    };

    const mockPasswordService = {
      verify: jest.fn(),
      dummyVerify: jest.fn(),
    };

    const mockTokenService = {
      generateRawRefreshToken: jest.fn(),
      hashToken: jest.fn(),
      calculateRefreshTokenExpiry: jest.fn(),
      generateAccessToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: RefreshSessionRepository, useValue: mockRefreshSessionRepository },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    useCase = module.get<LoginUseCase>(LoginUseCase);
    userRepository = module.get(UserRepository);
    refreshSessionRepository = module.get(RefreshSessionRepository);
    passwordService = module.get(PasswordService);
    tokenService = module.get(TokenService);
  });

  it('should login successfully with correct credentials', async () => {
    const dto = {
      email: 'user@lingoroad.com',
      password: 'CorrectPassword123!',
    };

    const mockUser: UserWithProfile = {
      id: 'uuid-user-1',
      email: dto.email,
      passwordHash: 'hashed_pw',
      name: 'User One',
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: {
        learningPurpose: null,
        selfAssessedCefr: null,
        onboardingCompletedAt: null,
        id: 'uuid-profile-1',
        userId: 'uuid-user-1',
        targetCefr: CefrLevel.B1,
        dailyGoalMinutes: 15,
        reminderEnabled: true,
        updatedAt: new Date(),
      },
    };

    userRepository.findByEmail.mockResolvedValue(mockUser);
    passwordService.verify.mockResolvedValue(true);
    tokenService.generateRawRefreshToken.mockReturnValue('refresh_token_hex');
    tokenService.hashToken.mockReturnValue('token_hash');
    tokenService.calculateRefreshTokenExpiry.mockReturnValue(new Date());
    tokenService.generateAccessToken.mockResolvedValue('jwt_access_token');

    const result = await useCase.execute(dto);

    expect(result.accessToken).toBe('jwt_access_token');
    expect(result.refreshToken).toBe('refresh_token_hex');
    expect(result.user.email).toBe(dto.email);
    expect(refreshSessionRepository.createSession).toHaveBeenCalled();
  });

  it('should perform dummy verify and throw UnauthorizedException when user does not exist', async () => {
    const dto = {
      email: 'nonexistent@lingoroad.com',
      password: 'SomePassword123!',
    };

    userRepository.findByEmail.mockResolvedValue(null);

    await expect(useCase.execute(dto)).rejects.toThrow(UnauthorizedException);
    expect(passwordService.dummyVerify).toHaveBeenCalledWith(dto.password);
  });

  it('should throw UnauthorizedException when password is incorrect', async () => {
    const dto = {
      email: 'user@lingoroad.com',
      password: 'WrongPassword123!',
    };

    const mockUser: UserWithProfile = {
      id: 'uuid-user-1',
      email: dto.email,
      passwordHash: 'hashed_pw',
      name: 'User One',
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: null,
    };

    userRepository.findByEmail.mockResolvedValue(mockUser);
    passwordService.verify.mockResolvedValue(false);

    await expect(useCase.execute(dto)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException when user status is SUSPENDED', async () => {
    const dto = {
      email: 'suspended@lingoroad.com',
      password: 'Password123!',
    };

    const mockUser: UserWithProfile = {
      id: 'uuid-user-1',
      email: dto.email,
      passwordHash: 'hashed_pw',
      name: 'Suspended User',
      role: UserRole.LEARNER,
      status: UserStatus.SUSPENDED,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: null,
    };

    userRepository.findByEmail.mockResolvedValue(mockUser);
    passwordService.verify.mockResolvedValue(true);

    await expect(useCase.execute(dto)).rejects.toThrow(ForbiddenException);
  });
});
