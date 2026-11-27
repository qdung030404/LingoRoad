import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/modules/prisma/prisma.service';

function lettersSuffix(): string {
  return String(Date.now()).replace(/\d/g, (digit) =>
    String.fromCharCode(97 + Number(digit)),
  );
}

describe('Admin CMS & Dashboard Analytics (E2E real PostgreSQL)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminUserId: string;
  const createdEmails: string[] = [];
  const createdUnitIds: string[] = [];
  const createdGrammarTopicIds: string[] = [];
  const createdLessonIds: string[] = [];
  const createdAssessmentItemIds: string[] = [];
  const createdAssessmentGroupIds: string[] = [];
  const createdSpeakingSubmissionIds: string[] = [];
  const createdSpeakingPromptIds: string[] = [];

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
    if (prisma && createdSpeakingSubmissionIds.length > 0) {
      await prisma.speakingSubmission.deleteMany({
        where: { id: { in: createdSpeakingSubmissionIds } },
      });
    }
    if (prisma && createdSpeakingPromptIds.length > 0) {
      await prisma.speakingPrompt.deleteMany({
        where: { id: { in: createdSpeakingPromptIds } },
      });
    }
    if (prisma && createdAssessmentItemIds.length > 0) {
      await prisma.assessmentItem.deleteMany({
        where: { id: { in: createdAssessmentItemIds } },
      });
    }
    if (prisma && createdAssessmentGroupIds.length > 0) {
      await prisma.assessmentItemGroup.deleteMany({
        where: { id: { in: createdAssessmentGroupIds } },
      });
    }
    if (prisma && createdLessonIds.length > 0) {
      await prisma.learningLesson.deleteMany({
        where: { id: { in: createdLessonIds } },
      });
    }
    if (prisma && createdGrammarTopicIds.length > 0) {
      await prisma.grammarTopic.deleteMany({
        where: { id: { in: createdGrammarTopicIds } },
      });
    }
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

  it('supports Grammar leaf CRUD (201/200/200) and rejects legacy invalid keys with 400', async () => {
    const authHeader = `Bearer ${adminToken}`;
    const code = `grammar.e2e_leaf_${lettersSuffix()}`;

    await request(app.getHttpServer())
      .post('/api/v1/admin/grammar/topics')
      .set('Authorization', authHeader)
      .send({
        code,
        cefrLevel: 'A2',
        isLeaf: true,
        title: 'Legacy Invalid Key',
        summary: 'Legacy summary key',
        formula: 'S + V',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/grammar/topics')
      .set('Authorization', authHeader)
      .send({
        code: 'grammar.bad-hyphen-123',
        cefrLevel: 'A2',
        isLeaf: true,
        titleEn: 'Invalid Code',
        titleVi: 'Mã sai chuẩn',
      })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/grammar/topics')
      .set('Authorization', authHeader)
      .send({
        code,
        cefrLevel: 'A2',
        isLeaf: true,
        titleEn: 'E2E Present Simple',
        titleVi: 'Hiện tại đơn E2E',
        summaryVi: 'Dùng cho thói quen lặp lại.',
        formulas: [
          {
            form: 'AFFIRMATIVE',
            labelVi: 'Khẳng định',
            structure: 'S + V(s/es)',
            noteVi: 'Thêm s/es với ngôi thứ ba số ít.',
          },
        ],
        usageNotes: [
          {
            useCaseVi: 'Diễn tả sự thật hiển nhiên hoặc thói quen.',
            signalWords: ['always', 'usually', 'every day'],
          },
        ],
        examples: [
          {
            sentenceEn: 'She walks to school every day.',
            translationVi: 'Cô ấy đi bộ đến trường mỗi ngày.',
            highlight: 'walks',
          },
        ],
        orderIndex: 99,
        published: true,
      })
      .expect(201);

    const topicId = created.body.data.id as string;
    createdGrammarTopicIds.push(topicId);
    expect(created.body.data.code).toBe(code);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/grammar/topics/${topicId}`)
      .set('Authorization', authHeader)
      .send({
        titleVi: 'Hiện tại đơn E2E (Đã cập nhật)',
        summaryVi: 'Tóm tắt mới sau cập nhật.',
      })
      .expect(200);
    expect(updated.body.data.titleVi).toBe('Hiện tại đơn E2E (Đã cập nhật)');

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/grammar/topics/${topicId}`)
      .set('Authorization', authHeader)
      .expect(200);
  });

  it('supports Listening v1 lesson CRUD via admin lessons endpoints', async () => {
    const authHeader = `Bearer ${adminToken}`;
    const lessonCode = `e2e-listening-v1-${Date.now()}`;
    const listeningContent = {
      listeningVersion: 1,
      audioUrl: '/media/learning/v1/e2e-station.wav',
      audioDurationMs: 45000,
      transcript: 'Welcome to the station. The train leaves at nine.',
      preparation: {
        situation: 'At a railway station information desk.',
        objective: 'Identify the main topic and train departure time.',
      },
      keyVocabulary: [
        { id: 'v1', word: 'station', meaning: 'nhà ga' },
        { id: 'v2', word: 'train', meaning: 'tàu hỏa' },
        { id: 'v3', word: 'leave', meaning: 'rời đi' },
      ],
      transcriptSegments: [
        {
          id: 'seg-1',
          speaker: 'Anna',
          startMs: 0,
          endMs: 20000,
          text: 'Welcome to the station.',
          translationVi: 'Chào mừng bạn đến nhà ga.',
        },
        {
          id: 'seg-2',
          speaker: 'Ben',
          startMs: 20000,
          endMs: 45000,
          text: 'The train leaves at nine.',
          translationVi: 'Chuyến tàu khởi hành lúc chín giờ.',
        },
      ],
      steps: [],
      questions: [
        {
          id: 'lq-1',
          type: 'MULTIPLE_CHOICE',
          skillCode: 'listening.gist',
          prompt: 'Where does the conversation take place?',
          options: [
            { id: 'A', text: 'At a station' },
            { id: 'B', text: 'At a hotel' },
            { id: 'C', text: 'At a library' },
            { id: 'D', text: 'At a hospital' },
          ],
          correctOptionId: 'A',
          explanation: 'Anna welcomes the listener to the station.',
          evidenceSegmentIds: ['seg-1'],
        },
        {
          id: 'lq-2',
          type: 'MULTIPLE_CHOICE',
          skillCode: 'listening.detail',
          prompt: 'What time does the train leave?',
          options: [
            { id: 'A', text: 'At seven' },
            { id: 'B', text: 'At eight' },
            { id: 'C', text: 'At nine' },
            { id: 'D', text: 'At ten' },
          ],
          correctOptionId: 'C',
          explanation: 'Ben says the train leaves at nine.',
          evidenceSegmentIds: ['seg-2'],
        },
        {
          id: 'lq-3',
          type: 'MULTIPLE_CHOICE',
          skillCode: 'listening.specific_information',
          prompt: 'Which vehicle is mentioned?',
          options: [
            { id: 'A', text: 'Bus' },
            { id: 'B', text: 'Train' },
            { id: 'C', text: 'Plane' },
            { id: 'D', text: 'Ferry' },
          ],
          correctOptionId: 'B',
          explanation: 'They discuss a train departure.',
          evidenceSegmentIds: ['seg-2'],
        },
        {
          id: 'lq-4',
          type: 'MULTIPLE_CHOICE',
          skillCode: 'listening.basic_dialogues',
          prompt: 'Who greets the traveler?',
          options: [
            { id: 'A', text: 'Anna' },
            { id: 'B', text: 'Tom' },
            { id: 'C', text: 'Mark' },
            { id: 'D', text: 'Lucy' },
          ],
          correctOptionId: 'A',
          explanation: 'Anna says welcome.',
          evidenceSegmentIds: ['seg-1'],
        },
        {
          id: 'lq-5',
          type: 'MULTIPLE_CHOICE',
          skillCode: 'listening.numbers_dates_times',
          prompt: 'What happens at nine?',
          options: [
            { id: 'A', text: 'The station closes' },
            { id: 'B', text: 'The train arrives' },
            { id: 'C', text: 'The train leaves' },
            { id: 'D', text: 'The cafe opens' },
          ],
          correctOptionId: 'C',
          explanation: 'The departure is at nine.',
          evidenceSegmentIds: ['seg-1', 'seg-2'],
        },
      ],
    };

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/lessons')
      .set('Authorization', authHeader)
      .send({
        code: lessonCode,
        kind: 'LISTENING',
        title: 'E2E Listening v1 Draft',
        description: 'Temporary Listening v1 lesson for E2E CRUD verification.',
        estimatedMinutes: 6,
        published: false,
        content: listeningContent,
      })
      .expect(201);

    const lessonId = created.body.data.id as string;
    createdLessonIds.push(lessonId);
    expect(created.body.data.questionsCount).toBe(5);

    const fetched = await request(app.getHttpServer())
      .get(`/api/v1/admin/lessons/${lessonId}`)
      .set('Authorization', authHeader)
      .expect(200);
    expect(fetched.body.data.content.listeningVersion).toBe(1);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/lessons/${lessonId}`)
      .set('Authorization', authHeader)
      .send({ title: 'E2E Listening v1 Updated', published: false })
      .expect(200);
    expect(updated.body.data.title).toBe('E2E Listening v1 Updated');

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/lessons/${lessonId}`)
      .set('Authorization', authHeader)
      .expect(200);
  });

  it('clears AssessmentItem optional fields to null while preserving Writing rubricCriteria', async () => {
    const authHeader = `Bearer ${adminToken}`;
    const rubric = {
      taskResponse: 25,
      coherence: 25,
      lexicalResource: 25,
      grammar: 25,
    };

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/assessment-items')
      .set('Authorization', authHeader)
      .send({
        skill: 'WRITING',
        skillCode: 'writing.essay',
        cefrLevel: 'B1',
        type: 'ESSAY',
        usageScope: 'MOCK_EXAM',
        passage: 'Context passage to clear',
        prompt: 'Write a short essay about online learning.',
        correctOption: 'Sample anchor to clear',
        explanation: 'Explanation to clear',
        audioUrl: '/media/learning/v1/sample.wav',
        rubricCriteria: rubric,
      })
      .expect(201);

    const itemId = created.body.data.id as string;
    createdAssessmentItemIds.push(itemId);

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/admin/assessment-items/${itemId}`)
      .set('Authorization', authHeader)
      .send({
        passage: null,
        correctOption: null,
        explanation: null,
        audioUrl: null,
        prompt: 'Write an updated essay about online learning.',
      })
      .expect(200);

    expect(patched.body.data.passage).toBeNull();
    expect(patched.body.data.correctOption).toBeNull();
    expect(patched.body.data.explanation).toBeNull();
    expect(patched.body.data.audioUrl).toBeNull();
    expect(patched.body.data.rubricCriteria).toEqual(rubric);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/assessment-items/${itemId}`)
      .set('Authorization', authHeader)
      .expect(200);
  });

  it('links and reorders AssessmentGroup items via itemIds on create and update', async () => {
    const authHeader = `Bearer ${adminToken}`;

    const item1Res = await request(app.getHttpServer())
      .post('/api/v1/admin/assessment-items')
      .set('Authorization', authHeader)
      .send({
        skill: 'READING',
        skillCode: 'reading.scanning',
        cefrLevel: 'B1',
        type: 'MULTIPLE_CHOICE',
        usageScope: 'MOCK_EXAM',
        prompt: 'E2E Group Question 1?',
        options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
        correctOption: 'Alpha',
      })
      .expect(201);
    const item2Res = await request(app.getHttpServer())
      .post('/api/v1/admin/assessment-items')
      .set('Authorization', authHeader)
      .send({
        skill: 'READING',
        skillCode: 'reading.main_idea',
        cefrLevel: 'B1',
        type: 'MULTIPLE_CHOICE',
        usageScope: 'MOCK_EXAM',
        prompt: 'E2E Group Question 2?',
        options: ['One', 'Two', 'Three', 'Four'],
        correctOption: 'Two',
      })
      .expect(201);

    const item1Id = item1Res.body.data.id as string;
    const item2Id = item2Res.body.data.id as string;
    createdAssessmentItemIds.push(item1Id, item2Id);

    const groupRes = await request(app.getHttpServer())
      .post('/api/v1/admin/assessment-groups')
      .set('Authorization', authHeader)
      .send({
        skill: 'READING',
        title: 'E2E Reading Group',
        cefrLevel: 'B1',
        partNumber: 1,
        passage: 'Shared E2E reading passage.',
        usageScope: 'MOCK_EXAM',
        itemIds: [item1Id, item2Id],
      })
      .expect(201);

    const groupId = groupRes.body.data.id as string;
    createdAssessmentGroupIds.push(groupId);
    expect(groupRes.body.data.itemsCount).toBe(2);
    expect(
      (groupRes.body.data.items as Array<{ id: string; itemOrder: number }>).map(
        (i) => ({ id: i.id, itemOrder: i.itemOrder }),
      ),
    ).toEqual([
      { id: item1Id, itemOrder: 1 },
      { id: item2Id, itemOrder: 2 },
    ]);

    const updatedGroup = await request(app.getHttpServer())
      .patch(`/api/v1/admin/assessment-groups/${groupId}`)
      .set('Authorization', authHeader)
      .send({ itemIds: [item2Id] })
      .expect(200);
    expect(updatedGroup.body.data.itemsCount).toBe(1);
    expect(updatedGroup.body.data.items[0]).toMatchObject({
      id: item2Id,
      itemOrder: 1,
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/assessment-groups/${groupId}`)
      .set('Authorization', authHeader)
      .expect(200);
  });

  it('extracts Speaking result.overall on Dashboard analytics and User detail', async () => {
    const authHeader = `Bearer ${adminToken}`;
    const learnerEmail = `e2e-speaking-learner-${Date.now()}@example.com`;
    createdEmails.push(learnerEmail);

    const learnerReg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Speaking Learner', email: learnerEmail, password: 'Password123!' })
      .expect(201);
    const learnerId = learnerReg.body.data.user.id as string;

    const prompt = await prisma.speakingPrompt.create({
      data: {
        code: `e2e-sp-score-${Date.now()}`,
        mode: 'READ_ALOUD',
        title: 'E2E Score Prompt',
        text: 'Good morning everyone.',
        maxDurationSeconds: 20,
        sortOrder: 999,
        published: true,
      },
    });
    createdSpeakingPromptIds.push(prompt.id);

    const submission = await prisma.speakingSubmission.create({
      data: {
        userId: learnerId,
        promptId: prompt.id,
        clientRequestId: randomUUID(),
        status: 'SUCCEEDED',
        promptSnapshot: {
          title: prompt.title,
          mode: 'READ_ALOUD',
          text: prompt.text,
          maxDurationSeconds: 20,
        },
        result: {
          schemaVersion: 2,
          overall: 86,
          pronunciation: 78,
          accuracy: 88,
          fluency: 84,
          completeness: 90,
        },
      },
    });
    createdSpeakingSubmissionIds.push(submission.id);

    const userDetail = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${learnerId}`)
      .set('Authorization', authHeader)
      .expect(200);
    expect(userDetail.body.data.recentSpeaking[0]).toMatchObject({
      id: submission.id,
      overallScore: 86,
    });

    const dash = await request(app.getHttpServer())
      .get('/api/v1/admin/analytics/dashboard?timeframe=30_DAYS&forceRefresh=true')
      .set('Authorization', authHeader)
      .expect(200);
    const speakingStat = (
      dash.body.data.masteryBySkill as Array<{
        group: string;
        sampleCount: number;
        accuracyPercent: number;
      }>
    ).find((s) => s.group === 'speaking');
    expect(speakingStat).toBeDefined();
    expect(speakingStat!.sampleCount).toBeGreaterThanOrEqual(1);
    expect(speakingStat!.accuracyPercent).toBeGreaterThan(0);
  });

  it('enforces Speaking ML limits (400/201) and preserves contentVersion on metadata-only updates', async () => {
    const authHeader = `Bearer ${adminToken}`;
    const baseCode = `e2e-sp-ml-${Date.now()}`;

    await request(app.getHttpServer())
      .post('/api/v1/admin/speaking-prompts')
      .set('Authorization', authHeader)
      .send({
        code: `${baseCode}-hints`,
        mode: 'TOPIC',
        title: 'Too many hints',
        text: 'Describe your favorite weekend activity.',
        hints: ['h1', 'h2', 'h3', 'h4'],
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/speaking-prompts')
      .set('Authorization', authHeader)
      .send({
        code: `${baseCode}-dur-ra`,
        mode: 'READ_ALOUD',
        title: 'Over 30s read aloud',
        text: 'Short read aloud sentence.',
        maxDurationSeconds: 45,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/speaking-prompts')
      .set('Authorization', authHeader)
      .send({
        code: `${baseCode}-dur-topic`,
        mode: 'TOPIC',
        title: 'Over 60s topic',
        text: 'Describe your city.',
        maxDurationSeconds: 61,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/speaking-prompts')
      .set('Authorization', authHeader)
      .send({
        code: `${baseCode}-text`,
        mode: 'TOPIC',
        title: 'Over 1000 chars',
        text: 'x'.repeat(1001),
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/admin/speaking-prompts')
      .set('Authorization', authHeader)
      .send({
        code: `${baseCode}-vc`,
        mode: 'TOPIC',
        title: 'Over 2000 visualContext',
        text: 'Describe a scene.',
        visualContext: 'v'.repeat(2001),
      })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/speaking-prompts')
      .set('Authorization', authHeader)
      .send({
        code: `${baseCode}-ok`,
        mode: 'TOPIC',
        title: 'Valid ML Topic',
        text: 'Describe your favorite hobby.',
        maxDurationSeconds: 60,
        hints: ['What it is', 'When you do it', 'Why you like it'],
      })
      .expect(201);

    const promptId = created.body.data.id as string;
    createdSpeakingPromptIds.push(promptId);
    expect(created.body.data.contentVersion).toBe(1);

    const metaUpdate = await request(app.getHttpServer())
      .patch(`/api/v1/admin/speaking-prompts/${promptId}`)
      .set('Authorization', authHeader)
      .send({
        title: 'Valid ML Topic Renamed',
        difficulty: 2,
        text: 'Describe your favorite hobby.',
        mode: 'TOPIC',
        hints: ['What it is', 'When you do it', 'Why you like it'],
      })
      .expect(200);
    expect(metaUpdate.body.data.contentVersion).toBe(1);

    const contentUpdate = await request(app.getHttpServer())
      .patch(`/api/v1/admin/speaking-prompts/${promptId}`)
      .set('Authorization', authHeader)
      .send({
        text: 'Describe a hobby you recently started.',
      })
      .expect(200);
    expect(contentUpdate.body.data.contentVersion).toBe(2);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/speaking-prompts/${promptId}`)
      .set('Authorization', authHeader)
      .expect(200);
  });
});
