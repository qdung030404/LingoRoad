import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AuthProvider, CefrLevel, Prisma, UserRole, UserStatus } from '@prisma/client';
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
  } | null;
  stats: {
    learningAttempts: number;
    placementSessions: number;
    vocabularyDecks: number;
    speakingSubmissions: number;
  };
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

    const passwordHash = await this.passwordService.hash(dto.password);
    const created = await this.prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash,
          provider: AuthProvider.LOCAL,
          role: dto.role ?? UserRole.LEARNER,
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
      });
    });

    return mapUserItem(created);
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

    const shouldRevokeSessions =
      (dto.status !== undefined && dto.status !== UserStatus.ACTIVE) ||
      dto.role !== undefined ||
      Boolean(passwordHash);

    const updated = await this.prisma.$transaction(async (tx) => {
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
      dto.status !== undefined &&
      dto.status !== UserStatus.ACTIVE &&
      this.firebase?.enabled &&
      existing.firebaseUid
    ) {
      await this.firebase.revoke(existing.firebaseUid).catch(() => undefined);
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
