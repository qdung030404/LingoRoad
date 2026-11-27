import { ConfigService } from '@nestjs/config';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { FirebaseTokenService } from './firebase-token.service';

jest.mock('firebase-admin/app', () => ({ getApps: () => [], initializeApp: () => ({}), applicationDefault: () => ({}) }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('Firebase admin credential operations', () => {
  const sdk = { createUser: jest.fn(), updateUser: jest.fn(), revokeRefreshTokens: jest.fn(), deleteUser: jest.fn() };
  let service: FirebaseTokenService;
  beforeEach(() => {
    jest.resetAllMocks();
    (getAuth as jest.Mock).mockReturnValue(sdk);
    service = new FirebaseTokenService(new ConfigService({ FIREBASE_PROJECT_ID: 'test-project' }));
  });

  it('keeps a new identity disabled until the DB identity has been stored', async () => {
    await service.createPasswordUser('new-uid', 'new@example.com', 'Password123!', 'New user');
    expect(sdk.createUser).toHaveBeenCalledWith({ uid: 'new-uid', email: 'new@example.com', password: 'Password123!', displayName: 'New user', disabled: true });
    expect(sdk.updateUser).not.toHaveBeenCalled();
    await service.activatePasswordUser('new-uid');
    expect(sdk.updateUser).toHaveBeenCalledWith('new-uid', { disabled: false });
  });

  it('rejects an existing email instead of linking or overwriting its credentials', async () => {
    sdk.createUser.mockRejectedValue({ code: 'auth/email-already-exists' });
    await expect(service.createPasswordUser('new-uid', 'existing@example.com', 'Password123!', 'New')).rejects.toBeInstanceOf(ConflictException);
    expect(sdk.updateUser).not.toHaveBeenCalled();
    expect(sdk.deleteUser).not.toHaveBeenCalled();
  });

  it('updates the authoritative password and revokes its refresh tokens', async () => {
    await service.resetPassword('uid', 'Changed123!');
    expect(sdk.updateUser).toHaveBeenCalledWith('uid', { password: 'Changed123!' });
    expect(sdk.revokeRefreshTokens).toHaveBeenCalledWith('uid');
  });

  it('surfaces reset failure without exposing provider error details', async () => {
    sdk.updateUser.mockRejectedValue(new Error('sensitive SDK details'));
    await expect(service.resetPassword('uid', 'Changed123!')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sdk.revokeRefreshTokens).not.toHaveBeenCalled();
  });
});
