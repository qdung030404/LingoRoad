import { Test } from '@nestjs/testing';
import { PrismaModule } from './prisma.module';
import { PrismaService, resolveDatasourceUrl } from './prisma.service';

describe('PrismaService & resolveDatasourceUrl', () => {
  it('resolves PrismaService cleanly via NestJS DI in PrismaModule without UnknownDependenciesException', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    const prisma = moduleRef.get(PrismaService);
    expect(prisma).toBeInstanceOf(PrismaService);
  });

  it('normalizes Supabase pooler URLs to Transaction Mode (port 6543 + pgbouncer=true) with pool limits', () => {
    const rewritten = resolveDatasourceUrl(
      'postgresql://user:pass@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    );
    expect(rewritten).toBeDefined();
    const parsedRewritten = new URL(rewritten!);
    expect(parsedRewritten.port).toBe('6543');
    expect(parsedRewritten.searchParams.get('pgbouncer')).toBe('true');
    expect(parsedRewritten.searchParams.get('connection_limit')).toBe('5');
    expect(parsedRewritten.searchParams.get('pool_timeout')).toBe('30');

    const port6543MissingFlag = resolveDatasourceUrl(
      'postgresql://user:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?connection_limit=8&pool_timeout=45',
    );
    const parsed6543 = new URL(port6543MissingFlag!);
    expect(parsed6543.port).toBe('6543');
    expect(parsed6543.searchParams.get('pgbouncer')).toBe('true');
    expect(parsed6543.searchParams.get('connection_limit')).toBe('8');
    expect(parsed6543.searchParams.get('pool_timeout')).toBe('45');
  });

  it('leaves non-Supabase URLs, invalid URLs, and undefined untouched', () => {
    const localUrl = 'postgresql://postgres:postgres@localhost:5432/lingoroad';
    expect(resolveDatasourceUrl(localUrl)).toBe(localUrl);
    expect(resolveDatasourceUrl('not-a-valid-url')).toBe('not-a-valid-url');
    expect(resolveDatasourceUrl(undefined)).toBeUndefined();
  });
});
