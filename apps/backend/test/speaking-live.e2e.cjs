// Explicit opt-in: real Azure TTS + assessment. Synthetic audio proves plumbing,
// not learner pronunciation quality. Audio and credentials never go to disk/logs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

async function freePort() {
  const server = net.createServer();
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  const port = server.address().port;
  await new Promise(ok => server.close(ok)); return port;
}

test('real Azure read aloud through NestJS, Python and PostgreSQL for all three prompts', {
  skip: process.env.SPEAKING_LIVE_AZURE !== 'true', timeout: 180000,
}, async () => {
  const db = new URL(process.env.DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(db.hostname) && db.pathname.endsWith('_test'), 'Requires local test database');
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST, project = process.env.FIREBASE_PROJECT_ID;
  assert.match(emulator || '', /^(127\.0\.0\.1|localhost):\d+$/); assert.match(project || '', /^demo-/);
  const path = process.env.AZURE_SPEECH_ENV_FILE;
  assert.ok(path, 'AZURE_SPEECH_ENV_FILE is required');
  const credentials = require('dotenv').parse(readFileSync(path, 'utf8'));
  const key = process.env.AZURE_SPEECH_KEY || credentials.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || credentials.AZURE_SPEECH_REGION;
  assert.ok(key && /^[a-z0-9]+$/.test(region || ''), 'Missing Azure configuration');
  const root = resolve(__dirname, '../../..'), port = await freePort(), token = randomBytes(32).toString('hex');
  const mlUrl = `http://127.0.0.1:${port}`;
  process.env.AUTH_PROVIDER = 'firebase'; process.env.SPEAKING_ENABLED = 'true';
  process.env.ML_SERVICE_URL = mlUrl; process.env.ML_INTERNAL_TOKEN = token;
  const child = spawn(process.env.SPEAKING_TEST_PYTHON || 'python', ['-m', 'uvicorn', 'lingoroad_ml.serving.app:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env,
      PYTHONPATH: resolve(root, 'apps/ml'), LINGOROAD_ML_INTERNAL_TOKEN: token,
      LINGOROAD_ML_REQUIRED_MODELS: 'speech_azure', LINGOROAD_ML_PREWARM: 'false',
      AZURE_SPEECH_KEY: key, AZURE_SPEECH_REGION: region,
    },
  });
  let childError = false; child.on('error', () => { childError = true; });
  let app, prisma, userId, uid;
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (childError || child.exitCode !== null) break;
      try { const response = await fetch(`${mlUrl}/health`, { signal: AbortSignal.timeout(500) }); if (response.ok) { ready = true; break; } } catch {}
      await new Promise(ok => setTimeout(ok, 250));
    }
    assert.ok(ready, 'Python ML service did not become healthy');
    const readiness = await fetch(`${mlUrl}/ready`, { signal: AbortSignal.timeout(1000) });
    assert.equal(readiness.status, 200, 'Python Azure configuration is not ready');
    assert.equal((await readiness.json()).components.speech_azure, 'ready');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new HttpExceptionFilter()); await app.init(); prisma = app.get(PrismaService);
    const signup = await fetch(`http://${emulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        email: `speaking-live-${randomUUID()}@example.com`, password: 'SpeakingLive123!', returnSecureToken: true,
      }), signal: AbortSignal.timeout(10000),
    });
    assert.equal(signup.status, 200, 'Emulator sign-up failed'); const identity = await signup.json(); uid = identity.localId;
    const api = (method, url) => request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${identity.idToken}`);
    const me = await api('get', '/auth/me').expect(200); userId = me.body.data.id;
    const prompts = (await api('get', '/speaking/prompts').expect(200)).body.data.items;
    assert.equal(prompts.length, 3);
    const ids = [];
    for (const prompt of prompts) {
      const escaped = prompt.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      const speech = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm' },
        body: `<speak version="1.0" xml:lang="en-US"><voice name="en-US-JennyNeural">${escaped}</voice></speak>`,
        signal: AbortSignal.timeout(45000),
      });
      assert.equal(speech.status, 200, 'Azure TTS failed'); const audio = Buffer.from(await speech.arrayBuffer());
      const created = (await api('post', '/speaking/submissions').send({ promptId: prompt.id, clientRequestId: randomUUID() }).expect(201)).body.data;
      ids.push(created.id);
      const submitted = (await api('put', `/speaking/submissions/${created.id}/audio`).attach('file', audio, { filename: 'synthetic.wav', contentType: 'audio/wav' }).expect(200)).body.data;
      assert.equal(submitted.status, 'SUCCEEDED', `Assessment did not succeed: ${submitted.errorCode || 'unknown'}`);
      assert.equal(submitted.result.provider, 'azure'); assert.ok(submitted.result.words.length > 0);
      for (const field of ['accuracy', 'fluency', 'completeness', 'pronunciation']) assert.ok(submitted.result[field] >= 0 && submitted.result[field] <= 100);
      const reread = (await api('get', `/speaking/submissions/${created.id}`).expect(200)).body.data;
      assert.deepEqual(reread.result, submitted.result);
      const duplicate = (await api('put', `/speaking/submissions/${created.id}/audio`).attach('file', audio, { filename: 'synthetic.wav', contentType: 'audio/wav' }).expect(200)).body.data;
      assert.equal(duplicate.completedAt, submitted.completedAt); assert.deepEqual(duplicate.result, submitted.result);
      audio.fill(0);
    }
    const history = (await api('get', '/speaking/history').expect(200)).body.data.items;
    assert.deepEqual(new Set(history.map(x => x.id)), new Set(ids));
    assert.ok(history.every(x => x.status === 'SUCCEEDED'));
    assert.equal(await prisma.learningAttempt.count({ where: { userId } }), 0);
    assert.equal(await prisma.learningActivitySession.count({ where: { userId } }), 0);
  } finally {
    try {
      if (prisma && userId) await prisma.user.deleteMany({ where: { id: userId } });
    } finally {
      try {
        const { getApps } = require('firebase-admin/app');
        const admin = getApps().find(a => a.name === `lingoroad-auth-${project}`);
        if (admin && uid) await require('firebase-admin/auth').getAuth(admin).deleteUser(uid);
      } finally {
        try { if (app) await app.close(); } finally {
          if (child.exitCode === null) {
            const stopped = new Promise(ok => child.once('exit', ok)); child.kill();
            await Promise.race([stopped, new Promise(ok => setTimeout(ok, 3000))]);
          }
        }
      }
    }
  }
});
