import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RegisterDto } from '../dto/register.dto';
import { UserRepository } from '../repositories/user.repository';
import { PasswordService } from '../../security/password.service';
import { TokenService } from '../../security/token.service';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { CefrLevel, UserRole, UserStatus } from '@prisma/client';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
    profile: {
      targetCefr: CefrLevel;
      dailyGoalMinutes: number;
      reminderEnabled: boolean;
    } | null;
  };
}

@Injectable()
export class RegisterUseCase {
  private readonly logger = new Logger(RegisterUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    dto: RegisterDto,
    context?: { ipAddress?: string; deviceIdentifier?: string },
  ): Promise<AuthResult> {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException({
        code: 'AUTH_EMAIL_ALREADY_EXISTS',
        message: 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.',
      });
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const rawRefreshToken = this.tokenService.generateRawRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const sessionExpiresAt = this.tokenService.calculateRefreshTokenExpiry();

    const userWithProfile = await this.userRepository.createLearnerWithProfileAndSession({
      email: dto.email,
      passwordHash,
      name: dto.name,
      tokenHash,
      sessionExpiresAt,
      deviceIdentifier: context?.deviceIdentifier,
      ipAddress: context?.ipAddress,
    });

    const accessToken = await this.tokenService.generateAccessToken({
      id: userWithProfile.id,
      email: userWithProfile.email,
      role: userWithProfile.role,
    });

    this.eventEmitter.emit(
      'user.registered',
      new UserRegisteredEvent(
        userWithProfile.id,
        userWithProfile.email,
        userWithProfile.role,
        userWithProfile.createdAt,
      ),
    );

    this.logger.log(`User registered successfully: ${userWithProfile.id} (${userWithProfile.email})`);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: userWithProfile.id,
        email: userWithProfile.email,
        name: userWithProfile.name,
        role: userWithProfile.role,
        status: userWithProfile.status,
        profile: userWithProfile.profile
          ? {
              targetCefr: userWithProfile.profile.targetCefr,
              dailyGoalMinutes: userWithProfile.profile.dailyGoalMinutes,
              reminderEnabled: userWithProfile.profile.reminderEnabled,
            }
          : null,
      },
    };
  }
}
