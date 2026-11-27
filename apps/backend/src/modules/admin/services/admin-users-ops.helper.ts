import { NotFoundException } from '@nestjs/common';
import { FirebaseTokenService } from '../../auth/firebase/firebase-token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminUserSessionView } from './admin-users.types';

export interface AdminUsersOpsDeps {
  prisma: PrismaService;
  firebase?: FirebaseTokenService;
}

export async function listUserSessionsHelper(
  deps: AdminUsersOpsDeps,
  userId: string,
): Promise<AdminUserSessionView[]> {
  const existing = await deps.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!existing) {
    throw new NotFoundException({
      code: 'ADMIN_USER_NOT_FOUND',
      message: 'Không tìm thấy người dùng.',
    });
  }

  return deps.prisma.refreshSession.findMany({
    where: {
      userId,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      deviceIdentifier: true,
      ipAddress: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export async function revokeUserSessionHelper(
  deps: AdminUsersOpsDeps,
  userId: string,
  sessionId: string,
): Promise<{ id: string; revoked: boolean }> {
  const session = await deps.prisma.refreshSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, isRevoked: true },
  });
  if (!session) {
    throw new NotFoundException({
      code: 'ADMIN_SESSION_NOT_FOUND',
      message: 'Không tìm thấy phiên đăng nhập.',
    });
  }

  if (!session.isRevoked) {
    await deps.prisma.refreshSession.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  return { id: sessionId, revoked: true };
}

export async function revokeAllUserSessionsHelper(
  deps: AdminUsersOpsDeps,
  userId: string,
): Promise<{ userId: string; revokedSessionsCount: number }> {
  const existing = await deps.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firebaseUid: true },
  });
  if (!existing) {
    throw new NotFoundException({
      code: 'ADMIN_USER_NOT_FOUND',
      message: 'Không tìm thấy người dùng.',
    });
  }

  const revokedCount = await deps.prisma.$transaction(async (tx) => {
    const res = await tx.refreshSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    await tx.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    return res.count;
  });

  if (deps.firebase?.enabled && existing.firebaseUid) {
    await deps.firebase.revoke(existing.firebaseUid);
  }

  return {
    userId,
    revokedSessionsCount: revokedCount,
  };
}

export async function exportUserDataHelper(
  deps: AdminUsersOpsDeps,
  userId: string,
): Promise<{ filename: string; contentType: string; body: string }> {
  const user = await deps.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      provider: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      profile: true,
      skillLevels: true,
      skillLevelEvents: { orderBy: [{ createdAt: 'desc' }], take: 500 },
      dayPlans: { orderBy: [{ date: 'desc' }], take: 500 },
      placementSessions: {
        orderBy: [{ startedAt: 'desc' }],
        take: 500,
        include: { responses: { orderBy: { itemIndex: 'asc' } } },
      },
      learningAttempts: {
        orderBy: [{ startedAt: 'desc' }],
        take: 500,
        include: { answers: true },
      },
      speakingSubmissions: { orderBy: [{ createdAt: 'desc' }], take: 500 },
      speakingGameProgress: true,
      voiceConversations: {
        orderBy: [{ createdAt: 'desc' }],
        take: 500,
        include: { turns: { orderBy: { sequence: 'asc' } } },
      },
      vocabularyDecks: {
        orderBy: [{ createdAt: 'desc' }],
        take: 500,
        include: { words: true },
      },
      vocabularyReviews: { orderBy: [{ startedAt: 'desc' }], take: 500 },
      refreshSessions: {
        orderBy: [{ createdAt: 'desc' }],
        take: 500,
        select: {
          id: true,
          deviceIdentifier: true,
          ipAddress: true,
          expiresAt: true,
          isRevoked: true,
          createdAt: true,
        },
      },
    },
  });
  if (!user) {
    throw new NotFoundException({
      code: 'ADMIN_USER_NOT_FOUND',
      message: 'Không tìm thấy người dùng.',
    });
  }

  // Defensive strip in case any mock or relation leaked secret hashes
  const safeUser = { ...(user as Record<string, unknown>) };
  delete safeUser.passwordHash;
  if (Array.isArray(safeUser.refreshSessions)) {
    safeUser.refreshSessions = safeUser.refreshSessions.map((session) => {
      if (!session || typeof session !== 'object') return session;
      const copy = { ...(session as Record<string, unknown>) };
      delete copy.tokenHash;
      return copy;
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    filename: `lingoroad-user-${userId}-${stamp}.json`,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        user: safeUser,
      },
      null,
      2,
    ),
  };
}
