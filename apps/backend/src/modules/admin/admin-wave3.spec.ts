import { HttpService } from '@nestjs/axios';
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import {
  AuthProvider,
  CefrLevel,
  LearningKind,
  SkillLevelSource,
  SpeakingMode,
  SpeakingStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { getAuth } from 'firebase-admin/auth';
import { seedSpeakingContent } from '../../../prisma/seed-speaking';
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
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminOpsService } from './services/admin-ops.service';
import { AdminUsersService } from './services/admin-users.service';

jest.mock('firebase-admin/app', () => ({
  getApps: () => [],
  initializeApp: () => ({}),
  applicationDefault: () => ({}),
  cert: () => ({}),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';

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
          timeout: 5000,
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
  });
});
