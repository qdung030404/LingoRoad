import { UnauthorizedException } from '@nestjs/common';
import { FirebaseTokenService } from '../auth/firebase/firebase-token.service';
import { FirebaseAdminService } from './firebase-admin.service';

describe('Firebase Admin compatibility adapter', () => {
  const firebase = { verify: jest.fn() };
  const adapter = new FirebaseAdminService(firebase as unknown as FirebaseTokenService);
  beforeEach(() => jest.resetAllMocks());

  it('delegates verification to the shared project and revocation-aware verifier', async () => {
    const token = { uid: 'same-uid' };
    firebase.verify.mockResolvedValue(token);
    await expect(adapter.verifyIdToken('id-token')).resolves.toBe(token);
    expect(firebase.verify).toHaveBeenCalledWith('id-token');
  });

  it('preserves revoked or invalid token failures', async () => {
    const error = new UnauthorizedException('revoked');
    firebase.verify.mockRejectedValue(error);
    await expect(adapter.verifyIdToken('old-token')).rejects.toBe(error);
  });
});
