import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { FirebaseTokenService } from '../../auth/firebase/firebase-token.service';
import { FirebaseUserService } from '../../auth/firebase/firebase-user.service';
import { PrismaService } from '../../prisma/prisma.service';

type RequestWithUser = Request & { user?: JwtPayload };

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Optional() private readonly firebase?: FirebaseTokenService,
    @Optional() private readonly firebaseUsers?: FirebaseUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match || match[1].length > 4096) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Yêu cầu Bearer token hợp lệ.',
      });
    }

    const token = match[1];
    const jwtUser = await this.tryVerifyInternalJwt(token);
    if (jwtUser !== null) {
      req.user = jwtUser;
      return true;
    }

    if (this.firebase?.enabled && this.firebaseUsers) {
      const decoded = await this.firebase.verify(token);
      const principal = await this.firebaseUsers.resolve(decoded);
      if (principal.role !== UserRole.ADMIN) {
        throw new ForbiddenException({
          code: 'AUTH_INSUFFICIENT_PERMISSIONS',
          message: 'Bạn không có quyền truy cập khu vực quản trị.',
        });
      }
      req.user = {
        sub: principal.sub,
        email: principal.email,
        role: principal.role,
        ...(principal.firebaseUid ? { firebaseUid: principal.firebaseUid } : {}),
      };
      return true;
    }

    throw new UnauthorizedException({
      code: 'AUTH_INVALID_TOKEN',
      message: 'Phiên đăng nhập quản trị hết hạn hoặc không hợp lệ.',
    });
  }

  private async tryVerifyInternalJwt(token: string): Promise<JwtPayload | null> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      return null;
    }

    if (!payload?.sub) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        firebaseUid: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Tài khoản không tồn tại.',
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code:
          user.status === UserStatus.DELETED
            ? 'AUTH_USER_DELETED'
            : 'AUTH_USER_SUSPENDED',
        message: 'Tài khoản quản trị đã bị khóa hoặc vô hiệu hóa.',
      });
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        message: 'Bạn không có quyền truy cập khu vực quản trị.',
      });
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(user.firebaseUid ? { firebaseUid: user.firebaseUid } : {}),
    };
  }
}
