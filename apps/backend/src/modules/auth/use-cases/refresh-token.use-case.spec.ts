import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import {
  RefreshSessionRepository,
  RefreshSessionWithUser,
} from '../repositories/refresh-session.repository';
import { TokenService } from '../../security/token.service';
import { UserRole, UserStatus } from '@prisma/client';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let refreshSessionRepository: jest.Mocked<RefreshSessionRepository>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    const mockRefreshSessionRepository = {
      findByTokenHash: jest.fn(),
      revokeAllUserSessions: jest.fn(),
      rotateSession: jest.fn(),
    };

    const mockTokenService = {
      hashToken: jest.fn(),
      generateRawRefreshToken: jest.fn(),
      calculateRefreshTokenExpiry: jest.fn(),
      generateAccessToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenUseCase,
        { provide: RefreshSessionRepository, useValue: mockRefreshSessionRepository },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    useCase = module.get<RefreshTokenUseCase>(RefreshTokenUseCase);
    refreshSessionRepository = module.get(RefreshSessionRepository);
    tokenService = module.get(TokenService);
  });

  it('should rotate tokens successfully when refresh token is valid', async () => {
    const dto = { refreshToken: 'valid_refresh_token_string' };
    const futureExpiry = new Date();
    futureExpiry.setDate(futureExpiry.getDate() + 10);

    const mockSession: RefreshSessionWithUser = {
      id: 'session-uuid-1',
      userId: 'user-uuid-1',
      tokenHash: 'sha256_hash_1',
      deviceIdentifier: 'device-1',
      ipAddress: '127.0.0.1',
      expiresAt: futureExpiry,
      isRevoked: false,
      createdAt: new Date(),
      user: {
        id: 'user-uuid-1',
        email: 'user@lingoroad.com',
        passwordHash: 'hash',
        name: 'User One',
        role: UserRole.LEARNER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    tokenService.hashToken.mockReturnValueOnce('sha256_hash_1').mockReturnValueOnce('sha256_hash_2');
    refreshSessionRepository.findByTokenHash.mockResolvedValue(mockSession);
    tokenService.generateRawRefreshToken.mockReturnValue('new_raw_refresh_token');
    tokenService.calculateRefreshTokenExpiry.mockReturnValue(futureExpiry);
    tokenService.generateAccessToken.mockResolvedValue('new_jwt_access_token');

    const result = await useCase.execute(dto);

    expect(result.accessToken).toBe('new_jwt_access_token');
    expect(result.refreshToken).toBe('new_raw_refresh_token');
    expect(refreshSessionRepository.rotateSession).toHaveBeenCalledWith('session-uuid-1', {
      userId: 'user-uuid-1',
      tokenHash: 'sha256_hash_2',
      deviceIdentifier: 'device-1',
      ipAddress: '127.0.0.1',
      expiresAt: futureExpiry,
    });
  });

  it('should detect Replay Attack when isRevoked is true and revoke ALL user sessions', async () => {
    const dto = { refreshToken: 'stolen_or_replayed_token' };
    const futureExpiry = new Date();
    futureExpiry.setDate(futureExpiry.getDate() + 10);

    const revokedSession: RefreshSessionWithUser = {
      id: 'session-uuid-1',
      userId: 'user-uuid-1',
      tokenHash: 'replayed_hash',
      deviceIdentifier: 'device-1',
      ipAddress: '127.0.0.1',
      expiresAt: futureExpiry,
      isRevoked: true, // Already revoked!
      createdAt: new Date(),
      user: {
        id: 'user-uuid-1',
        email: 'user@lingoroad.com',
        passwordHash: 'hash',
        name: 'User One',
        role: UserRole.LEARNER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    tokenService.hashToken.mockReturnValue('replayed_hash');
    refreshSessionRepository.findByTokenHash.mockResolvedValue(revokedSession);

    await expect(useCase.execute(dto)).rejects.toThrow(UnauthorizedException);
    expect(refreshSessionRepository.revokeAllUserSessions).toHaveBeenCalledWith('user-uuid-1');
  });

  it('should throw UnauthorizedException when session is expired', async () => {
    const dto = { refreshToken: 'expired_token' };
    const pastExpiry = new Date();
    pastExpiry.setDate(pastExpiry.getDate() - 5);

    const expiredSession: RefreshSessionWithUser = {
      id: 'session-uuid-1',
      userId: 'user-uuid-1',
      tokenHash: 'expired_hash',
      deviceIdentifier: 'device-1',
      ipAddress: '127.0.0.1',
      expiresAt: pastExpiry,
      isRevoked: false,
      createdAt: new Date(),
      user: {
        id: 'user-uuid-1',
        email: 'user@lingoroad.com',
        passwordHash: 'hash',
        name: 'User One',
        role: UserRole.LEARNER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    tokenService.hashToken.mockReturnValue('expired_hash');
    refreshSessionRepository.findByTokenHash.mockResolvedValue(expiredSession);

    await expect(useCase.execute(dto)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException if user is not ACTIVE', async () => {
    const dto = { refreshToken: 'valid_token' };
    const futureExpiry = new Date();
    futureExpiry.setDate(futureExpiry.getDate() + 10);

    const suspendedUserSession: RefreshSessionWithUser = {
      id: 'session-uuid-1',
      userId: 'user-uuid-1',
      tokenHash: 'valid_hash',
      deviceIdentifier: 'device-1',
      ipAddress: '127.0.0.1',
      expiresAt: futureExpiry,
      isRevoked: false,
      createdAt: new Date(),
      user: {
        id: 'user-uuid-1',
        email: 'user@lingoroad.com',
        passwordHash: 'hash',
        name: 'Suspended User',
        role: UserRole.LEARNER,
        status: UserStatus.SUSPENDED,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    tokenService.hashToken.mockReturnValue('valid_hash');
    refreshSessionRepository.findByTokenHash.mockResolvedValue(suspendedUserSession);

    await expect(useCase.execute(dto)).rejects.toThrow(ForbiddenException);
  });
});
