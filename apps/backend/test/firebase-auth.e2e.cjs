// Node's test runner loads the real Admin SDK (including its ESM dependencies).
// Run only against a local Firebase Auth Emulator and a dedicated *_test DB.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const request = require('supertest');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

describe('Firebase Auth Emulator + real HTTP + PostgreSQL', () => {
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });
  after(async () => {
    if (prisma && users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    const { getApps } = require('firebase-admin/app');
    const adminApp = getApps().find(a => a.name === `lingoroad-auth-${project}`);
    if (adminApp) {
      const { getAuth } = require('firebase-admin/auth');
      for (const id of identities) await getAuth(adminApp).deleteUser(id);
    }
    if (app) await app.close();
  });
  async function identity(email = `firebase-e2e-${randomUUID()}@example.com`) {
    const response = await fetch(`http://${emulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'FirebaseDemo123!', returnSecureToken: true }),
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    identities.push(data.localId);
    return { ...data, email };
  }
  const api = (account) => ({
    get: (path) => request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${account.idToken}`),
    post: (path) => request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${account.idToken}`),
    patch: (path) => request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${account.idToken}`),
  });
  async function provision(account) {
    const response = await api(account).get('/auth/me').expect(200);
    users.push(response.body.data.id);
    return response.body.data;
  }
  it('provisions an internal UUID/profile and preserves it across concurrent calls', async () => {
    const account = await identity();
    const me = await provision(account);
    assert.notEqual(me.id, account.localId);
    assert.match(me.id, /^[a-f0-9-]{36}$/);
    assert.equal(me.email, account.email);
    assert.equal(me.profile.onboardingCompletedAt, null);
    const rows = await Promise.all([api(account).get('/auth/me'), api(account).get('/auth/me')]);
    assert.ok(rows.every(r => r.status === 200 && r.body.data.id === me.id));
    assert.equal(await prisma.user.count({ where: { firebaseUid: account.localId } }), 1);
    assert.equal((await prisma.user.findUnique({ where: { id: me.id } })).passwordHash, null);
    assert.ok(!JSON.stringify(me).includes('passwordHash'));
    const updated = await api(account).patch('/auth/me').send({ name: 'Firebase Learner', learningPurpose: 'WORK', dailyGoalMinutes: 20 }).expect(200);
    assert.ok(updated.body.data.profile.onboardingCompletedAt);
    const status = await api(account).get('/placement/status').expect(200);
    assert.notEqual(status.body.data.status, 'COMPLETED');
    await request(app.getHttpServer()).post('/auth/login').send({ email: account.email, password: 'FirebaseDemo123!' }).expect(400);
    await api(account).get('/auth/me').set('Authorization', 'Bearer invalid-token').expect(401);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });
  it('never links a legacy account merely because the email matches', async () => {
    const account = await identity();
    const legacy = await prisma.user.create({ data: { name: 'Legacy', email: account.email, profile: { create: {} } } });
    users.push(legacy.id);
    const response = await api(account).get('/auth/me').expect(409);
    assert.equal(response.body.error.code, 'AUTH_ACCOUNT_LINK_REQUIRED');
    assert.equal((await prisma.user.findUnique({ where: { id: legacy.id } })).firebaseUid, null);
  });
  it('isolates learner profiles and rejects client-supplied ownership or roles', async () => {
    const a = await identity(), b = await identity();
    const owner = await provision(a), stranger = await provision(b);
    assert.notEqual(owner.id, stranger.id);
    await api(a).patch('/auth/me').send({ name: 'Private owner', learningPurpose: 'WORK', dailyGoalMinutes: 30 }).expect(200);
    await api(b).patch('/auth/me').send({ userId: owner.id, role: 'ADMIN' }).expect(400);
    const other = await api(b).get('/auth/me').expect(200);
    assert.equal(other.body.data.id, stranger.id);
    assert.notEqual(other.body.data.name, 'Private owner');
    assert.equal(other.body.data.role, 'LEARNER');
    await prisma.user.update({ where: { id: owner.id }, data: { status: 'SUSPENDED' } });
    await api(a).get('/auth/me').expect(403);
  });
  it('rejects disabled identities and revoked sessions through the real Admin SDK', async () => {
    const account = await identity();
    await provision(account);
    const { getApps } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const admin = getAuth(getApps().find(a => a.name === `lingoroad-auth-${project}`));
    await admin.updateUser(account.localId, { disabled: true });
    await api(account).get('/auth/me').expect(401);
    await admin.updateUser(account.localId, { disabled: false });
    // Firebase auth_time has second precision; cross the boundary before revoking.
    await new Promise(resolve => setTimeout(resolve, 1100));
    await api(account).post('/auth/logout-all').expect(200);
    await api(account).get('/auth/me').expect(401);
  });
});
