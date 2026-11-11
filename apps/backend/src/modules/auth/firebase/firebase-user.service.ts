import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { AuthProvider, Prisma, User, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FirebaseUserService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(token: DecodedIdToken) {
    if (!token.uid || !token.email) throw new UnauthorizedException({ code: 'AUTH_EMAIL_REQUIRED', message: 'Tài khoản đăng nhập cần có email.' });
    let user = await this.prisma.user.findUnique({ where: { firebaseUid: token.uid } });
    if (!user) {
      try {
        user = await this.prisma.user.create({ data: {
          firebaseUid: token.uid,
          email: token.email.toLowerCase(),
          name: (typeof token.name === 'string' ? token.name : token.email.split('@')[0]).slice(0, 100),
          provider: token.firebase?.sign_in_provider === 'google.com' ? AuthProvider.GOOGLE : AuthProvider.LOCAL,
          avatarUrl: typeof token.picture === 'string' && token.picture.startsWith('https://') ? token.picture.slice(0, 500) : null,
          profile: { create: {} },
        } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        // Concurrent first requests may race; never link accounts by email alone.
        user = await this.prisma.user.findUnique({ where: { firebaseUid: token.uid } });
        if (!user) throw new ConflictException({ code: 'AUTH_ACCOUNT_LINK_REQUIRED', message: 'Email đã thuộc tài khoản cũ. Cần chuyển đổi tài khoản trước khi đăng nhập bằng Firebase.' });
      }
    }
    return this.principal(user);
  }

  private principal(user: User) {
    if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException({ code: 'AUTH_USER_SUSPENDED', message: 'Tài khoản đã bị tạm khóa hoặc không còn hoạt động.' });
    return { sub: user.id, email: user.email, role: user.role, firebaseUid: user.firebaseUid };
  }
}
