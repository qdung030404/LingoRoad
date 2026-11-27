import {
  CallHandler,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ThrottlerException,
  ThrottlerLimitDetail,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { lastValueFrom, of, throwError } from 'rxjs';
import {
  ClientIpThrottlerGuard,
  normalizeClientIp,
  normalizeForwardedForHeader,
} from '../../common/guards/client-ip-throttler.guard';
import { AssessmentCacheService } from '../assessment/services/assessment-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import {
  AdminAnalyticsService,
  DashboardOverviewResponse,
} from './services/admin-analytics.service';
import {
  AdminAuditService,
  computeCompactDiff,
  RecordAuditLogInput,
} from './services/admin-audit.service';

const SAMPLE_UUID = '11111111-2222-4333-8444-555555555555';

function buildHttpContext(req: Record<string, unknown>, statusCode = 200) {
  return {
    getType: () => 'http',
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ statusCode }),
    }),
  } as unknown as ExecutionContext;
}

describe('Wave 2 Admin Audit Accuracy, Retention, Cache Invalidation & Client IP Throttler', () => {
  describe('AdminAuditInterceptor accuracy & event emission', () => {
    const createHarness = () => {
      const auditService = {
        record: jest.fn<Promise<void>, [RecordAuditLogInput]>(async () => undefined),
        captureBeforeSnapshot: jest.fn<
          Promise<Record<string, unknown> | null>,
          [string, string]
        >(async () => null),
        computeCompactDiff,
      };
      const eventEmitter = {
        emit: jest.fn(),
      };
      const interceptor = new AdminAuditInterceptor(
        auditService as unknown as AdminAuditService,
        eventEmitter as unknown as EventEmitter2,
      );
      return { auditService, eventEmitter, interceptor };
    };

    it('records ADMIN_LOGIN with user identity from response.data.user and does not emit admin.data.mutated', async () => {
      const { auditService, eventEmitter, interceptor } = createHarness();
      const ctx = buildHttpContext({
        method: 'POST',
        originalUrl: '/api/v1/admin/auth/login',
        body: { email: 'ADMIN@lingoroad.local', password: 'SecretPassword1!' },
        ip: '::ffff:203.0.113.10:50000',
      });
      const next: CallHandler = {
        handle: () =>
          of({
            success: true,
            data: {
              accessToken: 'jwt',
              refreshToken: 'ref',
              user: { id: SAMPLE_UUID, email: 'admin@lingoroad.local' },
            },
          }),
      };

      await lastValueFrom(interceptor.intercept(ctx, next));
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: SAMPLE_UUID,
          adminEmail: 'admin@lingoroad.local',
          action: 'ADMIN_LOGIN',
          resourceType: 'AUTH',
          resourceId: SAMPLE_UUID,
          ipAddress: '203.0.113.10',
        }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('records ADMIN_LOGIN_FAILED with normalized email on failed login', async () => {
      const { auditService, eventEmitter, interceptor } = createHarness();
      const ctx = buildHttpContext({
        method: 'POST',
        originalUrl: '/admin/auth/login',
        body: { email: '  Boss@LingoRoad.local ', password: 'WrongPassword1!' },
        ip: '198.51.100.2:44321',
      });
      const next: CallHandler = {
        handle: () => throwError(() => new UnauthorizedException('Invalid credentials')),
      };

      await expect(lastValueFrom(interceptor.intercept(ctx, next))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: null,
          adminEmail: 'boss@lingoroad.local',
          action: 'ADMIN_LOGIN_FAILED',
          resourceType: 'AUTH',
          statusCode: 401,
          ipAddress: '198.51.100.2',
        }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('records ADMIN_LOGOUT using __auditActor instead of anonymous', async () => {
      const { auditService, eventEmitter, interceptor } = createHarness();
      const ctx = buildHttpContext({
        method: 'POST',
        originalUrl: '/api/v1/admin/auth/logout',
        body: { refreshToken: 'raw-refresh-token-value' },
        __auditActor: { userId: SAMPLE_UUID, email: 'admin@lingoroad.local' },
        ip: '127.0.0.1',
      });
      const next: CallHandler = { handle: () => of({ success: true, data: null }) };

      await lastValueFrom(interceptor.intercept(ctx, next));
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: SAMPLE_UUID,
          adminEmail: 'admin@lingoroad.local',
          action: 'ADMIN_LOGOUT',
          resourceType: 'AUTH',
          resourceId: SAMPLE_UUID,
        }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('records ADMIN_CHANGE_PASSWORD and ADMIN_LOGOUT_ALL without emitting admin.data.mutated', async () => {
      const { auditService, eventEmitter, interceptor } = createHarness();
      const user = { sub: SAMPLE_UUID, email: 'admin@lingoroad.local', role: 'ADMIN' };

      await lastValueFrom(
        interceptor.intercept(
          buildHttpContext({
            method: 'POST',
            originalUrl: '/api/v1/admin/auth/change-password',
            user,
            body: { currentPassword: 'Old1', newPassword: 'NewPassword2' },
          }),
          { handle: () => of({ success: true, data: { accessToken: 't' } }) },
        ),
      );
      await lastValueFrom(
        interceptor.intercept(
          buildHttpContext({
            method: 'POST',
            originalUrl: '/api/v1/admin/auth/logout-all',
            user,
          }),
          { handle: () => of({ success: true, data: { revokedSessionsCount: 2 } }) },
        ),
      );

      expect(auditService.record).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ action: 'ADMIN_CHANGE_PASSWORD', resourceType: 'AUTH' }),
      );
      expect(auditService.record).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ action: 'ADMIN_LOGOUT_ALL', resourceType: 'AUTH' }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('audits GET /admin/exports/users as EXPORT_USERS with zero PII snapshot and no cache invalidation', async () => {
      const { auditService, eventEmitter, interceptor } = createHarness();
      const ctx = buildHttpContext({
        method: 'GET',
        originalUrl: '/api/v1/admin/exports/users?format=csv',
        params: { entity: 'users' },
        query: { format: 'csv' },
        user: { sub: SAMPLE_UUID, email: 'admin@lingoroad.local', role: 'ADMIN' },
      });
      const next: CallHandler = {
        handle: () => of('id,email\n1,secret-learner@example.com'),
      };

      await lastValueFrom(interceptor.intercept(ctx, next));
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EXPORT_USERS',
          resourceType: 'EXPORTS',
          resourceId: 'users',
          payloadSnapshot: { entity: 'users', format: 'csv' },
        }),
      );
      const recordedSnapshot = JSON.stringify(auditService.record.mock.calls[0][0].payloadSnapshot);
      expect(recordedSnapshot).not.toContain('secret-learner@example.com');
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('audits media uploads with metadata snapshot and does not emit admin.data.mutated', async () => {
      const { auditService, eventEmitter, interceptor } = createHarness();
      const user = { sub: SAMPLE_UUID, email: 'admin@lingoroad.local', role: 'ADMIN' };

      await lastValueFrom(
        interceptor.intercept(
          buildHttpContext(
            {
              method: 'POST',
              originalUrl: '/api/v1/admin/media/images?slug=banner',
              query: { slug: 'banner' },
              user,
              file: { originalname: 'banner.png', mimetype: 'image/png', size: 2048 },
            },
            201,
          ),
          {
            handle: () =>
              of({
                success: true,
                data: {
                  url: '/media/learning/v1/images/banner-abc123.png',
                  mime: 'image/png',
                  size: 2048,
                  storage: 'azure',
                },
              }),
          },
        ),
      );

      await lastValueFrom(
        interceptor.intercept(
          buildHttpContext(
            {
              method: 'POST',
              originalUrl: '/api/v1/admin/media/audio?scope=learning',
              query: { scope: 'learning' },
              user,
              file: { originalname: 'track.wav', mimetype: 'audio/wav', size: 40960 },
            },
            201,
          ),
          {
            handle: () =>
              of({
                success: true,
                data: {
                  url: '/media/learning/v1/track-abc123.wav',
                  durationMs: 42000,
                  size: 40960,
                  scope: 'learning',
                  storage: 'azure',
                },
              }),
          },
        ),
      );

      expect(auditService.record).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          action: 'UPLOAD_MEDIA_IMAGE',
          resourceType: 'MEDIA',
          resourceId: '/media/learning/v1/images/banner-abc123.png',
          payloadSnapshot: {
            query: { slug: 'banner' },
            file: {
              originalname: 'banner.png',
              mime: 'image/png',
              size: 2048,
              storage: 'azure',
              url: '/media/learning/v1/images/banner-abc123.png',
            },
          },
        }),
      );
      expect(auditService.record).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          action: 'UPLOAD_MEDIA_AUDIO',
          resourceType: 'MEDIA',
          resourceId: '/media/learning/v1/track-abc123.wav',
          payloadSnapshot: {
            query: { scope: 'learning' },
            file: {
              originalname: 'track.wav',
              mime: 'audio/wav',
              size: 40960,
              storage: 'azure',
              url: '/media/learning/v1/track-abc123.wav',
              durationMs: 42000,
              scope: 'learning',
            },
          },
        }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('distinguishes VALIDATE_IMPORTS (no emit) vs APPLY_IMPORTS (emits admin.data.mutated)', async () => {
      const { auditService, eventEmitter, interceptor } = createHarness();
      const user = { sub: SAMPLE_UUID, email: 'admin@lingoroad.local', role: 'ADMIN' };
      const preview = {
        totalRecords: 3,
        counts: { units: { create: 1, update: 0 }, lessons: { create: 2, update: 0 } },
        records: [],
      };

      await lastValueFrom(
        interceptor.intercept(
          buildHttpContext({
            method: 'POST',
            originalUrl: '/api/v1/admin/imports/validate',
            user,
            body: { bundle: { units: [{}] }, topicWordsMode: 'merge' },
          }),
          { handle: () => of({ success: true, data: { isValid: true, errors: [], preview } }) },
        ),
      );
      expect(auditService.record).toHaveBeenLastCalledWith(
        expect.objectContaining({
          action: 'VALIDATE_IMPORTS',
          resourceType: 'IMPORTS',
          payloadSnapshot: {
            topicWordsMode: 'merge',
            isValid: true,
            errorCount: 0,
            totalRecords: 3,
            counts: preview.counts,
          },
        }),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();

      const appliedAt = new Date().toISOString();
      await lastValueFrom(
        interceptor.intercept(
          buildHttpContext({
            method: 'POST',
            originalUrl: '/api/v1/admin/imports/apply',
            user,
            body: { bundle: { units: [{}] }, topicWordsMode: 'replace' },
          }),
          { handle: () => of({ success: true, data: { appliedAt, preview } }) },
        ),
      );
      expect(auditService.record).toHaveBeenLastCalledWith(
        expect.objectContaining({
          action: 'APPLY_IMPORTS',
          resourceType: 'IMPORTS',
          payloadSnapshot: {
            topicWordsMode: 'replace',
            appliedAt,
            totalRecords: 3,
            counts: preview.counts,
          },
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith('admin.data.mutated', {
        resourceType: 'IMPORTS',
        action: 'APPLY_IMPORTS',
      });
    });

    it('captures before/after compact diff on PATCH and deletedSnapshot on DELETE while emitting admin.data.mutated', async () => {
      const { auditService, eventEmitter, interceptor } = createHarness();
      const user = { sub: SAMPLE_UUID, email: 'admin@lingoroad.local', role: 'ADMIN' };

      auditService.captureBeforeSnapshot.mockResolvedValueOnce({
        id: SAMPLE_UUID,
        name: 'Old Learner',
        status: 'ACTIVE',
        passwordHash: '$argon2id$secret-before',
      });

      await lastValueFrom(
        interceptor.intercept(
          buildHttpContext({
            method: 'PATCH',
            originalUrl: `/api/v1/admin/users/${SAMPLE_UUID}`,
            params: { id: SAMPLE_UUID },
            user,
            body: { name: 'New Learner', status: 'SUSPENDED' },
          }),
          {
            handle: () =>
              of({
                success: true,
                data: {
                  id: SAMPLE_UUID,
                  name: 'New Learner',
                  status: 'SUSPENDED',
                  stats: { learningAttempts: 10 },
                },
              }),
          },
        ),
      );

      expect(auditService.captureBeforeSnapshot).toHaveBeenCalledWith('USERS', SAMPLE_UUID);
      const patchCall = auditService.record.mock.calls[0][0];
      expect(patchCall.payloadSnapshot).toEqual({
        diff: {
          name: { before: 'Old Learner', after: 'New Learner' },
          status: { before: 'ACTIVE', after: 'SUSPENDED' },
        },
      });
      expect(JSON.stringify(patchCall.payloadSnapshot)).not.toContain('passwordHash');
      expect(JSON.stringify(patchCall.payloadSnapshot)).not.toContain('secret-before');
      expect(eventEmitter.emit).toHaveBeenCalledWith('admin.data.mutated', {
        resourceType: 'USERS',
        action: 'UPDATE_USERS',
      });

      auditService.captureBeforeSnapshot.mockResolvedValueOnce({
        id: SAMPLE_UUID,
        code: 'a1-unit-01',
        title: 'Deleted Unit',
      });
      await lastValueFrom(
        interceptor.intercept(
          buildHttpContext({
            method: 'DELETE',
            originalUrl: `/api/v1/admin/units/${SAMPLE_UUID}`,
            params: { id: SAMPLE_UUID },
            user,
          }),
          { handle: () => of({ success: true, data: { id: SAMPLE_UUID, action: 'DELETED' } }) },
        ),
      );

      const deleteCall = auditService.record.mock.calls[1][0];
      expect(deleteCall.payloadSnapshot).toEqual({
        deletedSnapshot: {
          id: SAMPLE_UUID,
          code: 'a1-unit-01',
          title: 'Deleted Unit',
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('admin.data.mutated', {
        resourceType: 'UNITS',
        action: 'DELETE_UNITS',
      });
    });
  });

  describe('AdminAuditService diff, snapshot safety & retention cleanup', () => {
    it('captureBeforeSnapshot(USERS) never selects passwordHash', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: SAMPLE_UUID,
            email: 'learner@example.com',
            name: 'Learner',
          }),
        },
      };
      const service = new AdminAuditService(prisma as unknown as PrismaService);

      await service.captureBeforeSnapshot('USERS', SAMPLE_UUID);
      const queryArg = prisma.user.findUnique.mock.calls[0][0];
      expect(queryArg.select).toBeDefined();
      expect(queryArg.select.passwordHash).toBeUndefined();

      expect(await service.captureBeforeSnapshot('USERS', 'not-a-uuid')).toBeNull();
    });

    it('computeCompactDiff hides passwordHash, redacts secrets, and hashes >10KB JSON fields with changedKeys', () => {
      const largeBefore = {
        steps: [{ id: 's1', body: 'A'.repeat(11_000) }],
        questions: [{ id: 'q1', prompt: 'Old question?' }],
      };
      const largeAfter = {
        steps: [{ id: 's1', body: 'A'.repeat(11_000) }],
        questions: [{ id: 'q1', prompt: 'Updated question?' }],
      };

      const { diff } = computeCompactDiff(
        {
          title: 'Old Title',
          unchanged: 'same',
          passwordHash: '$argon2id$very-secret-1',
          apiSecret: 'secret-1',
          content: largeBefore,
        },
        {
          title: 'New Title',
          unchanged: 'same',
          passwordHash: '$argon2id$very-secret-2',
          apiSecret: 'secret-2',
          content: largeAfter,
        },
      );

      expect(diff.title).toEqual({ before: 'Old Title', after: 'New Title' });
      expect(diff.unchanged).toBeUndefined();
      expect(diff.passwordHash).toBeUndefined();
      expect(diff.apiSecret).toEqual({ before: '[REDACTED]', after: '[REDACTED]' });
      expect(diff.content).toEqual({
        changed: true,
        beforeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        afterHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        changedKeys: ['questions'],
      });
      expect(JSON.stringify(diff)).not.toContain('very-secret');
    });

    it('cleanupExpiredLogs performs batched LIMIT 1000 deletes by createdAt < cutoff', async () => {
      const batch1 = Array.from({ length: 1000 }, (_, i) => ({ id: `log-${i}` }));
      const batch2 = [{ id: 'log-1000' }, { id: 'log-1001' }];
      const prisma = {
        auditLog: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce(batch1)
            .mockResolvedValueOnce(batch2),
          deleteMany: jest
            .fn()
            .mockResolvedValueOnce({ count: 1000 })
            .mockResolvedValueOnce({ count: 2 }),
        },
      };
      const config = {
        get: jest.fn((key: string) =>
          key === 'AUDIT_LOG_RETENTION_DAYS' ? '180' : 'test',
        ),
      };
      const service = new AdminAuditService(
        prisma as unknown as PrismaService,
        config as unknown as ConfigService,
      );

      const deleted = await service.cleanupExpiredLogs();
      expect(deleted).toBe(1002);
      expect(prisma.auditLog.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.auditLog.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { createdAt: { lt: expect.any(Date) } },
          select: { id: true },
          take: 1000,
        }),
      );
      expect(prisma.auditLog.deleteMany).toHaveBeenNthCalledWith(2, {
        where: { id: { in: ['log-1000', 'log-1001'] } },
      });

      // Disabled when retentionDays <= 0
      expect(await service.cleanupExpiredLogs(0)).toBe(0);
    });
  });

  describe('AdminAnalyticsService cache invalidation & forceRefresh cooldown', () => {
    it('invalidates all 4 dashboard timeframe cache keys on admin.data.mutated', async () => {
      const cache = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(async () => undefined),
      };
      const service = new AdminAnalyticsService(
        {} as PrismaService,
        cache as unknown as AssessmentCacheService,
      );

      const emitter = new EventEmitter2();
      emitter.on('admin.data.mutated', () => service.invalidateDashboardCache());
      await emitter.emitAsync('admin.data.mutated', {
        resourceType: 'LESSONS',
        action: 'UPDATE_LESSONS',
      });

      expect(cache.del).toHaveBeenCalledTimes(4);
      expect(cache.del).toHaveBeenCalledWith('lingoroad:admin:dashboard:7_DAYS');
      expect(cache.del).toHaveBeenCalledWith('lingoroad:admin:dashboard:30_DAYS');
      expect(cache.del).toHaveBeenCalledWith('lingoroad:admin:dashboard:90_DAYS');
      expect(cache.del).toHaveBeenCalledWith('lingoroad:admin:dashboard:ALL_TIME');
    });

    it('enforces 15s cooldown on forceRefresh=true when cached dashboard is fresh', async () => {
      const freshCached = {
        timeframe: '30_DAYS',
        generatedAt: new Date(Date.now() - 5_000).toISOString(),
      } as DashboardOverviewResponse;

      const prisma = { user: { count: jest.fn() } };
      const cache = {
        get: jest.fn().mockResolvedValue(freshCached),
        set: jest.fn(),
        del: jest.fn(),
      };
      const service = new AdminAnalyticsService(
        prisma as unknown as PrismaService,
        cache as unknown as AssessmentCacheService,
      );

      const result = await service.getDashboard('30_DAYS', true);
      expect(result).toBe(freshCached);
      expect(prisma.user.count).not.toHaveBeenCalled();
    });
  });

  describe('ClientIpThrottlerGuard IP normalization & login rate-limit audit', () => {
    it('normalizes Azure IPv4:port, IPv4-mapped IPv6, bracketed IPv6 and preserves raw IPv6', async () => {
      expect(normalizeClientIp('203.0.113.5:54321')).toBe('203.0.113.5');
      expect(normalizeClientIp('::ffff:203.0.113.5')).toBe('203.0.113.5');
      expect(normalizeClientIp('::ffff:203.0.113.5:54321')).toBe('203.0.113.5');
      expect(normalizeClientIp('[2001:db8::1]:54321')).toBe('2001:db8::1');
      expect(normalizeClientIp('2001:db8::1')).toBe('2001:db8::1');
      expect(
        normalizeForwardedForHeader('203.0.113.5:54321, 2001:db8::1, ::ffff:10.0.0.1:443'),
      ).toBe('203.0.113.5, 2001:db8::1, 10.0.0.1');

      const auditService = { record: jest.fn(async () => undefined) };
      const guard = new ClientIpThrottlerGuard(
        [{ ttl: 60000, limit: 10 }],
        {} as ThrottlerStorage,
        new Reflector(),
        auditService as unknown as AdminAuditService,
      );

      const getTracker = (guard as unknown as {
        getTracker: (req: Record<string, unknown>) => Promise<string>;
      }).getTracker.bind(guard);

      await expect(getTracker({ ip: '::ffff:198.51.100.9:12345' })).resolves.toBe(
        '198.51.100.9',
      );
      await expect(
        getTracker({ socket: { remoteAddress: '2001:db8::42' } }),
      ).resolves.toBe('2001:db8::42');
      await expect(getTracker({})).resolves.toBe('unknown');

      const throwThrottling = (guard as unknown as {
        throwThrottlingException: (
          ctx: ExecutionContext,
          detail: ThrottlerLimitDetail,
        ) => Promise<void>;
      }).throwThrottlingException.bind(guard);

      const loginCtx = buildHttpContext({
        method: 'POST',
        originalUrl: '/api/v1/admin/auth/login',
        body: { email: 'Admin@LingoRoad.local' },
      });

      await expect(
        throwThrottling(loginCtx, {
          limit: 10,
          ttl: 60000,
          key: 'k',
          tracker: '198.51.100.9',
          totalHits: 11,
          timeToExpire: 60,
          isBlocked: true,
          timeToBlockExpire: 60,
        }),
      ).rejects.toBeInstanceOf(ThrottlerException);

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADMIN_LOGIN_RATE_LIMITED',
          adminEmail: 'admin@lingoroad.local',
          statusCode: 429,
          ipAddress: '198.51.100.9',
        }),
      );
    });
  });
});
