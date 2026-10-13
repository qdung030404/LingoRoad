import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalAuthGuard } from './internal-auth.guard';

describe('InternalAuthGuard', () => {
  let guard: InternalAuthGuard;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new InternalAuthGuard(configService);
  });

  function createMockContext(headers: Record<string, string | undefined>, user?: { role?: string }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          user,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access if x-internal-token matches configured ML_INTERNAL_TOKEN', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ML_INTERNAL_TOKEN') return 'secret-token-123';
      if (key === 'NODE_ENV') return 'production';
      return null;
    });

    const context = createMockContext({ 'x-internal-token': 'secret-token-123' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user is ADMIN', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ML_INTERNAL_TOKEN') return 'secret-token-123';
      if (key === 'NODE_ENV') return 'production';
      return null;
    });

    const context = createMockContext({}, { role: 'ADMIN' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException if token does not match in production', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ML_INTERNAL_TOKEN') return 'secret-token-123';
      if (key === 'NODE_ENV') return 'production';
      return null;
    });

    const context = createMockContext({ 'x-internal-token': 'wrong-token' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should allow access in development if token is not configured', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ML_INTERNAL_TOKEN') return '';
      if (key === 'NODE_ENV') return 'development';
      return null;
    });

    const context = createMockContext({});
    expect(guard.canActivate(context)).toBe(true);
  });
});
