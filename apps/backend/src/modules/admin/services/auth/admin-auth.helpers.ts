import { HttpException, HttpStatus } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { UserRole, UserStatus } from '@prisma/client';
import { Request } from 'express';
import { normalizeClientIp } from '../../../../common/guards/client-ip-throttler.guard';
import { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { AssessmentCacheService } from '../../../assessment/services/assessment-cache.service';

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

export interface AdminAuditActor {
  userId: string;
  email: string;
}

export type AdminAuditRequest = Request & {
  user?: JwtPayload;
  __auditActor?: AdminAuditActor;
};

interface LoginFailRecord {
  count: number;
  firstFailedAt: number;
  lockedUntil?: number;
}

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SECONDS = 15 * 60;
const LOCKOUT_DURATION_SECONDS = 15 * 60;

export function buildAdminLoginFailKey(normalizedEmail: string): string {
  const hash = createHash('sha256').update(normalizedEmail).digest('hex');
  return `lingoroad:admin:login_fail:${hash}`;
}

export function sanitizeSessionIp(ip?: string): string | undefined {
  const normalized = normalizeClientIp(ip);
  return normalized ? normalized.slice(0, 45) : undefined;
}

export async function assertAdminNotLockedOut(
  cacheService: AssessmentCacheService | undefined,
  normalizedEmail: string,
): Promise<void> {
  if (!cacheService) return;
  const key = buildAdminLoginFailKey(normalizedEmail);
  const record = await cacheService.get<LoginFailRecord>(key);
  const now = Date.now();
  if (record?.lockedUntil && record.lockedUntil > now) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((record.lockedUntil - now) / 1000),
    );
    throw new HttpException(
      {
        code: 'AUTH_ACCOUNT_LOCKED',
        retryAfterSeconds,
        message: `Tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${Math.ceil(retryAfterSeconds / 60)} phút.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export async function recordAdminFailedLogin(
  cacheService: AssessmentCacheService | undefined,
  normalizedEmail: string,
): Promise<void> {
  if (!cacheService) return;
  const key = buildAdminLoginFailKey(normalizedEmail);
  const now = Date.now();
  const windowMs = LOCKOUT_WINDOW_SECONDS * 1000;
  const existing = await cacheService.get<LoginFailRecord>(key);

  const nextCount =
    existing && now - existing.firstFailedAt <= windowMs
      ? existing.count + 1
      : 1;
  const firstFailedAt =
    existing && now - existing.firstFailedAt <= windowMs
      ? existing.firstFailedAt
      : now;

  if (nextCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
    await cacheService.set<LoginFailRecord>(
      key,
      {
        count: nextCount,
        firstFailedAt,
        lockedUntil: now + LOCKOUT_DURATION_SECONDS * 1000,
      },
      LOCKOUT_DURATION_SECONDS,
    );
    return;
  }

  const remainingTtl = Math.max(
    1,
    Math.ceil((firstFailedAt + windowMs - now) / 1000),
  );
  await cacheService.set<LoginFailRecord>(
    key,
    {
      count: nextCount,
      firstFailedAt,
    },
    remainingTtl,
  );
}

export async function clearAdminFailedLogins(
  cacheService: AssessmentCacheService | undefined,
  normalizedEmail: string,
): Promise<void> {
  if (!cacheService) return;
  await cacheService.del(buildAdminLoginFailKey(normalizedEmail));
}
