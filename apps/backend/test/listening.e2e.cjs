// Real Nest HTTP + PostgreSQL + curriculum media. Only token verification is replaced.
// Unlike the Firebase integration suite, this does not require an Auth Emulator.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Test } = require('@nestjs/testing');
const { ValidationPipe, UnauthorizedException } = require('@nestjs/common');
const request = require('supertest');
const { LearningModule } = require('../dist/modules/learning/learning.module');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');
const { JwtAuthGuard } = require('../dist/common/guards/jwt-auth.guard');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

describe('Listening v1 persisted HTTP workflow (test identity guard)', () => {
  let app, prisma, unit, lesson, owner, stranger;
  const users = [], lessons = [], identities = new Map();
  const content = JSON.parse(readFileSync(path.join(__dirname, '../prisma/listening-content/campus-cafe-v1.json'), 'utf8'));

  before(async () => {
    const database = new URL(process.env.DATABASE_URL || '');
    assert.match(database.hostname, /^(localhost|127\.0\.0\.1)$/);
    assert.match(database.pathname, /^\/lingoroad_[a-z0-9_]*test$/);
    const module = await Test.createTestingModule({ imports: [LearningModule] })
      .overrideGuard(JwtAuthGuard).useValue({
        canActivate(context) {
          const req = context.switchToHttp().getRequest();
          const userId = identities.get(req.headers.authorization);
          if (!userId) throw new UnauthorizedException();
          req.user = { sub: userId };
          return true;
        },
      }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useStaticAssets(path.join(__dirname, '../media/learning'), { prefix: '/media/learning/', index: false, dotfiles: 'deny' });
    await app.init();
    prisma = app.get(PrismaService);
    for (let i = 0; i < 2; i++) {
      const user = await prisma.user.create({ data: { email: `listening-${randomUUID()}@example.com`, name: 'Listening Test' } });
      users.push(user.id);
      identities.set(`Bearer ${user.id}`, user.id);
    }
    [owner, stranger] = users;
    unit = await prisma.learningUnit.create({ data: { code: `listening-test-${randomUUID()}`, cefrLevel: 'A1',
      orderIndex: Math.floor(Math.random() * 1000000000) + 1000, title: 'Listening test unit', description: 'Isolated fixture' } });
    lesson = await createLesson(content);
  });

  after(async () => {
    if (prisma) {
      if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
      if (lessons.length) await prisma.learningLesson.deleteMany({ where: { id: { in: lessons } } });
      if (unit) await prisma.learningUnit.delete({ where: { id: unit.id } });
    }
    if (app) await app.close();
  });

  async function createLesson(value) {
    const row = await prisma.learningLesson.create({ data: { code: `listening-test-${randomUUID()}`, kind: 'LISTENING',
      title: 'At the campus café', description: 'Listening v1 HTTP fixture', estimatedMinutes: 6, sortOrder: 999,
      published: true, contentVersion: 1, unitId: unit.id, content: value } });
    lessons.push(row.id);
    return row;
  }
  function send(userId, method, route, body) {
    const req = request(app.getHttpServer())[method](route).set('Authorization', `Bearer ${userId}`);
    return body === undefined ? req : req.send(body);
  }
  async function start(row = lesson) {
    return (await send(owner, 'post', `/learning/lessons/${row.id}/attempts`, {}).expect(201)).body.data;
  }
  function noReview(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!['transcript', 'transcriptSegments', 'evidenceSegmentIds', 'translationVi', 'contentSnapshot'].includes(key), `Leaked ${key}`);
      noReview(child);
    }
  }

  it('protects HTTP routes and exposes preparation/catalogue metadata without review fields', async () => {
    await request(app.getHttpServer()).get('/learning/lessons').expect(401);
    const list = (await send(owner, 'get', '/learning/lessons?kind=LISTENING').expect(200)).body.data.items;
    const entry = list.find((row) => row.id === lesson.id);
    assert.equal(entry.cefrLevel, 'A1');
    assert.equal(entry.audioDurationMs, content.audioDurationMs);
    assert.equal(entry.questionCount, 5);
    const detail = (await send(owner, 'get', `/learning/lessons/${lesson.id}`).expect(200)).body.data;
    assert.deepEqual(detail.content.preparation, content.preparation);
    noReview(detail);
    assert.ok(detail.questions.every((q) => !q.correctOptionId && !q.explanation));
  });

  it('keeps review private across progress/check, locks answers and opens immutable completed review once', async () => {
    let state = await start();
    noReview(state);
    assert.equal(state.position.phase, 'QUIZ');
    await send(stranger, 'get', `/learning/attempts/${state.id}`).expect(404);
    await send(stranger, 'put', `/learning/attempts/${state.id}/answers/q01/check`, { expectedVersion: 0, optionId: 'A' }).expect(404);
    await send(owner, 'post', `/learning/attempts/${state.id}/submit`, { expectedVersion: 0 }).expect(400);
    state = (await send(owner, 'patch', `/learning/attempts/${state.id}/progress`, {
      expectedVersion: state.version, phase: 'QUIZ', index: 0, questionId: 'q01', optionId: 'A',
    }).expect(200)).body.data;
    noReview(state);
    for (const [index, question] of content.questions.entries()) {
      const optionId = index === 0 ? question.options.find((option) => option.id !== question.correctOptionId).id : question.correctOptionId;
      const body = { expectedVersion: state.version, optionId };
      state = (await send(owner, 'put', `/learning/attempts/${state.id}/answers/${question.id}/check`, body).expect(200)).body.data;
      noReview(state);
      const retry = (await send(owner, 'put', `/learning/attempts/${state.id}/answers/${question.id}/check`, body).expect(200)).body.data;
      assert.equal(retry.version, state.version);
      assert.equal(state.answers[index].checked, true);
      const other = question.options.find((option) => option.id !== optionId).id;
      await send(owner, 'put', `/learning/attempts/${state.id}/answers/${question.id}/check`, { expectedVersion: state.version, optionId: other }).expect(409);
    }
    // Publishing edits must not replace the attempt's private content snapshot.
    await prisma.learningLesson.update({ where: { id: lesson.id }, data: { contentVersion: 2, content: { ...content, transcript: 'New unpublished revision text.' } } });
    const requestBody = { expectedVersion: state.version };
    const completed = (await send(owner, 'post', `/learning/attempts/${state.id}/submit`, requestBody).expect(200)).body.data;
    assert.equal(completed.status, 'COMPLETED');
    assert.equal(completed.result.correctCount, 4);
    assert.equal(completed.content.transcript, content.transcript);
    assert.deepEqual(completed.content.transcriptSegments, content.transcriptSegments);
    assert.deepEqual(completed.answers[0].evidenceSegmentIds, content.questions[0].evidenceSegmentIds);
    assert.equal(completed.levelChange, null);
    const repeated = (await send(owner, 'post', `/learning/attempts/${state.id}/submit`, requestBody).expect(200)).body.data;
    assert.equal(repeated.version, completed.version);
    assert.equal(await prisma.learningAttempt.count({ where: { userId: owner, lessonId: lesson.id, status: 'COMPLETED' } }), 1);
    assert.equal(await prisma.learningSkillLevel.count({ where: { userId: owner, kind: 'LISTENING' } }), 0);
    assert.equal(await prisma.learningSkillLevelEvent.count({ where: { attemptId: state.id } }), 0);
    const history = (await send(owner, 'get', '/learning/history').expect(200)).body.data.items;
    assert.ok(history.some((row) => row.id === state.id && row.result.correctCount === 4));
    assert.deepEqual((await send(owner, 'get', `/learning/attempts/${state.id}`).expect(200)).body.data.content, completed.content);
    await prisma.learningLesson.update({ where: { id: lesson.id }, data: { contentVersion: 1, content } });
  });

  it('rejects missing audio before discarding an existing unfinished attempt', async () => {
    const current = await start();
    await prisma.learningLesson.update({ where: { id: lesson.id }, data: { content: { ...content, audioUrl: '/media/learning/v1/missing.wav' } } });
    const failed = await send(owner, 'post', `/learning/lessons/${lesson.id}/attempts`, {}).expect(503);
    assert.equal(failed.body.error.code, 'LEARNING_CONTENT_UNAVAILABLE');
    assert.equal(await prisma.learningAttempt.count({ where: { id: current.id, status: 'IN_PROGRESS' } }), 1);
    await prisma.learningLesson.update({ where: { id: lesson.id }, data: { content } });
    await send(owner, 'delete', `/learning/attempts/${current.id}`).expect(200);
    await send(owner, 'get', `/learning/attempts/${current.id}`).expect(404);
  });

  it('retains legacy transcript-only playback and serves the generated WAV with range requests', async () => {
    const legacy = structuredClone(content);
    for (const key of ['listeningVersion', 'audioDurationMs', 'preparation', 'transcriptSegments']) delete legacy[key];
    legacy.questions.forEach((question) => { delete question.evidenceSegmentIds; delete question.skillCode; });
    const row = await createLesson(legacy);
    let state = await start(row);
    for (const question of legacy.questions) {
      state = (await send(owner, 'put', `/learning/attempts/${state.id}/answers/${question.id}/check`, {
        expectedVersion: state.version, optionId: question.correctOptionId,
      }).expect(200)).body.data;
    }
    const done = (await send(owner, 'post', `/learning/attempts/${state.id}/submit`, { expectedVersion: state.version }).expect(200)).body.data;
    assert.equal(done.content.transcript, legacy.transcript);
    assert.equal(done.content.transcriptSegments, undefined);
    const full = await request(app.getHttpServer()).get(content.audioUrl).expect(200);
    assert.equal(full.body.subarray(0, 4).toString(), 'RIFF');
    const range = await request(app.getHttpServer()).get(content.audioUrl).set('Range', 'bytes=0-43').expect(206);
    assert.equal(range.body.length, 44);
  });
});
