import { randomUUID } from 'crypto';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { placementMediaRoot } from '../src/modules/placement/services/demo-placement.service';
import { seedDemoContent } from '../prisma/seed-placement';

describe('First demo: real HTTP + PostgreSQL', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const createdUsers: string[] = [];
  const password = 'DemoEnglish123';

  beforeAll(async () => {
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

  async function register() {
    const email = `demo-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer()).post('/auth/register')
      .send({ name: 'Học viên Demo', email, password }).expect(201);
    const data = response.body.data;
    createdUsers.push(data.user.id);
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
});
