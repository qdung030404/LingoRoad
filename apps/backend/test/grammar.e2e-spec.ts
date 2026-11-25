import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { seedGrammarCatalog } from '../prisma/seed-grammar';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('GrammarModule (E2E Tree, CEFR Levels & Admin DAG Cycle Gate)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let learnerToken: string;
  let adminToken: string;
  let hadSeededGrammar = false;
  const createdEmails: string[] = [];
  const createdTopicIds: string[] = [];

  beforeAll(async () => {
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
    hadSeededGrammar = (await prisma.grammarTopic.count()) > 0;
    await seedGrammarCatalog(prisma);

    const learnerEmail = `grammar-learner-${Date.now()}@example.com`;
    createdEmails.push(learnerEmail);
    const learnerReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Grammar Learner', email: learnerEmail, password: 'Password123!' })
      .expect(201);
    learnerToken = learnerReg.body.data.accessToken;

    const adminEmail = `grammar-admin-${Date.now()}@example.com`;
    createdEmails.push(adminEmail);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Grammar Admin', email: adminEmail, password: 'Password123!' })
      .expect(201);
    await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' } });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: 'Password123!' })
      .expect(200);
    adminToken = adminLogin.body.data.accessToken;
  });

  afterAll(async () => {
    if (prisma && createdTopicIds.length > 0) {
      await prisma.grammarTopic.deleteMany({ where: { id: { in: createdTopicIds } } });
    }
    if (prisma && !hadSeededGrammar) {
      await prisma.learningLesson.deleteMany({ where: { grammarTopicId: { not: null } } });
      await prisma.learningUnit.deleteMany({ where: { code: { startsWith: 'grammar-unit-' } } });
      await prisma.grammarPrerequisite.deleteMany({});
      await prisma.grammarTopic.deleteMany({});
    }
    if (prisma && createdEmails.length > 0) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    if (app) {
      await app.close();
    }
  });

  it('serves all 6 CEFR levels (A1 -> C2) publicly and adds completedCount with JWT', async () => {
    const pub = await request(app.getHttpServer()).get('/api/v1/grammar/levels').expect(200);
    expect(pub.body.success).toBe(true);
    expect(pub.body.data.levels).toHaveLength(6);
    expect(pub.body.data.levels.every((l: { topicCount: number }) => l.topicCount >= 4)).toBe(true);
    expect(pub.body.data.levels[0].completedCount).toBeUndefined();

    const auth = await request(app.getHttpServer())
      .get('/grammar/levels')
      .set('Authorization', `Bearer ${learnerToken}`)
      .expect(200);
    expect(auth.body.data.levels[0].completedCount).toEqual(expect.any(Number));
  });

  it('returns hierarchical and CEFR-grouped grammar trees and topic details', async () => {
    const hierarchy = await request(app.getHttpServer())
      .get('/api/v1/grammar/tree?groupBy=hierarchy&cefrLevel=C1')
      .expect(200);
    expect(hierarchy.body.data.groupBy).toBe('hierarchy');
    expect(hierarchy.body.data.tree.length).toBeGreaterThanOrEqual(1);

    const byCefr = await request(app.getHttpServer())
      .get('/api/v1/grammar/tree?groupBy=cefr')
      .expect(200);
    expect(byCefr.body.data.levels).toHaveLength(6);

    const detail = await request(app.getHttpServer())
      .get('/api/v1/grammar/topics/grammar.inversion')
      .expect(200);
    expect(detail.body.data.cefrLevel).toBe('C1');
    expect(detail.body.data.formulas.length).toBeGreaterThanOrEqual(1);
    expect(detail.body.data.examples.length).toBeGreaterThanOrEqual(1);
  });

  it('enforces ADMIN role and blocks prerequisite DAG cycles in /admin/grammar/*', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/grammar/topics')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({
        code: 'grammar.test_one',
        cefrLevel: 'B1',
        isLeaf: true,
        titleEn: 'Test 1',
        titleVi: 'Kiểm thử 1',
        formulas: [{ form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + V' }],
        usageNotes: [{ useCaseVi: 'Cách dùng thử nghiệm' }],
        examples: [{ sentenceEn: 'Test one.', translationVi: 'Thử nghiệm một.' }],
      })
      .expect(403);

    const createNode = async (code: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/grammar/topics')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          cefrLevel: 'B1',
          isLeaf: true,
          titleEn: code,
          titleVi: code,
          formulas: [{ form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + V' }],
          usageNotes: [{ useCaseVi: 'Cách dùng' }],
          examples: [{ sentenceEn: 'Example.', translationVi: 'Ví dụ.' }],
        })
        .expect(201);
      createdTopicIds.push(res.body.data.id);
      return res.body.data.id as string;
    };

    const nodeA = await createNode('grammar.test_dag_a');
    const nodeB = await createNode('grammar.test_dag_b');

    await request(app.getHttpServer())
      .post('/api/v1/admin/grammar/prerequisites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prerequisiteId: nodeA, targetId: nodeB })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/admin/grammar/prerequisites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ prerequisiteId: nodeB, targetId: nodeA })
      .expect(400);
  });
});
