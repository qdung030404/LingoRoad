import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PlanningService } from '../planning/planning.service';
import { Prisma } from '@prisma/client';

const safeAccount = {
  id: true, name: true, email: true, role: true, status: true,
  createdAt: true, profile: true,
} as const;

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly planning?: PlanningService) {}

  async get(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: safeAccount });
    if (!user) throw new NotFoundException({ code: 'AUTH_USER_NOT_FOUND', message: 'Không tìm thấy tài khoản.' });
    return user;
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const account = await this.get(userId);
    const { name, ...fields } = dto;
    const completed = dto.learningPurpose != null && dto.dailyGoalMinutes != null;
    const write = async (db: Prisma.TransactionClient) => {
      const current = this.planning ? await db.userProfile.findUnique({ where: { userId } }) : account.profile;
      const goalChanged = dto.dailyGoalMinutes !== undefined && dto.dailyGoalMinutes !== current?.dailyGoalMinutes;
      return db.user.update({
      where: { id: userId },
      data: {
        ...(name === undefined ? {} : { name }),
        profile: {
          upsert: {
            create: { ...fields, onboardingCompletedAt: completed ? new Date() : null },
            update: { ...fields, ...(goalChanged ? { preferencesVersion: { increment: 1 } } : {}), ...(completed && !account.profile?.onboardingCompletedAt ? { onboardingCompletedAt: new Date() } : {}) },
          },
        },
      },
      select: safeAccount,
      });
    };
    return this.planning ? this.planning.updateAccountProfile(userId, write) : write(this.prisma);
  }
}
