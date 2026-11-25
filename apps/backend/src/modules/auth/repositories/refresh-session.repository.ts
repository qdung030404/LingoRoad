import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, RefreshSession, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const REFRESH_SESSION_RETENTION_DAYS = 7;
export const REFRESH_SESSION_RETENTION_MS =
  REFRESH_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const REFRESH_SESSION_CLEANUP_BATCH_SIZE = 1000;
export const REFRESH_SESSION_CLEANUP_MAX_BATCH_SIZE = 10000;

export function clampRefreshSessionBatchSize(batchSize: number): number {
  if (!Number.isFinite(batchSize)) {
    return REFRESH_SESSION_CLEANUP_BATCH_SIZE;
  }
  return Math.min(
    REFRESH_SESSION_CLEANUP_MAX_BATCH_SIZE,
    Math.max(1, Math.trunc(batchSize)),
  );
}

export type RefreshSessionWithUser = RefreshSession & { user: User };

@Injectable()
export class RefreshSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    data: {
      userId: string;
      tokenHash: string;
      deviceIdentifier?: string;
      ipAddress?: string;
      expiresAt: Date;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<RefreshSession> {
    const client = tx || this.prisma;
    return client.refreshSession.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        deviceIdentifier: data.deviceIdentifier,
        ipAddress: data.ipAddress,
        expiresAt: data.expiresAt,
        isRevoked: false,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshSessionWithUser | null> {
    return this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async revokeByTokenHash(
    tokenHash: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    const client = tx || this.prisma;
    return client.refreshSession.updateMany({
      where: { tokenHash, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async revokeAllUserSessions(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    const client = tx || this.prisma;
    return client.refreshSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async rotateSession(
    oldSessionId: string,
    newSessionData: {
      userId: string;
      tokenHash: string;
      deviceIdentifier?: string;
      ipAddress?: string;
      expiresAt: Date;
    },
  ): Promise<RefreshSession> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshSession.updateMany({
        where: { id: oldSessionId, isRevoked: false, expiresAt: { gt: new Date() } },
        data: { isRevoked: true },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedException({ code: 'AUTH_INVALID_REFRESH_TOKEN', message: 'Phiên làm việc đã được sử dụng. Vui lòng đăng nhập lại.' });
      }

      return tx.refreshSession.create({
        data: {
          userId: newSessionData.userId,
          tokenHash: newSessionData.tokenHash,
          deviceIdentifier: newSessionData.deviceIdentifier,
          ipAddress: newSessionData.ipAddress,
          expiresAt: newSessionData.expiresAt,
          isRevoked: false,
        },
      });
    });
  }

  /**
   * Deletes expired refresh sessions past the retention cutoff in SKIP LOCKED batches.
   * Preserves revoked-but-unexpired sessions so token replay detection remains intact.
   */
  async deleteExpiredSessions(
    olderThan: Date = new Date(Date.now() - REFRESH_SESSION_RETENTION_MS),
    batchSize: number = REFRESH_SESSION_CLEANUP_BATCH_SIZE,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    const client = tx || this.prisma;
    const limit = clampRefreshSessionBatchSize(batchSize);
    const deletedCount = await client.$executeRaw`
      WITH victim_rows AS (
        SELECT ctid
        FROM "refresh_sessions"
        WHERE expires_at < (${olderThan}::timestamptz AT TIME ZONE 'UTC')
        ORDER BY expires_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "refresh_sessions" AS rs
      USING victim_rows
      WHERE rs.ctid = victim_rows.ctid
    `;
    return { count: Number(deletedCount) };
  }
}
