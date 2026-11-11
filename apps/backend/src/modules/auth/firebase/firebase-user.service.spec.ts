import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseUserService } from './firebase-user.service';

describe('Firebase account ownership', () => {
  const row = { id: 'internal-uuid', firebaseUid: 'uid', email: 'learner@example.com', name: 'Learner', role: UserRole.LEARNER, status: UserStatus.ACTIVE };
  const token = { uid: 'uid', email: row.email, name: 'Learner', role: 'ADMIN' } as unknown as DecodedIdToken;
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
  const service = new FirebaseUserService(prisma as unknown as PrismaService);
  beforeEach(() => jest.resetAllMocks());
  it('preserves internal UUID ownership and database roles', async () => {
    prisma.user.findUnique.mockResolvedValue(row);
    await expect(service.resolve(token)).resolves.toEqual({ sub: row.id, email: row.email, role: 'LEARNER', firebaseUid: 'uid' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it('provisions a profile without storing a password', async () => {
    prisma.user.findUnique.mockResolvedValue(null); prisma.user.create.mockResolvedValue(row);
    await service.resolve(token);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ firebaseUid: 'uid', profile: { create: {} } });
    expect(data.passwordHash).toBeUndefined();
  });
  it('never links an existing account by email alone', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5' }));
    await expect(service.resolve(token)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({ where: { firebaseUid: 'uid' } });
  });
  it('recovers concurrent provisioning of the same verified UID', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    prisma.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5' }));
    await expect(service.resolve(token)).resolves.toMatchObject({ sub: row.id });
  });
  it('does not grant a suspended learner access', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...row, status: UserStatus.SUSPENDED });
    await expect(service.resolve(token)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
