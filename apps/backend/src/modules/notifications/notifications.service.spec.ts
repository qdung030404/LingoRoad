import { NotFoundException } from '@nestjs/common';
import { NotificationTargetType, NotificationType, Prisma, SpeakingMode } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SpeakingService } from '../speaking/speaking.service';
import { VoiceConversationsService } from '../speaking/voice-conversations.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

interface StoredNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  targetType: NotificationTargetType;
  targetPayload: Prisma.JsonValue | null;
  dedupeKey: string;
  readAt: Date | null;
  createdAt: Date;
}

function makeNotificationDb(initial: StoredNotification[] = []) {
  const rows: StoredNotification[] = [...initial];
  let seq = initial.length;
  let dayPlan: { items: unknown[] } | null = null;
  let completedLessonIdsToday: string[] = [];
  let needsReviewCount = 0;
  let activeAttempt: { id: string } | null = null;

  const db: Record<string, any> = {
    userNotification: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.userId_dedupeKey) {
          const { userId, dedupeKey } = where.userId_dedupeKey;
          return rows.find((row) => row.userId === userId && row.dedupeKey === dedupeKey) ?? null;
        }
        return rows.find((row) => row.id === where?.id) ?? null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          rows.find(
            (row) =>
              (!where.id || row.id === where.id) &&
              (!where.userId || row.userId === where.userId),
          ) ?? null
        );
      }),
      findMany: jest.fn(async ({ where, take }: any) => {
        let filtered = rows.filter((row) => row.userId === where.userId);
        if (where.dedupeKey?.in) {
          const allowed = new Set<string>(where.dedupeKey.in);
          filtered = filtered.filter((row) => allowed.has(row.dedupeKey));
        }
        if (Array.isArray(where.OR)) {
          const [ltTimeCond, tieCond] = where.OR;
          const anchorTime = ltTimeCond.createdAt.lt as Date;
          const anchorId = tieCond.id.lt as string;
          filtered = filtered.filter(
            (row) =>
              row.createdAt.getTime() < anchorTime.getTime() ||
              (row.createdAt.getTime() === anchorTime.getTime() && row.id < anchorId),
          );
        }
        filtered.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
        );
        return typeof take === 'number' ? filtered.slice(0, take) : filtered;
      }),
      createMany: jest.fn(async ({ data, skipDuplicates }: any) => {
        let count = 0;
        for (const item of data) {
          const duplicate = rows.some(
            (row) => row.userId === item.userId && row.dedupeKey === item.dedupeKey,
          );
          if (duplicate) {
            if (skipDuplicates) continue;
            throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          }
          seq += 1;
          rows.push({
            id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
            userId: item.userId,
            type: item.type,
            title: item.title,
            body: item.body,
            targetType: item.targetType ?? NotificationTargetType.NONE,
            targetPayload: (item.targetPayload ?? null) as Prisma.JsonValue | null,
            dedupeKey: item.dedupeKey,
            readAt: null,
            createdAt: new Date(),
          });
          count += 1;
        }
        return { count };
      }),
      create: jest.fn(async ({ data }: any) => {
        const duplicate = rows.some(
          (row) => row.userId === data.userId && row.dedupeKey === data.dedupeKey,
        );
        if (duplicate) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        seq += 1;
        const created: StoredNotification = {
          id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
          userId: data.userId,
          type: data.type,
          title: data.title,
          body: data.body,
          targetType: data.targetType ?? NotificationTargetType.NONE,
          targetPayload: (data.targetPayload ?? null) as Prisma.JsonValue | null,
          dedupeKey: data.dedupeKey,
          readAt: null,
          createdAt: new Date(),
        };
        rows.push(created);
        return created;
      }),
      count: jest.fn(async ({ where }: any) => {
        return rows.filter(
          (row) =>
            row.userId === where.userId &&
            (where.readAt === null ? row.readAt === null : true),
        ).length;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) throw new Error('Not found');
        Object.assign(row, data);
        return { ...row };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const row of rows) {
          if (row.userId === where.userId && (where.readAt === null ? row.readAt === null : true)) {
            Object.assign(row, data);
            count += 1;
          }
        }
        return { count };
      }),
    },
    learningDayPlan: {
      findUnique: jest.fn(async () => dayPlan),
    },
    learningAttempt: {
      findMany: jest.fn(async () => completedLessonIdsToday.map((lessonId) => ({ lessonId }))),
    },
    vocabularyWord: {
      count: jest.fn(async () => needsReviewCount),
    },
    vocabularyReviewAttempt: {
      findFirst: jest.fn(async () => activeAttempt),
    },
  };

  return {
    db,
    rows,
    setDayPlan: (plan: { items: unknown[] } | null) => {
      dayPlan = plan;
    },
    setCompletedLessonsToday: (lessonIds: string[]) => {
      completedLessonIdsToday = lessonIds;
    },
    setNeedsReviewCount: (count: number) => {
      needsReviewCount = count;
    },
    setActiveAttempt: (attempt: { id: string } | null) => {
      activeAttempt = attempt;
    },
  };
}

