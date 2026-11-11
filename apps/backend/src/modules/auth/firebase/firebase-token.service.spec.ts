import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { FirebaseTokenService } from './firebase-token.service';

jest.mock('firebase-admin/app', () => ({ getApps: jest.fn(() => []), initializeApp: jest.fn(() => ({})), applicationDefault: jest.fn(() => ({})) }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('Firebase token verification', () => {
  const verifyIdToken = jest.fn();
  beforeEach(() => { jest.clearAllMocks(); (getAuth as jest.Mock).mockReturnValue({ verifyIdToken }); });
  const service = () => new FirebaseTokenService(new ConfigService({ FIREBASE_PROJECT_ID: 'test-project' }));
  it('uses Admin verification with revocation checks', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'verified' });
    await expect(service().verify('id-token')).resolves.toEqual({ uid: 'verified' });
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
});
