const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const request = require('supertest');
const { WebSocket } = require('ws');
const { AppModule } = require('../dist/app.module');
const { JwtAuthGuard } = require('../dist/common/guards/jwt-auth.guard');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');
const { MlClientService } = require('../dist/modules/ml/ml-client.service');

test('conversation API persists account-isolated sessions without provider calls', async t => {
  require('dotenv').config();
  assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'));
  const identities = new Set();
  let audioCalls = 0, contentCalls = 0;
  const fakeMl = {
    async scoreConversationAudio(audio) {
      audioCalls++;
      await new Promise(resolve => setTimeout(resolve, 50));
      return { schemaVersion: 3, mode: 'TOPIC', assessmentProfile: 'conversation-speaking-v1', provider: 'azure',
        audioHash: createHash('sha256').update(audio).digest('hex'), adapterVersion: 'fixture',
        transcript: 'My answer.', accuracy: 32.5, fluency: 58.4, prosody: 41.7,
        overall: (40 * 32.5 + 25 * 58.4 + 25 * 41.7) / 90, durationSeconds: .2,
        words: [{ word: 'answer', accuracy: 32.5, errorType: 'Mispronunciation', offsetMs: 0, durationMs: 200 }] };
    },
    async scoreConversationContent() {
      contentCalls++;
      return { status: 'succeeded', rubricVersion: 'conversation-content-v1',
        overall: 50.5, vocabulary: 40.5, grammar: 50.5, topic: 60.5, strengths: [], improvements: [] };
    },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MlClientService).useValue(fakeMl)
    .overrideGuard(JwtAuthGuard).useValue({ canActivate(context) {
      const req = context.switchToHttp().getRequest();
      const id = req.headers['x-test-user'];
      if (!identities.has(id)) return false;
      req.user = { sub: id };
      return true;
    } }).compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  const prisma = app.get(PrismaService);
  const users = [];
  try {
    await app.listen(0, '127.0.0.1');
    for (let i = 0; i < 2; i++) {
      const user = await prisma.user.create({ data: { email: `voice-test-${randomUUID()}@example.test`, name: 'Voice test' } });
      users.push(user); identities.add(user.id);
    }
    const http = request(app.getHttpServer());
    const a = users[0].id, b = users[1].id;
    const topics = await http.get('/speaking/conversations/topics').set('x-test-user', a).expect(200);
    assert.equal(topics.body.data.items.length, 6);
    const topicId = topics.body.data.items[0].id;
    await t.test('topic preparation is authenticated, complete and allocates no sessions', async () => {
      for (const item of topics.body.data.items) {
        const guide = (await http.get(`/speaking/conversations/topics/${item.id}`).set('x-test-user', a).expect(200)).body.data;
        assert.equal(guide.id, item.id);
        assert.equal(guide.maxDurationSeconds, 180);
        assert.equal(guide.preparation.version, 1);
        assert.ok(guide.preparation.goal);
        assert.equal(guide.preparation.vocabulary.length, 12);
        assert.equal(new Set(guide.preparation.vocabulary.map(entry => entry.word)).size, 12);
        assert.ok(guide.preparation.vocabulary.every(entry => entry.meaningVi && entry.example));
        assert.equal(guide.preparation.phrases.length, 8);
        assert.equal(new Set(guide.preparation.phrases.map(entry => entry.text)).size, 8);
        for (const { text, meaningVi } of guide.preparation.phrases) {
          for (const sentence of [text, meaningVi]) {
            assert.match(sentence, /[.!?]$/);
            assert.doesNotMatch(sentence, /…|\.{3}/);
          }
        }
        assert.equal(guide.preparation.helpPhrases.length, 3);
        assert.equal(guide.hints.length, 3);
        assert.equal(guide.practice.topic.prompt.id, item.id);
        assert.equal(typeof guide.practice.topic.enabled, 'boolean');
        assert.equal(typeof guide.practice.readAloud.enabled, 'boolean');
        const readingCodes = {
          'Introduce yourself': ['read-aloud-2', 'read-aloud-3'],
          'My day': ['read-aloud-4'],
          'My family': ['read-aloud-5'],
          'My hobbies': ['topic-read-aloud-1'],
          'My favourite food': ['topic-read-aloud-2'],
          'Where I live': ['topic-read-aloud-3'],
        };
        assert.deepEqual(guide.practice.readAloud.items.map(prompt => prompt.code), readingCodes[item.title]);
      }
      await http.get(`/speaking/conversations/topics/${topicId}`).expect(403);
      await http.get(`/speaking/conversations/topics/${randomUUID()}`).set('x-test-user', a).expect(404);
      await http.get('/speaking/conversations/topics/invalid').set('x-test-user', a).expect(400);
      const hidden = await prisma.speakingPrompt.create({ data: { code: `guide-hidden-${randomUUID()}`, text: 'Hidden topic', mode: 'TOPIC', published: false, sortOrder: 999 } });
      try {
        await http.get(`/speaking/conversations/topics/${hidden.id}`).set('x-test-user', a).expect(404);
      } finally {
        await prisma.speakingPrompt.delete({ where: { id: hidden.id } });
      }
      assert.equal(await prisma.voiceConversation.count({ where: { userId: a } }), 0);
      assert.equal(audioCalls, 0); assert.equal(contentCalls, 0);
    });
    const clientRequestId = randomUUID();
    const preferences = { voice: 'ava', speechRate: 'slow', turnPause: 'long' };
    const create = () => http.post('/speaking/conversations').set('x-test-user', a)
      .send({ topicId, clientRequestId, ...preferences });
    const results = await Promise.all([create(), create()]);
    assert.ok(results.every(row => row.status === 201));
    const id = results[0].body.data.conversation.id;
    assert.equal(results[1].body.data.conversation.id, id);
    assert.equal(await prisma.voiceConversation.count({ where: { userId: a } }), 1);
    await t.test('ownership and authenticated entry points', async () => {
      await http.get(`/speaking/conversations/${id}`).set('x-test-user', b).expect(404);
      await http.get(`/speaking/conversations/${id}/summary`).set('x-test-user', b).expect(404);
      await http.get(`/speaking/conversations/${id}/turns`).set('x-test-user', b).expect(404);
      await http.post(`/speaking/conversations/${id}/finish`).set('x-test-user', b).expect(404);
      await http.get('/speaking/conversations/topics').expect(403);
    });
    await t.test('snapshot and replay conflict', async () => {
      const row = await prisma.voiceConversation.findUniqueOrThrow({ where: { id } });
      assert.equal(row.topicSnapshot.contentVersion, topics.body.data.items[0].contentVersion);
      assert.equal(row.topicSnapshot.voice, 'en-US-AvaMultilingualNeural');
      assert.equal(row.topicSnapshot.speechRate, '0.85');
      assert.equal(row.topicSnapshot.silenceDurationMs, 1200);
      for (const field of Object.keys(preferences)) {
        await http.post('/speaking/conversations').set('x-test-user', a)
          .send({ topicId, clientRequestId, ...preferences, [field]: 'unsupported' }).expect(400);
      }
      await http.post('/speaking/conversations').set('x-test-user', a)
        .send({ topicId: topics.body.data.items[1].id, clientRequestId }).expect(409);
    });
    await t.test('unknown socket ticket cannot connect to provider', async () => {
      const port = app.getHttpServer().address().port;
      await new Promise((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/speaking/conversations/connect`);
        socket.on('open', () => socket.send(JSON.stringify({ ticket: 'invalid', sdp: 'invalid' })));
        socket.on('close', code => { try { assert.equal(code, 1008); resolve(); } catch (error) { reject(error); } });
        socket.on('error', reject);
      });
      assert.equal((await prisma.voiceConversation.findUniqueOrThrow({ where: { id } })).status, 'CREATED');
    });
    await t.test('finish is replayable and history survives session end', async () => {
      await http.post(`/speaking/conversations/${id}/finish`).set('x-test-user', a).expect(201);
      await http.post(`/speaking/conversations/${id}/finish`).set('x-test-user', a).expect(201);
      const history = await http.get('/speaking/conversations').set('x-test-user', a).expect(200);
      assert.equal(history.body.data.items[0].status, 'ENDED');
      const replay = await create();
      assert.equal(replay.body.data.connectTicket, null);
      assert.equal((await prisma.voiceConversation.findUniqueOrThrow({ where: { id } })).activeUserId, null);
    });
    await t.test('concurrent uploads call each scorer once and persist decimal scores', async () => {
      await prisma.voiceConversationTurn.create({ data: { conversationId: id, providerItemId: 'user-fixture',
        sequence: 0, role: 'USER', transcript: 'My answer.' } });
      const audio = Buffer.alloc(44 + 6400);
      audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
      audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
      audio.writeUInt32LE(16000, 24); audio.writeUInt32LE(32000, 28);
      audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write('data', 36);
      audio.writeUInt32LE(6400, 40);
      for (let offset = 44; offset < audio.length; offset += 2) audio.writeInt16LE(1000, offset);
      const upload = user => http.put(`/speaking/conversations/${id}/assessment/audio`)
        .set('x-test-user', user).attach('file', audio, 'microphone.wav');
      await upload(b).expect(404);
      await http.put(`/speaking/conversations/${id}/assessment/audio`).set('x-test-user', a).expect(422);
      const responses = await Promise.all([upload(a), upload(a)]);
      assert.ok(responses.every(response => response.status === 200));
      let saved;
      for (let attempt = 0; attempt < 30; attempt++) {
        saved = (await http.get(`/speaking/conversations/${id}`).set('x-test-user', a)).body.data;
        if (saved.assessmentStatus !== 'PROCESSING') break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(saved.assessmentStatus, 'READY');
      assert.equal(saved.assessment.pronunciation.accuracy, 32.5);
      assert.equal(saved.assessment.content.grammar, 50.5);
      const summary = await http.get(`/speaking/conversations/${id}/summary`).set('x-test-user', a).expect(200);
      assert.equal(summary.body.data.hasUserTurns, true);
      assert.equal('turns' in summary.body.data, false);
      const transcript = await http.get(`/speaking/conversations/${id}/turns`).set('x-test-user', a).expect(200);
      assert.equal(transcript.body.data.items[0].transcript, 'My answer.');
      await upload(a).expect(200);
      assert.equal(audioCalls, 1); assert.equal(contentCalls, 1);
      audio.writeInt16LE(2000, 44);
      await upload(a).expect(409);
      const history = await http.get('/speaking/conversations').set('x-test-user', a);
      assert.equal(history.body.data.items[0].assessmentStatus, 'READY');
    });
    await t.test('keeps pending calls out of history and honors the owner’s save or discard choice', async () => {
      const route = '/speaking/conversations';
      const createPending = async () => (await http.post(route).set('x-test-user', a)
        .send({ topicId, clientRequestId: randomUUID(), deferHistory: true }).expect(201)).body.data.conversation;
      const list = async () => (await http.get(route).set('x-test-user', a).expect(200)).body.data.items;
      const choose = (id, save, user = a) => http.put(route + '/' + id + '/history')
        .set('x-test-user', user).send({ save });

      const pending = await createPending();
      assert.equal(pending.historyStatus, 'PENDING');
      await choose(pending.id, true).expect(409);
      await choose(pending.id, true, b).expect(404);
      await http.post(route + '/' + pending.id + '/finish').set('x-test-user', a).expect(201);
      assert.ok(!(await list()).some(row => row.id === pending.id));
      await http.get(route + '?cursor=' + pending.id).set('x-test-user', a).expect(404);
      await choose(pending.id, true).expect(200);
      await choose(pending.id, true).expect(200);
      await choose(pending.id, false).expect(409);
      assert.ok((await list()).some(row => row.id === pending.id));

      const discard = await createPending();
      await http.post(route + '/' + discard.id + '/finish').set('x-test-user', a).expect(201);
      await prisma.voiceConversationTurn.create({ data: { conversationId: discard.id, providerItemId: 'discard-fixture',
        sequence: 0, role: 'USER', transcript: 'Temporary reply.' } });
      await prisma.voiceConversation.update({ where: { id: discard.id },
        data: { startedAt: new Date(), assessmentStatus: 'PROCESSING', assessment: { sample: 'temporary' } } });
      await choose(discard.id, false).expect(200);
      await choose(discard.id, false).expect(200);
      await choose(discard.id, true).expect(409);
      for (const suffix of ['', '/summary', '/turns']) {
        await http.get(route + '/' + discard.id + suffix).set('x-test-user', a).expect(404);
      }
      const cleared = await prisma.voiceConversation.findUniqueOrThrow({ where: { id: discard.id }, include: { turns: true } });
      assert.equal(cleared.assessment, null);
      assert.equal(cleared.turns.length, 0);
      assert.ok(cleared.startedAt);
      assert.ok(!(await list()).some(row => row.id === discard.id));
    });
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await app.close();
  }
});