describe('NotificationsService', () => {
  const fixedNow = new Date('2026-11-28T03:00:00Z'); // 10:00 VN on 2026-11-28

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates idempotent notifications and never overwrites readAt on duplicate dedupeKey', async () => {
    const store = makeNotificationDb();
    const service = new NotificationsService(store.db as unknown as PrismaService);

    const first = await service.createNotification({
      userId: 'user-1',
      type: NotificationType.DAILY_GOAL_MET,
      title: 'Hoàn thành mục tiêu hôm nay!',
      body: 'Bạn đã học đủ 10 phút hôm nay.',
      targetType: NotificationTargetType.DAILY_PLAN,
      targetPayload: { date: '2026-11-28', dailyGoalMinutes: 10 },
      dedupeKey: 'daily_goal_met:2026-11-28',
    });
    expect(first.created).toBe(true);
    expect(first.notification).toMatchObject({
      type: 'DAILY_GOAL_MET',
      targetType: 'DAILY_PLAN',
      targetPayload: { date: '2026-11-28', dailyGoalMinutes: 10 },
      readAt: null,
    });

    const readTime = new Date('2026-11-28T03:05:00Z');
    jest.setSystemTime(readTime);
    await service.markRead('user-1', first.notification!.id);

    const duplicate = await service.createNotification({
      userId: 'user-1',
      type: NotificationType.DAILY_GOAL_MET,
      title: 'Title mới',
      body: 'Body mới',
      targetType: NotificationTargetType.DAILY_PLAN,
      targetPayload: { date: '2026-11-28', dailyGoalMinutes: 10 },
      dedupeKey: 'daily_goal_met:2026-11-28',
    });
    expect(duplicate.created).toBe(false);
    expect(duplicate.notification?.id).toBe(first.notification!.id);
    expect(duplicate.notification?.readAt).toEqual(readTime);
    expect(store.rows).toHaveLength(1);
  });

  it('handles P2002 race gracefully when falling back to create() and returns safe defaults on partial mocks', async () => {
    const existingRow: StoredNotification = {
      id: '00000000-0000-4000-8000-000000000099',
      userId: 'user-1',
      type: NotificationType.PLACEMENT_COMPLETED,
      title: 'Hoàn thành kiểm tra đầu vào',
      body: 'Trình độ B1',
      targetType: NotificationTargetType.DAILY_PLAN,
      targetPayload: { estimatedCefr: 'B1' },
      dedupeKey: 'placement:sess-1',
      readAt: null,
      createdAt: fixedNow,
    };
    const raceDb = {
      userNotification: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existingRow),
        create: jest
          .fn()
          .mockRejectedValueOnce(
            new Prisma.PrismaClientKnownRequestError('Unique failed', {
              code: 'P2002',
              clientVersion: '5.11.0',
            }),
          ),
      },
    };
    const service = new NotificationsService(raceDb as unknown as PrismaService);
    const res = await service.createNotification({
      userId: 'user-1',
      type: NotificationType.PLACEMENT_COMPLETED,
      title: 'Hoàn thành kiểm tra đầu vào',
      body: 'Trình độ B1',
      targetType: NotificationTargetType.DAILY_PLAN,
      targetPayload: { estimatedCefr: 'B1' },
      dedupeKey: 'placement:sess-1',
    });
    expect(res).toEqual({
      created: false,
      notification: {
        id: existingRow.id,
        type: existingRow.type,
        title: existingRow.title,
        body: existingRow.body,
        targetType: existingRow.targetType,
        targetPayload: existingRow.targetPayload,
        readAt: null,
        createdAt: fixedNow,
      },
    });

    const minimalService = new NotificationsService({} as unknown as PrismaService);
    expect(await minimalService.unreadCount('user-1')).toBe(0);
    expect(
      await minimalService.createNotification({
        userId: 'user-1',
        type: NotificationType.DAILY_PLAN_READY,
        title: 'Test',
        body: 'Test',
        dedupeKey: 'test:1',
      }),
    ).toEqual({ created: false });
  });

  it('materializes DAILY_PLAN_READY and VOCABULARY_REVIEW_DUE lazily per Vietnam date without duplicates', async () => {
    const store = makeNotificationDb();
    store.setDayPlan({
      items: [
        { lessonId: 'lesson-1', title: 'L1' },
        { lessonId: 'lesson-2', title: 'L2' },
      ],
    });
    store.setCompletedLessonsToday(['lesson-1']);
    store.setNeedsReviewCount(4);
    store.setActiveAttempt({ id: 'attempt-vocab-1' });

    const service = new NotificationsService(store.db as unknown as PrismaService);
    await service.ensureDailyNotifications('user-1');

    expect(store.rows).toHaveLength(2);
    expect(store.rows.find((row) => row.type === NotificationType.DAILY_PLAN_READY)).toMatchObject({
      dedupeKey: 'daily_plan:2026-11-28',
      targetType: NotificationTargetType.DAILY_PLAN,
      targetPayload: { date: '2026-11-28' },
    });
    expect(store.rows.find((row) => row.type === NotificationType.VOCABULARY_REVIEW_DUE)).toMatchObject({
      dedupeKey: 'vocab_due:2026-11-28',
      targetType: NotificationTargetType.VOCABULARY_REVIEW,
      targetPayload: { needsReviewCount: 4, activeAttemptId: 'attempt-vocab-1' },
    });

    // Second call on the same day is a fast no-op and does not recreate notifications
    store.db.learningDayPlan.findUnique.mockClear();
    store.db.vocabularyWord.count.mockClear();
    await service.ensureDailyNotifications('user-1');
    expect(store.rows).toHaveLength(2);
    expect(store.db.learningDayPlan.findUnique).not.toHaveBeenCalled();
    expect(store.db.vocabularyWord.count).not.toHaveBeenCalled();
  });

  it('skips DAILY_PLAN_READY when all lessons are done today and skips VOCABULARY_REVIEW_DUE when nothing is due', async () => {
    const store = makeNotificationDb();
    store.setDayPlan({ items: [{ lessonId: 'lesson-1' }] });
    store.setCompletedLessonsToday(['lesson-1']);
    store.setNeedsReviewCount(0);
    store.setActiveAttempt(null);

    const service = new NotificationsService(store.db as unknown as PrismaService);
    await service.ensureDailyNotifications('user-1');

    expect(store.rows).toHaveLength(0);
  });

  it('paginates with cursor (createdAt DESC, id DESC), enforces ownership, and marks read / read-all', async () => {
    const t1 = new Date('2026-11-28T01:00:00Z');
    const t2 = new Date('2026-11-28T02:00:00Z');
    const store = makeNotificationDb([
      {
        id: '00000000-0000-4000-8000-000000000001',
        userId: 'user-1',
        type: NotificationType.DAILY_PLAN_READY,
        title: 'N1',
        body: 'B1',
        targetType: NotificationTargetType.DAILY_PLAN,
        targetPayload: { date: '2026-11-28' },
        dedupeKey: 'daily_plan:2026-11-28',
        readAt: null,
        createdAt: t1,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        userId: 'user-1',
        type: NotificationType.DAILY_GOAL_MET,
        title: 'N2',
        body: 'B2',
        targetType: NotificationTargetType.DAILY_PLAN,
        targetPayload: { date: '2026-11-28', dailyGoalMinutes: 10 },
        dedupeKey: 'daily_goal_met:2026-11-28',
        readAt: null,
        createdAt: t2,
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        userId: 'user-1',
        type: NotificationType.SPEAKING_RESULT_READY,
        title: 'N3',
        body: 'B3',
        targetType: NotificationTargetType.SPEAKING,
        targetPayload: { submissionId: 'sub-1' },
        dedupeKey: 'speaking:sub-1',
        readAt: null,
        createdAt: t2,
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        userId: 'user-2',
        type: NotificationType.DAILY_PLAN_READY,
        title: 'Other',
        body: 'Other',
        targetType: NotificationTargetType.DAILY_PLAN,
        targetPayload: null,
        dedupeKey: 'daily_plan:2026-11-28',
        readAt: null,
        createdAt: t2,
      },
    ]);

    const service = new NotificationsService(store.db as unknown as PrismaService);
    const controller = new NotificationsController(service);

    const page1 = await controller.list('user-1', { limit: 2 });
    expect(page1.success).toBe(true);
    expect(page1.data.items.map((item) => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000002',
    ]);
    expect(page1.data.nextCursor).toBe('00000000-0000-4000-8000-000000000002');
    expect(page1.data.unreadCount).toBe(3);

    const page2 = await service.list('user-1', { cursor: page1.data.nextCursor!, limit: 2 });
    expect(page2.items.map((item) => item.id)).toEqual(['00000000-0000-4000-8000-000000000001']);
    expect(page2.nextCursor).toBeNull();

    // Foreign cursor is rejected with 404
    await expect(
      service.list('user-1', { cursor: '00000000-0000-4000-8000-000000000004' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Foreign markRead is rejected with 404
    await expect(
      controller.markRead('user-1', '00000000-0000-4000-8000-000000000004'),
    ).rejects.toBeInstanceOf(NotFoundException);

    // markRead sets readAt once and preserves timestamp on replay
    const marked = await controller.markRead('user-1', '00000000-0000-4000-8000-000000000003');
    expect(marked.success).toBe(true);
    expect(marked.data.item.readAt).toEqual(fixedNow);
    expect(marked.data.unreadCount).toBe(2);

    jest.setSystemTime(new Date('2026-11-28T04:00:00Z'));
    const reMarked = await service.markRead('user-1', '00000000-0000-4000-8000-000000000003');
    expect(reMarked.item.readAt).toEqual(fixedNow);
    expect(reMarked.unreadCount).toBe(2);

    // markAllRead marks remaining unread for user-1 only
    const allRead = await controller.markAllRead('user-1');
    expect(allRead).toEqual({
      success: true,
      data: { markedCount: 2, unreadCount: 0 },
    });
    expect(await service.unreadCount('user-1')).toBe(0);
    expect(await service.unreadCount('user-2')).toBe(1);
  });
});

describe('Speaking and VoiceConversation notification triggers', () => {
  function makeValidWavBuffer(): Buffer {
    const sampleRate = 16000;
    const dataSize = sampleRate * 2; // 1 second of 16-bit mono PCM
    const buffer = Buffer.alloc(44 + dataSize);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    buffer.fill(1, 44);
    return buffer;
  }

  it('creates SPEAKING_RESULT_READY when ReadAloud upload succeeds', async () => {
    const wav = makeValidWavBuffer();
    const audioHash = createHash('sha256').update(wav).digest('hex');
    let submission: any = {
      id: 'sub-read-1',
      userId: 'user-1',
      promptId: 'prompt-1',
      status: 'CREATED',
      audioHash: null,
      promptSnapshot: {
        text: 'Hello world',
        mode: SpeakingMode.READ_ALOUD,
        maxDurationSeconds: 30,
        assessmentProfile: 'read-aloud-v1',
      },
    };
    const prisma: any = {
      speakingSubmission: {
        findMany: jest.fn(async () => []),
        findFirst: jest.fn(async () => submission),
        updateMany: jest.fn(async ({ data }: any) => {
          submission = { ...submission, ...data };
          return { count: 1 };
        }),
      },
    };
    prisma.$transaction = jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma));
    const ml: any = {
      speakingProfile: 'read-aloud-v1',
      scoreReadAloud: jest.fn(async () => ({
        provider: 'azure',
        transcript: 'Hello world',
        accuracy: 92,
        fluency: 90,
        completeness: 100,
        pronunciation: 91,
        durationSeconds: 1,
        adapterVersion: 'v1',
        feedbackVi: 'Tốt lắm',
        words: [{ word: 'Hello', accuracy: 92, errorType: 'None' }],
        audioHash,
      })),
    };
    const config: any = {
      get: (key: string, fallback?: string) =>
        key === 'SPEAKING_ENABLED' || key === 'SPEAKING_READ_ALOUD_ENABLED' ? 'true' : fallback,
    };
    const notifications = { createNotification: jest.fn(async () => ({ created: true })) };

    const service = new SpeakingService(
      prisma,
      ml,
      config,
      notifications as unknown as NotificationsService,
    );
    await service.upload('user-1', 'sub-read-1', wav);

    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SPEAKING_RESULT_READY',
        targetType: 'SPEAKING',
        targetPayload: expect.objectContaining({ submissionId: 'sub-read-1' }),
        dedupeKey: 'speaking:sub-read-1',
      }),
    );
  });

  it('creates SPEAKING_RESULT_READY when VoiceConversation assessment finishes as READY or PARTIAL', async () => {
    let current: any = {
      id: 'conv-1',
      userId: 'user-1',
      topicId: 'topic-1',
      status: 'ENDED',
      assessmentStatus: 'UNASSESSED',
      assessmentStartedAt: null,
      assessmentAudioHash: null,
      assessment: null,
      topicSnapshot: { text: 'Daily routine' },
      turns: [{ providerItemId: 'turn-1', role: 'USER', transcript: 'I wake up early.' }],
    };
    const prisma: any = {
      voiceConversation: {
        findFirst: jest.fn(async () => current),
        updateMany: jest.fn(async ({ data }: any) => {
          current = { ...current, ...data };
          return { count: 1 };
        }),
      },
    };
    const ml: any = {
      scoreConversationContent: jest.fn(async () => ({
        status: 'succeeded',
        rubricVersion: 'conversation-content-v1',
        vocabulary: 84,
        grammar: 84,
        topic: 84,
        overall: 84,
        strengths: ['Rõ ràng'],
        improvements: [],
      })),
    };
    const notifications = { createNotification: jest.fn(async () => ({ created: true })) };
    const service = new VoiceConversationsService(
      prisma,
      { readiness: () => ({ enabled: true }), read: () => ({}) } as any,
      {} as any,
      ml,
      notifications as unknown as NotificationsService,
    );

    await service.assess('user-1', 'conv-1');
    await new Promise((resolve) => setImmediate(resolve));

    expect(current.assessmentStatus).toBe('PARTIAL');
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'SPEAKING_RESULT_READY',
        targetType: 'SPEAKING',
        targetPayload: expect.objectContaining({
          conversationId: 'conv-1',
          assessmentStatus: 'PARTIAL',
        }),
        dedupeKey: 'voice_conversation:conv-1',
      }),
    );
  });
});
