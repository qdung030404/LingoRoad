import { BadRequestException, ConflictException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { GoogleLoginUseCase } from './google-login.use-case';
import { FirebaseAdminService } from '../../security/firebase-admin.service';
import { FirebaseTokenService } from '../firebase/firebase-token.service';
import { FirebaseUserService } from '../firebase/firebase-user.service';
import { ProfileService } from '../profile.service';

describe('Google login uses the shared Firebase session', () => {
  const verifier = { verifyIdToken: jest.fn() };
  const firebase = { enabled: true };
  const users = { resolve: jest.fn() };
  const profile = { get: jest.fn() };
  const service = new GoogleLoginUseCase(
    verifier as unknown as FirebaseAdminService,
    firebase as FirebaseTokenService,
    users as unknown as FirebaseUserService,
    profile as unknown as ProfileService,
  );
  const token = {
    uid: 'google-uid', email: 'learner@example.com', email_verified: true,
    firebase: { sign_in_provider: 'google.com' },
  } as DecodedIdToken;

  beforeEach(() => {
    jest.resetAllMocks();
    firebase.enabled = true;
    verifier.verifyIdToken.mockResolvedValue(token);
    users.resolve.mockResolvedValue({ sub: 'internal-uuid' });
    profile.get.mockResolvedValue({ id: 'internal-uuid', email: token.email, provider: 'GOOGLE' });
  });

  it('maps the verified UID through the existing resolver and returns a safe account without issuing tokens', async () => {
    await expect(service.execute({ idToken: 'firebase-id-token' })).resolves.toEqual({
      user: { id: 'internal-uuid', email: token.email, provider: 'GOOGLE' },
    });
    expect(verifier.verifyIdToken).toHaveBeenCalledWith('firebase-id-token');
    expect(users.resolve).toHaveBeenCalledWith(token);
    expect(profile.get).toHaveBeenCalledWith('internal-uuid');
  });

  it('disables Google auth when the application explicitly uses legacy sessions', async () => {
    firebase.enabled = false;
    await expect(service.execute({ idToken: 'token' })).rejects.toBeInstanceOf(BadRequestException);
    expect(verifier.verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([new UnauthorizedException('revoked'), new ServiceUnavailableException('unavailable')])(
    'preserves shared verification errors without provisioning an account', async (error) => {
      verifier.verifyIdToken.mockRejectedValue(error);
      await expect(service.execute({ idToken: 'token' })).rejects.toBe(error);
      expect(users.resolve).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ...token, firebase: { sign_in_provider: 'password' } },
    { ...token, firebase: undefined },
    { ...token, email_verified: false },
    { ...token, email: undefined },
  ])('rejects a non-Google or unverified identity', async (invalid) => {
    verifier.verifyIdToken.mockResolvedValue(invalid);
    await expect(service.execute({ idToken: 'token' })).rejects.toBeInstanceOf(BadRequestException);
    expect(users.resolve).not.toHaveBeenCalled();
  });

  it('does not fall back to linking by email when the UID resolver detects an account collision', async () => {
    const error = new ConflictException('AUTH_ACCOUNT_LINK_REQUIRED');
    users.resolve.mockRejectedValue(error);
    await expect(service.execute({ idToken: 'token' })).rejects.toBe(error);
    expect(profile.get).not.toHaveBeenCalled();
  });
});
