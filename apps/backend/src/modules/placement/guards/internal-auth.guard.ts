import { timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard xác thực các request nội bộ từ ML Microservice.
 * Sử dụng header `x-internal-token` để so khớp với biến môi trường `ML_INTERNAL_TOKEN`.
 *
 * Security notes:
 * - Dùng `timingSafeEqual` để chống timing attack.
 * - Luôn trả về cùng một error code để tránh leak thông tin cấu hình server.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly logger = new Logger(InternalAuthGuard.name);
  private readonly internalToken: string;

  constructor(private readonly configService: ConfigService) {
    this.internalToken = this.configService.get<string>(
      'ML_INTERNAL_TOKEN',
      '',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const rawToken = request.headers['x-internal-token'];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!this.isValidToken(token)) {
      // Log nội bộ để phát hiện intrusion attempts, KHÔNG expose lý do ra client
      this.logger.warn(
        `InternalAuthGuard: invalid or missing x-internal-token from ${request.ip ?? 'unknown'}`,
      );
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return true;
  }

  /**
   * So sánh token theo constant-time để chống timing attack.
   * Trả về false nếu token trống, sai độ dài, hoặc sai nội dung.
   */
  private isValidToken(token: string | undefined): boolean {
    if (!this.internalToken || !token) {
      return false;
    }

    try {
      const tokenBuf = Buffer.from(token);
      const expectedBuf = Buffer.from(this.internalToken);

      // timingSafeEqual yêu cầu cùng độ dài buffer
      if (tokenBuf.length !== expectedBuf.length) {
        return false;
      }

      return timingSafeEqual(tokenBuf, expectedBuf);
    } catch {
      return false;
    }
  }
}
