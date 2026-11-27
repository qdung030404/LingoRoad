import {
  BadRequestException,
  ExecutionContext,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssessmentCacheService } from '../assessment/services/assessment-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseTokenService } from '../auth/firebase/firebase-token.service';
import { PasswordService } from '../security/password.service';
import { TokenService } from '../security/token.service';
import { AdminChangePasswordDto } from './dto/admin-auth.dto';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import {
  AdminAuditRequest,
  AdminAuthService,
  buildAdminLoginFailKey,
} from './services/admin-auth.service';
import { AdminUsersService } from './services/admin-users.service';

jest.mock('firebase-admin/app', () => ({}));
jest.mock('firebase-admin/auth', () => ({}));

const user = {
  id: 'user-1', email: 'learner@example.com', name: 'Learner', role: 'LEARNER',
  status: 'ACTIVE', firebaseUid: 'firebase-1', profile: null,
  _count: { learningAttempts: 0, placementSessions: 0, vocabularyDecks: 0, speakingSubmissions: 0 },
};

describe('Admin Firebase identity management', () => {
  const firebase = {
    enabled: true, createPasswordUser: jest.fn(), activatePasswordUser: jest.fn(),
    removeProvisionedUser: jest.fn(), resetPassword: jest.fn(), revoke: jest.fn(),
  };
  const password = { hash: jest.fn(async () => 'hashed') };
  const tx = { user: { create: jest.fn(), update: jest.fn() }, refreshSession: { updateMany: jest.fn() } };
  const prisma = { user: { findUnique: jest.fn(), delete: jest.fn() }, $transaction: jest.fn(async (fn) => fn(tx)) };
  const service = new AdminUsersService(prisma as unknown as PrismaService, password as unknown as PasswordService, firebase as unknown as FirebaseTokenService);
  beforeEach(() => {
    jest.clearAllMocks();
    firebase.createPasswordUser.mockResolvedValue(undefined);
    firebase.activatePasswordUser.mockResolvedValue(undefined);
    firebase.removeProvisionedUser.mockResolvedValue(undefined);
    firebase.resetPassword.mockResolvedValue(undefined);
    firebase.revoke.mockResolvedValue(undefined);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.delete.mockResolvedValue(user);
    prisma.$transaction.mockImplementation(async (fn) => fn(tx));
    tx.user.create.mockResolvedValue(user);
    tx.user.update.mockResolvedValue(user);
  });

  it('provisions learner credentials and activates Firebase only after DB transaction commits', async () => {
    const order: string[] = [];
    firebase.createPasswordUser.mockImplementationOnce(async () => { order.push('createPasswordUser'); });
    prisma.$transaction.mockImplementationOnce(async (fn) => {
      order.push('tx:start');
      const result = await fn(tx);
      order.push('tx:commit');
      return result;
    });
    tx.user.create.mockImplementationOnce(async () => {
      order.push('tx:user.create');
      return user;
    });
    firebase.activatePasswordUser.mockImplementationOnce(async () => { order.push('activatePasswordUser'); });

    await service.createUser({ email: 'LEARNER@example.com', name: 'Learner', password: 'Password123!' });
    const uid = firebase.createPasswordUser.mock.calls[0][0];
    expect(firebase.createPasswordUser).toHaveBeenCalledWith(uid, 'learner@example.com', 'Password123!', 'Learner');
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ firebaseUid: uid, passwordHash: null }) }));
    expect(firebase.activatePasswordUser).toHaveBeenCalledWith(uid);
    expect(order).toEqual(['createPasswordUser', 'tx:start', 'tx:user.create', 'tx:commit', 'activatePasswordUser']);
  });

  it('compensates both DB user and Firebase identity if post-commit activation fails', async () => {
    firebase.activatePasswordUser.mockRejectedValueOnce(new Error('Firebase activation failed'));
    await expect(service.createUser({ email: 'learner@example.com', name: 'Learner', password: 'Password123!' })).rejects.toThrow('Firebase activation failed');
    const uid = firebase.createPasswordUser.mock.calls[0][0];
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: user.id } });
    expect(firebase.removeProvisionedUser).toHaveBeenCalledWith(uid);
  });

  it('surfaces ADMIN_FIREBASE_CLEANUP_FAILED when post-commit compensation cannot delete DB or Firebase user', async () => {
    firebase.activatePasswordUser.mockRejectedValueOnce(new Error('Firebase activation failed'));
    prisma.user.delete.mockRejectedValueOnce(new Error('DB delete failed'));
    await expect(service.createUser({ email: 'learner@example.com', name: 'Learner', password: 'Password123!' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(firebase.removeProvisionedUser).toHaveBeenCalledWith(firebase.createPasswordUser.mock.calls[0][0]);
  });

  it('keeps newly created admins on internal password authentication', async () => {
    await service.createUser({ email: 'admin@example.com', name: 'Admin', password: 'Password123!', role: 'ADMIN' });
    expect(firebase.createPasswordUser).not.toHaveBeenCalled();
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ passwordHash: 'hashed', role: 'ADMIN' }) }));
  });

  it('does not create a DB user when Firebase provisioning fails', async () => {
    firebase.createPasswordUser.mockRejectedValueOnce(new Error('Firebase unavailable'));
    await expect(service.createUser({ email: 'learner@example.com', name: 'Learner', password: 'Password123!' })).rejects.toThrow();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('compensates only the identity provisioned by this request if DB creation fails', async () => {
    tx.user.create.mockRejectedValueOnce(new Error('DB conflict'));
    await expect(service.createUser({ email: 'learner@example.com', name: 'Learner', password: 'Password123!' })).rejects.toThrow('DB conflict');
    expect(firebase.removeProvisionedUser).toHaveBeenCalledWith(firebase.createPasswordUser.mock.calls[0][0]);
  });

  it('resets Firebase credentials before reporting a password reset as successful', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await service.updateUser('admin-1', user.id, { password: 'Changed123!' });
    expect(firebase.resetPassword).toHaveBeenCalledWith(user.firebaseUid, 'Changed123!');
    expect(tx.refreshSession.updateMany).toHaveBeenCalled();
    // resetPassword owns Firebase revocation; avoid a second provider call after commit.
    expect(firebase.revoke).not.toHaveBeenCalled();
  });

  it('does not report a successful DB-only reset if Firebase fails', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    firebase.resetPassword.mockRejectedValueOnce(new Error('Firebase unavailable'));
    await expect(service.updateUser('admin-1', user.id, { password: 'Changed123!' })).rejects.toThrow();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('Admin refresh rotation claim', () => {
  it('allows only one concurrent exchange of the same token', async () => {
    let revoked = false;
    const create = jest.fn();
    const updateMany = jest.fn(async () => {
      if (revoked) return { count: 0 };
      revoked = true;
      return { count: 1 };
    });
    const prisma = {
      refreshSession: { findUnique: jest.fn(async () => ({ id: 'old', isRevoked: false, expiresAt: new Date(Date.now() + 60000), user: { ...user, role: 'ADMIN' } })) },
      $transaction: async (fn: (tx: { refreshSession: { updateMany: typeof updateMany; create: typeof create } }) => Promise<unknown>) => fn({ refreshSession: { updateMany, create } }),
    };
    const tokens = { hashToken: (value: string) => value, generateTokenPair: async () => ({ accessToken: 'access', refreshToken: 'refresh', tokenHash: 'hash', expiresAt: new Date(Date.now() + 60000) }) };
    const service = new AdminAuthService(prisma as unknown as PrismaService, {} as PasswordService, tokens as unknown as TokenService);
    const results = await Promise.allSettled([service.refresh({ refreshToken: 'same-token' }), service.refresh({ refreshToken: 'same-token' })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(UnauthorizedException);
    expect(create).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ isRevoked: false, expiresAt: { gt: expect.any(Date) }, user: { role: 'ADMIN', status: 'ACTIVE' } }) }));
  });
});

