import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository';
import { TokenService } from '../../security/token.service';
import { UserStatus } from '@prisma/client';

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class RefreshTokenUseCase {
  private readonly logger = new Logger(RefreshTokenUseCase.name);

  constructor(
    private readonly refreshSessionRepository: RefreshSessionRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(
    dto: RefreshTokenDto,
    context?: { ipAddress?: string; deviceIdentifier?: string },
  ): Promise<RefreshResult> {
    const tokenHash = this.tokenService.hashToken(dto.refreshToken);
    const session = await this.refreshSessionRepository.findByTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_REFRESH_TOKEN',
        message: 'Phiên làm việc không tồn tại hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }

    if (session.isRevoked) {
      this.logger.warn(
        `Security Alert: Replay attack detected on session ${session.id} for user ${session.userId}. Revoking all sessions.`,
      );
      await this.refreshSessionRepository.revokeAllUserSessions(session.userId);
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_COMPROMISED',
        message:
          'Phiên đăng nhập đã bị vô hiệu hóa do phát hiện dấu hiệu bất thường. Vui lòng đăng nhập lại.',
      });
    }

    if (new Date() > session.expiresAt) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_REFRESH_TOKEN',
        message: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'AUTH_USER_SUSPENDED',
        message: 'Tài khoản người dùng đã bị khóa.',
      });
    }

    const newRawRefreshToken = this.tokenService.generateRawRefreshToken();
    const newTokenHash = this.tokenService.hashToken(newRawRefreshToken);
    const newExpiresAt = this.tokenService.calculateRefreshTokenExpiry();

    await this.refreshSessionRepository.rotateSession(session.id, {
      userId: session.userId,
      tokenHash: newTokenHash,
      deviceIdentifier: context?.deviceIdentifier ?? session.deviceIdentifier ?? undefined,
      ipAddress: context?.ipAddress ?? session.ipAddress ?? undefined,
      expiresAt: newExpiresAt,
    });

    const accessToken = await this.tokenService.generateAccessToken({
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    });

    this.logger.log(`Tokens rotated successfully for user ${session.userId}`);

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  }
}
