import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import { PrismaService } from './prisma.service';
import {
  flushSqlTimingSpans,
  getCurrentSqlMetrics,
  HttpSqlTimingReport,
  prismaSqlTracingHelper,
  setSqlTimingReportObserver,
  sqlTimingMiddleware,
} from './sql-timing';

function resolveSafeTestDatabaseUrl(): string | null {
  const current = process.env.DATABASE_URL;
  if (current) {
    try {
      const pathname = new URL(current).pathname;
      if (pathname.endsWith('_test')) return current;
    } catch {
      // Fall through to .demo/settings.json
    }
  }
  const candidates = [
    join(process.cwd(), '../../.demo/settings.json'),
    join(process.cwd(), '.demo/settings.json'),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as {
        TestDatabaseUrl?: string;
      };
      if (parsed.TestDatabaseUrl && new URL(parsed.TestDatabaseUrl).pathname.endsWith('_test')) {
        return parsed.TestDatabaseUrl;
      }
    } catch {
      // Ignore malformed settings
    }
  }
  return null;
}

function createBarrier(parties: number): () => Promise<void> {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived >= parties) {
      release();
    }
    await gate;
  };
}

describe('sqlTimingMiddleware + PrismaService per-request SQL counting', () => {
  const prevEnv = process.env.LINGOROAD_SQL_TIMING;
  const prevDbUrl = process.env.DATABASE_URL;
  let barrier = createBarrier(2);

  @Controller('sql-probe')
  class SqlProbeController {
    constructor(private readonly prisma: PrismaService) { }

    @Get('one')
    async one() {
      await barrier();
      await this.prisma.$queryRaw`SELECT 1`;
      await flushSqlTimingSpans();
      return { inHandlerSqlCount: getCurrentSqlMetrics()?.sqlCount ?? -1 };
    }

    @Get('three')
    async three() {
      await this.prisma.$queryRaw`SELECT 1`;
      await barrier();
      await this.prisma.$queryRaw`SELECT 1`;
      await this.prisma.$queryRaw`SELECT 1`;
      await flushSqlTimingSpans();
      return { inHandlerSqlCount: getCurrentSqlMetrics()?.sqlCount ?? -1 };
    }

    @Get('disabled')
    async disabled() {
      await this.prisma.$queryRaw`SELECT 1`;
      return { metrics: getCurrentSqlMetrics() ?? null };
    }
  }

  @Module({
    controllers: [SqlProbeController],
    providers: [PrismaService],
  })
  class SqlProbeModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
      consumer.apply(sqlTimingMiddleware).forRoutes('*');
    }
  }

  afterEach(() => {
    setSqlTimingReportObserver(null);
    if (prevEnv === undefined) {
      delete process.env.LINGOROAD_SQL_TIMING;
    } else {
      process.env.LINGOROAD_SQL_TIMING = prevEnv;
    }
  });

  afterAll(() => {
    if (prevDbUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = prevDbUrl;
    }
  });

  it('attributes exact SQL counts 1 and 3 to two concurrent interleaved HTTP requests without cross-request leakage', async () => {
    const testDbUrl = resolveSafeTestDatabaseUrl();
    if (!testDbUrl) {
      throw new Error('Missing *_test DATABASE_URL for sql-timing integration test.');
    }
    process.env.DATABASE_URL = testDbUrl;
    process.env.LINGOROAD_SQL_TIMING = 'true';

    const reports: HttpSqlTimingReport[] = [];
    setSqlTimingReportObserver((report) => {
      reports.push(report);
    });
    barrier = createBarrier(2);

    const moduleRef = await Test.createTestingModule({
      imports: [SqlProbeModule],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    try {
      const server = app.getHttpServer();
      const [res1, res3] = await Promise.all([
        request(server).get('/sql-probe/one').expect(200),
        request(server).get('/sql-probe/three').expect(200),
      ]);
      await flushSqlTimingSpans();

      expect(res1.body.inHandlerSqlCount).toBe(1);
      expect(res3.body.inHandlerSqlCount).toBe(3);

      const report1 = reports.find((r) => r.path === '/sql-probe/one');
      const report3 = reports.find((r) => r.path === '/sql-probe/three');
      expect(report1?.sqlCount).toBe(1);
      expect(report3?.sqlCount).toBe(3);
      expect((report1?.sqlDurationMs ?? 0) > 0).toBe(true);
      expect((report3?.sqlDurationMs ?? 0) > 0).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('keeps original Prisma tracingHelper untouched and emits no report when LINGOROAD_SQL_TIMING is disabled', async () => {
    const testDbUrl = resolveSafeTestDatabaseUrl();
    if (!testDbUrl) {
      throw new Error('Missing *_test DATABASE_URL for sql-timing integration test.');
    }
    process.env.DATABASE_URL = testDbUrl;
    delete process.env.LINGOROAD_SQL_TIMING;

    const baselineClient = new PrismaClient() as unknown as {
      _tracingHelper?: unknown;
      _engine?: { datamodel?: string };
    };
    const originalHelper = baselineClient._tracingHelper;
    const originalDatamodel = baselineClient._engine?.datamodel;

    const moduleRef = await Test.createTestingModule({
      imports: [SqlProbeModule],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    try {
      const prismaService = app.get(PrismaService) as unknown as {
        _tracingHelper?: unknown;
        _engine?: { datamodel?: string };
      };
      expect(prismaService._tracingHelper).toBe(originalHelper);
      expect(prismaService._tracingHelper).not.toBe(prismaSqlTracingHelper);
      expect(prismaService._engine?.datamodel).toBe(originalDatamodel);

      const res = await request(app.getHttpServer()).get('/sql-probe/disabled').expect(200);
      expect(res.body.metrics).toBeNull();
    } finally {
      await app.close();
    }
  });
});
