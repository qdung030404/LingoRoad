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
  cert: () => ({}),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';

describe('Wave 3 Backend Domain Parity, Learner 360°, Round-Trip Export/Import & Bulk Publish', () => {
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
});
