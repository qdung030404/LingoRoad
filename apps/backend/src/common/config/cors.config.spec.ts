import { ConfigService } from '@nestjs/config';
import { isOriginAllowed } from './cors.config';
import {
  DEFAULT_DEV_JWT_SECRET,
  resolveJwtSecret,
} from '../../modules/security/security.module';

describe('Cloud CORS and JWT production guards', () => {
  it('allows requests without an Origin header (native mobile and health probes)', () => {
    expect(
      isOriginAllowed(undefined, {
        nodeEnv: 'production',
        corsAllowedOrigins: 'https://lingoroad-admin.azurewebsites.net',
      }),
    ).toBe(true);
  });

  it('restricts browser origins in production to CORS_ALLOWED_ORIGINS only', () => {
    const prodOptions = {
      nodeEnv: 'production',
      corsAllowedOrigins:
        'https://lingoroad-admin.azurewebsites.net/, https://admin.lingoroad.edu.vn',
    };

    expect(
      isOriginAllowed(
        'https://lingoroad-admin.azurewebsites.net',
        prodOptions,
      ),
    ).toBe(true);
    expect(
      isOriginAllowed('https://admin.lingoroad.edu.vn', prodOptions),
    ).toBe(true);
    expect(isOriginAllowed('http://localhost:3001', prodOptions)).toBe(false);
    expect(isOriginAllowed('https://evil.example.com', prodOptions)).toBe(
      false,
    );
  });

  it('retains localhost in non-production while rejecting arbitrary untrusted origins', () => {
    const devOptions = {
      nodeEnv: 'development',
      corsAllowedOrigins: '',
    };

    expect(isOriginAllowed('http://localhost:3001', devOptions)).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:3001', devOptions)).toBe(true);
    expect(isOriginAllowed('https://evil.example.com', devOptions)).toBe(false);
  });

  it('rejects missing or default JWT_SECRET in production and accepts strong cloud secret', () => {
    const makeConfig = (values: Record<string, string | undefined>) =>
      ({
        get: (key: string) => values[key],
      }) as unknown as ConfigService;

    expect(() =>
      resolveJwtSecret(makeConfig({ NODE_ENV: 'production', JWT_SECRET: '' })),
    ).toThrow(/JWT_SECRET/);

    expect(() =>
      resolveJwtSecret(
        makeConfig({
          NODE_ENV: 'production',
          JWT_SECRET: DEFAULT_DEV_JWT_SECRET,
        }),
      ),
    ).toThrow(/JWT_SECRET/);

    expect(
      resolveJwtSecret(
        makeConfig({
          NODE_ENV: 'production',
          JWT_SECRET: 'cloud-only-unique-jwt-secret-with-at-least-32-chars',
        }),
      ),
    ).toBe('cloud-only-unique-jwt-secret-with-at-least-32-chars');

    expect(
      resolveJwtSecret(makeConfig({ NODE_ENV: 'development' })),
    ).toBe(DEFAULT_DEV_JWT_SECRET);
  });
});
