import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { InternalAuthGuard } from './internal-auth.guard';

describe('InternalAuthGuard', () => {
  let guard: InternalAuthGuard;
  let configService: jest.Mocked<ConfigService>;

  const mockRequest = (token?: string | string[]): Partial<Request> => ({
    ip: '127.0.0.1',
    headers: token !== undefined
      ? ({ 'x-internal-token': token } as Record<string, string | string[]>)
      : ({} as Record<string, string>),
  });

  const createExecutionContext = (request: Partial<Request>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new InternalAuthGuard(configService);
  });

  // ─── Happy path ───────────────────────────────────────────────────────────────

  it('should return true when the token matches', () => {
    configService.get.mockReturnValue('secret-token');
    guard = new InternalAuthGuard(configService);

    const ctx = createExecutionContext(mockRequest('secret-token'));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should return true when token is passed as an array header (proxy forwarding)', () => {
    configService.get.mockReturnValue('secret-token');
    guard = new InternalAuthGuard(configService);

    // Express may expose repeated headers as string[]
    const ctx = createExecutionContext(mockRequest(['secret-token']));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ─── Security: unified error (no info leak) ───────────────────────────────────

  it('should throw UnauthorizedException when token does not match', () => {
    configService.get.mockReturnValue('secret-token');
    guard = new InternalAuthGuard(configService);

    const ctx = createExecutionContext(mockRequest('wrong-token'));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when x-internal-token header is missing', () => {
    configService.get.mockReturnValue('secret-token');
    guard = new InternalAuthGuard(configService);

    const ctx = createExecutionContext(mockRequest());
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when ML_INTERNAL_TOKEN is not configured', () => {
    configService.get.mockReturnValue('');
    guard = new InternalAuthGuard(configService);

    const ctx = createExecutionContext(mockRequest('any-token'));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should always throw UNAUTHORIZED (not expose config reason)', () => {
    // Even when token is not configured, error code must be generic
    configService.get.mockReturnValue('');
    guard = new InternalAuthGuard(configService);
    const ctx = createExecutionContext(mockRequest('any-token'));

    try {
      guard.canActivate(ctx);
      fail('Expected UnauthorizedException');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      const body = (err as UnauthorizedException).getResponse() as Record<string, unknown>;
      expect(body.message).toBe('UNAUTHORIZED');
      // Must NOT expose 'INTERNAL_TOKEN_NOT_CONFIGURED'
      expect(body.message).not.toBe('INTERNAL_TOKEN_NOT_CONFIGURED');
    }
  });

  // ─── Security: timing attack resistance ──────────────────────────────────────

  it('should reject when token length differs (timing safe — no leak via length)', () => {
    configService.get.mockReturnValue('secret-token');
    guard = new InternalAuthGuard(configService);

    const ctx = createExecutionContext(mockRequest('short'));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
