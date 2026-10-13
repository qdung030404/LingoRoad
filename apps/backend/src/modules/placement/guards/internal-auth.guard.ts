import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: {
    sub: string;
    role?: string;
  };
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const internalHeader = request.headers['x-internal-token'];
    const expectedToken = this.configService.get<string>('ML_INTERNAL_TOKEN', '');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    // 1. Nếu có token cấu hình thì kiểm tra header
    if (expectedToken && expectedToken.trim().length > 0) {
      if (internalHeader === expectedToken) {
        return true;
      }
    }

    // 2. Cho phép người dùng có quyền ADMIN
    if (request.user?.role === 'ADMIN') {
      return true;
    }

    // 3. Môi trường phát triển cục bộ và token chưa được cấu hình
    if ((!expectedToken || expectedToken.trim().length === 0) && nodeEnv !== 'production') {
      return true;
    }

    throw new UnauthorizedException('UNAUTHORIZED_INTERNAL_TOKEN: Missing or invalid x-internal-token header.');
  }
}
