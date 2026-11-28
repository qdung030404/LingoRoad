import { Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { attachPrismaSqlTiming, isSqlTimingEnabled } from './sql-timing';

export const PRISMA_CLIENT_OPTIONS = Symbol('PRISMA_CLIENT_OPTIONS');

/** Normalizes Supabase Session Pooler URLs (max 15 clients) to Transaction Mode (port 6543 + pgbouncer=true). */
export function resolveDatasourceUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.endsWith('.pooler.supabase.com')) {
      if (parsed.port === '5432' || parsed.port === '') {
        parsed.port = '6543';
        parsed.searchParams.set('pgbouncer', 'true');
      } else if (parsed.port === '6543' && !parsed.searchParams.has('pgbouncer')) {
        parsed.searchParams.set('pgbouncer', 'true');
      }
      if (!parsed.searchParams.has('connection_limit')) {
        parsed.searchParams.set('connection_limit', '5');
      }
      if (!parsed.searchParams.has('pool_timeout')) {
        parsed.searchParams.set('pool_timeout', '30');
      }
      return parsed.toString();
    }
  } catch {
    return rawUrl;
  }
  return rawUrl;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Optional() @Inject(PRISMA_CLIENT_OPTIONS) options?: Prisma.PrismaClientOptions,
  ) {
    const rawUrl = options?.datasources?.db?.url ?? process.env.DATABASE_URL;
    const url = resolveDatasourceUrl(rawUrl);
    super(
      url
        ? { ...options, datasources: { ...options?.datasources, db: { url } } }
        : options,
    );
    if (isSqlTimingEnabled()) {
      attachPrismaSqlTiming(this);
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
