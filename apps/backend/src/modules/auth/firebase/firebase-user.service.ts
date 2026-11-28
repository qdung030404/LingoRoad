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

type CachedFirebaseUser = Pick<
  User,
  'id' | 'email' | 'name' | 'avatarUrl' | 'provider' | 'role' | 'status' | 'firebaseUid'
>;

interface CachedUserEntry {
  user: CachedFirebaseUser;
  expiresAt: number;
}

const USER_CACHE_TTL_MS = 60_000;
const USER_CACHE_MAX_ENTRIES = 1_000;

@Injectable()
export class FirebaseUserService {
  private readonly logger = new Logger(FirebaseUserService.name);
  private readonly userCache = new Map<string, CachedUserEntry>();
  private readonly uidByUserId = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {
    this.registerPrismaInvalidationHook();
  }

  private registerPrismaInvalidationHook(): void {
    const prismaWithUse = this.prisma as PrismaService & {
      $use?: (
        cb: (
          params: {
            model?: string;
            action?: string;
            args?: { where?: { id?: unknown; firebaseUid?: unknown } };
          },
          next: (params: unknown) => Promise<unknown>,
        ) => Promise<unknown>,
      ) => void;
    };
    if (typeof prismaWithUse.$use !== 'function') {
      return;
    }
    prismaWithUse.$use(async (params, next) => {
      const result = await next(params);
      if (params?.model === 'User') {
        const action = params.action ?? '';
        if (action === 'update' || action === 'upsert' || action === 'delete') {
          const row = result as { id?: unknown; firebaseUid?: unknown } | null;
          const where = params.args?.where;
          const key =
            (typeof row?.firebaseUid === 'string' && row.firebaseUid) ||
            (typeof row?.id === 'string' && row.id) ||
            (typeof where?.firebaseUid === 'string' && where.firebaseUid) ||
            (typeof where?.id === 'string' && where.id) ||
            undefined;
          this.invalidateCache(key);
        } else if (action === 'updateMany' || action === 'deleteMany') {
          this.invalidateCache();
        }
      }
      return result;
    });
  }

  invalidateCache(firebaseUidOrUserId?: string): void {
    if (!firebaseUidOrUserId) {
      this.userCache.clear();
      this.uidByUserId.clear();
      return;
    }
    const direct = this.userCache.get(firebaseUidOrUserId);
    if (direct) {
      this.userCache.delete(firebaseUidOrUserId);
      if (this.uidByUserId.get(direct.user.id) === firebaseUidOrUserId) {
        this.uidByUserId.delete(direct.user.id);
      }
    }
    const mappedUid = this.uidByUserId.get(firebaseUidOrUserId);
    if (mappedUid) {
      this.userCache.delete(mappedUid);
      this.uidByUserId.delete(firebaseUidOrUserId);
    }
  }

