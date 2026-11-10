const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const request = require('supertest');
const { WebSocket } = require('ws');
const { AppModule } = require('../dist/app.module');
const { JwtAuthGuard } = require('../dist/common/guards/jwt-auth.guard');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');

test('conversation API persists account-isolated sessions without provider calls', async t => {
  require('dotenv').config();
  assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'));
  const identities = new Set();
  const module = await Test.createTestingModule({ imports: [AppModule] })
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
    const clientRequestId = randomUUID();
    const create = () => http.post('/speaking/conversations').set('x-test-user', a).send({ topicId, clientRequestId });
    const results = await Promise.all([create(), create()]);
    assert.ok(results.every(row => row.status === 201));
    const id = results[0].body.data.conversation.id;
    assert.equal(results[1].body.data.conversation.id, id);
    assert.equal(await prisma.voiceConversation.count({ where: { userId: a } }), 1);
    await t.test('ownership and authenticated entry points', async () => {
      await http.get(`/speaking/conversations/${id}`).set('x-test-user', b).expect(404);
      await http.post(`/speaking/conversations/${id}/finish`).set('x-test-user', b).expect(404);
      await http.get('/speaking/conversations/topics').expect(403);
    });
    await t.test('snapshot and replay conflict', async () => {
      const row = await prisma.voiceConversation.findUniqueOrThrow({ where: { id } });
      assert.equal(row.topicSnapshot.contentVersion, topics.body.data.items[0].contentVersion);
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
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await app.close();
  }
});
