import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AuthProvider,
  CefrLevel,
  LearningKind,
  LearningPurpose,
  Prisma,
  SkillLevelSource,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { FirebaseTokenService } from '../../auth/firebase/firebase-token.service';
import { FirebaseUserService } from '../../auth/firebase/firebase-user.service';
import { learningDate } from '../../planning/planning.helpers';
import { PlanningService } from '../../planning/planning.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
import {
  AdminUsersQueryDto,
  CreateAdminUserDto,
  OverrideUserSkillLevelDto,
  ResetPlacementRetakeDto,
  UpdateAdminUserDto,
} from '../dto/admin-users.dto';

const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  firebaseUid: true,
  provider: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      targetCefr: true,
      dailyGoalMinutes: true,
      learningPurpose: true,
      preferredKinds: true,
      selfAssessedCefr: true,
      onboardingCompletedAt: true,
      reminderEnabled: true,
      reminderTime: true,
      preferencesVersion: true,
      reminderVersion: true,
    },
  },
  _count: {
    select: {
      learningAttempts: true,
      placementSessions: true,
      vocabularyDecks: true,
      speakingSubmissions: true,
      voiceConversations: true,
    },
  },
} as const;

type SelectedAdminUser = Prisma.UserGetPayload<{
  select: typeof ADMIN_USER_SELECT;
}>;

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  hasFirebaseIdentity: boolean;
  provider: AuthProvider;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  profile: {
    targetCefr: CefrLevel;
    dailyGoalMinutes: number;
    learningPurpose?: LearningPurpose | null;
    preferredKinds?: LearningKind[];
    selfAssessedCefr?: CefrLevel | null;
    onboardingCompletedAt?: Date | null;
    reminderEnabled?: boolean;
    reminderTime?: string;
    preferencesVersion?: number;
    reminderVersion?: number;
  } | null;
  stats: {
    learningAttempts: number;
    placementSessions: number;
    vocabularyDecks: number;
    speakingSubmissions: number;
    voiceConversations: number;
  };
}

