import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  REFRESH_SESSION_CLEANUP_BATCH_SIZE,
  REFRESH_SESSION_CLEANUP_MAX_BATCH_SIZE,
  REFRESH_SESSION_RETENTION_DAYS,
  REFRESH_SESSION_RETENTION_MS,
  RefreshSessionRepository,
} from './refresh-session.repository';

describe('RefreshSessionRepository rotation', () => {
  it('claims an unused unexpired refresh session before issuing a replacement', async () => {
    const tx = { refreshSession: { updateMany: jest.fn(async () => ({ count: 1 })), create: jest.fn(async () => ({ id: 'new' })) } };
    const prisma = { $transaction: jest.fn(async (fn) => fn(tx)) };
    const repository = new RefreshSessionRepository(prisma as unknown as PrismaService);
    const result = await repository.rotateSession('old', { userId: 'owner', tokenHash: 'new-hash', expiresAt: new Date(Date.now() + 10000) });
    expect(result).toEqual({ id: 'new' });
    expect(tx.refreshSession.updateMany).toHaveBeenCalledWith({ where: { id: 'old', isRevoked: false, expiresAt: { gt: expect.any(Date) } }, data: { isRevoked: true } });
  });

  it('does not create another token when a concurrent rotation already claimed it', async () => {
    const tx = { refreshSession: { updateMany: jest.fn(async () => ({ count: 0 })), create: jest.fn() } };
    const prisma = { $transaction: jest.fn(async (fn) => fn(tx)) };
    const repository = new RefreshSessionRepository(prisma as unknown as PrismaService);
    await expect(repository.rotateSession('old', { userId: 'owner', tokenHash: 'new-hash', expiresAt: new Date() })).rejects.toThrow(UnauthorizedException);
    expect(tx.refreshSession.create).not.toHaveBeenCalled();
  });
});

describe('RefreshSessionRepository deleteExpiredSessions', () => {
  it('uses a default 7-day cutoff, LIMIT 1000, SKIP LOCKED, UTC cast, and omits is_revoked/created_at filters', async () => {
    const executeRaw = jest.fn(async () => 7);
    const prisma = { $executeRaw: executeRaw };
    const repository = new RefreshSessionRepository(prisma as unknown as PrismaService);

    const beforeCall = Date.now();
    const result = await repository.deleteExpiredSessions();
    const afterCall = Date.now();

    expect(REFRESH_SESSION_RETENTION_DAYS).toBe(7);
    expect(REFRESH_SESSION_CLEANUP_BATCH_SIZE).toBe(1000);
    expect(result).toEqual({ count: 7 });
    expect(executeRaw).toHaveBeenCalledTimes(1);

    const [strings, cutoffArg, limitArg] = executeRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      Date,
      number,
    ];
    const sql = strings.join('?');
    expect(sql).toContain('FROM "refresh_sessions"');
    expect(sql).toContain('expires_at < (?::timestamptz AT TIME ZONE \'UTC\')');
    expect(sql).toContain('ORDER BY expires_at ASC');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('DELETE FROM "refresh_sessions"');
    expect(sql).not.toContain('is_revoked');
    expect(sql).not.toContain('created_at');

    expect(cutoffArg).toBeInstanceOf(Date);
    expect(cutoffArg.getTime()).toBeGreaterThanOrEqual(
      beforeCall - REFRESH_SESSION_RETENTION_MS - 50,
    );
    expect(cutoffArg.getTime()).toBeLessThanOrEqual(
      afterCall - REFRESH_SESSION_RETENTION_MS + 50,
    );
    expect(limitArg).toBe(REFRESH_SESSION_CLEANUP_BATCH_SIZE);
  });

  it('clamps custom batchSize values within safe bounds', async () => {
    const executeRaw = jest.fn<
      Promise<number>,
      [TemplateStringsArray, Date, number]
    >(async () => 1);
    const prisma = { $executeRaw: executeRaw };
    const repository = new RefreshSessionRepository(prisma as unknown as PrismaService);
    const cutoff = new Date('2026-11-18T00:00:00.000Z');

    await repository.deleteExpiredSessions(cutoff, 0);
    await repository.deleteExpiredSessions(cutoff, -25);
    await repository.deleteExpiredSessions(cutoff, 2.9);
    await repository.deleteExpiredSessions(cutoff, 50_000);
    await repository.deleteExpiredSessions(cutoff, Number.NaN);

    const limits = executeRaw.mock.calls.map((call) => call[2]);
    expect(limits).toEqual([
      1,
      1,
      2,
      REFRESH_SESSION_CLEANUP_MAX_BATCH_SIZE,
      REFRESH_SESSION_CLEANUP_BATCH_SIZE,
    ]);
  });

  it('executes on the provided transaction client instead of root prisma', async () => {
    const rootExecuteRaw = jest.fn(async () => 0);
    const txExecuteRaw = jest.fn<
      Promise<number>,
      [TemplateStringsArray, Date, number]
    >(async () => 4);
    const prisma = { $executeRaw: rootExecuteRaw };
    const tx = { $executeRaw: txExecuteRaw } as unknown as Prisma.TransactionClient;
    const repository = new RefreshSessionRepository(prisma as unknown as PrismaService);
    const cutoff = new Date('2026-11-18T00:00:00.000Z');

    const result = await repository.deleteExpiredSessions(cutoff, 250, tx);

    expect(result).toEqual({ count: 4 });
    expect(txExecuteRaw).toHaveBeenCalledTimes(1);
    expect(rootExecuteRaw).not.toHaveBeenCalled();
    expect(txExecuteRaw.mock.calls[0][1]).toBe(cutoff);
    expect(txExecuteRaw.mock.calls[0][2]).toBe(250);
  });
});
