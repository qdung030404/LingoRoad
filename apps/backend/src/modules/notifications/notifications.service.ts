import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationTargetType, NotificationType, Prisma, UserNotification } from '@prisma/client';
import { DAY_MS, learningDate, learningDayStart, PlanItem } from '../planning/planning.helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationInput, NotificationView } from './notifications.dto';

type Db = Prisma.TransactionClient | PrismaService;

const DAILY_CHECK_COMPLETE_TTL_MS = 5 * 60_000;
const DAILY_CHECK_INCOMPLETE_TTL_MS = 60_000;
const DAILY_CHECK_MAX_ENTRIES = 2_000;

function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return true;
  }
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002');
}

@Injectable()
export class NotificationsService {
  private readonly dailyCheckMemo = new Map<string, number>();
  private readonly dailyCheckInFlight = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  invalidateDailyCheck(userId?: string): void {
    if (!userId) {
      this.dailyCheckMemo.clear();
      return;
    }
    const prefix = `${userId}:`;
    for (const key of this.dailyCheckMemo.keys()) {
      if (key.startsWith(prefix)) {
        this.dailyCheckMemo.delete(key);
      }
    }
  }

  private setDailyCheckMemo(
    memoKey: string,
    date: string,
    nowMs: number,
    ttlMs: number,
  ): void {
    if (this.dailyCheckMemo.has(memoKey)) {
      this.dailyCheckMemo.delete(memoKey);
    } else if (this.dailyCheckMemo.size >= DAILY_CHECK_MAX_ENTRIES) {
      const oldestKey = this.dailyCheckMemo.keys().next().value;
      if (oldestKey !== undefined) {
        this.dailyCheckMemo.delete(oldestKey);
      }
    }
    const nextDayStartMs = learningDayStart(date).getTime() + DAY_MS;
    const expiresAt = Math.min(nowMs + ttlMs, nextDayStartMs);
    if (expiresAt > nowMs) {
      this.dailyCheckMemo.set(memoKey, expiresAt);
    }
  }