export interface AdminUserDetail extends AdminUserListItem {
  skillLevels: Array<{
    id: string;
    kind: LearningKind;
    cefrLevel: CefrLevel;
    source: SkillLevelSource;
    previousCefr: CefrLevel | null;
    changedAt: Date | null;
    updatedAt: Date;
  }>;
  skillLevelEvents: Array<{
    id: string;
    attemptId: string;
    kind: LearningKind;
    fromCefr: CefrLevel;
    toCefr: CefrLevel;
    direction: string;
    createdAt: Date;
  }>;
  todayDayPlan: {
    id: string;
    date: string;
    version: number;
    preferencesVersion: number;
    dailyGoalMinutes: number;
    policyVersion: string;
    items: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  answerExposuresCount: number;
  recentVoiceConversations: Array<{
    id: string;
    topicId: string;
    topicTitle: string;
    status: string;
    endReason: string | null;
    assessmentStatus: string;
    hasActiveLock: boolean;
    turnsCount: number;
    createdAt: Date;
    startedAt: Date | null;
    endedAt: Date | null;
  }>;
  recentAttempts: Array<{
    id: string;
    lessonTitle: string;
    status: string;
    correctCount: number | null;
    totalQuestions: number;
    startedAt: Date;
    submittedAt: Date | null;
  }>;
  recentPlacements: Array<{
    id: string;
    status: string;
    estimatedCefr: CefrLevel | null;
    correctCount: number;
    totalItems: number;
    startedAt: Date;
    completedAt: Date | null;
  }>;
  recentSpeaking: Array<{
    id: string;
    promptTitle: string;
    status: string;
    overallScore: number | null;
    createdAt: Date;
  }>;
}

export interface AdminUserSessionView {
  id: string;
  deviceIdentifier: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface UsersListSummary {
  total: number;
  activeLearners30d: number;
  learners: number;
  admins: number;
}

export interface PaginatedResult<T, S = undefined> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: S;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function extractSpeakingOverallScore(result: unknown): number | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null;
  }
  const resObj = result as Record<string, unknown>;
  for (const key of ['overall', 'pronunciation', 'overallScore', 'score'] as const) {
    const raw = resObj[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  }
  return null;
}

function mapUserItem(user: SelectedAdminUser): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    hasFirebaseIdentity: Boolean(user.firebaseUid),
    provider: user.provider,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: user.profile
      ? {
          targetCefr: user.profile.targetCefr,
          dailyGoalMinutes: user.profile.dailyGoalMinutes,
          ...(user.profile.learningPurpose !== undefined
            ? { learningPurpose: user.profile.learningPurpose }
            : {}),
          ...(user.profile.preferredKinds !== undefined
            ? { preferredKinds: user.profile.preferredKinds }
            : {}),
          ...(user.profile.selfAssessedCefr !== undefined
            ? { selfAssessedCefr: user.profile.selfAssessedCefr }
            : {}),
          ...(user.profile.onboardingCompletedAt !== undefined
            ? { onboardingCompletedAt: user.profile.onboardingCompletedAt }
            : {}),
          ...(user.profile.reminderEnabled !== undefined
            ? { reminderEnabled: user.profile.reminderEnabled }
            : {}),
          ...(user.profile.reminderTime !== undefined
            ? { reminderTime: user.profile.reminderTime }
            : {}),
          ...(user.profile.preferencesVersion !== undefined
            ? { preferencesVersion: user.profile.preferencesVersion }
            : {}),
          ...(user.profile.reminderVersion !== undefined
            ? { reminderVersion: user.profile.reminderVersion }
            : {}),
        }
      : null,
    stats: {
      learningAttempts: user._count.learningAttempts,
      placementSessions: user._count.placementSessions,
      vocabularyDecks: user._count.vocabularyDecks,
      speakingSubmissions: user._count.speakingSubmissions,
      voiceConversations: user._count.voiceConversations ?? 0,
    },
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    @Optional() private readonly firebase?: FirebaseTokenService,
    @Optional() private readonly planning?: PlanningService,
    @Optional() private readonly firebaseUsers?: FirebaseUserService,
  ) {}

  async listUsers(
    query: AdminUsersQueryDto,
  ): Promise<PaginatedResult<AdminUserListItem, UsersListSummary>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              ...(UUID_REGEX.test(search) ? [{ id: search }] : []),
            ],
          }
        : {}),
    };

    const [total, rows, totalAll, learnersCount, adminsCount, activeLearners30d] =
      await Promise.all([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          select: ADMIN_USER_SELECT,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.user.count(),
        this.prisma.user.count({ where: { role: UserRole.LEARNER } }),
        this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
        this.prisma.user.count({
          where: {
            role: UserRole.LEARNER,
            OR: [
              { learningAttempts: { some: { startedAt: { gte: thirtyDaysAgo } } } },
              { placementSessions: { some: { startedAt: { gte: thirtyDaysAgo } } } },
              { vocabularyReviews: { some: { startedAt: { gte: thirtyDaysAgo } } } },
              { speakingSubmissions: { some: { createdAt: { gte: thirtyDaysAgo } } } },
              { voiceConversations: { some: { createdAt: { gte: thirtyDaysAgo } } } },
            ],
          },
        }),
      ]);

    return {
      items: rows.map(mapUserItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      summary: {
        total: totalAll,
        activeLearners30d,
        learners: learnersCount,
        admins: adminsCount,
      },
    };
  }

  async createUser(dto: CreateAdminUserDto): Promise<AdminUserListItem> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ADMIN_EMAIL_EXISTS',
        message: 'Email này đã được sử dụng trong hệ thống.',
      });
    }

    const role = dto.role ?? UserRole.LEARNER;
    const firebaseUid = this.firebase?.enabled && role === UserRole.LEARNER ? randomUUID() : undefined;
    const passwordHash = firebaseUid ? null : await this.passwordService.hash(dto.password);
    if (firebaseUid) {
      await this.firebase!.createPasswordUser(firebaseUid, email, dto.password, dto.name.trim());
    }
    let created: SelectedAdminUser;
    try {
      created = await this.prisma.$transaction((tx) =>
        tx.user.create({
          data: {
            email,
            name: dto.name.trim(),
            passwordHash,
            ...(firebaseUid ? { firebaseUid } : {}),
            provider: AuthProvider.LOCAL,
            role,
            status: UserStatus.ACTIVE,
            profile: {
              create: {
                targetCefr: dto.targetCefr ?? CefrLevel.B1,
                dailyGoalMinutes: 10,
                reminderEnabled: true,
              },
            },
          },
          select: ADMIN_USER_SELECT,
        }),
      );
    } catch (error) {
      if (firebaseUid) {
        try {
          await this.firebase!.removeProvisionedUser(firebaseUid);
        } catch {
          throw new ServiceUnavailableException({
            code: 'ADMIN_FIREBASE_CLEANUP_FAILED',
            message:
              'Tạo tài khoản chưa hoàn tất; không thể thu hồi danh tính Firebase mới. Cần quản trị viên kiểm tra trước khi thử lại.',
          });
        }
      }
      throw error;
    }

    if (firebaseUid) {
      try {
        await this.firebase!.activatePasswordUser(firebaseUid);
      } catch (error) {
        const [dbCleanup, firebaseCleanup] = await Promise.allSettled([
          this.prisma.user.delete({ where: { id: created.id } }),
          this.firebase!.removeProvisionedUser(firebaseUid),
        ]);
        if (
          dbCleanup.status === 'rejected' ||
          firebaseCleanup.status === 'rejected'
        ) {
          throw new ServiceUnavailableException({
            code: 'ADMIN_FIREBASE_CLEANUP_FAILED',
            message:
              'Kích hoạt tài khoản Firebase thất bại và không thể hoàn tác đầy đủ dữ liệu đã tạo. Cần quản trị viên kiểm tra trước khi thử lại.',
          });
        }
        throw error;
      }
    }

    return mapUserItem(created);
  }

  async getUserDetail(id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
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
      this.prisma.learningAttempt.findMany({
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
      this.prisma.placementSession.findMany({
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
      this.prisma.speakingSubmission.findMany({
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
      this.prisma.learningSkillLevel?.findMany({
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
      this.prisma.learningSkillLevelEvent?.findMany({
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
      this.prisma.learningDayPlan?.findUnique({
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
      this.prisma.learningAnswerExposure?.count({
        where: { userId: id },
      }) ?? Promise.resolve(0),
      this.prisma.voiceConversation?.findMany({
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
          ((a.lessonSnapshot as { title?: string } | null)?.title ?? 'Bài học'),
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
          ((s.promptSnapshot as { title?: string } | null)?.title ?? 'Luyện nói'),
        status: s.status,
        overallScore: extractSpeakingOverallScore(s.result),
        createdAt: s.createdAt,
      })),
    };
  }

  async updateUser(
    adminId: string,
    targetId: string,
    dto: UpdateAdminUserDto,
  ): Promise<AdminUserListItem> {
    if (
      adminId === targetId &&
      ((dto.role !== undefined && dto.role !== UserRole.ADMIN) ||
        (dto.status !== undefined && dto.status !== UserStatus.ACTIVE))
    ) {
      throw new BadRequestException({
        code: 'ADMIN_SELF_MODIFICATION_FORBIDDEN',
        message:
          'Không thể tự hạ quyền hoặc tự khóa tài khoản của chính bạn.',
      });
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, firebaseUid: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const passwordHash = dto.password
      ? await this.passwordService.hash(dto.password)
      : undefined;

    if (dto.password && this.firebase?.enabled && existing.firebaseUid) {
      await this.firebase.resetPassword(existing.firebaseUid, dto.password);
    }

    const shouldRevokeSessions =
      (dto.status !== undefined && dto.status !== UserStatus.ACTIVE) ||
      dto.role !== undefined ||
      Boolean(passwordHash);

    const preferredKinds = dto.preferredKinds
      ? [...new Set(dto.preferredKinds)]
      : undefined;

    const hasGoalChanges =
      dto.targetCefr !== undefined ||
      dto.dailyGoalMinutes !== undefined ||
      dto.learningPurpose !== undefined ||
      preferredKinds !== undefined ||
      dto.selfAssessedCefr !== undefined;

    const hasReminderChanges =
      dto.reminderEnabled !== undefined || dto.reminderTime !== undefined;

    const hasProfileChanges = hasGoalChanges || hasReminderChanges;

    const runUpdate = async (tx: Prisma.TransactionClient) => {
      if (hasProfileChanges) {
        await tx.userProfile.upsert({
          where: { userId: targetId },
          create: {
            userId: targetId,
            targetCefr: dto.targetCefr ?? CefrLevel.B1,
            dailyGoalMinutes: dto.dailyGoalMinutes ?? 10,
            learningPurpose: dto.learningPurpose ?? null,
            ...(preferredKinds !== undefined ? { preferredKinds } : {}),
            ...(dto.selfAssessedCefr !== undefined
              ? { selfAssessedCefr: dto.selfAssessedCefr }
              : {}),
            reminderEnabled: dto.reminderEnabled ?? true,
            ...(dto.reminderTime !== undefined
              ? { reminderTime: dto.reminderTime }
              : {}),
          },
          update: {
            ...(dto.targetCefr !== undefined ? { targetCefr: dto.targetCefr } : {}),
            ...(dto.dailyGoalMinutes !== undefined
              ? { dailyGoalMinutes: dto.dailyGoalMinutes }
              : {}),
            ...(dto.learningPurpose !== undefined
              ? { learningPurpose: dto.learningPurpose }
              : {}),
            ...(preferredKinds !== undefined ? { preferredKinds } : {}),
            ...(dto.selfAssessedCefr !== undefined
              ? { selfAssessedCefr: dto.selfAssessedCefr }
              : {}),
            ...(dto.reminderEnabled !== undefined
              ? { reminderEnabled: dto.reminderEnabled }
              : {}),
            ...(dto.reminderTime !== undefined
              ? { reminderTime: dto.reminderTime }
              : {}),
            ...(hasGoalChanges ? { preferencesVersion: { increment: 1 } } : {}),
            ...(hasReminderChanges ? { reminderVersion: { increment: 1 } } : {}),
          },
        });
      }

      const user = await tx.user.update({
        where: { id: targetId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
          ...(shouldRevokeSessions ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: ADMIN_USER_SELECT,
      });

      if (shouldRevokeSessions) {
        await tx.refreshSession.updateMany({
          where: { userId: targetId, isRevoked: false },
          data: { isRevoked: true },
        });
      }

      return user;
    };

    const updated =
      hasGoalChanges && this.planning
        ? await this.planning.updateAccountProfile(targetId, runUpdate, () => true)
        : await this.prisma.$transaction(runUpdate);

    this.firebaseUsers?.invalidateCache(existing.firebaseUid ?? targetId);
    this.firebaseUsers?.invalidateCache(targetId);

    if (this.firebase?.enabled && existing.firebaseUid) {
      if (typeof this.firebase.setDisabled === 'function') {
        if (dto.status === UserStatus.ACTIVE && existing.status !== UserStatus.ACTIVE) {
          await this.firebase.setDisabled(existing.firebaseUid, false);
        } else if (
          dto.status === UserStatus.SUSPENDED ||
          dto.status === UserStatus.DELETED
        ) {
          await this.firebase.setDisabled(existing.firebaseUid, true);
        }
      }
      if (shouldRevokeSessions && !dto.password) {
        await this.firebase.revoke(existing.firebaseUid);
      }
    }

    return mapUserItem(updated);
  }

  async deleteUser(
    adminId: string,
    targetId: string,
    hard = false,
  ): Promise<{ id: string; action: 'HARD_DELETED' | 'SOFT_DELETED' }> {
    if (adminId === targetId) {
      throw new BadRequestException({
        code: 'ADMIN_SELF_DELETE_FORBIDDEN',
        message: 'Không thể tự xoá tài khoản quản trị đang đăng nhập.',
      });
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, firebaseUid: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng.',
      });
    }

    if (hard) {
      if (this.firebase?.enabled && existing.firebaseUid) {
        try {
          await this.firebase.deleteUser(existing.firebaseUid);
        } catch (error) {
          if (error instanceof ServiceUnavailableException) {
            throw error;
          }
          throw new ServiceUnavailableException({
            code: 'ADMIN_FIREBASE_DELETE_FAILED',
            message:
              'Không thể xoá danh tính Firebase. Dữ liệu tài khoản trong DB vẫn được giữ nguyên.',
          });
        }
      }
      await this.prisma.user.delete({ where: { id: targetId } });
      this.firebaseUsers?.invalidateCache(existing.firebaseUid ?? targetId);
      this.firebaseUsers?.invalidateCache(targetId);
      return {
        id: targetId,
        action: 'HARD_DELETED',
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetId },
        data: { status: UserStatus.DELETED, tokenVersion: { increment: 1 } },
      });
      await tx.refreshSession.updateMany({
        where: { userId: targetId, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    this.firebaseUsers?.invalidateCache(existing.firebaseUid ?? targetId);
    this.firebaseUsers?.invalidateCache(targetId);

    if (this.firebase?.enabled && existing.firebaseUid) {
      if (typeof this.firebase.setDisabled === 'function') {
        await this.firebase.setDisabled(existing.firebaseUid, true).catch(() => undefined);
      }
      await this.firebase.revoke(existing.firebaseUid).catch(() => undefined);
    }

    return {
      id: targetId,
      action: 'SOFT_DELETED',
    };
  }

  async overrideSkillLevel(
    userId: string,
    kind: LearningKind,
    dto: OverrideUserSkillLevelDto,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existingUser) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const write = async (tx: Prisma.TransactionClient) => {
      const current = await tx.learningSkillLevel.findUnique({
        where: { userId_kind: { userId, kind } },
      });
      const now = new Date();
      const skillLevel = await tx.learningSkillLevel.upsert({
        where: { userId_kind: { userId, kind } },
        create: {
          userId,
          kind,
          cefrLevel: dto.cefrLevel,
          source: SkillLevelSource.ADAPTIVE,
          previousCefr: null,
          changedAt: now,
        },
        update: {
          cefrLevel: dto.cefrLevel,
          source: SkillLevelSource.ADAPTIVE,
          previousCefr: current?.cefrLevel ?? null,
          changedAt: now,
        },
      });

      let resetExposuresCount = 0;
      if (dto.resetExposures) {
        const deleted = await tx.learningAnswerExposure.deleteMany({
          where: { userId, lesson: { kind } },
        });
        resetExposuresCount = deleted.count;
      }

      return { skillLevel, resetExposuresCount };
    };

    return this.planning
      ? this.planning.updateAccountProfile(userId, write, () => true)
      : this.prisma.$transaction(write);
  }

  async getPlacementSessionDetail(userId: string, sessionId: string) {
    const session = await this.prisma.placementSession.findFirst({
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

  async resetPlacementRetake(
    userId: string,
    dto: ResetPlacementRetakeDto = {},
  ): Promise<{
    userId: string;
    abandonedSessionsCount: number;
    resetSkillLevelsCount: number;
  }> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
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

  async listUserSessions(userId: string): Promise<AdminUserSessionView[]> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng.',
      });
    }

    return this.prisma.refreshSession.findMany({
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

  async revokeUserSession(
    userId: string,
    sessionId: string,
  ): Promise<{ id: string; revoked: boolean }> {
    const session = await this.prisma.refreshSession.findFirst({
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
      await this.prisma.refreshSession.update({
        where: { id: sessionId },
        data: { isRevoked: true },
      });
    }

    return { id: sessionId, revoked: true };
  }

  async revokeAllUserSessions(
    userId: string,
  ): Promise<{ userId: string; revokedSessionsCount: number }> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firebaseUid: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_USER_NOT_FOUND',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const revokedCount = await this.prisma.$transaction(async (tx) => {
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

    this.firebaseUsers?.invalidateCache(existing.firebaseUid ?? userId);
    this.firebaseUsers?.invalidateCache(userId);

    if (this.firebase?.enabled && existing.firebaseUid) {
      await this.firebase.revoke(existing.firebaseUid);
    }

    return {
      userId,
      revokedSessionsCount: revokedCount,
    };
  }

  async exportUserData(
    userId: string,
  ): Promise<{ filename: string; contentType: string; body: string }> {
    const user = await this.prisma.user.findUnique({
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
}
