import { Injectable } from '@nestjs/common';
import { Prisma, User, UserProfile, UserRole, UserStatus, CefrLevel, AuthProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type UserWithProfile = User & { profile: UserProfile | null };

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
  }

  async findById(id: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
  }

  async findByFirebaseUid(firebaseUid: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { profile: true },
    });
  }

  async createGoogleLearnerWithProfileAndSession(data: {
    email: string;
    name: string;
    firebaseUid: string;
    avatarUrl?: string | null;
    tokenHash: string;
    sessionExpiresAt: Date;
    targetCefr?: CefrLevel;
    dailyGoalMinutes?: number;
    reminderEnabled?: boolean;
    deviceIdentifier?: string;
    ipAddress?: string;
  }): Promise<UserWithProfile> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          firebaseUid: data.firebaseUid,
          avatarUrl: data.avatarUrl,
          provider: AuthProvider.GOOGLE,
          role: UserRole.LEARNER,
          status: UserStatus.ACTIVE,
        },
      });

      const profile = await tx.userProfile.create({
        data: {
          userId: user.id,
          targetCefr: data.targetCefr ?? CefrLevel.B1,
          dailyGoalMinutes: data.dailyGoalMinutes ?? 10,
          reminderEnabled: data.reminderEnabled ?? true,
        },
      });

      await tx.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: data.tokenHash,
          deviceIdentifier: data.deviceIdentifier,
          ipAddress: data.ipAddress,
          expiresAt: data.sessionExpiresAt,
          isRevoked: false,
        },
      });

      return { ...user, profile };
    });
  }

  async linkFirebaseUid(
    userId: string,
    data: { firebaseUid: string; avatarUrl?: string | null },
  ): Promise<UserWithProfile> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firebaseUid: data.firebaseUid,
        ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
      },
      include: { profile: true },
    });
  }

  async createLearnerWithProfileAndSession(data: {
    email: string;
    passwordHash: string;
    name: string;
    tokenHash: string;
    sessionExpiresAt: Date;
    targetCefr?: CefrLevel;
    dailyGoalMinutes?: number;
    reminderEnabled?: boolean;
    deviceIdentifier?: string;
    ipAddress?: string;
  }): Promise<UserWithProfile> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.name,
          role: UserRole.LEARNER,
          status: UserStatus.ACTIVE,
        },
      });

      const profile = await tx.userProfile.create({
        data: {
          userId: user.id,
          targetCefr: data.targetCefr ?? CefrLevel.B1,
          dailyGoalMinutes: data.dailyGoalMinutes ?? 10,
          reminderEnabled: data.reminderEnabled ?? true,
        },
      });

      await tx.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: data.tokenHash,
          deviceIdentifier: data.deviceIdentifier,
          ipAddress: data.ipAddress,
          expiresAt: data.sessionExpiresAt,
          isRevoked: false,
        },
      });

      return { ...user, profile };
    });
  }

  async updatePassword(
    userId: string,
    newPasswordHash: string,
    tx?: Prisma.TransactionClient,
  ): Promise<User> {
    const client = tx || this.prisma;
    return client.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }
}