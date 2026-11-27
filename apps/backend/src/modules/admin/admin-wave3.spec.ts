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
import { AdminContentController } from './controllers/admin-content.controller';
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

  describe('4. Learner 360°, Firebase Hard-Delete & Single-User Export', () => {
    it('FirebaseTokenService.deleteUser ignores auth/user-not-found and throws ADMIN_FIREBASE_DELETE_FAILED on other failures', async () => {
      const sdk = { deleteUser: jest.fn(), updateUser: jest.fn() };
      (getAuth as jest.Mock).mockReturnValue(sdk);
      const svc = new FirebaseTokenService(new ConfigService({ FIREBASE_PROJECT_ID: 'p1' }));

      sdk.deleteUser.mockRejectedValueOnce({ code: 'auth/user-not-found' });
      await expect(svc.deleteUser('missing-uid')).resolves.toBeUndefined();

      sdk.deleteUser.mockRejectedValueOnce(new Error('network down'));
      await expect(svc.deleteUser('uid-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ADMIN_FIREBASE_DELETE_FAILED' }),
      });

      sdk.updateUser.mockResolvedValueOnce({});
      await expect(svc.setDisabled('uid-1', true)).resolves.toBeUndefined();
      expect(sdk.updateUser).toHaveBeenCalledWith('uid-1', { disabled: true });
    });

    it('resetPlacementRetake row-locks user, transitions IN_PROGRESS/COMPLETED -> ABANDONED without deleting responses, and optionally resets PLACEMENT skill levels', async () => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: UUID_1 }]),
        placementSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
        learningSkillLevel: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        assessmentResponse: { deleteMany: jest.fn() },
      };
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: UUID_1 }) },
        $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const service = new AdminUsersService(
        prisma as unknown as PrismaService,
        {} as PasswordService,
      );

      const res = await service.resetPlacementRetake(UUID_1, { resetSkillLevels: true });
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.placementSession.updateMany).toHaveBeenCalledWith({
        where: { userId: UUID_1, status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
        data: { status: 'ABANDONED', currentItemId: null, version: { increment: 1 } },
      });
      expect(tx.assessmentResponse.deleteMany).not.toHaveBeenCalled();
      expect(tx.learningSkillLevel.deleteMany).toHaveBeenCalledWith({
        where: { userId: UUID_1, source: SkillLevelSource.PLACEMENT },
      });
      expect(res).toEqual({
        userId: UUID_1,
        abandonedSessionsCount: 2,
        resetSkillLevelsCount: 1,
      });
    });

    it('session listing omits tokenHash, revokeUserSession revokes one, and revokeAllUserSessions increments tokenVersion + revokes Firebase', async () => {
      const tx = {
        refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
        user: { update: jest.fn().mockResolvedValue({}) },
      };
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: UUID_1, firebaseUid: 'fb-1' }),
        },
        refreshSession: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: UUID_2,
              deviceIdentifier: 'Pixel 8',
              ipAddress: '203.0.113.10',
              expiresAt: new Date(Date.now() + 60_000),
              createdAt: new Date(),
            },
          ]),
          findFirst: jest.fn().mockResolvedValue({ id: UUID_2, isRevoked: false }),
          update: jest.fn().mockResolvedValue({ id: UUID_2, isRevoked: true }),
        },
        $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const firebase = { enabled: true, revoke: jest.fn().mockResolvedValue(undefined) };
      const service = new AdminUsersService(
        prisma as unknown as PrismaService,
        {} as PasswordService,
        firebase as unknown as FirebaseTokenService,
      );

      const sessions = await service.listUserSessions(UUID_1);
      expect(sessions).toHaveLength(1);
      const findManyArg = prisma.refreshSession.findMany.mock.calls[0][0];
      expect(findManyArg.select.tokenHash).toBeUndefined();

      const single = await service.revokeUserSession(UUID_1, UUID_2);
      expect(single).toEqual({ id: UUID_2, revoked: true });
      expect(prisma.refreshSession.update).toHaveBeenCalledWith({
        where: { id: UUID_2 },
        data: { isRevoked: true },
      });

      const all = await service.revokeAllUserSessions(UUID_1);
      expect(all).toEqual({ userId: UUID_1, revokedSessionsCount: 3 });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: UUID_1 },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(firebase.revoke).toHaveBeenCalledWith('fb-1');
    });

    it('overrideSkillLevel upserts skill level, optionally resets exposures, and reconciles day plan via PlanningService', async () => {
      const tx = {
        learningSkillLevel: {
          findUnique: jest.fn().mockResolvedValue({ cefrLevel: CefrLevel.A2 }),
          upsert: jest.fn().mockResolvedValue({
            id: 'sl-1',
            userId: UUID_1,
            kind: LearningKind.READING,
            cefrLevel: CefrLevel.B2,
            source: SkillLevelSource.ADAPTIVE,
            previousCefr: CefrLevel.A2,
          }),
        },
        learningAnswerExposure: {
          deleteMany: jest.fn().mockResolvedValue({ count: 4 }),
        },
      };
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: UUID_1 }) },
        $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const planning = {
        updateAccountProfile: jest.fn(
          async (_userId: string, write: (db: typeof tx) => Promise<unknown>) => write(tx),
        ),
      };

      const service = new AdminUsersService(
        prisma as unknown as PrismaService,
        {} as PasswordService,
        undefined,
        planning as unknown as PlanningService,
      );

      const res = await service.overrideSkillLevel(UUID_1, LearningKind.READING, {
        cefrLevel: CefrLevel.B2,
        resetExposures: true,
      });

      expect(planning.updateAccountProfile).toHaveBeenCalledWith(
        UUID_1,
        expect.any(Function),
        expect.any(Function),
      );
      expect(tx.learningSkillLevel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            cefrLevel: CefrLevel.B2,
            previousCefr: CefrLevel.A2,
            source: SkillLevelSource.ADAPTIVE,
          }),
        }),
      );
      expect(tx.learningAnswerExposure.deleteMany).toHaveBeenCalledWith({
        where: { userId: UUID_1, lesson: { kind: LearningKind.READING } },
      });
      expect(res.resetExposuresCount).toBe(4);
    });

    it('hard-delete calls firebase.deleteUser BEFORE prisma.user.delete and aborts with 503 if Firebase fails; soft-delete disables & restore re-enables', async () => {
      const order: string[] = [];
      const tx = {
        user: {
          update: jest.fn().mockResolvedValue({
            id: UUID_1,
            email: 'u@example.com',
            name: 'Learner',
            avatarUrl: null,
            firebaseUid: 'fb-uid-1',
            provider: AuthProvider.LOCAL,
            role: UserRole.LEARNER,
            status: UserStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            profile: null,
            _count: {
              learningAttempts: 0,
              placementSessions: 0,
              vocabularyDecks: 0,
              speakingSubmissions: 0,
              voiceConversations: 0,
            },
          }),
        },
        refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: UUID_1,
            firebaseUid: 'fb-uid-1',
            status: UserStatus.DELETED,
          }),
          delete: jest.fn(async () => {
            order.push('prisma.user.delete');
            return { id: UUID_1 };
          }),
        },
        $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const firebase = {
        enabled: true,
        deleteUser: jest.fn(async () => {
          order.push('firebase.deleteUser');
        }),
        setDisabled: jest.fn(async () => undefined),
        revoke: jest.fn(async () => undefined),
      };

      const service = new AdminUsersService(
        prisma as unknown as PrismaService,
        {} as PasswordService,
        firebase as unknown as FirebaseTokenService,
      );

      // Success ordering: firebase.deleteUser BEFORE prisma.user.delete
      const hardRes = await service.deleteUser(UUID_2, UUID_1, true);
      expect(hardRes).toEqual({ id: UUID_1, action: 'HARD_DELETED' });
      expect(order).toEqual(['firebase.deleteUser', 'prisma.user.delete']);

      // Failure: Firebase throws -> 503 ADMIN_FIREBASE_DELETE_FAILED & zero DB delete
      prisma.user.delete.mockClear();
      firebase.deleteUser.mockRejectedValueOnce(new Error('Firebase unavailable'));
      await expect(service.deleteUser(UUID_2, UUID_1, true)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();

      // Soft-delete disables Firebase user
      await service.deleteUser(UUID_2, UUID_1, false);
      expect(firebase.setDisabled).toHaveBeenCalledWith('fb-uid-1', true);

      // Restoring status -> ACTIVE re-enables Firebase user
      firebase.setDisabled.mockClear();
      await service.updateUser(UUID_2, UUID_1, { status: UserStatus.ACTIVE });
      expect(firebase.setDisabled).toHaveBeenCalledWith('fb-uid-1', false);
    });

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

      // Audit interceptor check
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
  });

  describe('5. Round-Trip Export/Import, Stream Cap & Bulk Publish', () => {
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

      // Simulate hitting the 5000 user cap across cursor batches + 1 overflow row
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

      // Controller sets X-Export-Count & X-Export-Truncated headers
      const headers: Record<string, string> = {};
      const mockRes = {
        setHeader: jest.fn((k: string, v: string) => {
          headers[k] = v;
        }),
      } as unknown as Response;
      const controller = new AdminContentController(
        {} as AdminAnalyticsService,
        {} as AdminContentService,
        {} as AdminImportService,
        {} as AdminVocabularyService,
        {} as AdminSpeakingService,
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

      // Detect raw units array in normalizeBundleShape
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

      // 3-level tree provided in reverse order (leaf -> mid -> root) + prerequisiteCodes
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

      // Root MUST be upserted before mid, and mid MUST be upserted before leaves!
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

      // parentCode cycle rejection (A -> B -> A)
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

      // DAG prerequisiteCodes cycle rejection across merged DB + bundle (DB has B requires A, bundle sets A requires B)
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
      // DTO validation: >100 ids rejected
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
        learningLesson: {
          findMany: jest.fn(),
        },
        speakingPrompt: {
          findMany: jest.fn(),
        },
        $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const mediaStorage = {
        verifyListeningAudio: jest.fn(),
      };

      const contentService = new AdminContentService(
        prisma as unknown as PrismaService,
        { invalidateCache: jest.fn(async () => undefined) } as unknown as AssessmentMatrixService,
        mediaStorage as unknown as MediaStorageService,
      );

      // Invalid listening audio blocks bulk publish
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

      // Valid listening + grammar lessons succeed
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

      // Bulk publish speaking prompts
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
});
