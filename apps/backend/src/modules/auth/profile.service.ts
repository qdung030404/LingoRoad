import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FirebaseUserService } from './firebase/firebase-user.service';
import {
  PlanningService,
  readPreferredSkillsForUser,
  writePreferredSkillsForUser,
} from '../planning/planning.service';
import { PreferredSkill } from '../planning/planning.dto';
import { LearningKind, Prisma } from '@prisma/client';

const safeAccount = {
  id: true, name: true, email: true, role: true, status: true,
  avatarUrl: true, provider: true,
  createdAt: true, profile: true,
} as const;

const LESSON_KIND_SET = new Set<string>(Object.values(LearningKind));
function isLessonKind(value: string): value is LearningKind {
  return LESSON_KIND_SET.has(value);
}

function normalizeAccountProfile<T extends { profile?: Record<string, any> | null } | null>(
  account: T,
  storedSkills?: PreferredSkill[] | null,
): T {
  if (!account?.profile) return account;
  const skills = storedSkills ?? account.profile.preferredSkills;
  if (Array.isArray(skills) && skills.length > 0) {
    return {
      ...account,
      profile: {
        ...account.profile,
        preferredKinds: skills,
      },
    };
  }
  return account;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly planning?: PlanningService,
    @Optional() private readonly firebaseUsers?: FirebaseUserService,
  ) {}

  async get(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: safeAccount });
    if (!user) throw new NotFoundException({ code: 'AUTH_USER_NOT_FOUND', message: 'Không tìm thấy tài khoản.' });
    const storedSkills = await readPreferredSkillsForUser(
      this.prisma,
      userId,
      user.profile?.preferredKinds,
    );
    return normalizeAccountProfile(user, storedSkills);
  }

  private hasGoalMutation(dto: UpdateProfileDto): boolean {
    return (
      dto.learningPurpose !== undefined ||
      dto.targetCefr !== undefined ||
      dto.dailyGoalMinutes !== undefined ||
      dto.preferredKinds !== undefined ||
      dto.selfAssessedCefr !== undefined
    );
  }

  private hasReminderMutation(dto: UpdateProfileDto): boolean {
    return dto.reminderEnabled !== undefined || dto.reminderTime !== undefined;
  }

  private didGoalChange(
    dto: UpdateProfileDto,
    current: {
      learningPurpose?: string | null;
      targetCefr?: string;
      dailyGoalMinutes?: number;
      preferredKinds?: string[];
      preferredSkills?: string[];
      selfAssessedCefr?: string | null;
    } | null | undefined,
    preferredSkills?: string[],
  ): boolean {
    if (!current) return this.hasGoalMutation(dto);
    const existingSkills =
      Array.isArray(current.preferredSkills) && current.preferredSkills.length > 0
        ? current.preferredSkills
        : (current.preferredKinds ?? []);
    const sameKinds =
      preferredSkills === undefined ||
      (existingSkills.length === preferredSkills.length &&
        existingSkills.every((k, i) => k === preferredSkills[i]));
    return (
      (dto.learningPurpose !== undefined && dto.learningPurpose !== current.learningPurpose) ||
      (dto.targetCefr !== undefined && dto.targetCefr !== current.targetCefr) ||
      (dto.dailyGoalMinutes !== undefined && dto.dailyGoalMinutes !== current.dailyGoalMinutes) ||
      (dto.selfAssessedCefr !== undefined && dto.selfAssessedCefr !== current.selfAssessedCefr) ||
      !sameKinds
    );
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const account = await this.get(userId);
    const {
      name,
      avatarUrl,
      expectedVersion,
      expectedReminderVersion,
      preferredKinds: rawPreferredKinds,
      ...restFields
    } = dto;
    const preferredSkills = rawPreferredKinds ? [...new Set(rawPreferredKinds)] : undefined;
    const lessonKinds = preferredSkills?.filter(isLessonKind);
    const profileFields = {
      ...restFields,
      ...(lessonKinds && lessonKinds.length > 0 ? { preferredKinds: lessonKinds } : {}),
    };
    const completed = dto.learningPurpose != null && dto.dailyGoalMinutes != null;
    const touchesGoals = this.hasGoalMutation(dto);
    const touchesReminder = this.hasReminderMutation(dto);
    let shouldReconcilePlan = false;

    const write = async (db: Prisma.TransactionClient) => {
      const current = 'userProfile' in db && db.userProfile?.findUnique
        ? await db.userProfile.findUnique({ where: { userId } })
        : account.profile;

      if (touchesGoals) {
        const currentPrefVersion = current?.preferencesVersion ?? 0;
        if (current?.onboardingCompletedAt != null) {
          if (expectedVersion === undefined) {
            throw new BadRequestException({
              code: 'LEARNING_PREFERENCES_VERSION_REQUIRED',
              message: 'Cần phiên bản mục tiêu học tập hiện tại để cập nhật.',
            });
          }
          if (expectedVersion !== currentPrefVersion) {
            throw new ConflictException({
              code: 'LEARNING_PREFERENCES_CONFLICT',
              message: 'Thiết lập đã thay đổi. Hãy tải lại trước khi lưu.',
            });
          }
        } else if (expectedVersion !== undefined && expectedVersion !== currentPrefVersion) {
          throw new ConflictException({
            code: 'LEARNING_PREFERENCES_CONFLICT',
            message: 'Thiết lập đã thay đổi. Hãy tải lại trước khi lưu.',
          });
        }
      }

      if (touchesReminder && current != null) {
        const currentReminderVersion = current.reminderVersion ?? 0;
        if (expectedReminderVersion === undefined) {
          throw new BadRequestException({
            code: 'REMINDER_VERSION_REQUIRED',
            message: 'Cần phiên bản cài đặt nhắc học hiện tại để lưu.',
          });
        }
        if (expectedReminderVersion !== currentReminderVersion) {
          throw new ConflictException({
            code: 'REMINDER_VERSION_CONFLICT',
            message: 'Cài đặt nhắc học đã được cập nhật bởi thao tác mới hơn.',
          });
        }
      }

      const goalChanged = this.didGoalChange(dto, current, preferredSkills);
      const reminderChanged =
        (dto.reminderEnabled !== undefined && dto.reminderEnabled !== (current?.reminderEnabled ?? true)) ||
        (dto.reminderTime !== undefined && dto.reminderTime !== (current?.reminderTime ?? '19:30'));
      shouldReconcilePlan = goalChanged;

      const updatedUser = await db.user.update({
        where: { id: userId },
        data: {
          ...(name === undefined ? {} : { name }),
          ...(avatarUrl === undefined ? {} : { avatarUrl }),
          profile: {
            upsert: {
              create: {
                ...profileFields,
                onboardingCompletedAt: completed ? new Date() : null,
              },
              update: {
                ...profileFields,
                ...(goalChanged ? { preferencesVersion: { increment: 1 } } : {}),
                ...(reminderChanged ? { reminderVersion: { increment: 1 } } : {}),
                ...(completed && !account.profile?.onboardingCompletedAt ? { onboardingCompletedAt: new Date() } : {}),
              },
            },
          },
        },
        select: safeAccount,
      });
      if (preferredSkills !== undefined) {
        await writePreferredSkillsForUser(
          db,
          userId,
          preferredSkills,
          updatedUser.profile?.preferencesVersion,
        );
      }
      return normalizeAccountProfile(updatedUser, preferredSkills);
    };
    const updated = this.planning
      ? await this.planning.updateAccountProfile(userId, write, () => shouldReconcilePlan)
      : await write(this.prisma);
    this.firebaseUsers?.invalidateCache(userId);
    return updated;
  }
}
