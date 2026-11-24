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
      const user = await prisma.user.create({ data: {
        email: `listening-${randomUUID()}@example.com`, name: 'Listening Test', profile: { create: {} },
      } });
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

  const extendedPilot = process.env.LINGOROAD_VERIFY_LISTENING_A1_C2 === '1';
  it('hides chosen completed attempts atomically and preserves progress and pagination', async () => {
    const row = await createLesson(content);
    const active = await start(row);
    await send(owner, 'delete', `/learning/history/${active.id}`).expect(404);

    const complete = async () => {
      let state = await start(row);
      for (const question of content.questions) {
        state = (await send(owner, 'put', `/learning/attempts/${state.id}/answers/${question.id}/check`, {
          expectedVersion: state.version, optionId: question.correctOptionId,
        }).expect(200)).body.data;
      }
      return (await send(owner, 'post', `/learning/attempts/${state.id}/submit`, {
        expectedVersion: state.version,
      }).expect(200)).body.data;
    };
    const older = await complete();
    const middle = await complete();
    const newest = await complete();
    const history = '/learning/history?kind=LISTENING&limit=1';
    const before = (await send(owner, 'get', history).expect(200)).body.data;
    assert.equal(before.nextCursor, newest.id);
    const progressBefore = (await send(owner, 'get', '/learning/progress').expect(200)).body.data;
    const attemptPath = `/learning/history/${newest.id}`;
    await send(stranger, 'delete', attemptPath).expect(404);
    await send(owner, 'delete', attemptPath).expect(200);
    await send(owner, 'delete', attemptPath).expect(200);
    await send(owner, 'get', `/learning/attempts/${newest.id}`).expect(404);
    const after = (await send(owner, 'get', history).expect(200)).body.data;
    assert.equal(after.items[0].id, middle.id);
    const fromHidden = (await send(owner, 'get', `${history}&cursor=${newest.id}`).expect(200)).body.data;
    assert.equal(fromHidden.items[0].id, middle.id);
    const saved = await prisma.learningAttempt.findUniqueOrThrow({
      where: { id: newest.id }, include: { answers: true },
    });
    assert.equal(saved.status, 'COMPLETED');
    assert.equal(saved.answers.length, 5);
    assert.ok(saved.historyHiddenAt);
    const batchPath = '/learning/history/hide';
    const selected = { attemptIds: [older.id, middle.id] };
    await send(stranger, 'post', batchPath, selected).expect(404);
    await send(owner, 'post', batchPath, { attemptIds: [] }).expect(400);
    await send(owner, 'post', batchPath, { attemptIds: [older.id, older.id] }).expect(400);
    await send(owner, 'post', batchPath, { attemptIds: [older.id, randomUUID()] }).expect(404);
    assert.equal(await prisma.learningAttempt.count({
      where: { id: { in: selected.attemptIds }, historyHiddenAt: null },
    }), 2);
    await send(owner, 'post', batchPath, selected).expect(200);
    await send(owner, 'post', batchPath, selected).expect(200);
    assert.equal(await prisma.learningAttempt.count({
      where: { id: { in: selected.attemptIds }, historyHiddenAt: { not: null }, status: 'COMPLETED' },
    }), 2);
    const lessonDetail = (await send(owner, 'get', `/learning/lessons/${row.id}`).expect(200)).body.data;
    assert.equal(lessonDetail.state, 'COMPLETED');
    assert.equal(lessonDetail.latestResult, null);
    const progressAfter = (await send(owner, 'get', '/learning/progress').expect(200)).body.data;
    assert.equal(progressAfter.totals.completedAttemptCount, progressBefore.totals.completedAttemptCount);
    assert.equal(progressAfter.totals.completedLessonCount, progressBefore.totals.completedLessonCount);
  });

  if (extendedPilot || process.env.LINGOROAD_VERIFY_LISTENING_PILOT === '1') {
    it('completes each pilot lesson at its target level and opens its audio evidence', async () => {
      assert.equal(new URL(process.env.DATABASE_URL).pathname, '/lingoroad_listening_pilot_test');
      const directory = path.join(__dirname, '../prisma/listening-content', extendedPilot
        ? 'a1-c2-pilot'
        : path.join('voa-pilot', process.env.LINGOROAD_VERIFY_LISTENING_WAVE_2 === '1' ? 'wave-2' : ''));
      const entries = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
      const expectedLevels = extendedPilot ? ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] : ['A1', 'A2', 'B1'];
      assert.deepEqual([...new Set(entries.map((entry) => entry.level))].sort(), expectedLevels);
      if (extendedPilot) {
        assert.deepEqual(expectedLevels.map((level) => entries.filter((entry) => entry.level === level).length),
          [1, 1, 2, 2, 2, 2]);
      }
      const catalogue = (await send(owner, 'get', '/learning/lessons?kind=LISTENING').expect(200)).body.data.items;
      for (const entry of entries) {
        const row = await prisma.learningLesson.findUniqueOrThrow({ where: { code: entry.code } });
        const fixture = JSON.parse(readFileSync(path.join(directory, `${entry.code}-v1.json`), 'utf8'));
        const card = catalogue.find((item) => item.id === row.id);
        assert.equal(card?.title, entry.title);
        assert.equal(card?.cefrLevel, entry.level);
        assert.equal(card?.questionCount, 5);
        const range = await request(app.getHttpServer()).get(fixture.audioUrl).set('Range', 'bytes=0-43').expect(206);
        assert.equal(range.body.subarray(0, 4).toString(), 'RIFF');
        let state = await start(row);
        noReview(state);
        for (const question of fixture.questions) {
          state = (await send(owner, 'put', `/learning/attempts/${state.id}/answers/${question.id}/check`, {
            expectedVersion: state.version, optionId: question.correctOptionId,
          }).expect(200)).body.data;
          noReview(state);
        }
        const done = (await send(owner, 'post', `/learning/attempts/${state.id}/submit`, {
          expectedVersion: state.version,
        }).expect(200)).body.data;
        assert.equal(done.result.correctCount, 5);
        assert.equal(done.content.transcript, fixture.transcript);
        assert.deepEqual(done.content.transcriptSegments, fixture.transcriptSegments);
        assert.deepEqual(done.answers.map((answer) => answer.evidenceSegmentIds),
          fixture.questions.map((question) => question.evidenceSegmentIds));
      }
    });
  }
});
