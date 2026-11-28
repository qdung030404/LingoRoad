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
  Prisma,
  SkillLevelSource,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { FirebaseTokenService } from '../../auth/firebase/firebase-token.service';
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
import {
  exportUserDataOp,
  getPlacementSessionDetailOp,
  getUserDetailOp,
  listUserSessionsOp,
  resetPlacementRetakeOp,
  revokeAllUserSessionsOp,
  revokeUserSessionOp,
} from './users/admin-users-detail.helper';
import {
  ADMIN_USER_SELECT,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserSessionView,
  mapUserItem,
  PaginatedResult,
  SelectedAdminUser,
  UsersListSummary,
} from './users/admin-users.types';

export { extractSpeakingOverallScore } from './users/admin-users.types';
export type {
  AdminUserDetail,
  AdminUserListItem,
  AdminUserSessionView,
  PaginatedResult,
  UsersListSummary,
} from './users/admin-users.types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    @Optional() private readonly firebase?: FirebaseTokenService,
    @Optional() private readonly planning?: PlanningService,
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
    const firebaseUid =
      this.firebase?.enabled && role === UserRole.LEARNER
        ? randomUUID()
        : undefined;
    const passwordHash = firebaseUid
      ? null
      : await this.passwordService.hash(dto.password);
    if (firebaseUid) {
      await this.firebase!.createPasswordUser(
        firebaseUid,
        email,
        dto.password,
        dto.name.trim(),
      );
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

  getUserDetail(id: string): Promise<AdminUserDetail> {
    return getUserDetailOp(this.prisma, id);
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
      return { id: targetId, action: 'HARD_DELETED' };
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

    if (this.firebase?.enabled && existing.firebaseUid) {
      if (typeof this.firebase.setDisabled === 'function') {
        await this.firebase.setDisabled(existing.firebaseUid, true).catch(() => undefined);
      }
      await this.firebase.revoke(existing.firebaseUid).catch(() => undefined);
    }

    return { id: targetId, action: 'SOFT_DELETED' };
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

  getPlacementSessionDetail(userId: string, sessionId: string) {
    return getPlacementSessionDetailOp(this.prisma, userId, sessionId);
  }

  resetPlacementRetake(userId: string, dto: ResetPlacementRetakeDto = {}) {
    return resetPlacementRetakeOp(this.prisma, userId, dto);
  }

  listUserSessions(userId: string): Promise<AdminUserSessionView[]> {
    return listUserSessionsOp(this.prisma, userId);
  }

  revokeUserSession(
    userId: string,
    sessionId: string,
  ): Promise<{ id: string; revoked: boolean }> {
    return revokeUserSessionOp(this.prisma, userId, sessionId);
  }

  revokeAllUserSessions(
    userId: string,
  ): Promise<{ userId: string; revokedSessionsCount: number }> {
    return revokeAllUserSessionsOp(this.prisma, userId, this.firebase);
  }

  exportUserData(
    userId: string,
  ): Promise<{ filename: string; contentType: string; body: string }> {
    return exportUserDataOp(this.prisma, userId);
  }
}
