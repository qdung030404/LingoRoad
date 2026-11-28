import { NotFoundException } from '@nestjs/common';
import { SkillLevelSource } from '@prisma/client';
import { FirebaseTokenService } from '../../../auth/firebase/firebase-token.service';
import { learningDate } from '../../../planning/planning.helpers';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResetPlacementRetakeDto } from '../../dto/admin-users.dto';
import {
  ADMIN_USER_SELECT,
  AdminUserDetail,
  AdminUserSessionView,
  extractSpeakingOverallScore,
  mapUserItem,
} from './admin-users.types';

export async function getUserDetailOp(
  prisma: PrismaService,
  id: string,
): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: ADMIN_USER_SELECT,
  });
  if (!user) {
    throw new NotFoundException({
      code: 'ADMIN_USER_NOT_FOUND',
      message: 'Không tìm thấy người dùng.',
    });
  }

  const todayDate = learningDate(new Date());
  const [
    attempts,
    placements,
    speakings,
    skillLevels,
    skillLevelEvents,
    todayDayPlan,
    answerExposuresCount,
    voiceConversations,
  ] = await Promise.all([
    prisma.learningAttempt.findMany({
      where: { userId: id },
      orderBy: [{ startedAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        status: true,
        correctCount: true,
        totalQuestions: true,
        lessonSnapshot: true,
        startedAt: true,
        submittedAt: true,
      },
    }),
    prisma.placementSession.findMany({
      where: { userId: id },
      orderBy: [{ startedAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        status: true,
        estimatedCefr: true,
        correctCount: true,
        totalItems: true,
        startedAt: true,
        completedAt: true,
      },
    }),
    prisma.speakingSubmission.findMany({
      where: { userId: id },
      orderBy: [{ createdAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        status: true,
        promptSnapshot: true,
        result: true,
        createdAt: true,
      },
    }),
    prisma.learningSkillLevel?.findMany({
      where: { userId: id },
      orderBy: [{ kind: 'asc' }],
      select: {
        id: true,
        kind: true,
        cefrLevel: true,
        source: true,
        previousCefr: true,
        changedAt: true,
        updatedAt: true,
      },
    }) ?? Promise.resolve([]),
    prisma.learningSkillLevelEvent?.findMany({
      where: { userId: id },
      orderBy: [{ createdAt: 'desc' }],
      take: 20,
      select: {
        id: true,
        attemptId: true,
        kind: true,
        fromCefr: true,
        toCefr: true,
        direction: true,
        createdAt: true,
      },
    }) ?? Promise.resolve([]),
    prisma.learningDayPlan?.findUnique({
      where: { userId_date: { userId: id, date: todayDate } },
      select: {
        id: true,
        date: true,
        version: true,
        preferencesVersion: true,
        dailyGoalMinutes: true,
        policyVersion: true,
        items: true,
        createdAt: true,
        updatedAt: true,
      },
    }) ?? Promise.resolve(null),
    prisma.learningAnswerExposure?.count({
      where: { userId: id },
    }) ?? Promise.resolve(0),
    prisma.voiceConversation?.findMany({
      where: { userId: id },
      orderBy: [{ createdAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        topicId: true,
        topicSnapshot: true,
        status: true,
        endReason: true,
        assessmentStatus: true,
        activeUserId: true,
        createdAt: true,
        startedAt: true,
        endedAt: true,
        _count: { select: { turns: true } },
      },
    }) ?? Promise.resolve([]),
  ]);

  return {
    ...mapUserItem(user),
    skillLevels,
    skillLevelEvents,
    todayDayPlan,
    answerExposuresCount,
    recentVoiceConversations: voiceConversations.map((vc) => ({
      id: vc.id,
      topicId: vc.topicId,
      topicTitle:
        (vc.topicSnapshot as { title?: string } | null)?.title ?? 'Hội thoại AI',
      status: vc.status,
      endReason: vc.endReason,
      assessmentStatus: vc.assessmentStatus,
      hasActiveLock: Boolean(vc.activeUserId),
      turnsCount: vc._count.turns,
      createdAt: vc.createdAt,
      startedAt: vc.startedAt,
      endedAt: vc.endedAt,
    })),
    recentAttempts: attempts.map((a) => ({
      id: a.id,
      lessonTitle:
        (a.lessonSnapshot as { title?: string } | null)?.title ?? 'Bài học',
      status: a.status,
      correctCount: a.correctCount,
      totalQuestions: a.totalQuestions,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
    })),
    recentPlacements: placements,
    recentSpeaking: speakings.map((s) => ({
      id: s.id,
      promptTitle:
        (s.promptSnapshot as { title?: string } | null)?.title ?? 'Luyện nói',
      status: s.status,
      overallScore: extractSpeakingOverallScore(s.result),
      createdAt: s.createdAt,
    })),
  };
}

export async function getPlacementSessionDetailOp(
  prisma: PrismaService,
  userId: string,
  sessionId: string,
) {
  const session = await prisma.placementSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      responses: {
        orderBy: { itemIndex: 'asc' },
        include: {
          item: {
            select: {
              id: true,
              externalId: true,
              prompt: true,
              skill: true,
              skillCode: true,
              cefrLevel: true,
              type: true,
              options: true,
              correctOption: true,
            },
          },
        },
      },
    },
  });
  if (!session) {
    throw new NotFoundException({
      code: 'ADMIN_PLACEMENT_SESSION_NOT_FOUND',
      message: 'Không tìm thấy phiên đánh giá đầu vào.',
    });
  }
  return session;
}