  private getCachedUser(firebaseUid: string): CachedFirebaseUser | null {
    const entry = this.userCache.get(firebaseUid);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.invalidateCache(firebaseUid);
      return null;
    }
    // Refresh LRU order without extending absolute expiration timestamp.
    this.userCache.delete(firebaseUid);
    this.userCache.set(firebaseUid, entry);
    return entry.user;
  }

  private setCachedUser(user: CachedFirebaseUser): void {
    if (!user.firebaseUid || user.status !== UserStatus.ACTIVE) {
      return;
    }
    if (this.userCache.has(user.firebaseUid)) {
      this.userCache.delete(user.firebaseUid);
    } else if (this.userCache.size >= USER_CACHE_MAX_ENTRIES) {
      const oldestKey = this.userCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.invalidateCache(oldestKey);
      }
    }
    this.userCache.set(user.firebaseUid, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
        role: user.role,
        status: user.status,
        firebaseUid: user.firebaseUid,
      },
      expiresAt: Date.now() + USER_CACHE_TTL_MS,
    });
    this.uidByUserId.set(user.id, user.firebaseUid);
  }

  private needsGoogleIdentitySync(
    user: Pick<CachedFirebaseUser, 'provider' | 'avatarUrl'>,
    isGoogle: boolean,
    tokenAvatarUrl: string | null,
  ): boolean {
    const needsProviderSync = isGoogle && user.provider !== AuthProvider.GOOGLE;
    const hasAvatar = typeof user.avatarUrl === 'string' && user.avatarUrl.trim().length > 0;
    const needsAvatarSync = isGoogle && !hasAvatar && tokenAvatarUrl !== null;
    return needsProviderSync || needsAvatarSync;
  }

  async resolve(token: DecodedIdToken): Promise<FirebaseUserPrincipal> {
    const uid = token.uid?.trim();
    const rawEmail = token.email?.trim();
    if (!uid || !rawEmail) {
      throw new UnauthorizedException({ code: 'AUTH_EMAIL_REQUIRED', message: 'Tài khoản đăng nhập cần có email.' });
    }
    const normalizedEmail = rawEmail.toLowerCase();
    const isGoogle = token.firebase?.sign_in_provider === 'google.com';
    const tokenAvatarUrl =
      typeof token.picture === 'string' && token.picture.startsWith('https://')
        ? token.picture.slice(0, 500)
        : null;
    if (isGoogle && !token.email_verified) {
      throw new UnauthorizedException({
        code: 'AUTH_EMAIL_NOT_VERIFIED',
        message: 'Tài khoản Google cần có email đã được xác thực.',
      });
    }

    const cached = this.getCachedUser(uid);
    if (cached) {
      if (cached.role === UserRole.ADMIN && isGoogle) {
        throw new ForbiddenException({
          code: 'AUTH_ADMIN_GOOGLE_LINK_RESTRICTED',
          message: 'Tài khoản Quản trị viên không được phép đăng nhập qua Google SSO.',
        });
      }
      if (
        cached.status === UserStatus.ACTIVE &&
        cached.email.toLowerCase() === normalizedEmail &&
        !this.needsGoogleIdentitySync(cached, isGoogle, tokenAvatarUrl)
      ) {
        return this.principal(cached);
      }
      this.invalidateCache(uid);
    }

    this.logger.debug(`Đang tìm/tạo người dùng cho Firebase UID: ${uid}, email: ${maskEmail(normalizedEmail)}`);
    let user = await this.prisma.user.findUnique({ where: { firebaseUid: uid } });
    const existingUser = user !== null;
    if (!user) {
      this.logger.debug(`Chưa có user với firebaseUid: ${uid}. Đang tạo mới user trong DB...`);
      try {
        user = await this.prisma.user.create({
          data: {
            firebaseUid: uid,
            email: normalizedEmail,
            name: (typeof token.name === 'string' && token.name.trim().length > 0 ? token.name.trim() : rawEmail.split('@')[0]).slice(0, 100),
            provider: isGoogle ? AuthProvider.GOOGLE : AuthProvider.LOCAL,
            avatarUrl: tokenAvatarUrl,
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

    if (user.role === UserRole.ADMIN && isGoogle) {
      throw new ForbiddenException({
        code: 'AUTH_ADMIN_GOOGLE_LINK_RESTRICTED',
        message: 'Tài khoản Quản trị viên không được phép đăng nhập qua Google SSO.',
      });
    }
    this.assertActive(user);

    if (existingUser) {
      user = await this.syncGoogleIdentityIfNeeded(user, isGoogle, tokenAvatarUrl);
    }
    this.setCachedUser(user);
    return this.principal(user);
  }

  private async syncGoogleIdentityIfNeeded(
    user: User,
    isGoogle: boolean,
    tokenAvatarUrl: string | null,
  ): Promise<User> {
    const needsProviderSync = isGoogle && user.provider !== AuthProvider.GOOGLE;
    const hasAvatar = typeof user.avatarUrl === 'string' && user.avatarUrl.trim().length > 0;
    const needsAvatarSync = isGoogle && !hasAvatar && tokenAvatarUrl !== null;
    if (!needsProviderSync && !needsAvatarSync) {
      return user;
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(needsProviderSync ? { provider: AuthProvider.GOOGLE } : {}),
        ...(needsAvatarSync ? { avatarUrl: tokenAvatarUrl } : {}),
      },
    });
    this.logger.log(
      `Đã đồng bộ thông tin Google cho user ID=${updated.id} (provider=${updated.provider}, avatarSynced=${needsAvatarSync})`,
    );
    return updated;
  }

  private assertActive(user: Pick<CachedFirebaseUser, 'status'>): void {
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: user.status === UserStatus.DELETED ? 'AUTH_USER_DELETED' : 'AUTH_USER_SUSPENDED',
        message: 'Tài khoản đã bị tạm khóa hoặc không còn hoạt động.',
      });
    }
  }

  private principal(user: CachedFirebaseUser): FirebaseUserPrincipal {
    this.assertActive(user);
    return { sub: user.id, email: user.email, role: user.role, firebaseUid: user.firebaseUid };
  }
}
