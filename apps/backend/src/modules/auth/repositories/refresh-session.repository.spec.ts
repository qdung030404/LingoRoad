import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshSessionRepository } from './refresh-session.repository';

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