export async function resetPlacementRetakeOp(
  prisma: PrismaService,
  userId: string,
  dto: ResetPlacementRetakeDto = {},
): Promise<{
  userId: string;
  abandonedSessionsCount: number;
  resetSkillLevelsCount: number;
}> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!existing) {
    throw new NotFoundException({
      code: 'ADMIN_USER_NOT_FOUND',
      message: 'Không tìm thấy người dùng.',
    });
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

    const updated = await tx.placementSession.updateMany({
      where: {
        userId,
        status: { in: ['IN_PROGRESS', 'COMPLETED'] },
      },
      data: {
        status: 'ABANDONED',
        currentItemId: null,
        version: { increment: 1 },
      },
    });

    let resetSkillLevelsCount = 0;
    if (dto.resetSkillLevels) {
      const deleted = await tx.learningSkillLevel.deleteMany({
        where: {
          userId,
          source: SkillLevelSource.PLACEMENT,
        },
      });
      resetSkillLevelsCount = deleted.count;
    }

    return {
      userId,
      abandonedSessionsCount: updated.count,
      resetSkillLevelsCount,
    };
  });
}

export async function listUserSessionsOp(
  prisma: PrismaService,
  userId: string,
): Promise<AdminUserSessionView[]> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!existing) {
    throw new NotFoundException({
      code: 'ADMIN_USER_NOT_FOUND',
      message: 'Không tìm thấy người dùng.',
    });
  }

  return prisma.refreshSession.findMany({
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

export async function revokeUserSessionOp(
  prisma: PrismaService,
  userId: string,
  sessionId: string,
): Promise<{ id: string; revoked: boolean }> {
  const session = await prisma.refreshSession.findFirst({
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
    await prisma.refreshSession.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  return { id: sessionId, revoked: true };
}

export async function revokeAllUserSessionsOp(
  prisma: PrismaService,
  userId: string,
  firebase?: FirebaseTokenService,
): Promise<{ userId: string; revokedSessionsCount: number }> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firebaseUid: true },
  });
  if (!existing) {
    throw new NotFoundException({
      code: 'ADMIN_USER_NOT_FOUND',
      message: 'Không tìm thấy người dùng.',
    });
  }

  const revokedCount = await prisma.$transaction(async (tx) => {
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

  if (firebase?.enabled && existing.firebaseUid) {
    await firebase.revoke(existing.firebaseUid);
  }

  return {
    userId,
    revokedSessionsCount: revokedCount,
  };
}

export async function exportUserDataOp(
  prisma: PrismaService,
  userId: string,
): Promise<{ filename: string; contentType: string; body: string }> {
  const user = await prisma.user.findUnique({
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
      skillLevelEvents: { orderBy: [{ createdAt: 'desc' }] },
      dayPlans: { orderBy: [{ date: 'desc' }] },
      placementSessions: {
        orderBy: [{ startedAt: 'desc' }],
        include: { responses: { orderBy: { itemIndex: 'asc' } } },
      },
      learningAttempts: {
        orderBy: [{ startedAt: 'desc' }],
        include: { answers: true },
      },
      speakingSubmissions: { orderBy: [{ createdAt: 'desc' }] },
      speakingGameProgress: true,
      voiceConversations: {
        orderBy: [{ createdAt: 'desc' }],
        include: { turns: { orderBy: { sequence: 'asc' } } },
      },
      vocabularyDecks: {
        orderBy: [{ createdAt: 'desc' }],
        include: { words: true },
      },
      vocabularyReviews: { orderBy: [{ startedAt: 'desc' }] },
      refreshSessions: {
        orderBy: [{ createdAt: 'desc' }],
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
