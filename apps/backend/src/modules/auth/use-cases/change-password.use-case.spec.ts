import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChangePasswordUseCase } from './change-password.use-case';
import { UserRepository, UserWithProfile } from '../repositories/user.repository';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository';
import { PasswordService } from '../../security/password.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

describe('ChangePasswordUseCase', () => {
  let useCase: ChangePasswordUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let refreshSessionRepository: jest.Mocked<RefreshSessionRepository>;
  let passwordService: jest.Mocked<PasswordService>;
  let prismaService: { $transaction: jest.Mock };
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockUserRepository = {
      findById: jest.fn(),
      updatePassword: jest.fn(),
    };

    const mockRefreshSessionRepository = {
      revokeAllUserSessions: jest.fn(),
    };

    const mockPasswordService = {
      verify: jest.fn(),
      hash: jest.fn(),
    };

    const mockPrismaService: { $transaction: jest.Mock } = {
      $transaction: jest.fn(),
    };
    mockPrismaService.$transaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) =>
      callback(mockPrismaService),
    );

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangePasswordUseCase,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: RefreshSessionRepository, useValue: mockRefreshSessionRepository },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    useCase = module.get<ChangePasswordUseCase>(ChangePasswordUseCase);
    userRepository = module.get(UserRepository);
    refreshSessionRepository = module.get(RefreshSessionRepository);
    passwordService = module.get(PasswordService);
    prismaService = module.get(PrismaService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should change password successfully, revoke all sessions and emit event', async () => {
    const userId = 'user-uuid-1';
    const dto = {
      oldPassword: 'OldPassword123!',
      newPassword: 'NewPassword456!',
    };

    const mockUser: UserWithProfile = {
      id: userId,
      email: 'user@lingoroad.com',
      passwordHash: 'old_hashed_pw',
      name: 'User One',
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: null,
    };

    userRepository.findById.mockResolvedValue(mockUser);
    passwordService.verify.mockResolvedValue(true);
    passwordService.hash.mockResolvedValue('new_hashed_pw');

    await useCase.execute(userId, dto);

    expect(passwordService.hash).toHaveBeenCalledWith(dto.newPassword);
    expect(prismaService.$transaction).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith('user.password_changed', expect.anything());
  });

  it('should throw BadRequestException when old password does not match', async () => {
    const userId = 'user-uuid-1';
    const dto = {
      oldPassword: 'WrongOldPassword!',
      newPassword: 'NewPassword456!',
    };

    const mockUser: UserWithProfile = {
      id: userId,
      email: 'user@lingoroad.com',
      passwordHash: 'old_hashed_pw',
      name: 'User One',
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: null,
    };

    userRepository.findById.mockResolvedValue(mockUser);
    passwordService.verify.mockResolvedValue(false);

    await expect(useCase.execute(userId, dto)).rejects.toThrow(BadRequestException);
    expect(passwordService.hash).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException when new password equals old password', async () => {
    const userId = 'user-uuid-1';
    const dto = {
      oldPassword: 'SamePassword123!',
      newPassword: 'SamePassword123!',
    };

    const mockUser: UserWithProfile = {
      id: userId,
      email: 'user@lingoroad.com',
      passwordHash: 'old_hashed_pw',
      name: 'User One',
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: null,
    };

    userRepository.findById.mockResolvedValue(mockUser);
    passwordService.verify.mockResolvedValue(true);

    await expect(useCase.execute(userId, dto)).rejects.toThrow(BadRequestException);
  });
});
