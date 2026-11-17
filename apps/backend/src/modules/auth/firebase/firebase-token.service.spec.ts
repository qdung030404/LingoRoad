import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { FirebaseTokenService, maskEmail } from './firebase-token.service';

jest.mock('firebase-admin/app', () => ({ getApps: jest.fn(() => []), initializeApp: jest.fn(() => ({})), applicationDefault: jest.fn(() => ({})), cert: jest.fn(() => ({})) }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('Firebase token verification', () => {
  const verifyIdToken = jest.fn();
  beforeEach(() => { jest.clearAllMocks(); (getAuth as jest.Mock).mockReturnValue({ verifyIdToken }); });
  const service = () => new FirebaseTokenService(new ConfigService({ FIREBASE_PROJECT_ID: 'test-project' }));
  it('uses Admin verification with local check by default (checkRevoked = false)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'verified' });
    await expect(service().verify('id-token')).resolves.toEqual({ uid: 'verified' });
    expect(verifyIdToken).toHaveBeenCalledWith('id-token', false);
  });
  it('supports verify with revocation check when checkRevoked is true', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'verified' });
    await expect(service().verify('id-token', true)).resolves.toEqual({ uid: 'verified' });
    expect(verifyIdToken).toHaveBeenCalledWith('id-token', true);
  });
  it.each(['auth/invalid-id-token','auth/id-token-expired','auth/id-token-revoked','auth/user-disabled'])( 'rejects %s as unauthorized', async (code) => {
    verifyIdToken.mockRejectedValue({ code });
    await expect(service().verify('bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('keeps infrastructure failures distinct from expired credentials', async () => {
    verifyIdToken.mockRejectedValue({ code: 'app/network-error' });
    await expect(service().verify('token')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('initializes with cert when FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are set', async () => {
    const s = new FirebaseTokenService(new ConfigService({
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_CLIENT_EMAIL: 'test@example.com',
      FIREBASE_PRIVATE_KEY: '"-----BEGIN PRIVATE KEY-----\\nMIIE\\n-----END PRIVATE KEY-----"',
    }));
    verifyIdToken.mockResolvedValue({ uid: 'verified' });
    await expect(s.verify('id-token')).resolves.toEqual({ uid: 'verified' });
  });
  it('supports Base64 encoded FIREBASE_PRIVATE_KEY', async () => {
    const pemKey = '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----';
    const base64Key = Buffer.from(pemKey).toString('base64');
    const s = new FirebaseTokenService(new ConfigService({
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_CLIENT_EMAIL: 'test@example.com',
      FIREBASE_PRIVATE_KEY: base64Key,
    }));
    verifyIdToken.mockResolvedValue({ uid: 'verified' });
    await expect(s.verify('id-token')).resolves.toEqual({ uid: 'verified' });
  });
  it('eagerly initializes client in onModuleInit if projectId is present', () => {
    const s = new FirebaseTokenService(new ConfigService({
      FIREBASE_PROJECT_ID: 'test-project',
    }));
    expect(() => s.onModuleInit()).not.toThrow();
  });
  it('supports verify without revocation check when checkRevoked is false', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'verified' });
    await expect(service().verify('id-token', false)).resolves.toEqual({ uid: 'verified' });
    expect(verifyIdToken).toHaveBeenCalledWith('id-token', false);
  });
  it('throws ServiceUnavailableException AUTH_NOT_CONFIGURED if FIREBASE_PROJECT_ID is missing', async () => {
    const s = new FirebaseTokenService(new ConfigService({}));
    await expect(s.verify('id-token')).rejects.toMatchObject({
      response: { code: 'AUTH_NOT_CONFIGURED' },
    });
  });
  it('throws ServiceUnavailableException AUTH_NOT_CONFIGURED if FIREBASE_CLIENT_EMAIL is set but FIREBASE_PRIVATE_KEY is missing', async () => {
    const s = new FirebaseTokenService(new ConfigService({
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_CLIENT_EMAIL: 'test@example.com',
    }));
    await expect(s.verify('id-token')).rejects.toMatchObject({
      response: { code: 'AUTH_NOT_CONFIGURED' },
    });
  });
  it('throws ServiceUnavailableException AUTH_NOT_CONFIGURED if FIREBASE_PRIVATE_KEY is set but FIREBASE_CLIENT_EMAIL is missing', async () => {
    const s = new FirebaseTokenService(new ConfigService({
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_PRIVATE_KEY: 'test-key',
    }));
    await expect(s.verify('id-token')).rejects.toMatchObject({
      response: { code: 'AUTH_NOT_CONFIGURED' },
    });
  });
  it('does not run emulator verification in production', () => {
    const previous = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const previousMode = process.env.NODE_ENV;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.NODE_ENV = 'production';
    try { expect(() => service().onModuleInit()).toThrow('never'); }
    finally {
      if (previous === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST; else process.env.FIREBASE_AUTH_EMULATOR_HOST = previous;
      if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
    }
  });

  it('revokes refresh tokens for a user', async () => {
    const revokeRefreshTokens = jest.fn().mockResolvedValue(undefined);
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken, revokeRefreshTokens });
    await expect(service().revoke('uid-123')).resolves.toBeUndefined();
    expect(revokeRefreshTokens).toHaveBeenCalledWith('uid-123');
  });

  it('maps malformed JWT decoding error without code to UnauthorizedException', async () => {
    verifyIdToken.mockRejectedValue(new Error('Decoding Firebase ID token failed. Format error.'));
    await expect(service().verify('malformed')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('maskEmail', () => {
  it('masks normal email addresses', () => {
    expect(maskEmail('user@example.com')).toBe('u***r@example.com');
    expect(maskEmail('longname@domain.org')).toBe('l***e@domain.org');
  });
  it('masks short local parts', () => {
    expect(maskEmail('ab@example.com')).toBe('***@example.com');
    expect(maskEmail('a@example.com')).toBe('***@example.com');
  });
  it('handles missing or malformed email', () => {
    expect(maskEmail('invalid')).toBe('***');
    expect(maskEmail(null)).toBe('<anonymous>');
    expect(maskEmail(undefined)).toBe('<anonymous>');
  });
});
