// Real HTTP, PostgreSQL and Firebase Auth Emulator; cleanup is fixture-scoped.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const request = require('supertest');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

describe('Personal vocabulary and persisted review', () => {
  let app, prisma;
  const users = [], identities = [];
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const project = process.env.FIREBASE_PROJECT_ID;

  before(async () => {
    assert.match(emulator || '', /^(127\.0\.0\.1|localhost):\d+$/);
    assert.match(project || '', /^demo-/);
    assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'));
    process.env.AUTH_PROVIDER = 'firebase';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true,
      forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    require('ts-node/register');
    const { seedLearningContent } = require('../prisma/seed-learning.ts');
    await seedLearningContent(prisma);
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
      body: JSON.stringify({ email: `vocabulary-e2e-${randomUUID()}@example.com`, password: 'VocabularyTest123!', returnSecureToken: true }),
    });
    assert.equal(response.status, 200);
    const identity = await response.json(); identities.push(identity.localId);
    const me = (await api(identity, 'get', '/auth/me').expect(200)).body.data;
    users.push(me.id);
    return { ...identity, userId: me.id };
  }
  async function createDeck(owner, name = 'Bộ từ kiểm thử') {
    return (await api(owner, 'post', '/vocabulary/decks', { commandId: randomUUID(), name }).expect(201)).body.data.deck;
  }
  async function createWord(owner, deck, english = 'apple', extra = {}) {
    return (await api(owner, 'post', `/vocabulary/decks/${deck.id}/words`, {
      commandId: randomUUID(), english, meaning: `Nghĩa ${english}`, ...extra,
    }).expect(201)).body.data.word;
  }
  async function start(owner, deck, scope = 'NEEDS_REVIEW', commandId = randomUUID()) {
    return (await api(owner, 'post', `/vocabulary/decks/${deck.id}/reviews`, { commandId, scope }).expect(200)).body.data;
  }
  const read = async (owner, id) => (await api(owner, 'get', `/vocabulary/reviews/${id}`).expect(200)).body.data.attempt;
  const summary = async owner => (await api(owner, 'get', '/vocabulary/summary').expect(200)).body.data;
  const current = attempt => attempt.items.find(item => item.id === attempt.queue[0]);
  function command(owner, attempt, action, extra = {}, commandId = randomUUID()) {
    return api(owner, 'post', `/vocabulary/reviews/${attempt.id}/commands`, {
      commandId, expectedVersion: attempt.version, action,
      ...(!['SUBMIT', 'ABANDON'].includes(action) ? { itemId: current(attempt).id } : {}), ...extra,
    });
  }
  async function act(owner, attempt, action, extra = {}) {
    return (await command(owner, attempt, action, extra).expect(200)).body.data.attempt;
  }
  async function finish(owner, attempt, rating = 'EASY') {
    while (attempt.queue.length) attempt = await act(owner, attempt, 'RATE', { rating });
    return act(owner, attempt, 'SUBMIT');
  }
  function counts(data, total, remembered, reviewed) {
    assert.equal(data.totals.totalWords, total);
    assert.equal(data.totals.rememberedWords, remembered);
    assert.equal(data.totals.needsReviewWords, total - remembered);
    if (reviewed !== undefined) assert.equal(data.totals.reviewedWords, reviewed);
  }

  it('starts empty and protects CRUD, validation and replay across accounts', async () => {
    await request(app.getHttpServer()).get('/vocabulary/summary').expect(401);
    const a = await account(), b = await account();
    counts(await summary(a), 0, 0, 0);
    await api(a, 'post', '/vocabulary/decks', { commandId: randomUUID(), name: '  ' }).expect(400);
    const payload = { commandId: randomUUID(), name: 'Công việc' };
    const first = (await api(a, 'post', '/vocabulary/decks', payload).expect(201)).body.data;
    const replay = (await api(a, 'post', '/vocabulary/decks', payload).expect(201)).body.data;
    assert.equal(first.deck.id, replay.deck.id);
    assert.deepEqual(first.receipt, replay.receipt);
    await api(a, 'post', '/vocabulary/decks', { ...payload, name: 'Changed' }).expect(409);
    const deck = first.deck;
    const wordPayload = { commandId: randomUUID(), english: 'colleague', meaning: 'đồng nghiệp' };
    const word = (await api(a, 'post', `/vocabulary/decks/${deck.id}/words`, wordPayload).expect(201)).body.data.word;
    const repeatWord = (await api(a, 'post', `/vocabulary/decks/${deck.id}/words`, wordPayload).expect(201)).body.data.word;
    assert.equal(word.id, repeatWord.id);
    counts(await summary(a), 1, 0, 0);
    for (const [method, url, body] of [
      ['get', `/vocabulary/decks/${deck.id}`],
      ['get', `/vocabulary/decks/${deck.id}/words`],
      ['patch', `/vocabulary/decks/${deck.id}`, { commandId: randomUUID(), expectedVersion: deck.version, name: 'Hacked' }],
      ['post', `/vocabulary/decks/${deck.id}/words`, { commandId: randomUUID(), english: 'hack', meaning: 'x' }],
      ['patch', `/vocabulary/words/${word.id}`, { commandId: randomUUID(), expectedVersion: word.version, english: 'hack', meaning: 'x' }],
      ['delete', `/vocabulary/words/${word.id}`, { commandId: randomUUID(), expectedVersion: word.version }],
      ['post', `/vocabulary/decks/${deck.id}/reviews`, { commandId: randomUUID(), scope: 'ALL' }],
    ]) await api(b, method, url, body).expect(404);
    await api(a, 'post', `/vocabulary/decks/${deck.id}/words`, {
      commandId: randomUUID(), english: 'bad', meaning: 'bad', learningState: 'REMEMBERED',
    }).expect(400);
    counts(await summary(b), 0, 0, 0);
  });

  it('deduplicates concurrent start and commands and rejects stale revisions', async () => {
    const owner = await account(), deck = await createDeck(owner);
    await createWord(owner, deck); await createWord(owner, deck, 'pear');
    const starts = await Promise.all(Array.from({ length: 4 }, () => start(owner, deck)));
    assert.equal(new Set(starts.map(r => r.attempt.id)).size, 1);
    let attempt = starts[0].attempt;
    const id = randomUUID();
    const repeated = await Promise.all(Array.from({ length: 4 }, () => command(owner, attempt, 'RATE', { rating: 'EASY' }, id).expect(200)));
    assert.ok(repeated.every(r => r.body.data.receipt.commandId === id));
    assert.equal(new Set(repeated.map(r => r.body.data.receipt.appliedVersion)).size, 1);
    await command(owner, attempt, 'RATE', { rating: 'HARD' }, id).expect(409);
    await command(owner, attempt, 'RATE', { rating: 'EASY' }).expect(409);
    attempt = await read(owner, attempt.id);
    assert.equal(attempt.queue.length, 1);
    counts(await summary(owner), 2, 1, 1);
    const competing = await Promise.all([
      command(owner, attempt, 'RATE', { rating: 'MEDIUM' }),
      command(owner, attempt, 'SKIP'),
    ]);
    assert.deepEqual(competing.map(r => r.status).sort(), [200, 409]);
    const stranger = await account();
    await api(stranger, 'get', `/vocabulary/reviews/${attempt.id}`).expect(404);
    await command(stranger, attempt, 'SKIP').expect(404);
  });

  it('resumes progress, server-normalizes recall and keeps quick ratings separate from correctness', async () => {
    const owner = await account(), deck = await createDeck(owner);
    await createWord(owner, deck, 'apple');
    let attempt = (await start(owner, deck)).attempt;
    attempt = await act(owner, attempt, 'SAVE_PROGRESS', { phase: 'RECALL', draft: '  ＡＰＰＬＥ  ' });
    const restored = await read(owner, attempt.id);
    assert.equal(restored.phase, 'RECALL');
    assert.equal(current(restored).draft, '  ＡＰＰＬＥ  ');
    attempt = await act(owner, restored, 'CHECK_RECALL', { answer: '  ＡＰＰＬＥ  ' });
    assert.equal(current(attempt).isCorrect, true);
    assert.ok(current(attempt).checkedAt);
    counts(await summary(owner), 1, 0, 0);
    await command(owner, attempt, 'CHECK_RECALL', { answer: 'wrong' }).expect(400);
    attempt = await act(owner, attempt, 'RATE', { rating: 'EASY' });
    attempt = await act(owner, attempt, 'SUBMIT');
    assert.equal(attempt.items[0].resultSource, 'RECALL_AFTER_REVEAL');
    assert.equal(attempt.items[0].isCorrect, true);
    assert.equal(attempt.items[0].answerExposed, true);
    counts(await summary(owner), 1, 1, 1);
    attempt = (await start(owner, deck, 'ALL')).attempt;
    attempt = await finish(owner, attempt, 'MEDIUM');
    assert.equal(attempt.items[0].resultSource, 'SELF_REPORT');
    assert.equal(attempt.items[0].isCorrect, null);
    counts(await summary(owner), 1, 0, 1);
  });

  it('rejects false EASY on wrong recall, blank answers, and confirmation before checking', async () => {
    const owner = await account(), deck = await createDeck(owner);
    await createWord(owner, deck, "don't");
    let attempt = (await start(owner, deck)).attempt;
    await command(owner, attempt, 'ADVANCE').expect(400);
    await command(owner, attempt, 'CHECK_RECALL', { answer: '  ' }).expect(400);
    attempt = await act(owner, attempt, 'SAVE_PROGRESS', { phase: 'RECALL' });
    attempt = await act(owner, attempt, 'CHECK_RECALL', { answer: 'dont' });
    assert.equal(current(attempt).isCorrect, false);
    const invalid = await command(owner, attempt, 'RATE', { rating: 'EASY' }).expect(400);
    assert.equal(invalid.body.error.code, 'VOCAB_INVALID_RATING');
    attempt = await act(owner, attempt, 'ADVANCE');
    attempt = await act(owner, attempt, 'SUBMIT');
    assert.equal(attempt.items[0].rating, 'HARD');
    counts(await summary(owner), 1, 0, 1);
  });

  it('preserves meaningful punctuation, accents and explicitly accepted aliases', async () => {
    const owner = await account();
    for (const [english, answer, expected, acceptedAnswers] of [
      ["don't", 'don’t', true, []], ['résumé', 're\u0301sume\u0301', true, []],
      ['résumé', 'resume', false, []], ['apple', 'apple.', false, []],
      ['ice cream', 'ice-cream', false, []], ['colour', 'color', true, ['color']],
    ]) {
      const deck = await createDeck(owner, `Normalize ${randomUUID().slice(0, 8)}`);
      await createWord(owner, deck, english, { acceptedAnswers });
      let attempt = (await start(owner, deck)).attempt;
      attempt = await act(owner, attempt, 'SAVE_PROGRESS', { phase: 'RECALL' });
      attempt = await act(owner, attempt, 'CHECK_RECALL', { answer });
      assert.equal(current(attempt).isCorrect, expected, `${english} versus ${answer}`);
    }
  });

  it('skips only this round, requeues without duplicates, and submits all-skipped honestly', async () => {
    const owner = await account(), deck = await createDeck(owner);
    await createWord(owner, deck); await createWord(owner, deck, 'pear');
    let attempt = (await start(owner, deck)).attempt;
    const first = current(attempt).id;
    attempt = await act(owner, attempt, 'REQUEUE');
    assert.equal(attempt.queue.at(-1), first);
    assert.equal(new Set(attempt.queue).size, 2);
    attempt = await act(owner, attempt, 'SKIP');
    const only = current(attempt).id;
    attempt = await act(owner, attempt, 'REQUEUE');
    assert.deepEqual(attempt.queue, [only]);
    attempt = await act(owner, attempt, 'SKIP');
    const submitId = randomUUID();
    const result = (await command(owner, attempt, 'SUBMIT', {}, submitId).expect(200)).body.data;
    const replay = (await command(owner, attempt, 'SUBMIT', {}, submitId).expect(200)).body.data;
    assert.deepEqual(result.receipt, replay.receipt);
    assert.equal(result.attempt.status, 'COMPLETED');
    assert.equal(result.attempt.items.filter(i => i.state === 'REVIEWED').length, 0);
    assert.equal(result.attempt.items.filter(i => i.state === 'SKIPPED').length, 2);
    counts(await summary(owner), 2, 0, 0);
    const next = await start(owner, deck);
    assert.notEqual(next.attempt.id, attempt.id);
    assert.equal(next.attempt.queue.length, 2);
  });

  it('freezes snapshots and prevents old-version results from restoring a new word state', async () => {
    const owner = await account(), deck = await createDeck(owner);
    const word = await createWord(owner, deck, 'apple');
    let old = (await start(owner, deck)).attempt;
    const edited = (await api(owner, 'patch', `/vocabulary/words/${word.id}`, {
      commandId: randomUUID(), expectedVersion: word.version, english: 'pear', meaning: 'quả lê',
    }).expect(200)).body.data.word;
    assert.ok(edited.contentVersion > word.contentVersion);
    old = await read(owner, old.id);
    assert.equal(current(old).word.english, 'apple');
    await finish(owner, old);
    counts(await summary(owner), 1, 0, 0);
    let next = (await start(owner, deck)).attempt;
    assert.equal(current(next).word.english, 'pear');
    await finish(owner, next);
    counts(await summary(owner), 1, 1, 1);
    const renamed = (await api(owner, 'patch', `/vocabulary/decks/${deck.id}`, {
      commandId: randomUUID(), expectedVersion: deck.version, name: 'Tên mới',
    }).expect(200)).body.data.deck;
    assert.equal(renamed.name, 'Tên mới');
    counts(await summary(owner), 1, 1, 1);
  });

  it('keeps soft-deleted snapshots/history and idempotent delete receipts without resurrection', async () => {
    const owner = await account(), deck = await createDeck(owner);
    const word = await createWord(owner, deck);
    const attempt = (await start(owner, deck)).attempt;
    const deletion = { commandId: randomUUID(), expectedVersion: word.version };
    await api(owner, 'delete', `/vocabulary/words/${word.id}`, deletion).expect(200);
    await api(owner, 'delete', `/vocabulary/words/${word.id}`, deletion).expect(200);
    counts(await summary(owner), 0, 0, 0);
    const done = await finish(owner, attempt);
    assert.equal(done.items[0].word.english, 'apple');
    counts(await summary(owner), 0, 0, 0);
    const deckDelete = { commandId: randomUUID(), expectedVersion: deck.version };
    await api(owner, 'delete', `/vocabulary/decks/${deck.id}`, deckDelete).expect(200);
    await api(owner, 'delete', `/vocabulary/decks/${deck.id}`, deckDelete).expect(200);
    await api(owner, 'get', `/vocabulary/decks/${deck.id}`).expect(404);
    const history = (await api(owner, 'get', '/vocabulary/history').expect(200)).body.data;
    assert.ok(history.items.some(i => i.id === done.id));
    assert.equal((await read(owner, done.id)).items[0].word.english, 'apple');
  });

  it('paginates and searches libraries/history without leaking another account', async () => {
    const owner = await account(), other = await account();
    await createDeck(other, 'Private secret');
    for (let i = 0; i < 3; i++) {
      const deck = await createDeck(owner, `Page ${i}`);
      await createWord(owner, deck, `word${i}`);
      await finish(owner, (await start(owner, deck)).attempt);
    }
    const seen = [];
    let cursor;
    do {
      const page = (await api(owner, 'get', `/vocabulary/decks?limit=1${cursor ? `&cursor=${cursor}` : ''}`).expect(200)).body.data;
      seen.push(...page.items.map(i => i.id)); cursor = page.nextCursor;
    } while (cursor);
    assert.equal(seen.length, 3); assert.equal(new Set(seen).size, 3);
    const search = (await api(owner, 'get', '/vocabulary/decks?query=Page%201').expect(200)).body.data;
    assert.equal(search.items.length, 1);
    const history = (await api(owner, 'get', '/vocabulary/history?limit=1').expect(200)).body.data;
    assert.equal(history.items.length, 1); assert.ok(history.nextCursor);
    const next = (await api(owner, 'get', `/vocabulary/history?limit=1&cursor=${history.nextCursor}`).expect(200)).body.data;
    assert.notEqual(history.items[0].id, next.items[0].id);
  });

  it('rotates batches after skipped words and never inflates lesson or daily activity', async () => {
    const owner = await account(), deck = await createDeck(owner);
    for (let i = 0; i < 101; i++) await createWord(owner, deck, `batch${i}`);
    await api(owner, 'post', '/learning/plan/today', {}).expect(200);
    const initialPlan = (await api(owner, 'get', '/learning/plan/today').expect(200)).body.data;
    const before = (await api(owner, 'get', '/learning/progress').expect(200)).body.data;
    let attempt = (await start(owner, deck)).attempt;
    assert.equal(attempt.items.length, 100);
    const oldIds = new Set(attempt.items.map(i => i.wordId));
    while (attempt.queue.length) attempt = await act(owner, attempt, 'SKIP');
    await act(owner, attempt, 'SUBMIT');
    attempt = (await start(owner, deck)).attempt;
    assert.ok(attempt.items.some(i => !oldIds.has(i.wordId)), 'Words outside the first batch must get an opportunity.');
    await act(owner, attempt, 'ABANDON');
    const after = (await api(owner, 'get', '/learning/progress').expect(200)).body.data;
    assert.deepEqual(after.totals, before.totals);
    assert.equal(after.today.activeSeconds, before.today.activeSeconds);
    assert.equal(after.today.goalMet, before.today.goalMet);
    assert.equal(after.today.hasActivity, before.today.hasActivity);
    assert.deepEqual((await api(owner, 'get', '/learning/plan/today').expect(200)).body.data, initialPlan);
    assert.equal(await prisma.learningActivitySession.count({ where: { userId: owner.userId } }), 0);
    assert.equal(await prisma.learningAttempt.count({ where: { userId: owner.userId } }), 0);
  });

  it('does not invent reviews for empty or remembered decks and keeps abandoned checks unconfirmed', async () => {
    const owner = await account(), deck = await createDeck(owner);
    let result = await start(owner, deck);
    assert.equal(result.attempt, null);
    assert.equal(result.reason, 'NO_WORDS_TO_REVIEW');
    await createWord(owner, deck);
    await finish(owner, (await start(owner, deck)).attempt);
    result = await start(owner, deck);
    assert.equal(result.attempt, null);
    assert.equal(result.reason, 'NO_WORDS_TO_REVIEW');
    let attempt = (await start(owner, deck, 'ALL')).attempt;
    attempt = await act(owner, attempt, 'SAVE_PROGRESS', { phase: 'RECALL' });
    attempt = await act(owner, attempt, 'CHECK_RECALL', { answer: 'wrong' });
    attempt = await act(owner, attempt, 'ABANDON');
    assert.equal(attempt.status, 'ABANDONED');
    assert.equal(attempt.counts.reviewedCount, 0);
    assert.equal(attempt.counts.checkedCount, 0);
    assert.equal(attempt.counts.uncheckedCount, 1);
    assert.equal(attempt.items[0].isCorrect, false);
    counts(await summary(owner), 1, 1, 1);
  });

  it('guards concurrent editorial changes and word pagination/search/cursor ownership', async () => {
    const owner = await account(), other = await account(), deck = await createDeck(owner);
    const word = await createWord(owner, deck, 'apple');
    const updates = await Promise.all(['pear', 'peach'].map(english => api(owner, 'patch', `/vocabulary/words/${word.id}`, {
      commandId: randomUUID(), expectedVersion: word.version, english, meaning: 'trái cây',
    })));
    assert.deepEqual(updates.map(r => r.status).sort(), [200, 409]);
    await createWord(owner, deck, 'banana');
    const first = (await api(owner, 'get', `/vocabulary/decks/${deck.id}/words?limit=1`).expect(200)).body.data;
    assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
    const second = (await api(owner, 'get', `/vocabulary/decks/${deck.id}/words?limit=1&cursor=${first.nextCursor}`).expect(200)).body.data;
    assert.equal(second.items.length, 1); assert.notEqual(first.items[0].id, second.items[0].id);
    const found = (await api(owner, 'get', `/vocabulary/decks/${deck.id}/words?query=BANANA`).expect(200)).body.data;
    assert.equal(found.items.length, 1); assert.equal(found.items[0].english, 'banana');
    const foreignDeck = await createDeck(other), foreignWord = await createWord(other, foreignDeck);
    await api(owner, 'get', `/vocabulary/decks?cursor=${foreignDeck.id}`).expect(404);
    await api(owner, 'get', `/vocabulary/decks/${deck.id}/words?cursor=${foreignWord.id}`).expect(404);
  });
});
