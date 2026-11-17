// Real Firebase Auth Emulator + HTTP + PostgreSQL acceptance tests.
// Never run this suite against a production Firebase project or database.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { readFile } = require('node:fs/promises');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const request = require('supertest');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');
const { MlClientService } = require('../dist/modules/ml/ml-client.service');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

describe('Persisted learning workflow', () => {
  let app, prisma, seeds, seedLearningContent;
  const users = [], identities = [], fixtures = [];
  const mlExplainCalls = [];
  let mlExplainHandler = async () => { throw new Error('ML mock unavailable'); };
  const mlMock = {
    explainReadingAnswer: async (payload) => {
      mlExplainCalls.push(payload);
      return mlExplainHandler(payload);
    },
  };
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const project = process.env.FIREBASE_PROJECT_ID;

  before(async () => {
    assert.match(emulator || '', /^(127\.0\.0\.1|localhost):\d+$/);
    assert.match(project || '', /^demo-/);
    assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'));
    process.env.AUTH_PROVIDER = 'firebase';
    require('ts-node/register');
    ({ seedLearningContent } = require('../prisma/seed-learning.ts'));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MlClientService)
      .useValue(mlMock)
      .compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useStaticAssets(path.join(__dirname, '../media/learning'), {
      prefix: '/media/learning/', index: false, dotfiles: 'deny',
    });
    await app.init();
    prisma = app.get(PrismaService);
    await seedLearningContent(prisma);
    const lessons = await prisma.learningLesson.findMany({
      where: { published: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    seeds = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'].map(kind => {
      const lesson = lessons.find(row => row.kind === kind);
      assert.ok(lesson, `Missing ${kind} curriculum lesson`);
      assert.equal(lesson.content.questions.length, 5);
      return lesson;
    });
  });

  after(async () => {
    if (prisma && users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (prisma && fixtures.length) await prisma.learningLesson.deleteMany({ where: { id: { in: fixtures } } });
    const { getApps } = require('firebase-admin/app');
    const admin = getApps().find(a => a.name === `lingoroad-auth-${project}`);
    if (admin) {
      const { getAuth } = require('firebase-admin/auth');
      for (const uid of identities) await getAuth(admin).deleteUser(uid);
    }
    if (app) await app.close();
  });

  async function account() {
    const response = await fetch(`http://${emulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `learning-e2e-${randomUUID()}@example.com`, password: 'LearningTest123!', returnSecureToken: true }),
    });
    assert.equal(response.status, 200);
    const identity = await response.json();
    identities.push(identity.localId);
    const me = await send(identity, 'get', '/auth/me').expect(200);
    users.push(me.body.data.id);
    return { ...identity, userId: me.body.data.id };
  }

  function send(owner, method, url, body) {
    const call = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${owner.idToken}`);
    return body === undefined ? call : call.send(body);
  }
  async function start(owner, lesson) {
    const response = await send(owner, 'post', `/learning/lessons/${lesson.id}/attempts`, {}).expect(201);
    return response.body.data;
  }
  async function checkAll(owner, attempt, lesson, wrong = false) {
    for (const question of lesson.content.questions) {
      const optionId = wrong
        ? question.options.find(option => option.id !== question.correctOptionId).id
        : question.correctOptionId;
      const response = await send(owner, 'put', `/learning/attempts/${attempt.id}/answers/${question.id}/check`, {
        expectedVersion: attempt.version, optionId,
      }).expect(200);
      attempt = response.body.data;
    }
    return attempt;
  }
  function assertNoKey(value, forbidden) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbidden.includes(key), `Leaked private field ${key}`);
      assertNoKey(child, forbidden);
    }
  }

  it('protects the catalogue and hides unchecked answers and listening transcripts', async () => {
    await request(app.getHttpServer()).get('/learning/lessons').expect(401);
    const owner = await account();
    const catalogue = await send(owner, 'get', '/learning/lessons').expect(200);
    assert.ok(seeds.every(seed => catalogue.body.data.items.some(row => row.id === seed.id)));
    await send(owner, 'get', '/learning/lessons?kind=UNKNOWN').expect(400);
    for (const lesson of seeds) {
      const detail = await send(owner, 'get', `/learning/lessons/${lesson.id}`).expect(200);
      assertNoKey(detail.body.data, ['correctOptionId', 'isCorrect', 'explanation', 'evidence', 'transcript', 'contentSnapshot']);
      const attempt = await start(owner, lesson);
      assertNoKey(attempt, ['correctOptionId', 'isCorrect', 'explanation', 'evidence', 'transcript', 'contentSnapshot']);
      assert.equal(attempt.questions.length, 5);
    }
  });

  it('persists all four flows, completes at 0/5, and preserves retakes and distinct lesson counts', async () => {
    const owner = await account();
    for (const lesson of seeds) {
      let attempt = await start(owner, lesson);
      const phase = lesson.content.steps.length ? 'STUDY' : 'QUIZ';
      const index = lesson.kind === 'VOCABULARY' ? 6 : 0;
      attempt = (await send(owner, 'patch', `/learning/attempts/${attempt.id}/progress`, {
        expectedVersion: attempt.version, phase, index,
      }).expect(200)).body.data;
      const fetched = (await send(owner, 'get', `/learning/attempts/${attempt.id}`).expect(200)).body.data;
      assert.deepEqual(fetched.position, { phase, index });
      // Starting the lesson again discards unfinished progress and restarts from index 0.
      const restarted = await start(owner, lesson);
      assert.notEqual(restarted.id, attempt.id);
      assert.deepEqual(restarted.position, { phase: lesson.content.steps.length ? 'STUDY' : 'QUIZ', index: 0 });
      attempt = restarted;
      await send(owner, 'post', `/learning/attempts/${attempt.id}/submit`, { expectedVersion: attempt.version }).expect(400);
      attempt = await checkAll(owner, attempt, lesson, true);
      const submitted = (await send(owner, 'post', `/learning/attempts/${attempt.id}/submit`, {
        expectedVersion: attempt.version,
      }).expect(200)).body.data;
      assert.equal(submitted.status, 'COMPLETED');
      assert.deepEqual(submitted.result, { correctCount: 0, totalQuestions: 5, scoreRatio: 0 });
      if (lesson.kind === 'LISTENING') assert.equal(submitted.content.transcript, lesson.content.transcript);
      await send(owner, 'delete', `/learning/attempts/${submitted.id}`).expect(409);
      const retake = await start(owner, lesson);
      assert.notEqual(retake.id, submitted.id);
      await send(owner, 'delete', `/learning/attempts/${retake.id}`).expect(200);
      await send(owner, 'get', `/learning/attempts/${retake.id}`).expect(404);
      const previous = await send(owner, 'get', `/learning/attempts/${submitted.id}`).expect(200);
      assert.equal(previous.body.data.status, 'COMPLETED');
      assert.equal(previous.body.data.result.correctCount, 0);
    }
    const summary = (await send(owner, 'get', '/learning/summary').expect(200)).body.data;
    assert.equal(summary.completedLessonCount, 4);
    assert.equal(summary.completedAttemptCount, 4);
    assert.equal(summary.activeAttemptCount, 0);
    assert.equal(summary.continueAttemptId, null);
    const all = [];
    let cursor;
    do {
      const page = (await send(owner, 'get', `/learning/history?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`).expect(200)).body.data;
      all.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(all.length, 4);
    assert.equal(new Set(all.map(row => row.id)).size, 4);
    assert.ok(all.every(row => row.status === 'COMPLETED'));
  });

  it('lists the A2 reading lesson and preserves its passage and level when reopening from history', async () => {
    const owner = await account();
    const { items } = (await send(owner, 'get', '/learning/lessons?kind=READING').expect(200)).body.data;
    assert.equal(items.find(row => row.code === 'reading-everyday-introductions').cefrLevel, 'A1');
    const lesson = items.find(row => row.code === 'reading-a2-club-meeting');
    assert.equal(lesson.cefrLevel, 'A2');
    assert.equal(lesson.questionCount, 5);
    const original = await prisma.learningLesson.findUniqueOrThrow({ where: { id: lesson.id } });
    const started = await start(owner, lesson);
    assert.equal(started.lesson.cefrLevel, 'A2');
    assert.equal(started.lesson.contentVersion, 3);
    assert.match(started.content.passage, /book club meeting/);
    assert.ok(Array.isArray(started.content.keyVocabulary) && started.content.keyVocabulary.length > 0);
    assertNoKey(started, ['correctOptionId', 'isCorrect', 'explanation', 'evidence']);
    const first = original.content.questions[0];
    const draft = (await send(owner, 'patch', `/learning/attempts/${started.id}/progress`, {
      expectedVersion: started.version, phase: 'QUIZ', index: 0, questionId: first.id, optionId: first.correctOptionId,
    }).expect(200)).body.data;
    assert.deepEqual(draft.answers.find(answer => answer.questionId === first.id), {
      questionId: first.id, optionId: first.correctOptionId, checked: false,
    });
    await send(owner, 'delete', `/learning/attempts/${draft.id}`).expect(200);
    const fresh = await start(owner, lesson);
    assert.notEqual(fresh.id, draft.id);
    assert.deepEqual(fresh.answers.find(answer => answer.questionId === first.id), {
      questionId: first.id, optionId: null, checked: false,
    });
    const checked = await checkAll(owner, fresh, original);
    assert.equal(checked.answers[0].evidence, first.evidence);
    await send(owner, 'post', `/learning/attempts/${checked.id}/submit`, { expectedVersion: checked.version }).expect(200);
    const history = (await send(owner, 'get', '/learning/history').expect(200)).body.data.items;
    const entry = history.find(row => row.id === checked.id);
    assert.equal(entry.lesson.cefrLevel, 'A2');
    assert.equal(entry.lesson.questionCount, 5);
    assert.equal(entry.result.correctCount, 5);
    const reviewed = (await send(owner, 'get', `/learning/attempts/${entry.id}`).expect(200)).body.data;
    assert.equal(reviewed.content.passage, started.content.passage);
    assert.equal(reviewed.answers[0].explanation, first.explanation);
    assert.equal(reviewed.answers[0].evidence, first.evidence);
  });

  it('preserves A2 reading v1 attempts across upgrade to v2 and only reveals v2 evidence per checked question', async () => {
    const owner = await account();
    const a2V2 = await prisma.learningLesson.findUniqueOrThrow({ where: { code: 'reading-a2-club-meeting' } });
    const v1Content = structuredClone(a2V2.content);
    delete v1Content.keyVocabulary;
    for (const q of v1Content.questions) {
      delete q.evidence;
      delete q.skillCode;
      delete q.type;
    }
    try {
      await prisma.learningLesson.update({
        where: { id: a2V2.id },
        data: { contentVersion: 1, content: v1Content },
      });
      const v1Started = await start(owner, a2V2);
      assert.equal(v1Started.lesson.contentVersion, 1);
      assert.equal(v1Started.lesson.questionCount, 5);

      await seedLearningContent(prisma);

      const reopenedV1 = (await send(owner, 'get', `/learning/attempts/${v1Started.id}`).expect(200)).body.data;
      assert.equal(reopenedV1.lesson.contentVersion, 1);
      assert.equal(reopenedV1.lesson.questionCount, 5);
      assert.equal(reopenedV1.questions[0].prompt, v1Content.questions[0].prompt);
      const checkedV1 = await checkAll(owner, reopenedV1, { content: v1Content });
      assertNoKey(checkedV1.answers, ['evidence']);
      await send(owner, 'post', `/learning/attempts/${checkedV1.id}/submit`, { expectedVersion: checkedV1.version }).expect(200);

      const v2Started = await start(owner, a2V2);
      assert.notEqual(v2Started.id, v1Started.id);
      assert.equal(v2Started.lesson.contentVersion, 3);
      assert.equal(v2Started.lesson.questionCount, 5);
      assertNoKey(v2Started, ['correctOptionId', 'isCorrect', 'explanation', 'evidence']);
      const q0 = a2V2.content.questions[0];
      const q0Checked = (await send(owner, 'put', `/learning/attempts/${v2Started.id}/answers/${q0.id}/check`, {
        expectedVersion: v2Started.version, optionId: q0.correctOptionId,
      }).expect(200)).body.data;
      assert.equal(q0Checked.answers[0].evidence, q0.evidence);
      assertNoKey(q0Checked.answers.slice(1), ['evidence']);
    } finally {
      await seedLearningContent(prisma);
    }
  });

  it('serializes concurrent starts and rejects stale progress without overwriting saved drafts', async () => {
    const owner = await account(), lesson = seeds[2];
    await Promise.all(Array.from({ length: 5 }, () => start(owner, lesson)));
    assert.equal(await prisma.learningAttempt.count({ where: { userId: owner.userId, lessonId: lesson.id, status: 'IN_PROGRESS' } }), 1);
    const winner = await prisma.learningAttempt.findFirstOrThrow({ where: { userId: owner.userId, lessonId: lesson.id, status: 'IN_PROGRESS' } });
    let attempt = (await send(owner, 'get', `/learning/attempts/${winner.id}`).expect(200)).body.data;
    const question = attempt.questions[0];
    const responses = await Promise.all(question.options.slice(0, 2).map(option => send(owner, 'patch', `/learning/attempts/${attempt.id}/progress`, {
      expectedVersion: attempt.version, phase: 'QUIZ', index: 0, questionId: question.id, optionId: option.id,
    })));
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    attempt = responses.find(response => response.status === 200).body.data;
    const persisted = (await send(owner, 'get', `/learning/attempts/${attempt.id}`).expect(200)).body.data;
    assert.equal(persisted.answers.find(answer => answer.questionId === question.id).optionId,
      attempt.answers.find(answer => answer.questionId === question.id).optionId);
    assert.equal(persisted.version, attempt.version);
  });

  it('replays lost check/submit responses once and refuses changing a locked answer', async () => {
    const owner = await account(), lesson = seeds[2];
    let attempt = await start(owner, lesson);
    const question = lesson.content.questions[0];
    const body = { expectedVersion: attempt.version, optionId: question.correctOptionId };
    const concurrentChecks = await Promise.all(Array.from({ length: 3 }, () =>
      send(owner, 'put', `/learning/attempts/${attempt.id}/answers/${question.id}/check`, body)));
    assert.ok(concurrentChecks.every(response => response.status === 200));
    const first = concurrentChecks[0].body.data;
    assert.ok(concurrentChecks.every(response => response.body.data.version === first.version));
    const replay = (await send(owner, 'put', `/learning/attempts/${attempt.id}/answers/${question.id}/check`, body).expect(200)).body.data;
    assert.equal(replay.version, first.version);
    assert.equal(replay.answers.filter(answer => answer.checked).length, 1);
    const wrong = question.options.find(option => option.id !== question.correctOptionId).id;
    await send(owner, 'put', `/learning/attempts/${attempt.id}/answers/${question.id}/check`, {
      expectedVersion: first.version, optionId: wrong,
    }).expect(409);
    // Retry all checked questions too: their grading must stay immutable.
    attempt = await checkAll(owner, first, lesson);
    const submit = { expectedVersion: attempt.version };
    const results = await Promise.all(Array.from({ length: 3 }, () => send(owner, 'post', `/learning/attempts/${attempt.id}/submit`, submit)));
    assert.ok(results.every(response => response.status === 200));
    assert.ok(results.every(response => response.body.data.result.correctCount === 5));
    const summary = (await send(owner, 'get', '/learning/summary').expect(200)).body.data;
    assert.equal(summary.completedAttemptCount, 1);
    assert.equal(summary.completedLessonCount, 1);
  });

  it('enforces ownership on every attempt operation and validates client input', async () => {
    const a = await account(), b = await account(), lesson = seeds[2];
    const attempt = await start(a, lesson), question = attempt.questions[0];
    await send(b, 'get', `/learning/attempts/${attempt.id}`).expect(404);
    await send(b, 'patch', `/learning/attempts/${attempt.id}/progress`, { expectedVersion: attempt.version, phase: 'QUIZ', index: 0 }).expect(404);
    await send(b, 'put', `/learning/attempts/${attempt.id}/answers/${question.id}/check`, { expectedVersion: attempt.version, optionId: question.options[0].id }).expect(404);
    await send(b, 'post', `/learning/attempts/${attempt.id}/submit`, { expectedVersion: attempt.version }).expect(404);
    await send(b, 'delete', `/learning/attempts/${attempt.id}`).expect(404);
    assert.deepEqual((await send(b, 'get', '/learning/history').expect(200)).body.data.items, []);
    await send(a, 'patch', `/learning/attempts/${attempt.id}/progress`, { expectedVersion: attempt.version, phase: 'QUIZ', index: 0, userId: b.userId }).expect(400);
    await send(a, 'patch', `/learning/attempts/${attempt.id}/progress`, { expectedVersion: attempt.version, phase: 'QUIZ', index: 999 }).expect(400);
    await send(a, 'put', `/learning/attempts/${attempt.id}/answers/${question.id}/check`, { expectedVersion: attempt.version, optionId: 'missing' }).expect(400);
    await send(a, 'get', '/learning/history?limit=0').expect(400);
  });

  it('freezes published content per attempt across edits and reseeding', async () => {
    const owner = await account(), source = seeds[2];
    const fixture = await prisma.learningLesson.create({ data: {
      code: `snapshot-test-${randomUUID()}`, kind: source.kind, title: 'Snapshot original',
      description: source.description, estimatedMinutes: source.estimatedMinutes,
      contentVersion: 1, sortOrder: 999, published: true, content: source.content,
    } });
    fixtures.push(fixture.id);
    let attempt = await start(owner, fixture);
    const updated = structuredClone(fixture.content);
    updated.questions[0].prompt = 'Edited after the learner started';
    updated.questions[0].correctOptionId = updated.questions[0].options.find(option => option.id !== updated.questions[0].correctOptionId).id;
    await prisma.learningLesson.update({ where: { id: fixture.id }, data: { content: updated, contentVersion: 2, title: 'Snapshot changed' } });
    const count = await prisma.learningLesson.count();
    await seedLearningContent(prisma);
    await seedLearningContent(prisma);
    assert.equal(await prisma.learningLesson.count(), count);
    const saved = (await send(owner, 'get', `/learning/attempts/${attempt.id}`).expect(200)).body.data;
    assert.equal(saved.lesson.title, 'Snapshot original');
    assert.equal(saved.questions[0].prompt, fixture.content.questions[0].prompt);
    attempt = await checkAll(owner, saved, fixture);
    const done = (await send(owner, 'post', `/learning/attempts/${attempt.id}/submit`, { expectedVersion: attempt.version }).expect(200)).body.data;
    assert.equal(done.result.correctCount, 5);
    const retake = await start(owner, fixture);
    assert.equal(retake.lesson.title, 'Snapshot changed');
    assert.equal(retake.lesson.contentVersion, 2);
    assert.equal(retake.questions[0].prompt, updated.questions[0].prompt);
  });

  it('serves checked-in WAV curriculum media without requiring learner tokens', async () => {
    const urls = new Set();
    for (const lesson of seeds) {
      if (lesson.content.audioUrl) urls.add(lesson.content.audioUrl);
      for (const step of lesson.content.steps) if (step.audioUrl) urls.add(step.audioUrl);
    }
    assert.equal(urls.size, 11);
    for (const url of urls) {
      assert.match(url, /^\/media\/learning\/v1\/[a-z]+\.wav$/);
      const response = await request(app.getHttpServer()).get(url).expect(200);
      const bytes = await readFile(path.join(__dirname, '../media/learning', url.slice('/media/learning/'.length)));
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
      assert.equal(bytes.subarray(8, 12).toString(), 'WAVE');
      assert.equal(Number(response.headers['content-length']), bytes.length);
    }
  });

  it('explains checked reading answers with ownership checks, AI success, and deterministic fallback without mutating attempts', async () => {
    mlExplainCalls.length = 0;
    const owner = await account(), stranger = await account();
    const reading = seeds.find(row => row.kind === 'READING');
    const started = await start(owner, reading);
    const question = reading.content.questions[0];

    mlExplainHandler = async () => ({
      explanation: 'AI giải thích từ mock provider: đoạn văn nêu rõ mốc giờ.',
      model_version: 'mock-ai',
    });

    await send(stranger, 'post', `/learning/attempts/${started.id}/answers/${question.id}/explain`, {}).expect(404);
    await send(owner, 'post', `/learning/attempts/${started.id}/answers/${question.id}/explain`, {}).expect(400);
    assert.equal(mlExplainCalls.length, 0);

    const checked = (await send(owner, 'put', `/learning/attempts/${started.id}/answers/${question.id}/check`, {
      expectedVersion: started.version,
      optionId: question.options.find(opt => opt.id !== question.correctOptionId).id,
    }).expect(200)).body.data;

    const aiExplained = (await send(owner, 'post', `/learning/attempts/${started.id}/answers/${question.id}/explain`, {})
      .expect(200)).body.data;
    assert.deepEqual(aiExplained, {
      questionId: question.id,
      explanation: 'AI giải thích từ mock provider: đoạn văn nêu rõ mốc giờ.',
      source: 'AI',
    });
    assert.equal(mlExplainCalls.length, 1);
    assert.equal(mlExplainCalls[0].question_prompt, question.prompt);

    mlExplainHandler = async () => { throw new Error('timeout of 12000ms exceeded'); };
    const retryableFallback = (await send(owner, 'post', `/learning/attempts/${started.id}/answers/${question.id}/explain`, {})
      .expect(200)).body.data;
    assert.deepEqual(retryableFallback, {
      questionId: question.id,
      explanation: question.explanation,
      source: 'CURRICULUM',
      retryable: true,
    });
    assert.equal(mlExplainCalls.length, 2);

    const longPassageContent = {
      steps: [],
      passage: `${reading.content.passage} ${'Extra context sentence about reading skills. '.repeat(120)}`,
      questions: [
        {
          id: 'q-ng',
          type: 'TRUE_FALSE_NOT_GIVEN',
          skillCode: 'reading.inference',
          prompt: 'The author plans to cancel every meeting next year.',
          options: [
            { id: 'A', text: 'True' },
            { id: 'B', text: 'False' },
            { id: 'C', text: 'Not Given' },
          ],
          correctOptionId: 'C',
          explanation: 'Bài đọc không đề cập kế hoạch năm sau.',
        },
        ...reading.content.questions.slice(0, 2),
      ],
    };
    const longFixture = await prisma.learningLesson.create({
      data: {
        code: `reading-long-${randomUUID()}`,
        kind: 'READING',
        title: 'Long reading fixture',
        description: reading.description,
        estimatedMinutes: 8,
        contentVersion: 1,
        sortOrder: 998,
        published: true,
        content: longPassageContent,
      },
    });
    fixtures.push(longFixture.id);
    const longStarted = await start(owner, longFixture);
    const ngChecked = (await send(owner, 'put', `/learning/attempts/${longStarted.id}/answers/q-ng/check`, {
      expectedVersion: longStarted.version,
      optionId: 'C',
    }).expect(200)).body.data;
    const contextFallback = (await send(owner, 'post', `/learning/attempts/${ngChecked.id}/answers/q-ng/explain`, {})
      .expect(200)).body.data;
    assert.deepEqual(contextFallback, {
      questionId: 'q-ng',
      explanation: 'Bài đọc không đề cập kế hoạch năm sau.',
      source: 'CURRICULUM',
      retryable: false,
    });
    assert.equal(mlExplainCalls.length, 2);

    const persisted = (await send(owner, 'get', `/learning/attempts/${started.id}`).expect(200)).body.data;
    assert.equal(persisted.version, checked.version);
    assert.deepEqual(persisted.answers, checked.answers);
  });
});
