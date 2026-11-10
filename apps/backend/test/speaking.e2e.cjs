// Actual HTTP, PostgreSQL and Firebase Auth Emulator; ML is deliberately mocked.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const request = require('supertest');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');
const { MlClientService } = require('../dist/modules/ml/ml-client.service');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');

function wav(seconds = 1, sample = 1000) {
  const length = Math.round(seconds * 32000), b = Buffer.alloc(44 + length);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(length, 40);
  for (let i = 44; i < b.length; i += 2) b.writeInt16LE(sample, i);
  return b;
}
const result = { transcript: 'My name is Anna', accuracy: 95, fluency: 90, completeness: 100, pronunciation: 94,
  words: [{ word: 'Anna', accuracy: 95, errorType: 'None' }], durationSeconds: 1, provider: 'azure', adapterVersion: 'azure-read-aloud-v1', feedbackVi: 'Bạn đã đọc đủ câu.' };

describe('Speaking read aloud persisted workflow', () => {
  let app, prisma, config, a, b, prompts, calls = 0, behavior, topicCalls = 0, contentCalls = 0, contentFailure = false;
  const users = [], identities = [];
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST, project = process.env.FIREBASE_PROJECT_ID;
  before(async () => {
    assert.match(emulator || '', /^(127\.0\.0\.1|localhost):\d+$/);
    assert.match(project || '', /^demo-/);
    assert.ok(new URL(process.env.DATABASE_URL).pathname.endsWith('_test'));
    process.env.AUTH_PROVIDER = 'firebase'; process.env.SPEAKING_ENABLED = 'true';
    process.env.SPEAKING_SCORING_PROFILE = 'read-aloud-v1';
    process.env.SPEAKING_TOPIC_ENABLED = 'true'; process.env.SPEAKING_GAME_ENABLED = 'true';
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MlClientService)
      .useValue({ get speakingProfile() { return config?.get('SPEAKING_SCORING_PROFILE', 'read-aloud-v1') ?? 'read-aloud-v1'; },
        scoreTopic: async audio => { topicCalls++; return { schemaVersion: 3, mode: 'TOPIC', assessmentProfile: 'topic-speaking-v1',
          transcript: 'I live in Hanoi and I enjoy reading books with my family after school every day because it helps me learn.',
          accuracy: 80, fluency: 90, prosody: 50, overall: (40*80+25*90+25*50)/90,
          durationSeconds: audio.readUInt32LE(40)/32000, audioHash: createHash('sha256').update(audio).digest('hex'),
          provider: 'azure', adapterVersion: 'topic-fixture', assessmentCompleteness: 'full',
          words: [{ word: 'Hello', accuracy: 80, errorType: 'None', offsetMs: 0, durationMs: 100 }] }; },
        scoreTopicContent: async () => { contentCalls++; if(contentFailure) throw new Error('offline'); return {
          status: 'succeeded', rubricVersion: 'topic-content-v1', vocabulary: 70, grammar: 80, topic: 90, overall: 80, strengths: [], improvements: [] }; },
        scoreReadAloud: async (...args) => { calls++; return behavior ? behavior(...args) : result; } }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new HttpExceptionFilter()); await app.init();
    prisma = app.get(PrismaService); config = app.get(ConfigService);
    a = await account(); b = await account();
    prompts = (await api(a, 'get', '/speaking/prompts').expect(200)).body.data.items;
  });
  after(async () => {
    if (prisma && users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
    const { getApps } = require('firebase-admin/app');
    const admin = getApps().find(a => a.name === `lingoroad-auth-${project}`);
    if (admin) for (const uid of identities) await require('firebase-admin/auth').getAuth(admin).deleteUser(uid);
    if (app) await app.close();
  });
  function api(owner, method, url, body) {
    const call = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${owner.idToken}`);
    return body === undefined ? call : call.send(body);
  }
  async function account() {
    const r = await fetch(`http://${emulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `speaking-${randomUUID()}@example.com`, password: 'SpeakingTest123!', returnSecureToken: true }) });
    assert.equal(r.status, 200); const identity = await r.json(); identities.push(identity.localId);
    const me = (await api(identity, 'get', '/auth/me').expect(200)).body.data; users.push(me.id);
    return { ...identity, userId: me.id };
  }
  async function create(prompt = prompts[0], clientRequestId = randomUUID()) {
    return (await api(a, 'post', '/speaking/submissions', { promptId: prompt.id, clientRequestId }).expect(201)).body.data;
  }
  const read = async id => (await api(a, 'get', `/speaking/submissions/${id}`).expect(200)).body.data;
  const upload = (owner, id, audio = wav()) => api(owner, 'put', `/speaking/submissions/${id}/audio`).attach('file', audio, { filename: 'record.wav', contentType: 'audio/wav' });
  it('lists nine server prompts preserving the original three and requires authentication', async () => {
    assert.equal(prompts.length, 9);
    assert.deepEqual(prompts.slice(0, 3).map(p => p.text), ['I have lived here for five years', 'My name is Anna', 'I am a student from Hanoi']);
    await request(app.getHttpServer()).get('/speaking/prompts').expect(401);
  });
  it('persists snapshot and idempotent creation; rejects changed command', async () => {
    const command = randomUUID(), s = await create(prompts[0], command), same = await create(prompts[0], command);
    assert.equal(s.id, same.id); assert.equal(s.promptSnapshot.text, prompts[0].text);
    await api(a, 'post', '/speaking/submissions', { promptId: prompts[1].id, clientRequestId: command }).expect(409);
    const original = prompts[0].text;
    try {
      await prisma.speakingPrompt.update({ where: { id: prompts[0].id }, data: { text: 'Changed prompt' } });
      assert.equal((await read(s.id)).promptSnapshot.text, original);
    } finally { await prisma.speakingPrompt.update({ where: { id: prompts[0].id }, data: { text: original } }); }
  });
  it('blocks another account from reading or uploading', async () => {
    const s = await create(), before = calls;
    await api(b, 'get', `/speaking/submissions/${s.id}`).expect(404); await upload(b, s.id).expect(404);
    assert.equal(calls, before);
  });
  it('validates audio bytes before provider invocation', async () => {
    const s = await create(), before = calls;
    for (const audio of [Buffer.from('fake WAV'), wav(1, 0), wav(30.01)]) await upload(a, s.id, audio).expect(422);
    const wrong = wav(); wrong.writeUInt32LE(44100, 24); await upload(a, s.id, wrong).expect(422);
    await upload(a, s.id, Buffer.alloc(2 * 1024 * 1024 + 1)).expect(413);
    assert.equal(calls, before); assert.equal((await read(s.id)).status, 'CREATED');
  });
  it('claims concurrent requests once; replay returns persisted result; changed audio conflicts', async () => {
    const s = await create(), before = calls;
    behavior = async () => { await new Promise(r => setTimeout(r, 60)); return result; };
    const [one, two] = await Promise.all([upload(a, s.id).expect(200), upload(a, s.id).expect(200)]);
    behavior = null;
    assert.equal(calls, before + 1); assert.ok([one.body.data.status, two.body.data.status].includes('SUCCEEDED'));
    const replay = (await upload(a, s.id).expect(200)).body.data;
    assert.equal(replay.status, 'SUCCEEDED'); assert.deepEqual(replay.result, result); assert.equal(calls, before + 1);
    await upload(a, s.id, wav(1, 2000)).expect(409);
  });
  it('keeps timeout unknown and never retries it automatically', async () => {
    const s = await create(), before = calls;
    behavior = async () => { throw new Error('timeout'); };
    const response = (await upload(a, s.id).expect(200)).body.data; behavior = null;
    assert.equal(response.status, 'UNKNOWN'); await upload(a, s.id).expect(200); assert.equal(calls, before + 1);
  });
  it('persists exact v2 decimal scores, partial metadata and mixed history', async () => {
    const old = await create(); await upload(a, old.id).expect(200);
    config.set('SPEAKING_SCORING_PROFILE', 'read-aloud-v2');
    try {
      const s = await create(), audio = wav(), before = calls;
      const v2 = { ...result, schemaVersion: 2, assessmentProfile: 'read-aloud-v2', prosody: null,
        assessmentCompleteness: 'partial', accuracy: 31.25, fluency: 51.125, pronunciation: 41.375,
        referenceText: s.promptSnapshot.text, audioHash: createHash('sha256').update(audio).digest('hex'),
        assessedAt: new Date().toISOString(), assessmentConfig: { locale: 'en-US', scenario: 'reading', gradingSystem: 'HundredMark',
          granularity: 'Phoneme', dimension: 'Comprehensive', enableMiscue: true, enableProsodyAssessment: true, breakConfidenceThreshold: .75, monotoneScope: 'utterance' },
        words: [{ ...result.words[0], offsetMs: 1, durationMs: 20, phonemes: [], syllables: [],
          prosody: { unexpectedBreakConfidence: null, missingBreakConfidence: null, monotone: null } }] };
      behavior = async () => v2;
      const submitted = (await upload(a, s.id, audio).expect(200)).body.data;
      assert.equal(submitted.status, 'SUCCEEDED');
      const weighted = { ...v2, overall: null, scoringPolicy: { version: 'lingoroad-weighted-v1', weights: { accuracy: 40, fluency: 25, prosody: 25, completeness: 10 } } };
      assert.deepEqual((await read(s.id)).result, weighted);
      assert.deepEqual((await prisma.speakingSubmission.findUnique({ where: { id: s.id } })).result, weighted);
      await upload(a, s.id, audio).expect(200); assert.equal(calls, before + 1);
      const history = (await api(a, 'get', '/speaking/history').expect(200)).body.data.items;
      assert.deepEqual(history.find(x => x.id === old.id).result, result);
      assert.deepEqual(history.find(x => x.id === s.id).result, weighted);
      const complete = await create();
      behavior = async () => ({ ...v2, accuracy: 88, fluency: 77, prosody: 51.5,
        completeness: 100, pronunciation: 73.6, assessmentCompleteness: 'full' });
      const full = (await upload(a, complete.id, audio).expect(200)).body.data;
      assert.equal(full.result.overall, 77.325);
      assert.equal(full.result.pronunciation, 73.6);
      assert.equal((await read(complete.id)).result.overall, 77.325);
      assert.equal((await prisma.speakingSubmission.findUnique({ where: { id: complete.id } })).result.overall, 77.325);
      const mismatch = await create(); behavior = async () => ({ ...v2, audioHash: 'f'.repeat(64) });
      assert.equal((await upload(a, mismatch.id).expect(200)).body.data.status, 'UNKNOWN');
    } finally { behavior = null; config.set('SPEAKING_SCORING_PROFILE', 'read-aloud-v1'); }
  });
  it('records deterministic quota failure and rejects malformed scores as UNKNOWN', async () => {
    let s = await create(); behavior = async () => { throw { response: { status: 429, data: { detail: 'azure_quota_exceeded' } } }; };
    assert.equal((await upload(a, s.id).expect(200)).body.data.status, 'FAILED');
    s = await create(); behavior = async () => ({ ...result, accuracy: undefined });
    assert.equal((await upload(a, s.id).expect(200)).body.data.status, 'UNKNOWN'); behavior = null;
  });
  it('recovers stale PROCESSING without making provider call', async () => {
    const s = await create(), before = calls;
    await prisma.speakingSubmission.update({ where: { id: s.id }, data: { status: 'PROCESSING', processingAt: new Date(Date.now() - 121000), audioHash: 'f'.repeat(64) } });
    assert.equal((await read(s.id)).status, 'UNKNOWN'); assert.equal(calls, before);
  });
  it('feature switch blocks new work but keeps history and replay readable', async () => {
    const s = await create(), done = await create(); await upload(a, done.id).expect(200);
    config.set('SPEAKING_ENABLED', 'false');
    try {
      await api(a, 'post', '/speaking/submissions', { promptId: prompts[0].id, clientRequestId: randomUUID() }).expect(503);
      await upload(a, s.id).expect(503); await upload(a, done.id).expect(200); await read(done.id);
      const history = (await api(a, 'get', '/speaking/history').expect(200)).body.data;
      assert.ok(history.items.some(x => x.id === done.id)); assert.ok(history.items.every(x => x.userId === a.userId));
    } finally { config.set('SPEAKING_ENABLED', 'true'); }
  });
  it('does not create daily learning activity or attempts', async () => {
    assert.equal(await prisma.learningAttempt.count({ where: { userId: a.userId } }), 0);
    assert.equal(await prisma.learningActivitySession.count({ where: { userId: a.userId } }), 0);
    assert.equal(await prisma.learningDayPlan.count({ where: { userId: a.userId } }), 0);
  });
  it('paginates with ownership-bound cursors and stable ordering', async () => {
    for (let i = 0; i < 12; i++) await create();
    const first = (await api(a, 'get', '/speaking/history').expect(200)).body.data;
    assert.equal(first.items.length, 20); assert.ok(first.nextCursor);
    const second = (await api(a, 'get', `/speaking/history?cursor=${first.nextCursor}`).expect(200)).body.data;
    assert.ok(second.items.length > 0);
    assert.equal(new Set([...first.items, ...second.items].map(x => x.id)).size, first.items.length + second.items.length);
    await api(b, 'get', `/speaking/history?cursor=${first.nextCursor}`).expect(404);
  });
  it('scores 60-second topic speech, persists content and replays without extra calls', async () => {
    const topics = (await api(a, 'get', '/speaking/prompts?mode=TOPIC').expect(200)).body.data.items;
    assert.equal(topics.length, 6);
    const s = await create(topics[0]), audio = wav(60), before = topicCalls, beforeContent = contentCalls;
    const scored = (await upload(a, s.id, audio).expect(200)).body.data;
    assert.equal(scored.status, 'SUCCEEDED'); assert.equal(scored.result.content.overall, 80);
    assert.equal(scored.result.schemaVersion, 3); assert.equal(scored.result.durationSeconds, 60);
    await upload(a, s.id, audio).expect(200);
    assert.equal(topicCalls, before+1); assert.equal(contentCalls, beforeContent+1);
    await upload(a, (await create(topics[0])).id, wav(60.01)).expect(422);
    const history = (await api(a, 'get', '/speaking/history?mode=TOPIC').expect(200)).body.data.items;
    assert.ok(history.every(item => item.promptSnapshot.mode === 'TOPIC'));
    contentFailure = true;
    try {
      const done = (await upload(a, (await create(topics[0])).id, wav(15)).expect(200)).body.data;
      assert.equal(done.status, 'SUCCEEDED'); assert.equal(done.result.accuracy, 80);
      assert.equal(done.result.content.status, 'unavailable');
    } finally { contentFailure = false; }
  });
  it('enforces game locks per account and preserves best results concurrently', async () => {
    const game = (await api(a, 'get', '/speaking/game/progress').expect(200)).body.data.items;
    assert.equal(game.length,12); assert.equal(game[0].unlocked,true); assert.equal(game[1].unlocked,false);
    await api(a, 'post', '/speaking/submissions', {promptId:game[1].id,clientRequestId:randomUUID()}).expect(403);
    config.set('SPEAKING_SCORING_PROFILE','read-aloud-v2');
    const base = { ...result, schemaVersion:2, assessmentProfile:'read-aloud-v2', prosody:90,
      assessmentCompleteness:'full', assessedAt:new Date().toISOString(), assessmentConfig:{locale:'en-US',scenario:'reading',gradingSystem:'HundredMark',granularity:'Phoneme',dimension:'Comprehensive',enableMiscue:true,enableProsodyAssessment:true,breakConfidenceThreshold:.75,monotoneScope:'utterance'},
      words:[{word:'Hello',accuracy:95,errorType:'None',offsetMs:0,durationMs:100,phonemes:[],syllables:[],prosody:{unexpectedBreakConfidence:null,missingBreakConfidence:null,monotone:null}}] };
    behavior = async(audio,text) => ({...base,audioHash:createHash('sha256').update(audio).digest('hex'),referenceText:text});
    try {
      const first = await create(game[0]), second=await create(game[0]);
      await Promise.all([upload(a,first.id).expect(200),upload(a,second.id).expect(200)]);
      let progress=(await api(a,'get','/speaking/game/progress').expect(200)).body.data.items;
      assert.equal(progress[0].stars,3); assert.equal(progress[0].cleared,true); assert.equal(progress[1].unlocked,true);
      const before=progress[0].bestScore;
      behavior=async(audio,text)=>({...base,accuracy:40,fluency:40,prosody:40,completeness:100,audioHash:createHash('sha256').update(audio).digest('hex'),referenceText:text});
      await upload(a,(await create(game[0])).id).expect(200);
      progress=(await api(a,'get','/speaking/game/progress').expect(200)).body.data.items;
      assert.equal(progress[0].bestScore,before); assert.equal(progress[0].stars,3);
      const other=(await api(b,'get','/speaking/game/progress').expect(200)).body.data.items;
      assert.equal(other[0].stars,0); assert.equal(other[1].unlocked,false);
    } finally {behavior=null;config.set('SPEAKING_SCORING_PROFILE','read-aloud-v1');}
  });

});