  private toView(
    row: Pick<
      UserNotification,
      'id' | 'type' | 'title' | 'body' | 'targetType' | 'targetPayload' | 'readAt' | 'createdAt'
    >,
  ): NotificationView {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      targetType: row.targetType,
      targetPayload: row.targetPayload ?? null,
      readAt: row.readAt ?? null,
      createdAt: row.createdAt,
    };
  }

  async createNotification(
    input: CreateNotificationInput,
    tx?: Db,
  ): Promise<{ created: boolean; notification?: NotificationView }> {
    const db = tx ?? this.prisma;
    if (!db?.userNotification) {
      return { created: false };
    }

    const dedupeKey = input.dedupeKey.slice(0, 160);
    const title = input.title.slice(0, 200);
    const existing = await db.userNotification.findUnique?.({
      where: { userId_dedupeKey: { userId: input.userId, dedupeKey } },
    });
    if (existing) {
      return { created: false, notification: this.toView(existing) };
    }

    const data: Prisma.UserNotificationCreateManyInput = {
      userId: input.userId,
      type: input.type,
      title,
      body: input.body,
      targetType: input.targetType ?? NotificationTargetType.NONE,
      dedupeKey,
      ...(input.targetPayload != null ? { targetPayload: input.targetPayload } : {}),
    };

    if (typeof db.userNotification.createMany === 'function') {
      const inserted = await db.userNotification.createMany({
        data: [data],
        skipDuplicates: true,
      });
      const saved = await db.userNotification.findUnique?.({
        where: { userId_dedupeKey: { userId: input.userId, dedupeKey } },
      });
      return {
        created: inserted.count > 0,
        ...(saved ? { notification: this.toView(saved) } : {}),
      };
    }

    try {
      const created = await db.userNotification.create({ data });
      return { created: true, notification: this.toView(created) };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const winner = await db.userNotification.findUnique?.({
          where: { userId_dedupeKey: { userId: input.userId, dedupeKey } },
        });
        return {
          created: false,
          ...(winner ? { notification: this.toView(winner) } : {}),
        };
      }
      throw error;
    }
  }

  async ensureDailyNotifications(userId: string): Promise<void> {
    if (!this.prisma.userNotification) return;

    const now = new Date();
    const nowMs = now.getTime();
    const date = learningDate(now);
    const memoKey = `${userId}:${date}`;
    const cachedUntil = this.dailyCheckMemo.get(memoKey);
    if (cachedUntil !== undefined) {
      if (cachedUntil > nowMs) {
        this.dailyCheckMemo.delete(memoKey);
        this.dailyCheckMemo.set(memoKey, cachedUntil);
        return;
      }
      this.dailyCheckMemo.delete(memoKey);
    }

    const existingInFlight = this.dailyCheckInFlight.get(memoKey);
    if (existingInFlight) {
      return existingInFlight;
    }

    const work = this.runEnsureDailyNotifications(userId, date, nowMs).finally(() => {
      if (this.dailyCheckInFlight.get(memoKey) === work) {
        this.dailyCheckInFlight.delete(memoKey);
      }
    });
    this.dailyCheckInFlight.set(memoKey, work);
    return work;
  }

  private async runEnsureDailyNotifications(
    userId: string,
    date: string,
    nowMs: number,
  ): Promise<void> {
    const planKey = `daily_plan:${date}`;
    const vocabKey = `vocab_due:${date}`;
    const memoKey = `${userId}:${date}`;

    const existingRows = this.prisma.userNotification.findMany
      ? await this.prisma.userNotification.findMany({
          where: { userId, dedupeKey: { in: [planKey, vocabKey] } },
          select: { dedupeKey: true },
        })
      : [];
    const existingKeys = new Set(existingRows.map((row) => row.dedupeKey));
    if (existingKeys.has(planKey) && existingKeys.has(vocabKey)) {
      this.setDailyCheckMemo(memoKey, date, nowMs, DAILY_CHECK_COMPLETE_TTL_MS);
      return;
    }

    const ensurePlan = async (): Promise<boolean> => {
      if (existingKeys.has(planKey)) return true;
      if (!this.prisma.learningDayPlan?.findUnique) return false;
      const plan = await this.prisma.learningDayPlan.findUnique({
        where: { userId_date: { userId, date } },
        select: { items: true },
      });
      const items = Array.isArray(plan?.items) ? (plan.items as unknown as PlanItem[]) : [];
      const lessonIds = [
        ...new Set(
          items
            .map((item) => item?.lessonId)
            .filter((lessonId): lessonId is string => typeof lessonId === 'string' && lessonId.length > 0),
        ),
      ];
      if (lessonIds.length === 0) return false;
      const dayStart = learningDayStart(date);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const completedAttempts = this.prisma.learningAttempt?.findMany
        ? await this.prisma.learningAttempt.findMany({
            where: {
              userId,
              lessonId: { in: lessonIds },
              status: 'COMPLETED',
              submittedAt: { gte: dayStart, lt: dayEnd },
            },
            select: { lessonId: true },
          })
        : [];
      const completedLessonIds = new Set(completedAttempts.map((attempt) => attempt.lessonId));
      const remainingCount = items.filter((item) => !completedLessonIds.has(item.lessonId)).length;
      if (remainingCount > 0) {
        await this.createNotification({
          userId,
          type: NotificationType.DAILY_PLAN_READY,
          title: 'Kế hoạch học hôm nay đã sẵn sàng',
          body:
            remainingCount === 1
              ? 'Bạn còn 1 bài học trong kế hoạch hôm nay. Hãy bắt đầu nhé!'
              : `Bạn còn ${remainingCount} bài học trong kế hoạch hôm nay. Hãy bắt đầu nhé!`,
          targetType: NotificationTargetType.DAILY_PLAN,
          targetPayload: { date },
          dedupeKey: planKey,
        });
        return true;
      }
      return false;
    };

    const ensureVocab = async (): Promise<boolean> => {
      if (existingKeys.has(vocabKey)) return true;
      if (!this.prisma.vocabularyWord?.count && !this.prisma.vocabularyReviewAttempt?.findFirst) {
        return false;
      }
      const [needsReviewCount, activeAttempt] = await Promise.all([
        this.prisma.vocabularyWord?.count
          ? this.prisma.vocabularyWord.count({
              where: {
                deletedAt: null,
                learningState: 'NEEDS_REVIEW',
                deck: { userId, deletedAt: null },
              },
            })
          : Promise.resolve(0),
        this.prisma.vocabularyReviewAttempt?.findFirst
          ? this.prisma.vocabularyReviewAttempt.findFirst({
              where: {
                userId,
                status: 'IN_PROGRESS',
                deck: { deletedAt: null },
              },
              orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
              select: { id: true },
            })
          : Promise.resolve(null),
      ]);

      if (needsReviewCount > 0 || activeAttempt) {
        const body =
          activeAttempt && needsReviewCount > 0
            ? `Bạn có phiên ôn tập dang dở và ${needsReviewCount} từ vựng cần ôn lại hôm nay.`
            : activeAttempt
              ? 'Bạn đang có phiên ôn tập từ vựng dang dở. Quay lại hoàn thành nhé!'
              : `Bạn có ${needsReviewCount} từ vựng cần ôn tập hôm nay để ghi nhớ lâu hơn.`;

        await this.createNotification({
          userId,
          type: NotificationType.VOCABULARY_REVIEW_DUE,
          title: 'Từ vựng cần ôn tập',
          body,
          targetType: NotificationTargetType.VOCABULARY_REVIEW,
          targetPayload: {
            needsReviewCount,
            ...(activeAttempt ? { activeAttemptId: activeAttempt.id } : {}),
          },
          dedupeKey: vocabKey,
        });
        return true;
      }
      return false;
    };

    const [hasPlan, hasVocab] = await Promise.all([ensurePlan(), ensureVocab()]);
    this.setDailyCheckMemo(
      memoKey,
      date,
      nowMs,
      hasPlan && hasVocab ? DAILY_CHECK_COMPLETE_TTL_MS : DAILY_CHECK_INCOMPLETE_TTL_MS,
    );
  }

  async list(userId: string, query: { cursor?: string; limit?: number } = {}) {
    await this.ensureDailyNotifications(userId);

    const anchor = query.cursor
      ? await this.prisma.userNotification.findFirst({
          where: { id: query.cursor, userId },
          select: { id: true, createdAt: true },
        })
      : null;

    if (query.cursor && !anchor) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Không tìm thấy thông báo.',
      });
    }

    const rawLimit = query.limit ?? 20;
    const limit = Math.min(50, Math.max(1, Math.trunc(rawLimit)));

    const [rows, unreadCount] = await Promise.all([
      this.prisma.userNotification.findMany({
        where: {
          userId,
          ...(anchor
            ? {
                OR: [
                  { createdAt: { lt: anchor.createdAt } },
                  { createdAt: anchor.createdAt, id: { lt: anchor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      this.unreadCount(userId),
    ]);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: pageRows.map((row) => this.toView(row)),
      nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null,
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    if (!this.prisma.userNotification?.count) return 0;
    return this.prisma.userNotification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(userId: string, id: string) {
    const existing = await this.prisma.userNotification.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Không tìm thấy thông báo.',
      });
    }

    const saved = existing.readAt
      ? existing
      : await this.prisma.userNotification.update({
          where: { id: existing.id },
          data: { readAt: new Date() },
        });
    const unreadCount = await this.unreadCount(userId);
    return {
      item: this.toView(saved),
      unreadCount,
    };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return {
      markedCount: result.count,
      unreadCount: 0,
    };
  }
}
