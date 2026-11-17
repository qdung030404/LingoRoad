import { ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { AuthProvider, CefrLevel, Prisma, User, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { maskEmail } from './firebase-token.service';

export interface FirebaseUserPrincipal {
  sub: string;
  email: string;
  role: UserRole;
  firebaseUid: string | null;
}

@Injectable()
export class FirebaseUserService {
  private readonly logger = new Logger(FirebaseUserService.name);
  constructor(private readonly prisma: PrismaService) { }

  async resolve(token: DecodedIdToken): Promise<FirebaseUserPrincipal> {
    const uid = token.uid?.trim();
    const rawEmail = token.email?.trim();
    if (!uid || !rawEmail) {
      throw new UnauthorizedException({ code: 'AUTH_EMAIL_REQUIRED', message: 'Tài khoản đăng nhập cần có email.' });
    }
    const normalizedEmail = rawEmail.toLowerCase();
    if (token.firebase?.sign_in_provider === 'google.com' && !token.email_verified) {
      throw new UnauthorizedException({
        code: 'AUTH_EMAIL_NOT_VERIFIED',
        message: 'Tài khoản Google cần có email đã được xác thực.',
      });
    }

    this.logger.debug(`Đang tìm/tạo người dùng cho Firebase UID: ${uid}, email: ${maskEmail(normalizedEmail)}`);
    let user = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
    if (!user) {
      this.logger.debug(`Chưa có user với firebaseUid: ${uid}. Đang tạo mới user trong DB...`);
      try {
        user = await this.prisma.user.create({
          data: {
            firebaseUid: uid,
            email: normalizedEmail,
            name: (typeof token.name === 'string' && token.name.trim().length > 0 ? token.name.trim() : rawEmail.split('@')[0]).slice(0, 100),
            provider: token.firebase?.sign_in_provider === 'google.com' ? AuthProvider.GOOGLE : AuthProvider.LOCAL,
            avatarUrl: typeof token.picture === 'string' && token.picture.startsWith('https://') ? token.picture.slice(0, 500) : null,
            role: UserRole.LEARNER,
            status: UserStatus.ACTIVE,
            profile: {
              create: {
                targetCefr: CefrLevel.B1,
                dailyGoalMinutes: 10,
                reminderEnabled: true,
              },
            },
          },
        });
        this.logger.log(`Đã tạo tài khoản mới (${user.provider}) trong DB thành công: ID=${user.id}`);
      } catch (error) {
        this.logger.warn(`Lỗi khi tạo user mới: ${error instanceof Error ? error.message : error}`);
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        // Concurrent first requests may race; never link accounts by email alone.
        user = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
        if (!user) {
          this.logger.error(`Xung đột email: Email đã tồn tại trong DB nhưng chưa liên kết với Firebase UID ${uid}`);
          throw new ConflictException({ code: 'AUTH_ACCOUNT_LINK_REQUIRED', message: 'Email đã thuộc tài khoản cũ. Cần chuyển đổi tài khoản trước khi đăng nhập bằng Firebase.' });
        }
      }
    } else {
      this.logger.debug(`Đã tìm thấy user trong DB: ID=${user.id}`);
    }

    if (user.role === UserRole.ADMIN && token.firebase?.sign_in_provider === 'google.com') {
      throw new ForbiddenException({
        code: 'AUTH_ADMIN_GOOGLE_LINK_RESTRICTED',
        message: 'Tài khoản Quản trị viên không được phép đăng nhập qua Google SSO.',
      });
    }
    return this.principal(user);
  }

  private principal(user: User): FirebaseUserPrincipal {
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: user.status === UserStatus.DELETED ? 'AUTH_USER_DELETED' : 'AUTH_USER_SUSPENDED',
        message: 'Tài khoản đã bị tạm khóa hoặc không còn hoạt động.',
      });
    }
    return { sub: user.id, email: user.email, role: user.role, firebaseUid: user.firebaseUid };
  }
}
