import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, RefreshSession, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

  async deleteExpiredSessions(
    olderThan: Date = new Date(),
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.BatchPayload> {
    const client = tx || this.prisma;
    return client.refreshSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: olderThan } },
          { isRevoked: true, createdAt: { lt: olderThan } },
        ],
      },
    });
  }
}
