import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import {
  AssessmentSkill,
  AuthProvider,
  CefrLevel,
  ItemUsageScope,
  LearningKind,
  LearningPurpose,
  SpeakingMode,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { lastValueFrom, of } from 'rxjs';
import { AssessmentMatrixService } from '../assessment/services/assessment-matrix.service';
import { MediaStorageService } from '../media/media-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../security/password.service';
import { CuratedVocabularyService } from '../vocabulary/curated-vocabulary.service';
import { AdminReportingController } from './controllers/admin-reporting.controller';
import { BulkPublishDto } from './dto/admin-content.dto';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import {
  AdminAuditService,
  computeCompactDiff,
  RecordAuditLogInput,
} from './services/admin-audit.service';
import { AdminContentService } from './services/admin-content.service';
import {
  AdminExportService,
  MAX_SENSITIVE_EXPORT_ROWS,
} from './services/admin-export.service';
import { AdminImportService } from './services/admin-import.service';
import { AdminSpeakingService } from './services/admin-speaking.service';
import { AdminUsersService } from './services/admin-users.service';

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';

describe('Wave 3 Round-Trip Export/Import, Single-User Export & Bulk Publish', () => {
  it('exportUserData omits passwordHash & tokenHash and AdminAuditInterceptor logs EXPORT_USER_DATA with zero PII', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: UUID_1,
          email: 'private-learner@example.com',
          name: 'Private Learner',
          passwordHash: '$argon2id$must-not-leak',
          profile: { targetCefr: CefrLevel.B1, dailyGoalMinutes: 15 },
          skillLevels: [],
          skillLevelEvents: [],
          dayPlans: [],
          placementSessions: [],
          learningAttempts: [],
          speakingSubmissions: [],
          speakingGameProgress: [],
          voiceConversations: [],
          vocabularyDecks: [],
          vocabularyReviews: [],
          refreshSessions: [
            {
              id: UUID_2,
              deviceIdentifier: 'iPhone',
              ipAddress: '1.2.3.4',
              tokenHash: 'secret-token-hash',
              isRevoked: false,
              expiresAt: new Date(),
              createdAt: new Date(),
            },
          ],
        }),
      },
    };
    const service = new AdminUsersService(
      prisma as unknown as PrismaService,
      {} as PasswordService,
    );

    const exported = await service.exportUserData(UUID_1);
    expect(exported.filename).toMatch(
      new RegExp(`^lingoroad-user-${UUID_1}-\\d{4}-\\d{2}-\\d{2}\\.json$`),
    );
    expect(exported.body).not.toContain('passwordHash');
    expect(exported.body).not.toContain('$argon2id$must-not-leak');
    expect(exported.body).not.toContain('tokenHash');
    expect(exported.body).not.toContain('secret-token-hash');

    const auditService = {
      record: jest.fn<Promise<void>, [RecordAuditLogInput]>(async () => undefined),
      captureBeforeSnapshot: jest.fn(),
      computeCompactDiff,
    };
    const eventEmitter = { emit: jest.fn() };
    const interceptor = new AdminAuditInterceptor(
      auditService as unknown as AdminAuditService,
      eventEmitter as unknown as EventEmitter2,
    );
    const ctx = {
      getType: () => 'http',
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: `/api/v1/admin/users/${UUID_1}/export`,
          params: { id: UUID_1 },
          query: {},
          user: { sub: UUID_2, email: 'admin@lingoroad.local', role: 'ADMIN' },
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of(exported.body) };

    await lastValueFrom(interceptor.intercept(ctx, next));
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPORT_USER_DATA',
        resourceType: 'EXPORTS',
        resourceId: UUID_1,
        payloadSnapshot: {
          entity: 'user-data',
          targetUserId: UUID_1,
          format: 'json',
        },
      }),
    );
    expect(
      JSON.stringify(auditService.record.mock.calls[0][0].payloadSnapshot),
    ).not.toContain('private-learner@example.com');
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('AdminExportService exports assessment-groups, grammar prerequisiteCodes, topics audioUrl, users learningPurpose, and enforces cap with truncated headers', async () => {
    const prisma = {
      assessmentItemGroup: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: UUID_1,
            skill: AssessmentSkill.READING,
            title: 'Passage 1',
            cefrLevel: CefrLevel.B1,
            partNumber: 5,
            passage: 'Reading text',
            audioUrl: null,
            transcript: null,
            usageScope: ItemUsageScope.MOCK_EXAM,
          },
        ]),
      },
      grammarTopic: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: UUID_1,
            code: 'grammar.present_perfect',
            parent: { code: 'grammar.tenses' },
            cefrLevel: CefrLevel.B1,
            isLeaf: true,
            titleEn: 'Present Perfect',
            titleVi: 'Hiện tại hoàn thành',
            summaryVi: 'Summary',
            formulas: [],
            usageNotes: [],
            examples: [],
            orderIndex: 2,
            published: true,
            prerequisites: [{ prerequisite: { code: 'grammar.present_simple' } }],
          },
        ]),
      },
      curatedTopic: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: UUID_1,
            slug: 'travel',
            titleEn: 'Travel',
            titleVi: 'Du lịch',
            description: null,
            icon: null,
            displayOrder: 1,
            words: [
              {
                word: 'ticket',
                phonetic: '/ˈtɪk.ɪt/',
                partOfSpeech: 'noun',
                meaningVi: 'Vé',
                exampleEn: 'Buy a ticket.',
                exampleVi: 'Mua vé.',
                imageUrl: null,
                audioUrl: '/media/learning/v1/ticket.wav',
              },
            ],
          },
        ]),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    const exportService = new AdminExportService(prisma as unknown as PrismaService);

    const groupsJson = await exportService.exportEntity('assessment-groups', 'json');
    expect(groupsJson.count).toBe(1);
    expect(groupsJson.truncated).toBe(false);
    expect(JSON.parse(groupsJson.body).assessmentGroups[0]).toMatchObject({
      id: UUID_1,
      skill: 'READING',
      partNumber: 5,
    });

    const groupsCsv = await exportService.exportEntity('assessment-groups', 'csv');
    expect(groupsCsv.body).toContain('"partNumber"');
    expect(groupsCsv.body).toContain('"Passage 1"');

    const grammarJson = await exportService.exportEntity('grammar', 'json');
    expect(JSON.parse(grammarJson.body).grammarTopics[0].prerequisiteCodes).toEqual([
      'grammar.present_simple',
    ]);

    const topicsCsv = await exportService.exportEntity('topics', 'csv');
    expect(topicsCsv.body).toContain('"audioUrl"');
    expect(topicsCsv.body).toContain('/media/learning/v1/ticket.wav');

    let batchNum = 0;
    prisma.user.findMany.mockImplementation(async ({ take }: { take: number }) => {
      batchNum += 1;
      return Array.from({ length: take }, (_, idx) => ({
        id: `user-${batchNum}-${idx}`,
        email: `u${batchNum}_${idx}@example.com`,
        name: 'User',
        role: UserRole.LEARNER,
        status: UserStatus.ACTIVE,
        provider: AuthProvider.LOCAL,
        createdAt: new Date(),
        profile: {
          targetCefr: CefrLevel.B1,
          dailyGoalMinutes: 10,
          learningPurpose: LearningPurpose.EXAM,
        },
      }));
    });

    const usersCsv = await exportService.exportEntity('users', 'csv');
    expect(usersCsv.count).toBe(MAX_SENSITIVE_EXPORT_ROWS);
    expect(usersCsv.truncated).toBe(true);
    expect(usersCsv.body).toContain('"learningPurpose"');
    expect(usersCsv.body).toContain('"EXAM"');

    const headers: Record<string, string> = {};
    const mockRes = {
      setHeader: jest.fn((k: string, v: string) => {
        headers[k] = v;
      }),
    } as unknown as Response;
    const controller = new AdminReportingController(
      {} as AdminAnalyticsService,
      {} as AdminImportService,
      {} as AdminAuditService,
      exportService,
    );
    batchNum = 0;
    await controller.exportEntity('users', 'csv', mockRes);
    expect(headers['X-Export-Count']).toBe(String(MAX_SENSITIVE_EXPORT_ROWS));
    expect(headers['X-Export-Truncated']).toBe('true');
  });

  it('AdminImportService supports 3-level grammar Kahn topo-sort, prerequisiteCodes sync, units array detection, and rejects parentCode & DAG cycles', async () => {
    const upsertedOrder: string[] = [];
    const parentIdUsed = new Map<string, string | null>();
    const tx = {
      grammarTopic: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(async ({ where, create }: { where: { code: string }; create: { parentId: string | null } }) => {
          upsertedOrder.push(where.code);
          parentIdUsed.set(where.code, create.parentId);
          return { id: `id:${where.code}`, code: where.code };
        }),
      },
      grammarPrerequisite: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      learningUnit: { findMany: jest.fn().mockResolvedValue([]) },
      grammarTopic: { findMany: jest.fn().mockResolvedValue([]) },
      grammarPrerequisite: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const importer = new AdminImportService(
      prisma as unknown as PrismaService,
      { invalidateCache: jest.fn(async () => undefined) } as unknown as AssessmentMatrixService,
      { invalidateTopicsCache: jest.fn() } as unknown as CuratedVocabularyService,
    );

    const unitArrayCheck = await importer.validateBundle([
      {
        code: 'a1-unit-01',
        cefrLevel: 'A1',
        orderIndex: 1,
        title: 'Unit 1',
        description: 'Intro',
      },
    ]);
    expect(unitArrayCheck.isValid).toBe(true);
    expect(unitArrayCheck.preview.counts.units.create).toBe(1);

    const leafPayload = {
      formulas: [{ form: 'AFFIRMATIVE', labelVi: 'KĐ', structure: 'S + V' }],
      usageNotes: [{ useCaseVi: 'Thói quen' }],
      examples: [{ sentenceEn: 'I work.', translationVi: 'Tôi làm việc.' }],
    };

    await importer.applyBundle({
      grammarTopics: [
        {
          code: 'grammar.tenses.present_continuous',
          parentCode: 'grammar.tenses',
          cefrLevel: 'A1',
          isLeaf: true,
          titleEn: 'Present Continuous',
          titleVi: 'Hiện tại tiếp diễn',
          summaryVi: 'Desc',
          prerequisiteCodes: ['grammar.tenses.present_simple'],
          ...leafPayload,
        },
        {
          code: 'grammar.tenses.present_simple',
          parentCode: 'grammar.tenses',
          cefrLevel: 'A1',
          isLeaf: true,
          titleEn: 'Present Simple',
          titleVi: 'Hiện tại đơn',
          summaryVi: 'Desc',
          ...leafPayload,
        },
        {
          code: 'grammar.tenses',
          parentCode: 'grammar',
          cefrLevel: 'A1',
          isLeaf: false,
          titleEn: 'Tenses',
          titleVi: 'Các thì',
        },
        {
          code: 'grammar',
          parentCode: null,
          cefrLevel: 'A1',
          isLeaf: false,
          titleEn: 'Grammar',
          titleVi: 'Ngữ pháp',
        },
      ],
    });

    expect(upsertedOrder.indexOf('grammar')).toBeLessThan(
      upsertedOrder.indexOf('grammar.tenses'),
    );
    expect(upsertedOrder.indexOf('grammar.tenses')).toBeLessThan(
      upsertedOrder.indexOf('grammar.tenses.present_simple'),
    );
    expect(parentIdUsed.get('grammar.tenses')).toBe('id:grammar');
    expect(parentIdUsed.get('grammar.tenses.present_continuous')).toBe(
      'id:grammar.tenses',
    );
    expect(tx.grammarPrerequisite.createMany).toHaveBeenCalledWith({
      data: [
        {
          prerequisiteId: 'id:grammar.tenses.present_simple',
          targetId: 'id:grammar.tenses.present_continuous',
        },
      ],
      skipDuplicates: true,
    });

    const parentCycle = await importer.validateBundle({
      grammarTopics: [
        {
          code: 'grammar.group_a',
          parentCode: 'grammar.group_b',
          cefrLevel: 'A1',
          isLeaf: false,
          titleEn: 'Group A',
          titleVi: 'Nhóm A',
        },
        {
          code: 'grammar.group_b',
          parentCode: 'grammar.group_a',
          cefrLevel: 'A1',
          isLeaf: false,
          titleEn: 'Group B',
          titleVi: 'Nhóm B',
        },
      ],
    });
    expect(parentCycle.isValid).toBe(false);
    expect(
      parentCycle.errors.some((e) => e.path.endsWith('.parentCode')),
    ).toBe(true);

    prisma.grammarTopic.findMany.mockResolvedValueOnce([
      { id: 'g-a', code: 'grammar.a', isLeaf: true, parentId: null, parent: null },
      { id: 'g-b', code: 'grammar.b', isLeaf: true, parentId: null, parent: null },
    ]);
    prisma.grammarPrerequisite.findMany.mockResolvedValueOnce([
      { prerequisite: { code: 'grammar.a' }, target: { code: 'grammar.b' } },
    ]);
    const dagCycle = await importer.validateBundle({
      grammarTopics: [
        {
          code: 'grammar.a',
          cefrLevel: 'A1',
          isLeaf: true,
          titleEn: 'Topic A',
          titleVi: 'Chủ điểm A',
          summaryVi: 'A',
          prerequisiteCodes: ['grammar.b'],
          ...leafPayload,
        },
      ],
    });
    expect(dagCycle.isValid).toBe(false);
    expect(
      dagCycle.errors.some((e) => e.path.endsWith('.prerequisiteCodes')),
    ).toBe(true);
  });

  it('bulkPublishLessons validates LISTENING audio when publishing and bulkPublishPrompts updates in transaction', async () => {
    const tooMany = plainToInstance(BulkPublishDto, {
      ids: Array.from({ length: 101 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`),
      published: true,
    });
    expect((await validate(tooMany)).length).toBeGreaterThan(0);

    const tx = {
      learningLesson: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      speakingPrompt: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      learningLesson: { findMany: jest.fn() },
      speakingPrompt: { findMany: jest.fn() },
      $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const mediaStorage = { verifyListeningAudio: jest.fn() };

    const contentService = new AdminContentService(
      prisma as unknown as PrismaService,
      { invalidateCache: jest.fn(async () => undefined) } as unknown as AssessmentMatrixService,
      mediaStorage as unknown as MediaStorageService,
    );

    prisma.learningLesson.findMany.mockResolvedValueOnce([
      {
        id: UUID_1,
        code: 'listening-bad',
        kind: LearningKind.LISTENING,
        content: { listeningVersion: 1, audioUrl: '/media/learning/v1/missing.wav' },
      },
    ]);
    mediaStorage.verifyListeningAudio.mockRejectedValueOnce(
      new Error('Listening curriculum audio file not found.'),
    );
    await expect(
      contentService.bulkPublishLessons({ ids: [UUID_1], published: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.learningLesson.updateMany).not.toHaveBeenCalled();

    prisma.learningLesson.findMany.mockResolvedValueOnce([
      {
        id: UUID_1,
        code: 'listening-ok',
        kind: LearningKind.LISTENING,
        content: { listeningVersion: 1, audioUrl: '/media/learning/v1/ok.wav' },
      },
      {
        id: UUID_2,
        code: 'grammar-ok',
        kind: LearningKind.GRAMMAR,
        content: {},
      },
    ]);
    mediaStorage.verifyListeningAudio.mockResolvedValueOnce(undefined);
    const lessonRes = await contentService.bulkPublishLessons({
      ids: [UUID_1, UUID_2],
      published: true,
    });
    expect(mediaStorage.verifyListeningAudio).toHaveBeenCalledTimes(2);
    expect(lessonRes).toEqual({
      updatedCount: 2,
      published: true,
      ids: [UUID_1, UUID_2],
    });

    const speakingAdmin = new AdminSpeakingService(prisma as unknown as PrismaService);
    prisma.speakingPrompt.findMany.mockResolvedValueOnce([
      { id: UUID_1, code: 'topic-1', mode: SpeakingMode.TOPIC, imageUrl: null },
      { id: UUID_3, code: 'pic-1', mode: SpeakingMode.PICTURE_DESCRIPTION, imageUrl: '/media/learning/v1/images/p1.jpg' },
    ]);
    const speakingRes = await speakingAdmin.bulkPublishPrompts({
      ids: [UUID_1, UUID_3],
      published: false,
    });
    expect(speakingRes).toEqual({
      updatedCount: 2,
      published: false,
      ids: [UUID_1, UUID_3],
    });
    expect(tx.speakingPrompt.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [UUID_1, UUID_3] } },
      data: { published: false },
    });
  });
});
