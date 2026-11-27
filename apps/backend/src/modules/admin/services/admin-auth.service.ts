import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
import { TokenService } from '../../security/token.service';
import { AdminLoginDto, AdminLogoutDto, AdminRefreshDto } from '../dto/admin-auth.dto';

export interface AdminUserView {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
}

export interface AdminAuthResult {
  accessToken: string;
  refreshToken: string;
  user: AdminUserView;
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async login(
    dto: AdminLoginDto,
    context?: { ipAddress?: string; deviceIdentifier?: string },
  ): Promise<AdminAuthResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      await this.passwordService.dummyVerify(dto.password);
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    const isMatch = await this.passwordService.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isMatch) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác.',
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code:
          user.status === UserStatus.DELETED
            ? 'AUTH_USER_DELETED'
            : 'AUTH_USER_SUSPENDED',
        message: 'Tài khoản đã bị khóa hoặc ngừng hoạt động.',
      });
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        message:
          'Chỉ tài khoản Quản trị viên (ADMIN) mới được phép đăng nhập cổng này.',
      });
    }

    const tokens = await this.tokenService.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: tokens.tokenHash,
        deviceIdentifier: context?.deviceIdentifier,
        ipAddress: context?.ipAddress,
        expiresAt: tokens.expiresAt,
        isRevoked: false,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async refresh(
    dto: AdminRefreshDto,
    context?: { ipAddress?: string; deviceIdentifier?: string },
  ): Promise<AdminAuthResult> {
    const tokenHash = this.tokenService.hashToken(dto.refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_REFRESH_TOKEN',
        message: 'Refresh token không hợp lệ.',
      });
    }

    if (session.isRevoked || session.expiresAt <= new Date()) {
      await this.prisma.refreshSession.updateMany({
        where: { userId: session.userId, isRevoked: false },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException({
        code: 'AUTH_REFRESH_TOKEN_EXPIRED',
        message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }

    const { user } = session;
    if (user.status !== UserStatus.ACTIVE) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      throw new ForbiddenException({
        code:
          user.status === UserStatus.DELETED
            ? 'AUTH_USER_DELETED'
            : 'AUTH_USER_SUSPENDED',
        message: 'Tài khoản đã bị khóa hoặc ngừng hoạt động.',
      });
    }

    if (user.role !== UserRole.ADMIN) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      throw new ForbiddenException({
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        message: 'Tài khoản không có quyền Quản trị viên.',
      });
    }

    const tokens = await this.tokenService.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshSession.updateMany({
        where: {
          id: session.id,
          isRevoked: false,
          expiresAt: { gt: new Date() },
          user: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        },
        data: { isRevoked: true },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedException({
          code: 'AUTH_INVALID_REFRESH_TOKEN',
          message: 'Phiên đăng nhập đã được sử dụng hoặc không còn hợp lệ.',
        });
      }
      await tx.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: tokens.tokenHash,
          deviceIdentifier: context?.deviceIdentifier,
          ipAddress: context?.ipAddress,
          expiresAt: tokens.expiresAt,
          isRevoked: false,
        },
      });
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async logout(dto: AdminLogoutDto): Promise<void> {
    const tokenHash = this.tokenService.hashToken(dto.refreshToken);
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async me(userId: string): Promise<AdminUserView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
      },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản quản trị.',
      });
    }
    return user;
  }
}
