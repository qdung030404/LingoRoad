import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseTokenService } from '../auth/firebase/firebase-token.service';
import { PasswordService } from '../security/password.service';
import { TokenService } from '../security/token.service';
import { AdminAuthService } from './services/admin-auth.service';
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
