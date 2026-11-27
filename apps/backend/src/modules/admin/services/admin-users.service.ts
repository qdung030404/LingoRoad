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
  LearningPurpose,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { FirebaseTokenService } from '../../auth/firebase/firebase-token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
import {
  AdminUsersQueryDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
} from '../dto/admin-users.dto';

const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
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
    },
  },
  _count: {
    select: {
      learningAttempts: true,
      placementSessions: true,
      vocabularyDecks: true,
      speakingSubmissions: true,
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
  provider: AuthProvider;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  profile: {
    targetCefr: CefrLevel;
    dailyGoalMinutes: number;
    learningPurpose?: LearningPurpose | null;
  } | null;
  stats: {
    learningAttempts: number;
    placementSessions: number;
    vocabularyDecks: number;
    speakingSubmissions: number;
  };
}

export interface AdminUserDetail extends AdminUserListItem {
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

function mapUserItem(user: SelectedAdminUser): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
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
        }
      : null,
    stats: {
      learningAttempts: user._count.learningAttempts,
      placementSessions: user._count.placementSessions,
      vocabularyDecks: user._count.vocabularyDecks,
      speakingSubmissions: user._count.speakingSubmissions,
    },
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    @Optional() private readonly firebase?: FirebaseTokenService,
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

    const [attempts, placements, speakings] = await Promise.all([
      this.prisma.learningAttempt.findMany({
        where: { userId: id },
        orderBy: [{ startedAt: 'desc' }],
        take: 5,
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
        take: 5,
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
        take: 5,
        select: {
          id: true,
          status: true,
          promptSnapshot: true,
          result: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      ...mapUserItem(user),
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
      recentSpeaking: speakings.map((s) => {
        const resObj = (s.result && typeof s.result === 'object' ? s.result : null) as
          | { overallScore?: unknown; score?: unknown }
          | null;
        const rawScore = resObj?.overallScore ?? resObj?.score;
        return {
          id: s.id,
          promptTitle:
            ((s.promptSnapshot as { title?: string } | null)?.title ?? 'Luyện nói'),
          status: s.status,
          overallScore: typeof rawScore === 'number' ? rawScore : null,
          createdAt: s.createdAt,
        };
      }),
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
      select: { id: true, firebaseUid: true },
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

    const hasProfileChanges =
      dto.targetCefr !== undefined ||
      dto.dailyGoalMinutes !== undefined ||
      dto.learningPurpose !== undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (hasProfileChanges) {
        await tx.userProfile.upsert({
          where: { userId: targetId },
          create: {
            userId: targetId,
            targetCefr: dto.targetCefr ?? CefrLevel.B1,
            dailyGoalMinutes: dto.dailyGoalMinutes ?? 10,
            learningPurpose: dto.learningPurpose ?? null,
            reminderEnabled: true,
          },
          update: {
            ...(dto.targetCefr !== undefined ? { targetCefr: dto.targetCefr } : {}),
            ...(dto.dailyGoalMinutes !== undefined
              ? { dailyGoalMinutes: dto.dailyGoalMinutes }
              : {}),
            ...(dto.learningPurpose !== undefined
              ? { learningPurpose: dto.learningPurpose }
              : {}),
            preferencesVersion: { increment: 1 },
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
    });

    if (
      shouldRevokeSessions &&
      !dto.password &&
      this.firebase?.enabled &&
      existing.firebaseUid
    ) {
      await this.firebase.revoke(existing.firebaseUid);
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
      await this.prisma.user.delete({ where: { id: targetId } });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: targetId },
          data: { status: UserStatus.DELETED },
        });
        await tx.refreshSession.updateMany({
          where: { userId: targetId, isRevoked: false },
          data: { isRevoked: true },
        });
      });
    }

    if (this.firebase?.enabled && existing.firebaseUid) {
      await this.firebase.revoke(existing.firebaseUid).catch(() => undefined);
    }

    return {
      id: targetId,
      action: hard ? 'HARD_DELETED' : 'SOFT_DELETED',
    };
  }
}
