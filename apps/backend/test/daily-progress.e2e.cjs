// Acceptance tests use real Firebase Auth Emulator, HTTP and PostgreSQL.
// Every modified row belongs to an account this suite creates.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const request = require('supertest');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

describe('Daily plans and observed learning time', () => {
  let app, prisma, lessons;
  const users = [], identities = [];
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const project = process.env.FIREBASE_PROJECT_ID;
  const kinds = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'];
  const dayMs = 86400000;
  const localDate = value => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 10);

  before(async () => {
    assert.match(emulator || '', /^(127\.0\.0\.1|localhost):\d+$/);
    assert.match(project || '', /^demo-/);
    assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'));
    process.env.AUTH_PROVIDER = 'firebase';
    require('ts-node/register');
    const { seedLearningContent } = require('../prisma/seed-learning.ts');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, transform: true,
      forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true }
    }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    await seedLearningContent(prisma);
    const published = await prisma.learningLesson.findMany({
      where: { published: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    lessons = Object.fromEntries(kinds.map(kind => [kind, published.find(row => row.kind === kind)]));
    assert.ok(kinds.every(kind => lessons[kind]));
  });

  after(async () => {
    if (prisma && users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    const { getApps } = require('firebase-admin/app');
    const admin = getApps().find(a => a.name === `lingoroad-auth-${project}`);
    if (admin) {
      const { getAuth } = require('firebase-admin/auth');
      for (const uid of identities) await getAuth(admin).deleteUser(uid);
    }
    if (app) await app.close();
  });

  function api(owner, method, url, body) {
    const call = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${owner.idToken}`);
    return body === undefined ? call : call.send(body);
  }
  async function account() {
    const response = await fetch(`http://${emulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `daily-e2e-${randomUUID()}@example.com`, password: 'DailyLearning123!', returnSecureToken: true }),
    });
    assert.equal(response.status, 200);
    const identity = await response.json(); identities.push(identity.localId);
    const me = (await api(identity, 'get', '/auth/me').expect(200)).body.data;
    users.push(me.id);
    return { ...identity, userId: me.id };
  }
  async function preferences(owner, minutes, preferredKinds = kinds) {
    const old = (await api(owner, 'get', '/learning/preferences').expect(200)).body.data;
    return (await api(owner, 'patch', '/learning/preferences', {
      dailyGoalMinutes: minutes, preferredKinds, expectedVersion: old.version,
    }).expect(200)).body.data;
  }
  const plan = async owner => (await api(owner, 'post', '/learning/plan/today', {}).expect(200)).body.data.plan;
  const progress = async owner => (await api(owner, 'get', '/learning/progress').expect(200)).body.data;
  const start = async (owner, lesson) => (await api(owner, 'post', `/learning/lessons/${lesson.id}/attempts`, {}).expect(201)).body.data;
  async function finish(owner, lesson, correctCount = 5, existingAttempt = null) {
    let attempt = existingAttempt ?? await start(owner, lesson);
    for (const [index, question] of lesson.content.questions.entries()) {
      const optionId = index < correctCount ? question.correctOptionId
        : question.options.find(option => option.id !== question.correctOptionId).id;
      attempt = (await api(owner, 'put', `/learning/attempts/${attempt.id}/answers/${question.id}/check`, {
        optionId, expectedVersion: attempt.version,
      }).expect(200)).body.data;
    }
    return (await api(owner, 'post', `/learning/attempts/${attempt.id}/submit`, { expectedVersion: attempt.version }).expect(200)).body.data;
  }
  const open = async (owner, attemptId, clientRunId = randomUUID()) =>
    (await api(owner, 'post', `/learning/attempts/${attemptId}/activity-sessions`, { clientRunId }).expect(200)).body.data;
  const send = (owner, sessionId, segments) => api(owner, 'post', `/learning/activity-sessions/${sessionId}/segments`, { segments });
  async function anchored(owner, attempt, anchorAt) {
    const session = await open(owner, attempt.id);
    await prisma.learningActivitySession.update({ where: { id: session.sessionId }, data: { anchorAt } });
    return session.sessionId;
  }

  it('does not create a plan on GET and initializes one stable plan under concurrent starts', async () => {
    await request(app.getHttpServer()).get('/learning/progress').expect(401);
    const owner = await account();
    assert.equal((await api(owner, 'get', '/learning/plan/today').expect(200)).body.data.plan, null);
    const home = (await api(owner, 'get', '/learning/home').expect(200)
      .expect('Cache-Control', 'private, no-store')).body.data;
    assert.equal(home.planStatus, 'missing');
    assert.equal(home.plan, null);
    assert.ok(home.continueLesson?.id);
    assert.equal(await prisma.learningDayPlan.count({ where: { userId: owner.userId } }), 0);
    assert.equal(home.days.length, 7);
    const initial = await progress(owner);
    assert.equal(initial.today.activeSeconds, 0);
    assert.equal(initial.today.timeMeasured, false);
    assert.equal(initial.trackingStartedAt, null);
    const results = await Promise.all(Array.from({ length: 5 }, () => plan(owner)));
    assert.equal(new Set(results.map(item => item.id)).size, 1);
    assert.equal(await prisma.learningDayPlan.count({ where: { userId: owner.userId } }), 1);
    assert.equal(results[0].timeZone, 'Asia/Ho_Chi_Minh');
    assert.deepEqual((await plan(owner)).items, results[0].items);
    const currentHome = (await api(owner, 'get', '/learning/home').expect(200)).body.data;
    assert.equal(currentHome.planStatus, 'ready');
    assert.equal(currentHome.plan.id, results[0].id);
    assert.equal(currentHome.plan.continueLessonId, currentHome.continueLesson.id);
    assert.deepEqual(currentHome.days, (await progress(owner)).days);
    assert.ok(results[0].items.every(item => item.reason && item.reasonCode));
  });

  it('fits a five-minute lesson and never duplicates lessons to fill a 120-minute target', async () => {
    const owner = await account();
    await preferences(owner, 5);
    let today = await plan(owner);
    assert.equal(today.items.length, 1);
    assert.equal(today.estimatedMinutes, 5);
    await preferences(owner, 120);
    today = await plan(owner);
    const foundationLessons = await prisma.learningLesson.findMany({
      where: {
        published: true,
        OR: [{ unit: null }, { unit: { cefrLevel: { in: ['A1', 'A2'] } } }],
      },
      select: { id: true, estimatedMinutes: true },
    });
    assert.equal(today.totalCount, foundationLessons.length);
    assert.equal(today.estimatedMinutes, foundationLessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0));
    assert.deepEqual(
      today.items.map(item => item.lessonId).sort(),
      foundationLessons.map(lesson => lesson.id).sort(),
    );
    const me = (await api(owner, 'get', '/auth/me').expect(200)).body.data;
    assert.equal(me.profile.dailyGoalMinutes, 120);
  });

  it('retains completed and active items when changing preferences without inventing studied minutes', async () => {
    const owner = await account();
    await preferences(owner, 20);
    const initial = await plan(owner);
    const firstLesson = Object.values(lessons).find(row => row.id === initial.items[0].lessonId);
    const done = await finish(owner, firstLesson, 0);
    const activeLesson = Object.values(lessons).find(row => row.id === initial.items[1].lessonId);
    const active = await start(owner, activeLesson);
    const frozen = await plan(owner);
    assert.equal(frozen.version, initial.version);
    assert.deepEqual(frozen.items.map(row => row.id), initial.items.map(row => row.id));
    assert.equal(frozen.completedCount, 1);
    const completedItemId = frozen.items.find(row => row.lessonId === firstLesson.id).id;
    await preferences(owner, 5, ['READING']);
    const updated = await plan(owner);
    assert.equal(updated.dailyGoalMinutes, 5);
    assert.ok(updated.items.some(row => row.id === completedItemId && row.completed && row.completedAttemptId === done.id));
    assert.ok(updated.items.every(row => row.activeAttemptId === null && row.reasonCode !== 'RESUME'));
    assert.equal(updated.continueAttemptId, null);
    assert.ok(active.id);
    await api(owner, 'delete', `/learning/attempts/${active.id}`).expect(200);
    const stats = await progress(owner);
    assert.equal(stats.today.completedLessonCount, 1);
    assert.equal(stats.today.activeSeconds, 0);
    assert.equal(stats.today.goalMet, false);
    await api(owner, 'patch', '/auth/me', { dailyGoalMinutes: 20 }).expect(200);
    assert.equal((await plan(owner)).dailyGoalMinutes, 20);
    assert.equal((await api(owner, 'get', '/learning/preferences').expect(200)).body.data.dailyGoalMinutes, 20);
  });

  it('uses latest results at the 80% cutoff, places a new lesson before review and counts retakes separately', async () => {
    const owner = await account();
    const weak = await finish(owner, lessons.GRAMMAR, 3);
    const strong = await finish(owner, lessons.VOCABULARY, 4);
    const yesterday = new Date(Date.now() - dayMs);
    await prisma.learningAttempt.updateMany({ where: { id: { in: [weak.id, strong.id] } }, data: { submittedAt: yesterday } });
    await preferences(owner, 20, ['READING', 'GRAMMAR', 'VOCABULARY', 'LISTENING']);
    const selected = await plan(owner);
    const newIndex = selected.items.findIndex(row => row.reasonCode === 'NEW');
    const reviewIndex = selected.items.findIndex(row => row.lessonId === lessons.GRAMMAR.id && row.reasonCode === 'REVIEW');
    assert.ok(newIndex >= 0 && reviewIndex > newIndex);
    assert.ok(!selected.items.some(row => row.lessonId === lessons.VOCABULARY.id && row.reasonCode === 'REVIEW'));
    const improved = await finish(owner, lessons.GRAMMAR, 5);
    const stats = await progress(owner);
    assert.equal(stats.totals.completedLessonCount, 2);
    assert.equal(stats.totals.completedAttemptCount, 3);
    assert.equal(stats.latestResults.find(row => row.kind === 'GRAMMAR').correctCount, 5);
    assert.equal((await api(owner, 'get', `/learning/attempts/${weak.id}`).expect(200)).body.data.result.correctCount, 3);
    assert.notEqual(improved.id, weak.id);
    // Replanning retains an already completed item's original snapshot/reason.
    await preferences(owner, 120);
    const replanned = await plan(owner);
    const grammarItems = replanned.items.filter(row => row.lessonId === lessons.GRAMMAR.id);
    assert.equal(grammarItems.length, 1);
    assert.equal(grammarItems[0].completed, true);
    assert.equal(grammarItems[0].id, selected.items[reviewIndex].id);
    assert.equal(grammarItems[0].completedAttemptId, improved.id);
  });

  it('unions device overlap, ACKs exact out-of-order receipts, and keeps activity writes separate from answer versions', async () => {
    const owner = await account(); await preferences(owner, 5); await plan(owner);
    const attempt = await start(owner, lessons.READING);
    const anchorAt = new Date(Date.now() - 60000);
    const one = await anchored(owner, attempt, anchorAt), two = await anchored(owner, attempt, anchorAt);
    const payload = [{ seq: 2, startOffsetMs: 20000, endOffsetMs: 30000 }, { seq: 0, startOffsetMs: 0, endOffsetMs: 10000 }];
    const original = (await send(owner, one, payload).expect(200)).body.data;
    assert.deepEqual(original.acks.map(row => row.seq), [2, 0]);
    await send(owner, two, [{ seq: 0, startOffsetMs: 5000, endOffsetMs: 20000 }]).expect(200);
    const replay = (await send(owner, one, payload).expect(200)).body.data;
    assert.deepEqual(replay.acks, original.acks);
    await send(owner, one, [{ seq: 0, startOffsetMs: 0, endOffsetMs: 9999 }]).expect(409);
    assert.equal(await prisma.learningActivitySegment.count({ where: { sessionId: { in: [one, two] } } }), 3);
    assert.equal((await api(owner, 'get', `/learning/attempts/${attempt.id}`).expect(200)).body.data.version, attempt.version);
    let stats = await progress(owner);
    assert.equal(stats.today.activeSeconds, 30);
    assert.equal(stats.today.goalMet, false);
    const three = await anchored(owner, attempt, new Date(Date.now() - 600000));
    await send(owner, three, Array.from({ length: 21 }, (_, seq) => ({ seq, startOffsetMs: seq * 15000, endOffsetMs: (seq + 1) * 15000 }))).expect(200);
    stats = await progress(owner);
    assert.equal(stats.today.activeSeconds, 345);
    assert.equal(stats.today.goalMet, true);
    const home = (await api(owner, 'get', '/learning/home').expect(200)).body.data;
    assert.deepEqual(home.days, stats.days);
    assert.equal(home.totals.activeSeconds, stats.totals.activeSeconds);
    const summary = (await api(owner, 'get', '/learning/summary').expect(200)).body.data;
    assert.equal(summary.activeSeconds, stats.totals.activeSeconds);
    assert.equal(summary.completedAttemptCount, stats.totals.completedAttemptCount);
    // Cancelling an unfinished attempt removes all of its recorded activity time as well.
    const cancelledAttempt = await start(owner, lessons.GRAMMAR);
    const cancelledSession = await anchored(owner, cancelledAttempt, new Date(Date.now() - 30000));
    await send(owner, cancelledSession, [{ seq: 0, startOffsetMs: 0, endOffsetMs: 10000 }]).expect(200);
    assert.equal((await progress(owner)).today.activeSeconds, 355);
    await api(owner, 'delete', `/learning/attempts/${cancelledAttempt.id}`).expect(200);
    assert.equal((await progress(owner)).today.activeSeconds, 345);
  });

  it('splits uploaded offline intervals at Vietnam midnight and preserves old data as unmeasured', async () => {
    const owner = await account(), attempt = await start(owner, lessons.LISTENING);
    const today = (await progress(owner)).today.date;
    const boundary = new Date(new Date(`${today}T00:00:00+07:00`).getTime() - dayMs);
    const sessionId = await anchored(owner, attempt, new Date(boundary.getTime() - 10000));
    await send(owner, sessionId, [{ seq: 0, startOffsetMs: 0, endOffsetMs: 15000 }]).expect(200);
    const stats = await progress(owner);
    assert.equal(stats.days.find(day => day.date === localDate(boundary.getTime() - 1)).activeSeconds, 10);
    assert.equal(stats.days.find(day => day.date === localDate(boundary)).activeSeconds, 5);
    assert.equal(stats.today.activeSeconds, 0);
    assert.equal(stats.totals.activeSeconds, 15);
    const home = (await api(owner, 'get', '/learning/home').expect(200)).body.data;
    assert.deepEqual(home.days, stats.days);
    assert.equal(home.totals.activeSeconds, 15);
    const before = stats.days.find(day => day.date < localDate(boundary.getTime() - 10000));
    assert.ok(before && !before.timeMeasured);
    const saved = await prisma.learningActivitySegment.findUnique({ where: { sessionId_seq: { sessionId, seq: 0 } } });
    assert.equal(saved.startAt.toISOString(), new Date(boundary.getTime() - 10000).toISOString());
    // A new request reloads canonical database state, independent of a client/controller instance.
    assert.deepEqual((await progress(owner)).days, stats.days);
  });

  it('accepts valid late intervals before submission, clips later intervals, and never opens a new completed timer', async () => {
    const owner = await account(), attempt = await start(owner, lessons.READING);
    const anchor = new Date(Date.now() - 60000), sessionId = await anchored(owner, attempt, anchor);
    const done = await finish(owner, lessons.READING, 5, attempt);
    // Set an exact earlier submission boundary on our own test row.
    const submittedAt = new Date(anchor.getTime() + 20000);
    await prisma.learningAttempt.update({ where: { id: done.id }, data: { submittedAt } });
    const response = (await send(owner, sessionId, [
      { seq: 0, startOffsetMs: 10000, endOffsetMs: 25000 },
      { seq: 1, startOffsetMs: 25000, endOffsetMs: 30000 },
    ]).expect(200)).body.data;
    assert.equal(response.acks[0].endAt, submittedAt.toISOString());
    assert.equal(response.acks[1].startAt, null);
    assert.equal(response.acks[1].endAt, null);
    await api(owner, 'post', `/learning/attempts/${done.id}/activity-sessions`, { clientRunId: randomUUID() }).expect(400);
    assert.equal((await progress(owner)).today.activeSeconds, 10);
  });

  it('enforces timer ownership, input limits, canonical future clipping, expiry and preference conflicts', async () => {
    const owner = await account(), other = await account(), attempt = await start(owner, lessons.READING);
    const run = randomUUID();
    const session = await open(owner, attempt.id, run);
    assert.equal((await open(owner, attempt.id, run)).sessionId, session.sessionId);
    await api(other, 'post', `/learning/attempts/${attempt.id}/activity-sessions`, { clientRunId: randomUUID() }).expect(404);
    await send(other, session.sessionId, [{ seq: 0, startOffsetMs: 0, endOffsetMs: 1000 }]).expect(404);
    await send(owner, session.sessionId, [{ seq: 0, startOffsetMs: -1, endOffsetMs: 1000 }]).expect(400);
    await send(owner, session.sessionId, [{ seq: 0, startOffsetMs: 0, endOffsetMs: 15001 }]).expect(400);
    const future = [{ seq: 0, startOffsetMs: 30000, endOffsetMs: 31000 }];
    const first = (await send(owner, session.sessionId, future).expect(200)).body.data.acks;
    assert.equal(first[0].startAt, null);
    assert.deepEqual((await send(owner, session.sessionId, future).expect(200)).body.data.acks, first);
    await prisma.learningActivitySession.update({ where: { id: session.sessionId }, data: { anchorAt: new Date(Date.now() - 8 * dayMs) } });
    assert.deepEqual((await send(owner, session.sessionId, future).expect(200)).body.data.acks, first);
    await send(owner, session.sessionId, [{ seq: 1, startOffsetMs: 0, endOffsetMs: 1000 }]).expect(410);
    const pref = (await api(owner, 'get', '/learning/preferences').expect(200)).body.data;
    await preferences(owner, 20);
    await api(owner, 'patch', '/learning/preferences', { dailyGoalMinutes: 5, preferredKinds: kinds, expectedVersion: pref.version }).expect(409);
    await api(owner, 'patch', '/learning/preferences', { dailyGoalMinutes: 5, preferredKinds: kinds, expectedVersion: pref.version, userId: other.userId }).expect(400);
    assert.equal((await progress(other)).totals.activeSeconds, 0);
  });

  it('tracks A1 roadmap units and practice score stats across weeks', async () => {
    const owner = await account();
    const initial = await progress(owner);
    assert.equal(initial.units.length, 9);
    assert.equal(initial.units.find(unit => unit.cefrLevel === 'A2').totalLessons, 3);
    assert.equal(initial.units[0].status, 'IN_PROGRESS');
    assert.equal(initial.units[0].totalLessons, 3);
    assert.equal(initial.scoreStats.averageScore, null);

    // Complete previous week attempt at 3/5 (60%) and current week attempts at 5/5 (100%)
    const firstDone = await finish(owner, lessons.GRAMMAR, 3);
    await prisma.learningAttempt.update({
      where: { id: firstDone.id },
      data: { submittedAt: new Date(Date.now() - 8 * dayMs) },
    });
    await finish(owner, lessons.READING, 5);
    await finish(owner, lessons.LISTENING, 5);

    const updated = await progress(owner);
    assert.equal(updated.units[0].status, 'COMPLETED');
    assert.equal(updated.units[0].completedLessonCount, 3);
    assert.equal(updated.units[1].status, 'IN_PROGRESS');
    assert.equal(updated.scoreStats.averageScore, 87);
    assert.equal(updated.scoreStats.previousWeekAverage, 60);
    assert.equal(updated.scoreStats.currentWeekAverage, 100);
    assert.equal(updated.scoreStats.deltaPercent, 40);
  });

  it('filters daily plan suggestions by skill-specific CEFR ceiling from placement', async () => {
    const owner = await account();
    await prisma.placementSession.create({
      data: {
        userId: owner.userId,
        status: 'COMPLETED',
        completedAt: new Date(),
        estimatedCefr: 'B1',
        correctCount: 7,
        skillResults: {
          reading: { estimatedCefr: 'B1', correctCount: 4, totalItems: 5, status: 'PROVISIONAL' },
          listening: { estimatedCefr: 'A2', correctCount: 3, totalItems: 5, status: 'PROVISIONAL' },
        },
      },
    });
    await preferences(owner, 120);
    const generated = await plan(owner);
    const readingLessons = await prisma.learningLesson.findMany({
      where: { code: { in: ['reading-b1-hybrid-workday', 'reading-b2-urban-pocket-parks', 'reading-c1-deep-reading-attention'] } },
      select: { id: true, code: true },
    });
    const idByCode = Object.fromEntries(readingLessons.map(row => [row.code, row.id]));
    const plannedIds = new Set(generated.items.map(item => item.lessonId));
    assert.ok(plannedIds.has(idByCode['reading-b1-hybrid-workday']));
    assert.ok(!plannedIds.has(idByCode['reading-b2-urban-pocket-parks']));
    assert.ok(!plannedIds.has(idByCode['reading-c1-deep-reading-attention']));
  });
});