describe('Wave 2 Admin Auth Security Hardening', () => {
  describe('AdminJwtGuard tokenVersion revocation', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => false),
    } as unknown as Reflector;
    const jwtService = { verifyAsync: jest.fn() };
    const prisma = { user: { findUnique: jest.fn() } };
    const guard = new AdminJwtGuard(
      reflector,
      jwtService as unknown as JwtService,
      prisma as unknown as PrismaService,
    );

    const makeCtx = (token: string) => {
      const req = { headers: { authorization: `Bearer ${token}` }, user: undefined };
      return {
        req,
        ctx: {
          getHandler: () => null,
          getClass: () => null,
          switchToHttp: () => ({ getRequest: () => req }),
        } as unknown as ExecutionContext,
      };
    };

    beforeEach(() => {
      jest.clearAllMocks();
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    });

    it('rejects JWT with stale tv when user tokenVersion incremented', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'admin-1',
        email: 'admin@lingoroad.local',
        role: UserRole.ADMIN,
        tv: 1,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@lingoroad.local',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        firebaseUid: null,
        tokenVersion: 2,
      });

      const { ctx } = makeCtx('stale-jwt');
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_SESSION_REVOKED' }),
      });
    });

    it('rejects legacy JWT without tv once user tokenVersion > 0', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'admin-1',
        email: 'admin@lingoroad.local',
        role: UserRole.ADMIN,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@lingoroad.local',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        firebaseUid: null,
        tokenVersion: 1,
      });

      const { ctx } = makeCtx('legacy-jwt');
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_SESSION_REVOKED' }),
      });
    });

    it('accepts JWT when tv matches user tokenVersion and legacy JWT when tokenVersion is 0', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        sub: 'admin-1',
        email: 'admin@lingoroad.local',
        role: UserRole.ADMIN,
        tv: 3,
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@lingoroad.local',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        firebaseUid: null,
        tokenVersion: 3,
      });
      await expect(guard.canActivate(makeCtx('fresh-jwt').ctx)).resolves.toBe(true);

      jwtService.verifyAsync.mockResolvedValueOnce({
        sub: 'admin-1',
        email: 'admin@lingoroad.local',
        role: UserRole.ADMIN,
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@lingoroad.local',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        firebaseUid: null,
        tokenVersion: 0,
      });
      await expect(guard.canActivate(makeCtx('legacy-zero-jwt').ctx)).resolves.toBe(true);
    });
  });

  describe('AdminAuthService changePassword, logoutAll, logout actor & brute-force lockout', () => {
    const createInMemoryCache = () => {
      const store = new Map<string, unknown>();
      return {
        store,
        get: jest.fn(async <T>(key: string) => (store.get(key) as T | undefined) ?? null),
        set: jest.fn(async (key: string, value: unknown) => {
          store.set(key, value);
        }),
        del: jest.fn(async (key: string) => {
          store.delete(key);
        }),
      };
    };

    const adminRecord = {
      id: 'admin-1',
      email: 'admin@lingoroad.local',
      name: 'Super Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      avatarUrl: null,
      passwordHash: 'stored-hash',
      firebaseUid: 'fb-admin-1',
      tokenVersion: 2,
    };

    it('validates AdminChangePasswordDto complexity rules', async () => {
      const weak = plainToInstance(AdminChangePasswordDto, {
        currentPassword: 'OldPassword1',
        newPassword: 'alllowercase1',
      });
      expect((await validate(weak)).length).toBeGreaterThan(0);

      const noDigit = plainToInstance(AdminChangePasswordDto, {
        currentPassword: 'OldPassword1',
        newPassword: 'NoDigitPassword',
      });
      expect((await validate(noDigit)).length).toBeGreaterThan(0);

      const strong = plainToInstance(AdminChangePasswordDto, {
        currentPassword: 'OldPassword1',
        newPassword: 'NewStrongPass9',
      });
      expect(await validate(strong)).toHaveLength(0);
    });

    it('changePassword rejects wrong currentPassword (401) and unchanged password (400)', async () => {
      const prisma = { user: { findUnique: jest.fn().mockResolvedValue(adminRecord) } };
      const passwordService = {
        verify: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
        hash: jest.fn(),
      };
      const service = new AdminAuthService(
        prisma as unknown as PrismaService,
        passwordService as unknown as PasswordService,
        {} as TokenService,
      );

      await expect(
        service.changePassword('admin-1', {
          currentPassword: 'Wrong123',
          newPassword: 'NewPassword1',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'AUTH_INVALID_CURRENT_PASSWORD' }),
      });

      await expect(
        service.changePassword('admin-1', {
          currentPassword: 'SamePassword1',
          newPassword: 'SamePassword1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(passwordService.hash).not.toHaveBeenCalled();
    });

    it('changePassword syncs Firebase before DB commit, increments tokenVersion, revokes sessions, issues new pair and clears lockout', async () => {
      const order: string[] = [];
      const cache = createInMemoryCache();
      cache.store.set(buildAdminLoginFailKey(adminRecord.email), {
        count: 3,
        firstFailedAt: Date.now(),
      });
      const firebase = {
        enabled: true,
        resetPassword: jest.fn(async () => {
          order.push('firebase.resetPassword');
        }),
        revoke: jest.fn(),
      };
      const tx = {
        user: {
          update: jest.fn(async () => {
            order.push('tx.user.update');
            return { ...adminRecord, tokenVersion: 3 };
          }),
        },
        refreshSession: {
          updateMany: jest.fn(async () => {
            order.push('tx.refreshSession.updateMany');
            return { count: 2 };
          }),
          create: jest.fn(async () => {
            order.push('tx.refreshSession.create');
            return {};
          }),
        },
      };
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(adminRecord) },
        $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      };
      const passwordService = {
        verify: jest.fn().mockResolvedValue(true),
        hash: jest.fn().mockResolvedValue('new-argon2-hash'),
      };
      const tokenService = {
        generateTokenPair: jest.fn(async () => ({
          accessToken: 'new-access-tv3',
          refreshToken: 'new-refresh-tv3',
          tokenHash: 'new-hash',
          expiresAt: new Date(Date.now() + 3600_000),
        })),
      };

      const service = new AdminAuthService(
        prisma as unknown as PrismaService,
        passwordService as unknown as PasswordService,
        tokenService as unknown as TokenService,
        cache as unknown as AssessmentCacheService,
        firebase as unknown as FirebaseTokenService,
      );

      const res = await service.changePassword(
        'admin-1',
        { currentPassword: 'OldPassword1', newPassword: 'NewPassword2' },
        { ipAddress: '::ffff:203.0.113.5:54321', deviceIdentifier: 'browser-1' },
      );

      expect(res.accessToken).toBe('new-access-tv3');
      expect(order).toEqual([
        'firebase.resetPassword',
        'tx.user.update',
        'tx.refreshSession.updateMany',
        'tx.refreshSession.create',
      ]);
      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            passwordHash: 'new-argon2-hash',
            tokenVersion: { increment: 1 },
          },
        }),
      );
      expect(tokenService.generateTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 3 }),
      );
      expect(tx.refreshSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ipAddress: '203.0.113.5' }),
        }),
      );
      expect(cache.del).toHaveBeenCalledWith(buildAdminLoginFailKey(adminRecord.email));
    });

    it('logoutAll increments tokenVersion, revokes all active sessions and revokes Firebase', async () => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue({}) },
        refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 4 }) },
      };
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1', firebaseUid: 'fb-admin-1' }) },
        $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      };
      const firebase = { enabled: true, revoke: jest.fn().mockResolvedValue(undefined) };

      const service = new AdminAuthService(
        prisma as unknown as PrismaService,
        {} as PasswordService,
        {} as TokenService,
        undefined,
        firebase as unknown as FirebaseTokenService,
      );

      const result = await service.logoutAll('admin-1');
      expect(result).toEqual({ revokedSessionsCount: 4 });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(tx.refreshSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'admin-1', isRevoked: false },
        data: { isRevoked: true },
      });
      expect(firebase.revoke).toHaveBeenCalledWith('fb-admin-1');
    });

    it('logout attaches resolved __auditActor from refreshSession before revoking', async () => {
      const prisma = {
        refreshSession: {
          findUnique: jest.fn().mockResolvedValue({
            user: { id: 'admin-1', email: 'admin@lingoroad.local' },
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const tokenService = { hashToken: jest.fn((t: string) => `hash:${t}`) };
      const service = new AdminAuthService(
        prisma as unknown as PrismaService,
        {} as PasswordService,
        tokenService as unknown as TokenService,
      );

      const req = { headers: {} } as unknown as AdminAuditRequest;
      await service.logout({ refreshToken: 'refresh-token-123456' }, req);
      expect(req.__auditActor).toEqual({
        userId: 'admin-1',
        email: 'admin@lingoroad.local',
      });
    });

    it('locks account after 5 failed logins and throws 429 AUTH_ACCOUNT_LOCKED without calling passwordService.verify', async () => {
      const cache = createInMemoryCache();
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(adminRecord) },
        refreshSession: { create: jest.fn().mockResolvedValue({}) },
      };
      const passwordService = {
        verify: jest.fn().mockResolvedValue(false),
        dummyVerify: jest.fn().mockResolvedValue(undefined),
      };
      const tokenService = {
        generateTokenPair: jest.fn().mockResolvedValue({
          accessToken: 'acc',
          refreshToken: 'ref',
          tokenHash: 'hash',
          expiresAt: new Date(Date.now() + 60_000),
        }),
      };
      const service = new AdminAuthService(
        prisma as unknown as PrismaService,
        passwordService as unknown as PasswordService,
        tokenService as unknown as TokenService,
        cache as unknown as AssessmentCacheService,
      );

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.login({ email: 'Admin@LingoRoad.local', password: 'WrongPassword1' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }

      expect(passwordService.verify).toHaveBeenCalledTimes(5);
      passwordService.verify.mockClear();
      passwordService.dummyVerify.mockClear();

      let lockedError: unknown;
      try {
        await service.login({ email: 'admin@lingoroad.local', password: 'CorrectPassword1' });
      } catch (err) {
        lockedError = err;
      }

      expect(lockedError).toBeInstanceOf(HttpException);
      expect((lockedError as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((lockedError as HttpException).getResponse()).toMatchObject({
        code: 'AUTH_ACCOUNT_LOCKED',
        retryAfterSeconds: expect.any(Number),
      });
      // Zero Argon2id memory/CPU cost while locked!
      expect(passwordService.verify).not.toHaveBeenCalled();
      expect(passwordService.dummyVerify).not.toHaveBeenCalled();
    });
  });

  describe('AdminUsersService increments tokenVersion on session revocation', () => {
    it('increments tokenVersion when suspending/demoting/resetting password, but not on name-only update', async () => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue(user) },
        refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(user) },
        $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      };
      const password = { hash: jest.fn().mockResolvedValue('hashed-pw') };
      const service = new AdminUsersService(
        prisma as unknown as PrismaService,
        password as unknown as PasswordService,
      );

      await service.updateUser('admin-1', user.id, { name: 'Updated Name' });
      expect(tx.user.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ tokenVersion: { increment: 1 } }),
        }),
      );

      await service.updateUser('admin-1', user.id, { status: UserStatus.SUSPENDED });
      expect(tx.user.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
        }),
      );
    });
  });

  describe('PasswordService Argon2id FIFO concurrency semaphore', () => {
    it('bounds concurrent verify calls to 2 and throws 503 when wait queue exceeds 10', async () => {
      const resolvers: Array<() => void> = [];
      let inFlight = 0;
      let peakInFlight = 0;

      const verifySpy = jest.spyOn(argon2, 'verify').mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            inFlight += 1;
            peakInFlight = Math.max(peakInFlight, inFlight);
            resolvers.push(() => {
              inFlight -= 1;
              resolve(true);
            });
          }),
      );

      try {
        const service = new PasswordService();
        // Launch 2 active + 10 queued = 12 allowed
        const pending: Array<Promise<boolean>> = [];
        for (let i = 0; i < 12; i += 1) {
          pending.push(service.verify('fake-hash', `pw-${i}`));
        }

        // Wait a microtask so active slots engage
        await Promise.resolve();
        expect(peakInFlight).toBe(2);

        // 13th concurrent request overflows queue cap 10 -> 503 ServiceUnavailableException
        await expect(service.verify('fake-hash', 'overflow')).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );

        // Drain all 12 FIFO tasks cleanly
        while (resolvers.length > 0) {
          const release = resolvers.shift()!;
          release();
          await Promise.resolve();
          await Promise.resolve();
        }

        const results = await Promise.all(pending);
        expect(results).toHaveLength(12);
        expect(results.every(Boolean)).toBe(true);
        expect(peakInFlight).toBe(2);
      } finally {
        verifySpy.mockRestore();
      }
    });
  });
});
