import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AssessmentSkill,
  AuthProvider,
  CefrLevel,
  ItemUsageScope,
  LearningKind,
  LearningPurpose,
  SkillLevelSource,
  SpeakingMode,
  SpeakingStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AxiosResponse } from 'axios';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Response } from 'express';
import { lastValueFrom, of, throwError } from 'rxjs';
import { getAuth } from 'firebase-admin/auth';
import { seedSpeakingContent } from '../../../prisma/seed-speaking';
import { AssessmentMatrixService } from '../assessment/services/assessment-matrix.service';
import { FirebaseTokenService } from '../auth/firebase/firebase-token.service';
import { MediaStorageService } from '../media/media-storage.service';
import { InProcessCatFallback } from '../ml/fallbacks/in-process-cat.fallback';
import { MlClientService } from '../ml/ml-client.service';
import { PlanningService } from '../planning/planning.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../security/password.service';
import { SpeakingService } from '../speaking/speaking.service';
import { VoiceConversationsService } from '../speaking/voice-conversations.service';
import { VoiceLiveConfig } from '../speaking/voice-live.config';
import { CuratedVocabularyService } from '../vocabulary/curated-vocabulary.service';
import { AdminAuditImportController } from './controllers/admin-audit-import.controller';
import { BulkPublishDto } from './dto/admin-content.dto';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminAuditService, computeCompactDiff, RecordAuditLogInput } from './services/admin-audit.service';
import { AdminContentService } from './services/admin-content.service';
import {
  AdminExportService,
  MAX_SENSITIVE_EXPORT_ROWS,
} from './services/admin-export.service';
import { AdminImportService } from './services/admin-import.service';
import { AdminOpsService } from './services/admin-ops.service';
import { AdminSpeakingService } from './services/admin-speaking.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminVocabularyService } from './services/admin-vocabulary.service';

