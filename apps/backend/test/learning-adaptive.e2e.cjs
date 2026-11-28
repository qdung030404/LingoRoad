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
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, transform: true, forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true }
    }));
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

  it('blocks promotion after answer exposure + cancel, promotes A2->B1 with retry idempotency, separates budget cases, and upgrades adaptive-v1 plans', async () => {
    const a2Primary = await prisma.learningLesson.findUniqueOrThrow({ where: { code: 'reading-a2-club-meeting' } });
    const a2Secondary = await prisma.learningLesson.findUniqueOrThrow({ where: { code: 'reading-a2-weekend-market' } });
    const b1Lesson = await prisma.learningLesson.findUniqueOrThrow({ where: { code: 'reading-b1-hybrid-workday' } });

    // 1. Cancel after check() reveals answers -> redo cannot promote to B1, and real A1 (only 1 lesson) cannot cause A2->A1 dead-end.
    const exposedUser = await account();
    await seedReadingPlacement(exposedUser, 'A2', 20);
    const partialA2 = await start(exposedUser, a2Primary);
    await send(exposedUser, 'put', `/learning/attempts/${partialA2.id}/answers/${a2Primary.content.questions[0].id}/check`, {
      expectedVersion: partialA2.version,
      optionId: a2Primary.content.questions[0].correctOptionId,
    }).expect(200);
    await send(exposedUser, 'delete', `/learning/attempts/${partialA2.id}`).expect(200);
    const exposureRow = await prisma.learningAnswerExposure.findUnique({
      where: { userId_lessonId: { userId: exposedUser.userId, lessonId: a2Primary.id } },
    });
    assert.equal(exposureRow.firstAttemptId, partialA2.id);

    const redoneFirst = await completeReadingLesson(exposedUser, a2Primary, false);
    assert.equal(redoneFirst.levelChange, null);
    const secondAfterExpose = await completeReadingLesson(exposedUser, a2Secondary, false);
    assert.equal(secondAfterExpose.levelChange, null);
    assert.equal((await send(exposedUser, 'get', '/learning/progress').expect(200)).body.data.recommendedLevels.reading.cefrLevel, 'A2');

    // Upgrade a stored adaptive-v1 plan on GET.
    await prisma.learningDayPlan.create({
      data: {
        userId: exposedUser.userId,
        date: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10),
        preferencesVersion: 1,
        dailyGoalMinutes: 20,
        policyVersion: 'adaptive-v1',
        items: [],
      },
    });
    const upgradedPlan = (await send(exposedUser, 'get', '/learning/plan/today').expect(200)).body.data.plan;
    assert.equal(upgradedPlan.policyVersion, 'adaptive-v3');
    assert.ok(upgradedPlan.items.length > 0);

    // Real-catalog demotion policy: demotes A2 -> A1 on 2 weak completions (<50%) only when A1 has >= 2 unexposed lessons.
    const a1PublishedCount = await prisma.learningLesson.count({
      where: { kind: 'READING', published: true, unit: { cefrLevel: 'A1' } },
    });
    const weakGuardUser = await account();
    await seedReadingPlacement(weakGuardUser, 'A2', 20);
    await completeReadingLesson(weakGuardUser, a2Primary, true);
    const weakSecond = await completeReadingLesson(weakGuardUser, a2Secondary, true);
    if (a1PublishedCount >= 2) {
      assert.deepEqual(weakSecond.levelChange, { kind: 'READING', from: 'A2', to: 'A1', direction: 'DOWN' });
      assert.equal((await send(weakGuardUser, 'get', '/learning/progress').expect(200)).body.data.recommendedLevels.reading.cefrLevel, 'A1');
    } else {
      assert.equal(weakSecond.levelChange, null);
      assert.equal((await send(weakGuardUser, 'get', '/learning/progress').expect(200)).body.data.recommendedLevels.reading.cefrLevel, 'A2');
    }

    // 2. Remaining today budget (20 min) -> promotes A2 -> B1, retry submit returns same levelChange, today's plan adds B1 immediately.
    const roomUser = await account();
    await seedReadingPlacement(roomUser, 'A2', 20);
    await send(roomUser, 'post', '/learning/plan/today', {}).expect(200);
    const roomFirst = await completeReadingLesson(roomUser, a2Primary, false);
    assert.equal(roomFirst.levelChange, null);
    const roomAttempt2 = await start(roomUser, a2Secondary);
    const roomChecked2 = await checkAll(roomUser, roomAttempt2, a2Secondary, false);
    const roomSecond = (await send(roomUser, 'post', `/learning/attempts/${roomChecked2.id}/submit`, { expectedVersion: roomChecked2.version }).expect(200)).body.data;
    assert.deepEqual(roomSecond.levelChange, { kind: 'READING', from: 'A2', to: 'B1', direction: 'UP' });

    // Retry same attempt after simulated lost response -> returns exact same levelChange without second evaluation.
    const retried = (await send(roomUser, 'post', `/learning/attempts/${roomChecked2.id}/submit`, { expectedVersion: roomChecked2.version }).expect(200)).body.data;
    assert.deepEqual(retried.levelChange, { kind: 'READING', from: 'A2', to: 'B1', direction: 'UP' });
    assert.equal(await prisma.learningSkillLevelEvent.count({ where: { userId: roomUser.userId } }), 1);

    const todayWithRoom = (await send(roomUser, 'get', '/learning/plan/today').expect(200)).body.data.plan;
    assert.ok(todayWithRoom.items.some((item) => item.lessonId === b1Lesson.id && item.completed === false));

    // 3. Full today budget (10 min = 5m + 5m) -> promotes A2 -> B1, today stays at 2/2 without exceeding 10m; next plan schedules B1 first.
    const fullUser = await account();
    await seedReadingPlacement(fullUser, 'A2', 10);
    await send(fullUser, 'post', '/learning/plan/today', {}).expect(200);
    await completeReadingLesson(fullUser, a2Primary, false);
    const fullSecond = await completeReadingLesson(fullUser, a2Secondary, false);
    assert.deepEqual(fullSecond.levelChange, { kind: 'READING', from: 'A2', to: 'B1', direction: 'UP' });
    const fullPlan = (await send(fullUser, 'get', '/learning/plan/today').expect(200)).body.data.plan;
    assert.equal(fullPlan.totalCount, 2);
    assert.equal(fullPlan.completedCount, 2);
    assert.ok(!fullPlan.items.some((item) => item.lessonId === b1Lesson.id));
    await prisma.learningDayPlan.updateMany({ where: { userId: fullUser.userId }, data: { date: '2000-01-01' } });
    await prisma.learningAttempt.updateMany({ where: { userId: fullUser.userId }, data: { submittedAt: new Date(Date.now() - 86_400_000) } });
    const nextPlan = (await send(fullUser, 'post', '/learning/plan/today', {}).expect(200)).body.data.plan;
    assert.equal(nextPlan.items[0].lessonId, b1Lesson.id);
  });

  it('verifies technical fixture demotions (B1->A2 and A2->A1 with completed-today retention) and three concurrency races', async () => {
    const a1Unit = await prisma.learningUnit.findUniqueOrThrow({ where: { code: 'a1-unit-1' } });
    const b1Unit = await prisma.learningUnit.findUniqueOrThrow({ where: { code: 'b1-unit-1' } });
    const a1Primary = await prisma.learningLesson.findUniqueOrThrow({ where: { code: 'reading-everyday-introductions' } });
    const a2Primary = await prisma.learningLesson.findUniqueOrThrow({ where: { code: 'reading-a2-club-meeting' } });
    const a2Secondary = await prisma.learningLesson.findUniqueOrThrow({ where: { code: 'reading-a2-weekend-market' } });
    const b1Primary = await prisma.learningLesson.findUniqueOrThrow({ where: { code: 'reading-b1-hybrid-workday' } });

    const a1Fixture = await prisma.learningLesson.create({
      data: {
        code: `reading-a1-fixture-${randomUUID()}`, kind: 'READING', title: 'Fixture A1 Reading 2',
        description: a1Primary.description, estimatedMinutes: 5, contentVersion: 1, sortOrder: 996,
        published: true, unitId: a1Unit.id, content: a1Primary.content,
      },
    });
    const a2Unit = await prisma.learningUnit.findUniqueOrThrow({ where: { code: 'a2-unit-1' } });
    const a2Fixture = await prisma.learningLesson.create({
      data: {
        code: `reading-a2-fixture-${randomUUID()}`, kind: 'READING', title: 'Fixture A2 Reading 3 (should be excluded after demote to A1)',
        description: a2Primary.description, estimatedMinutes: 5, contentVersion: 1, sortOrder: 995,
        published: true, unitId: a2Unit.id, content: a2Primary.content,
      },
    });
    const b1Fixture = await prisma.learningLesson.create({
      data: {
        code: `reading-b1-fixture-${randomUUID()}`, kind: 'READING', title: 'Fixture B1 Reading 2',
        description: b1Primary.description, estimatedMinutes: 8, contentVersion: 1, sortOrder: 997,
        published: true, unitId: b1Unit.id, content: b1Primary.content,
      },
    });
    try {
      // 1. B1 -> A2 demotion in E2E fixture.
      const b1User = await account();
      await seedReadingPlacement(b1User, 'B1', 30);
      await completeReadingLesson(b1User, b1Primary, true);
      const b1Demoted = await completeReadingLesson(b1User, b1Fixture, true);
      assert.deepEqual(b1Demoted.levelChange, { kind: 'READING', from: 'B1', to: 'A2', direction: 'DOWN' });

      // 2. A2 -> A1 demotion keeps completed A2 today and restricts unit-bound suggested items to A1 ceiling (excluding unseen a2Fixture).
      const a2User = await account();
      await seedReadingPlacement(a2User, 'A2', 30);
      await send(a2User, 'post', '/learning/plan/today', {}).expect(200);
      await completeReadingLesson(a2User, a2Primary, true);
      const a2Demoted = await completeReadingLesson(a2User, a2Secondary, true);
      assert.deepEqual(a2Demoted.levelChange, { kind: 'READING', from: 'A2', to: 'A1', direction: 'DOWN' });
      const planAfterDemote = (await send(a2User, 'get', '/learning/plan/today').expect(200)).body.data.plan;
      assert.ok(planAfterDemote.items.some((item) => item.lessonId === a2Primary.id && item.completed === true));
      assert.ok(planAfterDemote.items.some((item) => item.lessonId === a2Secondary.id && item.completed === true));
      assert.ok(!planAfterDemote.items.some((item) => item.lessonId === a2Fixture.id));
      const suggestedReading = await prisma.learningLesson.findMany({
        where: { id: { in: planAfterDemote.items.filter((i) => !i.completed && i.kind === 'READING').map((i) => i.lessonId) } },
        include: { unit: { select: { cefrLevel: true } } },
      });
      const suggestedWithUnit = suggestedReading.filter((row) => row.unit != null);
      assert.ok(suggestedWithUnit.length >= 2);
      assert.ok(suggestedWithUnit.every((row) => row.unit.cefrLevel === 'A1'));

      // 3a. Concurrent duplicate submit on same attempt -> both succeed cleanly, 1 event max.
      const sameUser = await account();
      await seedReadingPlacement(sameUser, 'A2', 20);
      await completeReadingLesson(sameUser, a2Primary, false);
      const s2Start = await start(sameUser, a2Secondary);
      const s2Checked = await checkAll(sameUser, s2Start, a2Secondary, false);
      const [subA, subB] = await Promise.all([
        send(sameUser, 'post', `/learning/attempts/${s2Checked.id}/submit`, { expectedVersion: s2Checked.version }).expect(200),
        send(sameUser, 'post', `/learning/attempts/${s2Checked.id}/submit`, { expectedVersion: s2Checked.version }).expect(200),
      ]);
      assert.deepEqual(subA.body.data.levelChange, { kind: 'READING', from: 'A2', to: 'B1', direction: 'UP' });
      assert.deepEqual(subB.body.data.levelChange, { kind: 'READING', from: 'A2', to: 'B1', direction: 'UP' });
      assert.equal(await prisma.learningSkillLevelEvent.count({ where: { userId: sameUser.userId } }), 1);

      // 3b. Concurrent submit of two DIFFERENT A2 attempts by the same user -> serializes cleanly, promotes exactly once.
      const twoUser = await account();
      await seedReadingPlacement(twoUser, 'A2', 20);
      const t1 = await checkAll(twoUser, await start(twoUser, a2Primary), a2Primary, false);
      const t2 = await checkAll(twoUser, await start(twoUser, a2Secondary), a2Secondary, false);
      const [twoA, twoB] = await Promise.all([
        send(twoUser, 'post', `/learning/attempts/${t1.id}/submit`, { expectedVersion: t1.version }).expect(200),
        send(twoUser, 'post', `/learning/attempts/${t2.id}/submit`, { expectedVersion: t2.version }).expect(200),
      ]);
      const changes = [twoA.body.data.levelChange, twoB.body.data.levelChange].filter(Boolean);
      assert.equal(changes.length, 1);
      assert.deepEqual(changes[0], { kind: 'READING', from: 'A2', to: 'B1', direction: 'UP' });
      assert.equal(await prisma.learningSkillLevelEvent.count({ where: { userId: twoUser.userId } }), 1);

      // 3c. submit vs cancel race -> Promise.allSettled checks either valid outcome without deadlock and preserves exposure.
      const raceUser = await account();
      await seedReadingPlacement(raceUser, 'A2', 20);
      const raceChecked = await checkAll(raceUser, await start(raceUser, a2Primary), a2Primary, false);
      const [raceSubmit, raceCancel] = await Promise.allSettled([
        send(raceUser, 'post', `/learning/attempts/${raceChecked.id}/submit`, { expectedVersion: raceChecked.version }),
        send(raceUser, 'delete', `/learning/attempts/${raceChecked.id}`),
      ]);
      assert.equal(raceSubmit.status, 'fulfilled');
      assert.equal(raceCancel.status, 'fulfilled');
      const sStatus = raceSubmit.value.status;
      const cStatus = raceCancel.value.status;
      assert.ok(
        (sStatus === 200 && cStatus === 409) || (cStatus === 200 && sStatus === 404),
        `Unexpected submit/cancel race outcome: submit=${sStatus}, cancel=${cStatus}`,
      );
      const keptExposure = await prisma.learningAnswerExposure.findUnique({
        where: { userId_lessonId: { userId: raceUser.userId, lessonId: a2Primary.id } },
      });
      assert.equal(keptExposure?.firstAttemptId, raceChecked.id);
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.learningLesson.deleteMany({ where: { id: { in: [a1Fixture.id, a2Fixture.id, b1Fixture.id] } } });
    }
  });

  it('upgrades DEFAULT A1 after Placement across today/progress, keeps B1 reading over tie, and excludes pre-v4 A2 attempts', async () => {
    const clubSeed = await prisma.learningLesson.findUnique({ where: { code: 'reading-a2-club-meeting' } });
    const marketSeed = await prisma.learningLesson.findUnique({ where: { code: 'reading-a2-weekend-market' } });
    const b1Seed = await prisma.learningLesson.findUnique({ where: { code: 'reading-b1-hybrid-workday' } });
    assert.ok(clubSeed && marketSeed && b1Seed, 'Missing required seeded READING lessons');
    assert.ok(clubSeed.contentVersion >= 4);

    // 1a) Pre-placement plan creates DEFAULT A1, then Placement B1 upgrades via GET /learning/plan/today
    //     and prioritizes B1 reading even when reading and listening placement tie at 4/5.
    const todayUser = await account();
    await prisma.userProfile.upsert({
      where: { userId: todayUser.userId },
      create: { userId: todayUser.userId, dailyGoalMinutes: 10, preferredKinds: ['READING', 'LISTENING'] },
      update: { dailyGoalMinutes: 10, preferredKinds: ['READING', 'LISTENING'] },
    });
    const prePlan = (await send(todayUser, 'post', '/learning/plan/today').expect(200)).body.data;
    assert.equal(prePlan.plan.policyVersion, 'adaptive-v3');
    assert.ok(!prePlan.plan.items.some((item) => item.lessonId === b1Seed.id));

    const preProgress = (await send(todayUser, 'get', '/learning/progress').expect(200)).body.data;
    assert.equal(preProgress.recommendedLevels.reading.cefrLevel, 'A1');
    assert.equal(preProgress.recommendedLevels.reading.source, 'DEFAULT');

    await prisma.learningDayPlan.updateMany({
      where: { userId: todayUser.userId },
      data: { updatedAt: new Date(Date.now() - 60_000) },
    });
    await prisma.placementSession.create({
      data: {
        userId: todayUser.userId,
        status: 'COMPLETED',
        currentItemIndex: 10,
        totalItems: 10,
        correctCount: 8,
        estimatedCefr: 'B1',
        completedAt: new Date(),
        skillResults: {
          reading: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5 },
          listening: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5 },
        },
      },
    });

    const postToday = (await send(todayUser, 'get', '/learning/plan/today').expect(200)).body.data;
    assert.equal(postToday.plan.items[0].lessonId, b1Seed.id);
    assert.equal(postToday.plan.items[0].reason, 'Bài mới · đúng mức B1');

    const postTodayProgress = (await send(todayUser, 'get', '/learning/progress').expect(200)).body.data;
    assert.equal(postTodayProgress.recommendedLevels.reading.cefrLevel, 'B1');
    assert.equal(postTodayProgress.recommendedLevels.reading.source, 'PLACEMENT');

    // 1b) GET /learning/progress alone also upgrades DEFAULT A1 -> PLACEMENT B1.
    const progressUser = await account();
    await send(progressUser, 'post', '/learning/plan/today').expect(200);
    await prisma.placementSession.create({
      data: {
        userId: progressUser.userId,
        status: 'COMPLETED',
        currentItemIndex: 10,
        totalItems: 10,
        correctCount: 8,
        estimatedCefr: 'B1',
        completedAt: new Date(Date.now() + 1000),
        skillResults: {
          reading: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5 },
          listening: { estimatedCefr: 'A2', correctCount: 3, totalItems: 5 },
        },
      },
    });
    const healedProgress = (await send(progressUser, 'get', '/learning/progress').expect(200)).body.data;
    assert.equal(healedProgress.recommendedLevels.reading.cefrLevel, 'B1');
    assert.equal(healedProgress.recommendedLevels.reading.source, 'PLACEMENT');

    // 2a) Legacy pre-v4 reading-a2-club-meeting attempt does not combine with weekend-market to promote A2 -> B1.
    const legacyUser = await account();
    await prisma.placementSession.create({
      data: {
        userId: legacyUser.userId,
        status: 'COMPLETED',
        currentItemIndex: 10,
        totalItems: 10,
        correctCount: 6,
        estimatedCefr: 'A2',
        completedAt: new Date(Date.now() - 60_000),
        skillResults: {
          reading: { estimatedCefr: 'A2', correctCount: 3, totalItems: 5 },
          listening: { estimatedCefr: 'A2', correctCount: 3, totalItems: 5 },
        },
      },
    });
    let legacyClub = await start(legacyUser, clubSeed);
    legacyClub = await checkAll(legacyUser, legacyClub, clubSeed, false);
    const legacyClubSubmitted = (await send(legacyUser, 'post', `/learning/attempts/${legacyClub.id}/submit`, {
      expectedVersion: legacyClub.version,
    }).expect(200)).body.data;
    assert.equal(legacyClubSubmitted.levelChange, null);
    await prisma.learningAttempt.update({
      where: { id: legacyClubSubmitted.id }, data: {
        contentVersion: 3, lessonSnapshot: { ...legacyClubSubmitted.lesson, contentVersion: 3 },
      }
    });
    await prisma.learningAnswerExposure.update({
      where: { userId_lessonId: { userId: legacyUser.userId, lessonId: clubSeed.id } },
      data: { contentVersion: 3 },
    });

    let legacyMarket = await start(legacyUser, marketSeed);
    legacyMarket = await checkAll(legacyUser, legacyMarket, marketSeed, false);
    const legacyMarketSubmitted = (await send(legacyUser, 'post', `/learning/attempts/${legacyMarket.id}/submit`, {
      expectedVersion: legacyMarket.version,
    }).expect(200)).body.data;
    assert.equal(legacyMarketSubmitted.levelChange, null);
    const legacyProgress = (await send(legacyUser, 'get', '/learning/progress').expect(200)).body.data;
    assert.equal(legacyProgress.recommendedLevels.reading.cefrLevel, 'A2');

    const librarySeed = await prisma.learningLesson.findUniqueOrThrow({ where: { code: 'reading-a2-library-pickup' } });
    const libraryResult = await completeReadingLesson(legacyUser, librarySeed);
    const promotion = { kind: 'READING', from: 'A2', to: 'B1', direction: 'UP' };
    assert.deepEqual(libraryResult.levelChange, promotion);
    const libraryRetry = (await send(legacyUser, 'post', `/learning/attempts/${libraryResult.id}/submit`, {
      expectedVersion: libraryResult.version - 1,
    }).expect(200)).body.data;
    assert.deepEqual(libraryRetry.levelChange, promotion);
    assert.equal(await prisma.learningSkillLevelEvent.count({ where: { userId: legacyUser.userId } }), 1);

    // 2b) Fresh v4 reading-a2-club-meeting + weekend-market promotes A2 -> B1 with seeded curriculum.
    const v4User = await account();
    await prisma.placementSession.create({
      data: {
        userId: v4User.userId,
        status: 'COMPLETED',
        currentItemIndex: 10,
        totalItems: 10,
        correctCount: 6,
        estimatedCefr: 'A2',
        completedAt: new Date(Date.now() - 60_000),
        skillResults: {
          reading: { estimatedCefr: 'A2', correctCount: 3, totalItems: 5 },
          listening: { estimatedCefr: 'A2', correctCount: 3, totalItems: 5 },
        },
      },
    });
    let v4Club = await start(v4User, clubSeed);
    v4Club = await checkAll(v4User, v4Club, clubSeed, false);
    const v4ClubSubmitted = (await send(v4User, 'post', `/learning/attempts/${v4Club.id}/submit`, {
      expectedVersion: v4Club.version,
    }).expect(200)).body.data;
    assert.equal(v4ClubSubmitted.levelChange, null);

    let v4Market = await start(v4User, marketSeed);
    v4Market = await checkAll(v4User, v4Market, marketSeed, false);
    const v4MarketSubmitted = (await send(v4User, 'post', `/learning/attempts/${v4Market.id}/submit`, {
      expectedVersion: v4Market.version,
    }).expect(200)).body.data;
    assert.equal(v4MarketSubmitted.levelChange?.from, 'A2');
    assert.equal(v4MarketSubmitted.levelChange?.to, 'B1');
    assert.equal(v4MarketSubmitted.levelChange?.direction, 'UP');
  });

  it('prioritizes target B1 reading in ROTATION under 10m budget after all eligible lessons are completed', async () => {
    if (fixtures.length) {
      await prisma.learningLesson.deleteMany({ where: { id: { in: fixtures.splice(0) } } });
    }
    const rotUser = await account();
    const publishedLessons = await prisma.learningLesson.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    const a1Seed = publishedLessons.find(lesson => lesson.code === 'reading-everyday-introductions');
    const b1Seed = publishedLessons.find(lesson => lesson.code === 'reading-b1-hybrid-workday');
    assert.ok(a1Seed && b1Seed);

    await prisma.userProfile.upsert({
      where: { userId: rotUser.userId },
      create: { userId: rotUser.userId, dailyGoalMinutes: 10, preferredKinds: ['READING', 'LISTENING'] },
      update: { dailyGoalMinutes: 10, preferredKinds: ['READING', 'LISTENING'] },
    });
    const baseMs = Date.now() - 5 * 86_400_000;
    await prisma.learningSkillLevel.create({
      data: {
        userId: rotUser.userId,
        kind: 'READING',
        cefrLevel: 'B1',
        source: 'ADAPTIVE',
        previousCefr: 'A2',
        changedAt: new Date(baseMs - 10_000),
      },
    });
    // Complete the current catalogue so newly published lessons cannot switch the plan to NEW.
    // Make the A1 lesson the oldest to exercise the B1 rotation priority.
    const completedLessons = [a1Seed, ...publishedLessons.filter(lesson => lesson.id !== a1Seed.id)];
    for (const [index, lesson] of completedLessons.entries()) {
      const submittedAt = new Date(baseMs + index * 1000);
      const totalQuestions = lesson.content.questions.length;
      await prisma.learningAttempt.create({
        data: {
          userId: rotUser.userId,
          lessonId: lesson.id,
          status: 'COMPLETED',
          correctCount: totalQuestions,
          totalQuestions,
          contentVersion: lesson.contentVersion,
          eligibleForLevelEval: true,
          submittedAt,
          startedAt: new Date(submittedAt.getTime() - 1000),
          lessonSnapshot: { code: lesson.code, kind: lesson.kind, title: lesson.title },
          contentSnapshot: {},
        },
      });
    }

    const planRes = (await send(rotUser, 'post', '/learning/plan/today').expect(200)).body.data;
    assert.equal(planRes.plan.policyVersion, 'adaptive-v3');
    assert.deepEqual(
      planRes.plan.items.map((item) => [item.lessonId, item.reasonCode]),
      [[b1Seed.id, 'ROTATION']],
    );
  });

  it('keeps /learning/lessons metadata, ordering, CEFR levels, kind filter and per-learner latestResult exact without loading content', async () => {
    const unitB2 = await prisma.learningUnit.findFirst({ where: { cefrLevel: 'B2' } })
      ?? await prisma.learningUnit.findFirstOrThrow({ orderBy: { orderIndex: 'asc' } });
    const tag = randomUUID().slice(0, 8);
    const makeQuestions = (count) => Array.from({ length: count }, (_, idx) => ({
      id: `q-${idx}`,
      prompt: `Question ${idx}?`,
      options: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: `Opt ${id}` })),
      correctOptionId: 'A',
      explanation: `Exp ${idx}`,
    }));

    // Insert beta before alpha at equal sortOrder so code tie-breaking is genuinely exercised.
    const beta = await prisma.learningLesson.create({
      data: {
        code: `cat-b-${tag}`,
        kind: 'READING',
        title: 'Catalogue Tie Beta',
        description: '4 questions',
        estimatedMinutes: 7,
        sortOrder: 9002,
        published: true,
        contentVersion: 1,
        unitId: unitB2.id,
        content: { steps: [{ id: 's1', title: 'Intro', body: 'Text' }], questions: makeQuestions(4) },
      },
    });
    fixtures.push(beta.id);

    const alpha = await prisma.learningLesson.create({
      data: {
        code: `cat-a-${tag}`,
        kind: 'READING',
        title: 'Catalogue Tie Alpha',
        description: '3 questions',
        estimatedMinutes: 6,
        sortOrder: 9002,
        published: true,
        contentVersion: 2,
        unitId: unitB2.id,
        content: { steps: [{ id: 's1', title: 'Intro', body: 'Text' }], questions: makeQuestions(3) },
      },
    });
    fixtures.push(alpha.id);

    const legacy = await prisma.learningLesson.create({
      data: {
        code: `cat-legacy-${tag}`,
        kind: 'GRAMMAR',
        title: 'Legacy No Questions Array',
        description: 'Defaults to 5 questions',
        estimatedMinutes: 5,
        sortOrder: 9001,
        published: true,
        contentVersion: 1,
        unitId: null,
        content: {},
      },
    });
    fixtures.push(legacy.id);

    const learner1 = await account();
    const learner2 = await account();

    // Learner 1 completes alpha (2/3), completes and hides seeds[0], and leaves an active attempt on beta.
    let alphaAttempt = await start(learner1, alpha);
    const alphaQuestions = alpha.content.questions;
    for (const [idx, q] of alphaQuestions.entries()) {
      const optionId = idx < 2 ? q.correctOptionId : 'B';
      alphaAttempt = (await send(learner1, 'put', `/learning/attempts/${alphaAttempt.id}/answers/${q.id}/check`, {
        expectedVersion: alphaAttempt.version, optionId,
      }).expect(200)).body.data;
    }
    await send(learner1, 'post', `/learning/attempts/${alphaAttempt.id}/submit`, {
      expectedVersion: alphaAttempt.version,
    }).expect(200);

    let hiddenAttempt = await start(learner1, seeds[0]);
    hiddenAttempt = await checkAll(learner1, hiddenAttempt, seeds[0], false);
    await send(learner1, 'post', `/learning/attempts/${hiddenAttempt.id}/submit`, {
      expectedVersion: hiddenAttempt.version,
    }).expect(200);
    await send(learner1, 'delete', `/learning/history/${hiddenAttempt.id}`).expect(200);

    await start(learner1, beta);

    const allRes = (await send(learner1, 'get', '/learning/lessons').expect(200)).body.data;
    const tailCodes = allRes.items.slice(-3).map((item) => item.code);
    assert.deepEqual(tailCodes, [legacy.code, alpha.code, beta.code]);

    for (const item of allRes.items) {
      assert.equal(Object.prototype.hasOwnProperty.call(item, 'content'), false);
    }

    const legacyItem = allRes.items.find((item) => item.id === legacy.id);
    assert.equal(legacyItem.questionCount, 5);
    assert.equal(Object.prototype.hasOwnProperty.call(legacyItem, 'cefrLevel'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(legacyItem, 'audioDurationMs'), false);

    const hiddenSeedItem = allRes.items.find((item) => item.id === seeds[0].id);
    assert.equal(hiddenSeedItem.state, 'COMPLETED');
    assert.equal(hiddenSeedItem.latestResult, null);

    const alphaItem = allRes.items.find((item) => item.id === alpha.id);
    assert.equal(alphaItem.questionCount, 3);
    assert.equal(alphaItem.cefrLevel, unitB2.cefrLevel);
    assert.equal(alphaItem.state, 'COMPLETED');
    assert.equal(alphaItem.activeAttemptId, null);
    assert.deepEqual(alphaItem.latestResult, {
      correctCount: 2,
      totalQuestions: 3,
      scoreRatio: 2 / 3,
    });
    assert.equal(Object.prototype.hasOwnProperty.call(alphaItem, 'audioDurationMs'), false);

    const betaItem = allRes.items.find((item) => item.id === beta.id);
    assert.equal(betaItem.questionCount, 4);
    assert.equal(betaItem.cefrLevel, unitB2.cefrLevel);
    assert.equal(betaItem.state, 'NOT_STARTED');
    assert.equal(betaItem.latestResult, null);

    // Filter by READING and LISTENING.
    const readingOnly = (await send(learner1, 'get', '/learning/lessons?kind=READING').expect(200)).body.data;
    assert.ok(readingOnly.items.every((item) => item.kind === 'READING'));
    const alphaIdx = readingOnly.items.findIndex((item) => item.id === alpha.id);
    const betaIdx = readingOnly.items.findIndex((item) => item.id === beta.id);
    assert.ok(alphaIdx >= 0 && betaIdx === alphaIdx + 1);

    const listeningOnly = (await send(learner1, 'get', '/learning/lessons?kind=LISTENING').expect(200)).body.data;
    assert.ok(listeningOnly.items.length > 0);
    assert.ok(listeningOnly.items.every((item) => item.kind === 'LISTENING'));
    const legacyListening = listeningOnly.items.find((item) => item.code === 'listening-greetings-introductions');
    const cafeListening = listeningOnly.items.find((item) => item.code === 'listening-campus-cafe');
    const cafeDb = await prisma.learningLesson.findUniqueOrThrow({ where: { code: 'listening-campus-cafe' } });
    assert.equal(Object.prototype.hasOwnProperty.call(legacyListening, 'audioDurationMs'), false);
    assert.equal(cafeListening.audioDurationMs, cafeDb.content.audioDurationMs);
    assert.ok(cafeListening.audioDurationMs > 0);

    // Learner 2 must not see Learner 1's completion or latestResult.
    const learner2Res = (await send(learner2, 'get', '/learning/lessons?kind=READING').expect(200)).body.data;
    const learner2Alpha = learner2Res.items.find((item) => item.id === alpha.id);
    assert.equal(learner2Alpha.state, 'NOT_STARTED');
    assert.equal(learner2Alpha.latestResult, null);
  });
});
