import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { UserRepository } from '../repositories/user.repository';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository';
import { PasswordService } from '../../security/password.service';
import { TokenService } from '../../security/token.service';
import { UserStatus } from '@prisma/client';
import { AuthResult } from './register.use-case';

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshSessionRepository: RefreshSessionRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async execute(
    dto: LoginDto,
    context?: { ipAddress?: string; deviceIdentifier?: string },
  ): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      await this.passwordService.dummyVerify(dto.password);
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác',
      });
    }

    const isMatch = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!isMatch) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác',
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'AUTH_USER_SUSPENDED',
        message: 'Tài khoản đã bị tạm khóa hoặc không còn hoạt động trên hệ thống',
      });
    }

    const rawRefreshToken = this.tokenService.generateRawRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const expiresAt = this.tokenService.calculateRefreshTokenExpiry();

    await this.refreshSessionRepository.createSession({
      userId: user.id,
      tokenHash,
      deviceIdentifier: context?.deviceIdentifier,
      ipAddress: context?.ipAddress,
      expiresAt,
    });

    const accessToken = await this.tokenService.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    this.logger.log(`User logged in successfully: ${user.id} (${user.email})`);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        profile: user.profile
          ? {
              targetCefr: user.profile.targetCefr,
              dailyGoalMinutes: user.profile.dailyGoalMinutes,
              reminderEnabled: user.profile.reminderEnabled,
            }
          : null,
      },
    };
  }
}