jest.mock('firebase-admin/app', () => ({
  getApps: () => [],
  initializeApp: () => ({}),
  applicationDefault: () => ({}),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';

describe('Wave 3 Backend Domain Parity, Learner 360°, Round-Trip Export/Import & Bulk Publish', () => {
  describe('1. Non-destructive seedSpeakingContent', () => {
    it('persists preparation & linkedReadAloudCodes on create and only backfills missing fields on update', async () => {
      const upsertCalls: Array<{
        where: { code: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }> = [];
      const prisma = {
        speakingPrompt: {
          findUnique: jest.fn(async ({ where }: { where: { code: string } }) => {
            if (where.code === 'topic-1') {
              // Admin already customized both preparation and linkedReadAloudCodes
              return {
                preparation: { goal: 'Custom Admin Goal', vocabulary: [], phrases: [] },
                linkedReadAloudCodes: ['read-aloud-custom'],
              };
            }
            if (where.code === 'topic-2') {
              // Existing row missing both fields -> should backfill both
              return {
                preparation: null,
                linkedReadAloudCodes: [],
              };
            }
            return null;
          }),
          upsert: jest.fn(async (args: {
            where: { code: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => {
            upsertCalls.push(args);
            return args;
          }),
        },
      };

      await seedSpeakingContent(prisma as unknown as never);

      const topic1 = upsertCalls.find((c) => c.where.code === 'topic-1')!;
      expect(topic1.create.preparation).toBeDefined();
      expect(topic1.create.linkedReadAloudCodes).toEqual(['read-aloud-2', 'read-aloud-3']);
      // Must NOT overwrite admin CMS edits
      expect(topic1.update.preparation).toBeUndefined();
      expect(topic1.update.linkedReadAloudCodes).toBeUndefined();

      const topic2 = upsertCalls.find((c) => c.where.code === 'topic-2')!;
      // Missing fields must be backfilled
      expect(topic2.update.preparation).toBeDefined();
      expect(topic2.update.linkedReadAloudCodes).toEqual(['read-aloud-4']);
    });
  });

  describe('2. MlClientService.checkReady() 503 degradation preservation', () => {
    it('accepts HTTP 503 via validateStatus and preserves all 8 ML subsystem components', async () => {
      const components = {
        cat: 'ready',
        llm: 'ready',
        rag: 'missing_artifact',
        speech: 'cold',
        speech_azure: 'ready',
        speech_topic: 'missing_config',
        speaking_content: 'ready',
        kt: 'missing_artifact',
      };
      const httpService = {
        get: jest.fn().mockReturnValue(
          of({
            status: 503,
            statusText: 'Service Unavailable',
            headers: {},
            config: {},
            data: {
              status: 'not_ready',
              components,
              speakingProfiles: ['read-aloud-v1', 'read-aloud-v2'],
            },
          } as AxiosResponse),
        ),
      };
      const config = {
        get: jest.fn((key: string, fallback?: unknown) =>
          key === 'ML_SERVICE_URL' ? 'http://ml:8001' : fallback,
        ),
      };

      const client = new MlClientService(
        httpService as unknown as HttpService,
        config as unknown as ConfigService,
        new InProcessCatFallback(),
      );

      const readiness = await client.checkReady();

      expect(httpService.get).toHaveBeenCalledWith(
        'http://ml:8001/ready',
        expect.objectContaining({
          timeout: 10000,
          validateStatus: expect.any(Function),
        }),
      );
      const validateStatus = httpService.get.mock.calls[0][1].validateStatus as (
        s: number,
      ) => boolean;
      expect(validateStatus(200)).toBe(true);
      expect(validateStatus(503)).toBe(true);
      expect(validateStatus(500)).toBe(false);

      expect(readiness).toEqual({
        reachable: true,
        httpStatus: 503,
        status: 'not_ready',
        components,
        speakingProfiles: ['read-aloud-v1', 'read-aloud-v2'],
      });

      httpService.get.mockReturnValueOnce(throwError(() => new Error('ECONNREFUSED')));
      const unreachable = await client.checkReady();
      expect(unreachable).toEqual({
        reachable: false,
        httpStatus: null,
        status: 'unreachable',
        components: {},
        error: 'ECONNREFUSED',
      });
    });
  });

  describe('3. AdminOpsService, VoiceConversationsService.adminReleaseLock & SpeakingService admin actions', () => {
    it('releases stuck voice conversation DB lock via adminReleaseLock', async () => {
      const prisma = {
        voiceConversation: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({
              id: UUID_1,
              status: 'ACTIVE',
              activeUserId: UUID_2,
              endReason: null,
              endedAt: null,
            })
            .mockResolvedValueOnce({
              id: UUID_1,
              status: 'INTERRUPTED',
              activeUserId: null,
              endReason: 'admin_released',
              endedAt: new Date(),
            }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const voiceService = new VoiceConversationsService(
        prisma as unknown as PrismaService,
        {} as VoiceLiveConfig,
        {} as HttpAdapterHost,
        {} as MlClientService,
      );

      const ops = new AdminOpsService(
        prisma as unknown as PrismaService,
        voiceService,
        {} as SpeakingService,
        {} as VoiceLiveConfig,
        {} as MlClientService,
      );

      const res = await ops.releaseVoiceConversationLock(UUID_1);
      expect(res.released).toBe(true);
      expect(res.status).toBe('INTERRUPTED');
      expect(res.endReason).toBe('admin_released');
      expect(res.hasActiveLock).toBe(false);
      expect(prisma.voiceConversation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activeUserId: null,
            status: 'INTERRUPTED',
            endReason: 'admin_released',
            endedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('SpeakingService.adminRetryContent throws 422 ADMIN_SPEAKING_NO_TRANSCRIPT when missing transcript and retries hidden TOPIC submissions when transcript exists', async () => {
      const prisma = {
        speakingSubmission: {
          findUnique: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const ml = {
        speakingProfile: 'read-aloud-v2',
        scoreTopicContent: jest.fn().mockResolvedValue({
          status: 'succeeded',
          rubricVersion: 'topic-content-v1',
          vocabulary: 80,
          grammar: 85,
          topic: 90,
          overall: 85,
          strengths: ['Clear structure'],
          improvements: [],
        }),
      };
      const speakingService = new SpeakingService(
        prisma as unknown as PrismaService,
        ml as unknown as MlClientService,
        new ConfigService(),
      );
      const ops = new AdminOpsService(
        prisma as unknown as PrismaService,
        {} as VoiceConversationsService,
        speakingService,
        {} as VoiceLiveConfig,
        ml as unknown as MlClientService,
      );

      // No transcript -> 422 ADMIN_SPEAKING_NO_TRANSCRIPT
      prisma.speakingSubmission.findUnique.mockResolvedValueOnce({
        id: UUID_1,
        userId: UUID_2,
        status: SpeakingStatus.FAILED,
        promptSnapshot: { mode: SpeakingMode.TOPIC, text: 'My hometown' },
        result: null,
        historyHiddenAt: null,
      });

      let err: unknown;
      try {
        await ops.retrySpeakingSubmissionContent(UUID_1);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(422);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'ADMIN_SPEAKING_NO_TRANSCRIPT',
      });

      // Valid transcript on hidden TOPIC submission -> retries content ignoring historyHiddenAt
      prisma.speakingSubmission.findUnique
        .mockResolvedValueOnce({
          id: UUID_1,
          userId: UUID_2,
          status: SpeakingStatus.SUCCEEDED,
          promptSnapshot: { mode: SpeakingMode.TOPIC, text: 'My hometown', hints: ['Where?'] },
          result: {
            transcript: 'My hometown is Hanoi and I love the food.',
            durationSeconds: 18,
            content: { status: 'unavailable', errorCode: 'content_timeout' },
          },
          historyHiddenAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: UUID_1,
          userId: UUID_2,
          status: SpeakingStatus.SUCCEEDED,
          result: {
            transcript: 'My hometown is Hanoi and I love the food.',
            content: { status: 'succeeded', overall: 85 },
          },
        });

      const retried = await ops.retrySpeakingSubmissionContent(UUID_1);
      expect(ml.scoreTopicContent).toHaveBeenCalledWith(
        'My hometown',
        ['Where?'],
        'My hometown is Hanoi and I love the food.',
        18,
        undefined,
      );
      expect(retried.status).toBe(SpeakingStatus.SUCCEEDED);
    });

    it('SpeakingService.adminExpireStuck moves PROCESSING > 180s to UNKNOWN with errorCode=admin_expired and rejects fresh jobs', async () => {
      const prisma = {
        speakingSubmission: {
          findUnique: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const speakingService = new SpeakingService(
        prisma as unknown as PrismaService,
        { speakingProfile: 'read-aloud-v2' } as unknown as MlClientService,
        new ConfigService(),
      );
      const ops = new AdminOpsService(
        prisma as unknown as PrismaService,
        {} as VoiceConversationsService,
        speakingService,
        {} as VoiceLiveConfig,
        {} as MlClientService,
      );

      // Fresh job (< 180s) -> 409
      prisma.speakingSubmission.findUnique.mockResolvedValueOnce({
        id: UUID_1,
        status: SpeakingStatus.PROCESSING,
        processingAt: new Date(Date.now() - 30_000),
        createdAt: new Date(Date.now() - 30_000),
        result: null,
      });
      await expect(ops.expireSpeakingSubmission(UUID_1)).rejects.toMatchObject({
        status: 409,
      });

      // Stuck job (> 180s) -> UNKNOWN + admin_expired
      const staleAt = new Date(Date.now() - 240_000);
      prisma.speakingSubmission.findUnique
        .mockResolvedValueOnce({
          id: UUID_1,
          status: SpeakingStatus.PROCESSING,
          processingAt: staleAt,
          createdAt: staleAt,
          result: null,
        })
        .mockResolvedValueOnce({
          id: UUID_1,
          status: SpeakingStatus.UNKNOWN,
          errorCode: 'admin_expired',
        });

      const expired = await ops.expireSpeakingSubmission(UUID_1);
      expect(expired.status).toBe(SpeakingStatus.UNKNOWN);
      expect(expired.errorCode).toBe('admin_expired');
      expect(prisma.speakingSubmission.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'UNKNOWN',
            errorCode: 'admin_expired',
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('AdminOpsService.getSystemReadiness aggregates DB, ML, VoiceLive (no secrets), Speaking flags & incident counts', async () => {
      const prisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        voiceConversation: { count: jest.fn().mockResolvedValue(2) },
        speakingSubmission: {
          count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(4),
        },
        refreshSession: { count: jest.fn().mockResolvedValue(15) },
      };
      const voiceLiveConfig = {
        readiness: jest.fn().mockReturnValue({
          enabled: true,
          status: 'configured',
          maxDurationSeconds: 180,
        }),
        read: jest.fn().mockReturnValue({
          enabled: true,
          ready: true,
          endpoint: 'https://secret.services.ai.azure.com/',
          key: 'SUPER-SECRET-AZURE-KEY',
          model: 'gpt-4o',
          voice: 'en-US-AndrewMultilingualNeural',
          apiVersion: '2026-07-15',
          maxDurationSeconds: 180,
        }),
      };
      const mlClient = {
        speakingProfile: 'read-aloud-v2',
        checkReady: jest.fn().mockResolvedValue({
          reachable: true,
          httpStatus: 503,
          status: 'not_ready',
          components: { cat: 'ready', kt: 'missing_artifact' },
        }),
      };
      const speakingService = {
        modeEnabled: jest.fn((mode: SpeakingMode) => mode === SpeakingMode.READ_ALOUD),
      };
      const mediaStorage = {
        storageMode: jest.fn(() => 'azure' as const),
        isAzureConfigured: jest.fn(() => true),
        isAzureRequired: jest.fn(() => true),
      };
      const config = new ConfigService({
        APP_VERSION: '2.3.0',
        AUTH_PROVIDER: 'firebase',
      });

      const ops = new AdminOpsService(
        prisma as unknown as PrismaService,
        {} as VoiceConversationsService,
        speakingService as unknown as SpeakingService,
        voiceLiveConfig as unknown as VoiceLiveConfig,
        mlClient as unknown as MlClientService,
        mediaStorage as unknown as MediaStorageService,
        config,
      );

      const readiness = await ops.getSystemReadiness();
      expect(readiness.appVersion).toBe('2.3.0');
      expect(readiness.authProvider).toBe('firebase');
      expect(readiness.database.status).toBe('ready');
      expect(typeof readiness.database.latencyMs).toBe('number');
      expect(readiness.mediaStorage).toEqual({
        mode: 'azure',
        azureConfigured: true,
        azureRequired: true,
      });
      expect(readiness.ml.httpStatus).toBe(503);
      expect(readiness.ml.components).toEqual({ cat: 'ready', kt: 'missing_artifact' });
      expect(readiness.voiceLive).toEqual({
        enabled: true,
        status: 'configured',
        maxDurationSeconds: 180,
        model: 'gpt-4o',
        voice: 'en-US-AndrewMultilingualNeural',
        apiVersion: '2026-07-15',
      });
      expect(JSON.stringify(readiness)).not.toContain('SUPER-SECRET-AZURE-KEY');
      expect(JSON.stringify(readiness)).not.toContain('secret.services.ai.azure.com');
      expect(readiness.speaking.modes).toEqual({
        READ_ALOUD: true,
        TOPIC: false,
        PICTURE_DESCRIPTION: false,
        TONGUE_TWISTER: false,
      });
      expect(readiness.incidents).toEqual({
        stuckVoiceLocks: 2,
        stuckSpeakingJobs: 1,
        failedSpeaking24h: 4,
        activeRefreshSessions: 15,
      });
    });

    it('MlClientService reads LINGOROAD_ML_INTERNAL_TOKEN fallback and attaches x-internal-token header', async () => {
      const postMock = jest.fn().mockReturnValue(
        of({
          status: 200,
          data: { theta: 0.25, se: 0.4, next_item_id: 'item-1' },
        } as AxiosResponse),
      );
      const httpService = { post: postMock, get: jest.fn() } as unknown as HttpService;
      const values: Record<string, string> = {
        ML_SERVICE_URL: 'https://ml.internal.example',
        LINGOROAD_ML_INTERNAL_TOKEN: 'fallback-token-with-more-than-32-characters',
      };
      const config = {
        get: (key: string, defaultValue?: unknown) =>
          Object.prototype.hasOwnProperty.call(values, key) ? values[key] : defaultValue,
      } as unknown as ConfigService;
      const fallback = new InProcessCatFallback();
      const client = new MlClientService(httpService, config, fallback);

      await client.selectNextCatItem([], [{ item_id: 'item-1', a: 1, b: 0, c: 0.25 }]);
      expect(postMock).toHaveBeenCalledWith(
        'https://ml.internal.example/cat/select',
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-internal-token': 'fallback-token-with-more-than-32-characters',
          }),
        }),
      );
    });

    it('AdminAnalyticsService.getDashboard includes voiceConversations in active30dCount', async () => {
      const prisma = {
        user: { count: jest.fn().mockResolvedValue(5), findMany: jest.fn().mockResolvedValue([]) },
        learningLesson: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
        learningUnit: { count: jest.fn().mockResolvedValue(0) },
        assessmentItem: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
        speakingPrompt: { count: jest.fn().mockResolvedValue(0) },
        curatedTopic: { count: jest.fn().mockResolvedValue(0) },
        grammarTopic: { count: jest.fn().mockResolvedValue(0) },
        learningAttempt: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
        placementSession: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
        $queryRaw: jest.fn().mockResolvedValue([]),
      };
      const analytics = new AdminAnalyticsService(prisma as unknown as PrismaService);
      await analytics.getDashboard('30_DAYS', true);
      const active30dCall = prisma.user.count.mock.calls.find(
        (call) => Array.isArray(call[0]?.where?.OR),
      );
      expect(active30dCall?.[0].where.OR).toEqual(
        expect.arrayContaining([
          { voiceConversations: { some: { createdAt: { gte: expect.any(Date) } } } },
        ]),
      );
    });
  });
});
