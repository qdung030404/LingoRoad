import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('Admin CMS & Dashboard Analytics (E2E real PostgreSQL)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminUserId: string;
  const createdEmails: string[] = [];
  const createdUnitIds: string[] = [];

  beforeAll(async () => {
    process.env.AUTH_PROVIDER = 'legacy';
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set for E2E tests.');
    }
    const dbName = new URL(databaseUrl).pathname.slice(1);
    if (!dbName.endsWith('_test') && !/^lingoroad_(demo|test)$/.test(dbName)) {
      throw new Error(`E2E tests must run on test/demo databases. Current DB: ${dbName}`);
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    const adminEmail = `admin-cms-e2e-${Date.now()}@example.com`;
    createdEmails.push(adminEmail);
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'CMS E2E Admin', email: adminEmail, password: 'Password123!' })
      .expect(201);
    adminUserId = registerRes.body.data.user.id as string;

    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: 'ADMIN' },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: adminEmail, password: 'Password123!' })
      .expect(200);
    adminToken = loginRes.body.data.accessToken as string;
  });

  afterAll(async () => {
    if (prisma && createdUnitIds.length > 0) {
      await prisma.learningUnit.deleteMany({ where: { id: { in: createdUnitIds } } });
    }
    if (prisma && adminUserId) {
      await prisma.auditLog.deleteMany({ where: { adminUserId } });
    }
    if (prisma && createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (app) {
      await app.close();
    }
  });

  it('executes all Dashboard SQL aggregate queries across every timeframe without PostgreSQL errors', async () => {
    for (const timeframe of ['7_DAYS', '30_DAYS', '90_DAYS', 'ALL_TIME'] as const) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/analytics/dashboard?timeframe=${timeframe}&forceRefresh=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        timeframe,
        users: expect.objectContaining({
          total: expect.any(Number),
          admins: expect.any(Number),
        }),
        content: expect.objectContaining({
          unitsTotal: expect.any(Number),
          lessonsTotal: expect.any(Number),
          curatedTopicsTotal: expect.any(Number),
          grammarTopicsTotal: expect.any(Number),
        }),
        activity: expect.objectContaining({
          learningAttemptsTotal: expect.any(Number),
          accuracyPercent: expect.any(Number),
        }),
      });
      expect(Array.isArray(res.body.data.learningTrend)).toBe(true);
      expect(Array.isArray(res.body.data.attemptsByCefr)).toBe(true);
      expect(Array.isArray(res.body.data.masteryBySkill)).toBe(true);
      expect(Array.isArray(res.body.data.hardItems)).toBe(true);
    }
  });

  it('serves all Admin CMS listing, export, and audit log endpoints against real PostgreSQL', async () => {
    const authHeader = `Bearer ${adminToken}`;
    const endpoints = [
      '/api/v1/admin/users',
      `/api/v1/admin/users/${adminUserId}`,
      '/api/v1/admin/units',
      '/api/v1/admin/lessons',
      '/api/v1/admin/descriptors',
      '/api/v1/admin/assessment-items',
      '/api/v1/admin/assessment-groups',
      '/api/v1/admin/vocabulary/topics',
      '/api/v1/admin/speaking-prompts',
      '/api/v1/admin/audit-logs',
    ];

    for (const endpoint of endpoints) {
      const res = await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', authHeader)
        .expect(200);
      expect(res.body.success).toBe(true);
    }

    const csvExport = await request(app.getHttpServer())
      .get('/api/v1/admin/exports/units?format=csv')
      .set('Authorization', authHeader)
      .expect(200);
    expect(csvExport.headers['content-type']).toMatch(/text\/csv/);

    const uniqueCode = `e2e-unit-${Date.now()}`;
    const createdUnit = await request(app.getHttpServer())
      .post('/api/v1/admin/units')
      .set('Authorization', authHeader)
      .send({
        code: uniqueCode,
        cefrLevel: 'C2',
        orderIndex: 998,
        title: 'E2E Audit Unit',
        description: 'Temporary unit to verify admin mutation audit logs.',
      })
      .expect(201);
    const unitId = createdUnit.body.data.id as string;
    createdUnitIds.push(unitId);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/units/${unitId}?detach=true`)
      .set('Authorization', authHeader)
      .expect(200);

    const auditLogs = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?resourceType=units&limit=10')
      .set('Authorization', authHeader)
      .expect(200);
    expect(auditLogs.body.data.items.length).toBeGreaterThanOrEqual(1);
  });
});
