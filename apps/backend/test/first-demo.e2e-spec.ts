import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaModule } from '../src/modules/prisma/prisma.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { SecurityModule } from '../src/modules/security/security.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { RefreshSessionCleanupService } from '../src/modules/auth/services/refresh-session-cleanup.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { placementMediaRoot } from '../src/modules/placement/services/demo-placement.service';
import { seedDemoContent } from '../prisma/seed-placement';

function resolvePrismaCliPath(): string {
  const pkgPath = require.resolve('prisma/package.json', {
    paths: [path.resolve(__dirname, '..')],
  });
  const pkg = require(pkgPath) as { bin?: string | Record<string, string> };
  const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.prisma;
  if (!binRel) {
    throw new Error('Unable to resolve Prisma CLI binary from prisma/package.json.');
  }
  return path.resolve(path.dirname(pkgPath), binRel);
}

describe('First demo: real HTTP + PostgreSQL', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const createdUsers: string[] = [];
  const password = 'DemoEnglish123';

  beforeAll(async () => {
    process.env.AUTH_PROVIDER = 'legacy'; // This suite exercises the retained legacy API.
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
      throw new Error('E2E chỉ được chạy trên DATABASE_URL trỏ tới database có tên kết thúc _test.');
    }
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useStaticAssets(placementMediaRoot(), { prefix: '/media/placement/' });
    await app.init();
    prisma = app.get(PrismaService);
    await seedDemoContent(prisma);
  });

  afterAll(async () => {
    if (prisma && createdUsers.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    if (app) await app.close();
  });

  async function register(
    targetApp: NestExpressApplication = app,
    trackedUsers: string[] = createdUsers,
  ) {
    const email = `demo-e2e-${randomUUID()}@example.com`;
    const response = await request(targetApp.getHttpServer()).post('/auth/register')
      .send({ name: 'Học viên Demo', email, password }).expect(201);
    const data = response.body.data;
    trackedUsers.push(data.user.id);
    return { ...data, email, authorization: `Bearer ${data.accessToken}` };
  }

  function api(account: { authorization: string }) {
    return {
      get: (path: string) => request(app.getHttpServer()).get(path).set('Authorization', account.authorization),
      post: (path: string) => request(app.getHttpServer()).post(path).set('Authorization', account.authorization),
      patch: (path: string) => request(app.getHttpServer()).patch(path).set('Authorization', account.authorization),
    };
  }

  it('seeds idempotently with 40 items and serves a real WAV', async () => {
    await seedDemoContent(prisma);
    expect(await prisma.assessmentItem.count({ where: { bankVersion: 'demo-v1' } })).toBe(40);
    for (const skill of ['READING', 'LISTENING'] as const) {
      for (const cefrLevel of ['A1', 'A2', 'B1', 'B2'] as const) {
        expect(await prisma.assessmentItem.count({ where: { bankVersion: 'demo-v1', skill, cefrLevel } })).toBe(5);
      }
    }
    const audio = await prisma.assessmentItem.findFirstOrThrow({ where: { bankVersion: 'demo-v1', skill: 'LISTENING' } });
    const response = await request(app.getHttpServer()).get(audio.audioUrl!).expect(200);
    expect(response.headers['content-type']).toMatch(/audio/);
    expect(Number(response.headers['content-length'])).toBeGreaterThan(44);
  });

  it('registers, validates and persists safe learner profile, then logs in again', async () => {
    const account = await register();
    await request(app.getHttpServer()).post('/auth/register')
      .send({ name: 'Trùng email', email: account.email, password }).expect(409);
    await request(app.getHttpServer()).post('/auth/login').send({ email: account.email, password: 'WrongPassword9' }).expect(401);
    await api(account).patch('/auth/me').send({ dailyGoalMinutes: 0 }).expect(400);
    await api(account).patch('/auth/me').send({ learningPurpose: 'INVALID' }).expect(400);
    const patched = await api(account).patch('/auth/me')
      .send({ name: 'Lan Demo', learningPurpose: 'WORK', dailyGoalMinutes: 10, selfAssessedCefr: null }).expect(200);
    expect(patched.body.data.profile.onboardingCompletedAt).toBeTruthy();
    expect(JSON.stringify(patched.body)).not.toMatch(/passwordHash|tokenHash/);
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email: account.email, password }).expect(200);
    const read = await api({ authorization: `Bearer ${login.body.data.accessToken}` }).get('/auth/me').expect(200);
    expect(read.body.data).toMatchObject({ name: 'Lan Demo', profile: { learningPurpose: 'WORK', dailyGoalMinutes: 10 } });
    await api(account).patch('/auth/me').send({ dailyGoalMinutes: 20 }).expect(200);
    expect((await api(account).get('/auth/me')).body.data.profile.dailyGoalMinutes).toBe(20);
  });

  it('rotates refresh tokens, rejects revoked tokens, changes password and logs out', async () => {
    const account = await register();
    const refreshed = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: account.refreshToken }).expect(200);
    expect(refreshed.body.data.refreshToken).not.toBe(account.refreshToken);
    const auth = { authorization: `Bearer ${refreshed.body.data.accessToken}` };
    await api(auth).post('/auth/change-password').send({ oldPassword: password, newPassword: 'NewDemoEnglish456' }).expect(200);
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: refreshed.body.data.refreshToken }).expect(401);
    await request(app.getHttpServer()).post('/auth/login').send({ email: account.email, password }).expect(401);
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email: account.email, password: 'NewDemoEnglish456' }).expect(200);
    await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken: login.body.data.refreshToken }).expect(200);
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: login.body.data.refreshToken }).expect(401);
  });

  it('starts once, resumes exactly, prevents foreign access and completes Reading + Listening', async () => {
    const owner = await register();
    const stranger = await register();
    const starts = await Promise.all([api(owner).post('/placement/start'), api(owner).post('/placement/start')]);
    expect(starts.every((r) => r.status === 201)).toBe(true);
    const sessionId = starts[0].body.data.sessionId;
    expect(starts[1].body.data.sessionId).toBe(sessionId);
    expect(await prisma.placementSession.count({ where: { userId: owner.user.id, status: 'IN_PROGRESS' } })).toBe(1);
    let current = starts[0].body.data.firstItem;
    expect(current.skill).toBe('READING');
    expect((await api(owner).post('/placement/start')).body.data.firstItem.id).toBe(current.id);
    for (const endpoint of ['result', 'review']) await api(stranger).get(`/placement/${sessionId}/${endpoint}`).expect(403);
    await api(stranger).post(`/placement/${sessionId}/answer`).send({ itemId: current.id, itemIndex: 0, selectedOption: current.options[0] }).expect(403);
    const forged = await prisma.assessmentItem.findFirstOrThrow({ where: { bankVersion: 'demo-v1', id: { not: current.id } } });
    const forgedResponse = await api(owner).post(`/placement/${sessionId}/answer`).send({ itemId: forged.id, itemIndex: 0, selectedOption: current.options[0] });
    expect([400, 409]).toContain(forgedResponse.status);
    await api(owner).post(`/placement/${sessionId}/answer`).send({ itemId: current.id, itemIndex: 0, selectedOption: 'not-an-option' }).expect(400);
    const seen = new Set<string>();
    let finalResult: any;
    let firstPayload: any;
    for (let index = 0; index < 10; index++) {
      expect(current.index).toBe(index);
      expect(current.skill).toBe(index < 5 ? 'READING' : 'LISTENING');
      expect(seen.has(current.id)).toBe(false);
      seen.add(current.id);
      expect(current).not.toHaveProperty('correctOption');
      expect(current).not.toHaveProperty('explanation');
      if (index >= 5) expect(current.mediaUrl).toMatch(/^\/media\/placement\/.*\.wav$/);
      const stored = await prisma.assessmentItem.findUniqueOrThrow({ where: { id: current.id } });
      const payload = { itemId: current.id, itemIndex: index, selectedOption: stored.correctOption, responseTimeMs: 1300 };
      if (index === 0) firstPayload = payload;
      const response = await api(owner).post(`/placement/${sessionId}/answer`).send(payload).expect(200);
      if (index === 0) {
        const replay = await api(owner).post(`/placement/${sessionId}/answer`).send(payload).expect(200);
        expect(replay.body.data.nextItem.id).toBe(response.body.data.nextItem.id);
        await api(owner).post(`/placement/${sessionId}/answer`).send({ ...payload, selectedOption: current.options.find((o: string) => o !== stored.correctOption) }).expect(409);
        const review = (await api(owner).get(`/placement/${sessionId}/review`).expect(200)).body.data;
        expect(review.items).toHaveLength(1);
        expect(review.items[0]).not.toHaveProperty('isCorrect');
        expect(review.items[0]).not.toHaveProperty('correctOption');
        const resume = await api(owner).post('/placement/start').expect(201);
        expect(resume.body.data.firstItem.id).toBe(response.body.data.nextItem.id);
      }
      current = response.body.data.nextItem;
      finalResult = response.body.data.result;
      expect(response.body.data.isFinished).toBe(index === 9);
    }
    expect(current).toBeNull();
    expect(finalResult).toMatchObject({ estimatedCefr: 'B2', confidenceScore: null, correctCount: 10, totalItems: 10, resultStatus: 'PROVISIONAL', skills: { reading: { correctCount: 5 }, listening: { correctCount: 5 }, speaking: { status: 'NOT_ASSESSED' }, writing: { status: 'NOT_ASSESSED' } } });
    const replay = await api(owner).post(`/placement/${sessionId}/answer`).send(firstPayload).expect(200);
    expect(replay.body.data.isFinished).toBe(true);
    expect(await prisma.assessmentResponse.count({ where: { sessionId } })).toBe(10);
    const status = await api(owner).get('/placement/status').expect(200);
    expect(status.body.data).toMatchObject({ hasCompleted: true, currentSessionId: sessionId, status: 'COMPLETED' });
    const result = await api(owner).get(`/placement/${sessionId}/result`).expect(200);
    expect(result.body.data).toMatchObject({ sessionId, correctCount: 10 });
    const review = await api(owner).get(`/placement/${sessionId}/review`).expect(200);
    expect(review.body.data.items).toHaveLength(10);
    expect(review.body.data.items.every((i: any) => i.isCorrect === true && i.correctOption && i.explanation)).toBe(true);
    await api(owner).post('/placement/start').expect(409);
  });

  it('commits just one of two different concurrent answers', async () => {
    const owner = await register();
    const start = (await api(owner).post('/placement/start').expect(201)).body.data;
    const item = start.firstItem;
    const responses = await Promise.all(item.options.slice(0, 2).map((selectedOption: string) =>
      api(owner).post(`/placement/${start.sessionId}/answer`).send({ itemId: item.id, itemIndex: 0, selectedOption })));
    expect(responses.map((r: any) => r.status).sort()).toEqual([200, 409]);
    const session = await prisma.placementSession.findUniqueOrThrow({ where: { id: start.sessionId }, include: { responses: true } });
    expect(session.currentItemIndex).toBe(1);
    expect(session.responses).toHaveLength(1);
    expect(session.currentItemId).toBe(responses.find((r: any) => r.status === 200)!.body.data.nextItem.id);
  });

  it('purges only refresh_sessions expired past 7-day retention in SKIP LOCKED batches while preserving revoked-token replay detection', async () => {
    const mainCleanupService = app.get(RefreshSessionCleanupService);
    expect(mainCleanupService.isEnabled()).toBe(false);

    const dayMs = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    const bystander = await register();
    const bystanderExpiredId = randomUUID();
    await prisma.refreshSession.create({
      data: {
        id: bystanderExpiredId,
        userId: bystander.user.id,
        tokenHash: `bystander-${randomUUID()}`,
        expiresAt: new Date(nowMs - 20 * dayMs),
        isRevoked: false,
        createdAt: new Date(nowMs - 50 * dayMs),
      },
    });

    const schemaName = `retention_e2e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    if (!/^retention_e2e_[0-9a-f]{12}$/.test(schemaName)) {
      throw new Error(`Unexpected isolated schema name: ${schemaName}`);
    }

    const isolatedUrl = new URL(process.env.DATABASE_URL!);
    isolatedUrl.searchParams.set('schema', schemaName);
    const isolatedDatabaseUrl = isolatedUrl.toString();

    const isolatedUsers: string[] = [];
    let isolatedPrisma: PrismaService | null = null;
    let isolatedApp: NestExpressApplication | null = null;

    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);

    try {
      execFileSync(process.execPath, [resolvePrismaCliPath(), 'migrate', 'deploy'], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: isolatedDatabaseUrl },
        stdio: 'pipe',
      });

      const indexes = await prisma.$queryRaw<Array<{ schemaname: string; indexname: string }>>`
        SELECT schemaname, indexname
        FROM pg_indexes
        WHERE schemaname IN ('public', ${schemaName})
          AND tablename = 'refresh_sessions'
          AND indexname = 'refresh_sessions_expires_at_idx'
      `;
      expect(indexes.map((row) => row.schemaname).sort()).toEqual(['public', schemaName].sort());

      isolatedPrisma = new PrismaService({
        datasources: { db: { url: isolatedDatabaseUrl } },
      });
      await isolatedPrisma.$connect();

      const isolatedModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [
              () => ({
                AUTH_PROVIDER: 'legacy',
                NODE_ENV: 'test',
                JWT_SECRET:
                  process.env.JWT_SECRET ||
                  'e2e-isolated-jwt-secret-must-be-at-least-32-chars',
                JWT_REFRESH_SECRET:
                  process.env.JWT_REFRESH_SECRET ||
                  'e2e-isolated-refresh-secret-at-least-32-chars',
                REFRESH_SESSION_RETENTION_DAYS: '1',
              }),
            ],
          }),
          EventEmitterModule.forRoot({
            wildcard: false,
            delimiter: '.',
            maxListeners: 20,
          }),
          ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
          PrismaModule,
          SecurityModule,
          AuthModule,
        ],
      })
        .overrideProvider(PrismaService)
        .useValue(isolatedPrisma)
        .compile();

      isolatedApp = isolatedModule.createNestApplication<NestExpressApplication>();
      isolatedApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
      );
      isolatedApp.useGlobalFilters(new HttpExceptionFilter());
      await isolatedApp.init();

      const isolatedCleanup = isolatedApp.get(RefreshSessionCleanupService);
      expect(isolatedCleanup.isEnabled()).toBe(false);

      const account = await register(isolatedApp, isolatedUsers);
      const userId = account.user.id as string;
      const refreshToken1 = account.refreshToken as string;

      const rotateRes = await request(isolatedApp.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshToken1 })
        .expect(200);
      const refreshToken2 = rotateRes.body.data.refreshToken as string;
      expect(refreshToken2).not.toBe(refreshToken1);

      const sessions = await isolatedPrisma.refreshSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      const revokedUnexpired = sessions.find((s) => s.isRevoked)!;
      const activeSession = sessions.find((s) => !s.isRevoked)!;

      await isolatedPrisma.refreshSession.update({
        where: { id: revokedUnexpired.id },
        data: {
          createdAt: new Date(nowMs - 15 * dayMs),
          expiresAt: new Date(nowMs + 15 * dayMs),
        },
      });

      const lockedExpiredId = randomUUID();
      const keptRecentExpiredId = randomUUID();
      const keptRevokedCreatedOldId = randomUUID();
      const purgedIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

      await isolatedPrisma.refreshSession.createMany({
        data: [
          {
            id: keptRecentExpiredId,
            userId,
            tokenHash: `hash-${randomUUID()}`,
            expiresAt: new Date(nowMs - 2 * dayMs),
            isRevoked: false,
            createdAt: new Date(nowMs - 32 * dayMs),
          },
          {
            id: keptRevokedCreatedOldId,
            userId,
            tokenHash: `hash-${randomUUID()}`,
            expiresAt: new Date(nowMs - 6 * dayMs),
            isRevoked: true,
            createdAt: new Date(nowMs - 35 * dayMs),
          },
          {
            id: lockedExpiredId,
            userId,
            tokenHash: `hash-${randomUUID()}`,
            expiresAt: new Date(nowMs - 12 * dayMs),
            isRevoked: false,
            createdAt: new Date(nowMs - 42 * dayMs),
          },
          {
            id: purgedIds[0],
            userId,
            tokenHash: `hash-${randomUUID()}`,
            expiresAt: new Date(nowMs - 11 * dayMs),
            isRevoked: true,
            createdAt: new Date(nowMs - 41 * dayMs),
          },
          {
            id: purgedIds[1],
            userId,
            tokenHash: `hash-${randomUUID()}`,
            expiresAt: new Date(nowMs - 10 * dayMs),
            isRevoked: false,
            createdAt: new Date(nowMs - 40 * dayMs),
          },
          {
            id: purgedIds[2],
            userId,
            tokenHash: `hash-${randomUUID()}`,
            expiresAt: new Date(nowMs - 9 * dayMs),
            isRevoked: true,
            createdAt: new Date(nowMs - 39 * dayMs),
          },
          {
            id: purgedIds[3],
            userId,
            tokenHash: `hash-${randomUUID()}`,
            expiresAt: new Date(nowMs - 8 * dayMs),
            isRevoked: false,
            createdAt: new Date(nowMs - 38 * dayMs),
          },
        ],
      });

      const lockClient = new PrismaClient({
        datasources: { db: { url: isolatedDatabaseUrl } },
      });
      let releaseLock!: () => void;
      let markLocked!: () => void;
      const lockedReady = new Promise<void>((resolve) => {
        markLocked = resolve;
      });
      const lockHold = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });

      const txPromise = lockClient.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            SELECT id FROM "refresh_sessions" WHERE id = ${lockedExpiredId}::uuid FOR UPDATE
          `;
          markLocked();
          await lockHold;
        },
        { timeout: 15_000, maxWait: 5_000 },
      );

      try {
        await lockedReady;

        const firstSweep = await isolatedCleanup.runSweep({ batchSize: 2, maxBatches: 10 });
        expect(firstSweep.deletedCount).toBe(4);
        expect(firstSweep.batches).toBe(3);

        const midRemaining = await isolatedPrisma.refreshSession.findMany({
          where: { userId },
          select: { id: true },
        });
        expect(midRemaining.map((r) => r.id).sort()).toEqual(
          [revokedUnexpired.id, activeSession.id, keptRecentExpiredId, keptRevokedCreatedOldId, lockedExpiredId].sort(),
        );
      } finally {
        releaseLock();
        await txPromise.catch(() => undefined);
        await lockClient.$disconnect();
      }

      const secondSweep = await isolatedCleanup.runSweep({ batchSize: 2, maxBatches: 10 });
      expect(secondSweep.deletedCount).toBe(1);
      expect(secondSweep.batches).toBe(1);

      const finalRemaining = await isolatedPrisma.refreshSession.findMany({
        where: { userId },
        select: { id: true },
      });
      expect(finalRemaining.map((r) => r.id).sort()).toEqual(
        [revokedUnexpired.id, activeSession.id, keptRecentExpiredId, keptRevokedCreatedOldId].sort(),
      );

      const replayRes = await request(isolatedApp.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshToken1 })
        .expect(401);
      expect(replayRes.body?.error?.code).toBe('AUTH_TOKEN_COMPROMISED');

      const postReplaySessions = await isolatedPrisma.refreshSession.findMany({
        where: { userId },
        select: { id: true, isRevoked: true },
      });
      expect(postReplaySessions).toHaveLength(4);
      expect(postReplaySessions.every((s) => s.isRevoked)).toBe(true);

      const untouchedBystanderSession = await prisma.refreshSession.findUnique({
        where: { id: bystanderExpiredId },
        select: { id: true },
      });
      expect(untouchedBystanderSession?.id).toBe(bystanderExpiredId);
    } finally {
      if (isolatedPrisma && isolatedUsers.length > 0) {
        await isolatedPrisma.user.deleteMany({ where: { id: { in: isolatedUsers } } }).catch(() => undefined);
      }
      if (isolatedApp) {
        await isolatedApp.close();
      }
      if (isolatedPrisma) {
        await isolatedPrisma.$disconnect();
      }
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }

    const remainingSchemas = await prisma.$queryRaw<Array<{ schema_name: string }>>`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = ${schemaName}
    `;
    expect(remainingSchemas).toHaveLength(0);
  });
});
