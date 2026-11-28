import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { AssessmentCacheService } from '../../assessment/services/assessment-cache.service';
import { FirebaseTokenService } from '../../auth/firebase/firebase-token.service';
import { FirebaseUserService } from '../../auth/firebase/firebase-user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
import { TokenService } from '../../security/token.service';
import {
  AdminChangePasswordDto,
  AdminLoginDto,
  AdminLogoutDto,
  AdminRefreshDto,
  AdminUpdateProfileDto,
  isSafeAdminAvatarUrl,
} from '../dto/admin-auth.dto';
import {
  AdminAuditRequest,
  AdminAuthResult,
  AdminUserView,
  assertAdminNotLockedOut,
  clearAdminFailedLogins,
  recordAdminFailedLogin,
  sanitizeSessionIp,
} from './auth/admin-auth.helpers';

export { buildAdminLoginFailKey } from './auth/admin-auth.helpers';
export type {
  AdminAuditActor,
  AdminAuditRequest,
  AdminAuthResult,
  AdminUserView,
} from './auth/admin-auth.helpers';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    @Optional() private readonly cacheService?: AssessmentCacheService,
    @Optional() private readonly firebase?: FirebaseTokenService,
    @Optional() private readonly jwtService?: JwtService,
    @Optional() private readonly firebaseUsers?: FirebaseUserService,
  ) {}

  private assertNotLockedOut(normalizedEmail: string): Promise<void> {
    return assertAdminNotLockedOut(this.cacheService, normalizedEmail);
  }

  private recordFailedLogin(normalizedEmail: string): Promise<void> {
    return recordAdminFailedLogin(this.cacheService, normalizedEmail);
  }

  private clearFailedLogins(normalizedEmail: string): Promise<void> {
    return clearAdminFailedLogins(this.cacheService, normalizedEmail);
  }

  async login(
    dto: AdminLoginDto,
    context?: { ipAddress?: string; deviceIdentifier?: string },
  ): Promise<AdminAuthResult> {
    const email = dto.email.trim().toLowerCase();
    await this.assertNotLockedOut(email);

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      await this.passwordService.dummyVerify(dto.password);
      await this.recordFailedLogin(email);
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
      await this.recordFailedLogin(email);
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

    await this.clearFailedLogins(email);

    const tokens = await this.tokenService.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    });

    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: tokens.tokenHash,
        deviceIdentifier: context?.deviceIdentifier,
        ipAddress: sanitizeSessionIp(context?.ipAddress),
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
      tokenVersion: user.tokenVersion ?? 0,
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
          ipAddress: sanitizeSessionIp(context?.ipAddress),
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

  async changePassword(
    userId: string,
    dto: AdminChangePasswordDto,
    context?: { ipAddress?: string; deviceIdentifier?: string },
  ): Promise<AdminAuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        passwordHash: true,
        firebaseUid: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản quản trị.',
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
        message: 'Tài khoản không có quyền Quản trị viên.',
      });
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CURRENT_PASSWORD',
        message: 'Mật khẩu hiện tại không chính xác.',
      });
    }

    const isCurrentValid = await this.passwordService.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CURRENT_PASSWORD',
        message: 'Mật khẩu hiện tại không chính xác.',
      });
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_UNCHANGED',
        message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
      });
    }

    const newPasswordHash = await this.passwordService.hash(dto.newPassword);

    if (this.firebase?.enabled && user.firebaseUid) {
      await this.firebase.resetPassword(user.firebaseUid, dto.newPassword);
    }

    const { updatedUser, tokens } = await this.prisma.$transaction(async (tx) => {
      const savedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          tokenVersion: { increment: 1 },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          avatarUrl: true,
          tokenVersion: true,
        },
      });

      await tx.refreshSession.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true },
      });

      const nextTokens = await this.tokenService.generateTokenPair({
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        tokenVersion: savedUser.tokenVersion,
      });

      await tx.refreshSession.create({
        data: {
          userId: savedUser.id,
          tokenHash: nextTokens.tokenHash,
          deviceIdentifier: context?.deviceIdentifier,
          ipAddress: sanitizeSessionIp(context?.ipAddress),
          expiresAt: nextTokens.expiresAt,
          isRevoked: false,
        },
      });

      return { updatedUser: savedUser, tokens: nextTokens };
    });

    await this.clearFailedLogins(user.email.trim().toLowerCase());
    this.firebaseUsers?.invalidateCache(user.firebaseUid ?? user.id);
    this.firebaseUsers?.invalidateCache(user.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        status: updatedUser.status,
        avatarUrl: updatedUser.avatarUrl,
      },
    };
  }

  async logoutAll(userId: string): Promise<{ revokedSessionsCount: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firebaseUid: true },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản quản trị.',
      });
    }

    const revokedSessionsCount = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });
      const revoked = await tx.refreshSession.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true },
      });
      return revoked.count;
    });

    this.firebaseUsers?.invalidateCache(user.firebaseUid ?? user.id);
    this.firebaseUsers?.invalidateCache(user.id);

    if (this.firebase?.enabled && user.firebaseUid) {
      await this.firebase.revoke(user.firebaseUid);
    }

    return { revokedSessionsCount };
  }

  async logout(dto: AdminLogoutDto, req?: AdminAuditRequest): Promise<void> {
    const tokenHash = this.tokenService.hashToken(dto.refreshToken);
    const session = this.prisma.refreshSession.findUnique
      ? await this.prisma.refreshSession.findUnique({
          where: { tokenHash },
          select: {
            user: {
              select: { id: true, email: true },
            },
          },
        })
      : null;

    await this.prisma.refreshSession.updateMany({
      where: { tokenHash, isRevoked: false },
      data: { isRevoked: true },
    });

    if (!req) return;

    if (session?.user?.id && session.user.email) {
      req.__auditActor = {
        userId: session.user.id,
        email: session.user.email,
      };
      return;
    }

    if (req.user?.sub && req.user?.email) {
      req.__auditActor = {
        userId: req.user.sub,
        email: req.user.email,
      };
      return;
    }

    const authHeader = req.headers?.authorization;
    const bearerMatch =
      typeof authHeader === 'string' ? /^Bearer (\S+)$/i.exec(authHeader) : null;
    if (bearerMatch && bearerMatch[1].length <= 4096 && this.jwtService) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtPayload>(
          bearerMatch[1],
        );
        if (payload?.sub && payload?.email) {
          req.__auditActor = {
            userId: payload.sub,
            email: payload.email,
          };
        }
      } catch {
        // Ignore invalid/expired token on public logout fallback
      }
    }
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

  async updateProfile(
    userId: string,
    dto: AdminUpdateProfileDto,
  ): Promise<AdminUserView> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản quản trị.',
      });
    }
    if (existing.role !== UserRole.ADMIN || existing.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'ADMIN_FORBIDDEN',
        message: 'Tài khoản không có quyền cập nhật hồ sơ quản trị.',
      });
    }

    const updateData: { name?: string; avatarUrl?: string | null } = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 100) {
        throw new BadRequestException({
          code: 'ADMIN_INVALID_NAME',
          message: 'Tên hiển thị phải có độ dài từ 2 đến 100 ký tự.',
        });
      }
      updateData.name = trimmedName;
    }

    if (dto.avatarUrl !== undefined) {
      const normalizedAvatar =
        dto.avatarUrl === null ? null : dto.avatarUrl.trim();
      if (
        normalizedAvatar !== null &&
        normalizedAvatar !== '' &&
        !isSafeAdminAvatarUrl(normalizedAvatar)
      ) {
        throw new BadRequestException({
          code: 'ADMIN_INVALID_AVATAR_URL',
          message:
            'URL ảnh đại diện không hợp lệ (chỉ chấp nhận ảnh JPG, PNG, WEBP tải lên hoặc liên kết HTTPS an toàn).',
        });
      }
      updateData.avatarUrl =
        normalizedAvatar === null || normalizedAvatar === ''
          ? null
          : normalizedAvatar;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException({
        code: 'ADMIN_PROFILE_EMPTY_UPDATE',
        message: 'Vui lòng cung cấp thông tin cần cập nhật.',
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
      },
    });
    this.firebaseUsers?.invalidateCache(userId);
    return updated;
  }
}
