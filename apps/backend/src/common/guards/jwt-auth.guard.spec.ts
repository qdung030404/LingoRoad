import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { FirebaseTokenService } from '../../modules/auth/firebase/firebase-token.service';
import { FirebaseUserService } from '../../modules/auth/firebase/firebase-user.service';

jest.mock('firebase-admin/app', () => ({}));
jest.mock('firebase-admin/auth', () => ({}));

describe('Firebase protected routes', () => {
  const verify = jest.fn(), resolve = jest.fn();
  const reflector = { getAllAndOverride: jest.fn(() => false) };
  const guard = new JwtAuthGuard(reflector as unknown as Reflector, { enabled: true, verify } as unknown as FirebaseTokenService, { resolve } as unknown as FirebaseUserService);
  const context = (request: object) => ({ getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;
  beforeEach(() => jest.clearAllMocks());
  it('requires a Bearer token', async () => {
    await expect(guard.canActivate(context({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });
  it('attaches only the verified database principal', async () => {
    const req = { headers: { authorization: 'Bearer verified-token' }, user: undefined };
    verify.mockResolvedValue({ uid: 'uid' }); resolve.mockResolvedValue({ sub: 'uuid', role: 'LEARNER' });
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(req.user).toEqual({ sub: 'uuid', role: 'LEARNER' });
  });
  it('rejects tokens exceeding 4096 characters to prevent DoS', async () => {
    const longToken = 'a'.repeat(4097);
    const req = { headers: { authorization: `Bearer ${longToken}` } };
    await expect(guard.canActivate(context(req))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });
  it('allows token with exact 4096 characters', async () => {
    const exactToken = 'a'.repeat(4096);
    const req = { headers: { authorization: `Bearer ${exactToken}` }, user: undefined };
    verify.mockResolvedValue({ uid: 'uid' }); resolve.mockResolvedValue({ sub: 'uuid', role: 'LEARNER' });
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith(exactToken);
  });
});
