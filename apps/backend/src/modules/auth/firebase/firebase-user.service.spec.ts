import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthProvider, CefrLevel, Prisma, UserRole, UserStatus } from '@prisma/client';
import { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseUserService } from './firebase-user.service';

describe('Firebase account ownership', () => {
  const row = { id: 'internal-uuid', firebaseUid: 'uid', email: 'learner@example.com', name: 'Learner', role: UserRole.LEARNER, status: UserStatus.ACTIVE, provider: AuthProvider.GOOGLE };
  const token = { uid: 'uid', email: row.email, name: 'Learner', role: 'ADMIN', email_verified: true, firebase: { sign_in_provider: 'google.com' } } as unknown as DecodedIdToken;
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
  const service = new FirebaseUserService(prisma as unknown as PrismaService);
  beforeEach(() => jest.resetAllMocks());
  it('preserves internal UUID ownership and database roles', async () => {
    prisma.user.findUnique.mockResolvedValue(row);
    await expect(service.resolve(token)).resolves.toEqual({ sub: row.id, email: row.email, role: 'LEARNER', firebaseUid: 'uid' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it('provisions a profile without storing a password and sets domain defaults', async () => {
    prisma.user.findUnique.mockResolvedValue(null); prisma.user.create.mockResolvedValue(row);
    await service.resolve(token);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      firebaseUid: 'uid',
      provider: AuthProvider.GOOGLE,
      role: UserRole.LEARNER,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          targetCefr: CefrLevel.B1,
          dailyGoalMinutes: 10,
          reminderEnabled: true,
        },
      },
    });
    expect(data.passwordHash).toBeUndefined();
  });
  it('rejects an unverified email token for google provider', async () => {
    const unverifiedGoogleToken = {
      ...token,
      email_verified: false,
      firebase: { sign_in_provider: 'google.com' },
    } as unknown as DecodedIdToken;
    await expect(service.resolve(unverifiedGoogleToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
  it('permits non-google provider and sets provider to LOCAL', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ ...row, provider: AuthProvider.LOCAL });
    const passwordToken = {
      ...token,
      firebase: { sign_in_provider: 'password' },
    } as unknown as DecodedIdToken;
    const result = await service.resolve(passwordToken);
    expect(result).toMatchObject({ sub: row.id });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: AuthProvider.LOCAL,
        }),
      }),
    );
  });
  it('rejects google sso login for admin account', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...row, role: UserRole.ADMIN });
    await expect(service.resolve(token)).rejects.toThrow(
      new ForbiddenException({
        code: 'AUTH_ADMIN_GOOGLE_LINK_RESTRICTED',
        message: 'Tài khoản Quản trị viên không được phép đăng nhập qua Google SSO.',
      }),
    );
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
  it('falls back to email prefix when token name is empty or whitespace', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(row);
    const emptyNameToken = { ...token, name: '   ' } as unknown as DecodedIdToken;
    await service.resolve(emptyNameToken);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.name).toBe('learner');
  });
  it('rejects token with missing uid or email', async () => {
    const invalidToken1 = { ...token, uid: '' } as unknown as DecodedIdToken;
    await expect(service.resolve(invalidToken1)).rejects.toBeInstanceOf(UnauthorizedException);

    const invalidToken2 = { ...token, email: undefined } as unknown as DecodedIdToken;
    await expect(service.resolve(invalidToken2)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('converts uppercase email to lowercase on create', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(row);
    const upperToken = { ...token, email: 'TEST.LEARNER@EXAMPLE.COM' } as unknown as DecodedIdToken;
    await service.resolve(upperToken);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.email).toBe('test.learner@example.com');
  });
  it('drops insecure http avatarUrl to null', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(row);
    const httpPictureToken = { ...token, picture: 'http://insecure.com/avatar.png' } as unknown as DecodedIdToken;
    await service.resolve(httpPictureToken);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.avatarUrl).toBeNull();
  });
  it('truncates name exceeding 100 characters to 100 characters', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(row);
    const longName = 'a'.repeat(120);
    const longNameToken = { ...token, name: longName } as unknown as DecodedIdToken;
    await service.resolve(longNameToken);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.name).toHaveLength(100);
    expect(data.name).toBe('a'.repeat(100));
  });
  it('truncates avatarUrl exceeding 500 characters to 500 characters', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(row);
    const longPicture = `https://example.com/${'p'.repeat(600)}`;
    const longPicToken = { ...token, picture: longPicture } as unknown as DecodedIdToken;
    await service.resolve(longPicToken);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.avatarUrl).toHaveLength(500);
    expect(data.avatarUrl.startsWith('https://')).toBe(true);
  });
  it('does not grant a suspended learner access', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...row, status: UserStatus.SUSPENDED });
    await expect(service.resolve(token)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not grant a deleted learner access', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...row, status: UserStatus.DELETED });
    await expect(service.resolve(token)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
