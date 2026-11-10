// Local device acceptance server. Never authenticates against a cloud Firebase
// project. Azure is used only for assessment when the device submits a recording.
const { resolve, relative, isAbsolute } = require('node:path');
const { realpathSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const net = require('node:net');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { ValidationPipe, Module, Controller, Delete, UseGuards, Inject, ForbiddenException } = require('@nestjs/common');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/modules/prisma/prisma.service');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { JwtAuthGuard } = require('../dist/common/guards/jwt-auth.guard');
const { CurrentUser } = require('../dist/common/decorators/current-user.decorator');

const serverStartedAt = Date.now();
class DeviceFixtureController {
  constructor(prisma) { this.prisma = prisma; }
  async cleanup(userId) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const { getApps } = require('firebase-admin/app');
    const project = process.env.FIREBASE_PROJECT_ID;
    const admin = getApps().find(value => value.name === `lingoroad-auth-${project}`);
    if (!user || !admin || !user.firebaseUid || !/^speaking-(device|live)-[a-z0-9-]+@example\.com$/.test(user.email) || user.createdAt.getTime() < serverStartedAt) {
      throw new ForbiddenException({ code: 'fixture_cleanup_denied', message: 'Chỉ được xóa tài khoản kiểm thử vừa tạo trong phiên này.' });
    }
    const auth = require('firebase-admin/auth').getAuth(admin);
    const identity = await auth.getUser(user.firebaseUid);
    if (identity.email !== user.email || new Date(identity.metadata.creationTime).getTime() < serverStartedAt) {
      throw new ForbiddenException({ code: 'fixture_cleanup_denied', message: 'Tài khoản không thuộc phiên kiểm thử hiện tại.' });
    }
    // Exact authenticated UID only. Cascades cover its own Speaking/daily fixtures.
    await auth.deleteUser(user.firebaseUid);
    await this.prisma.user.delete({ where: { id: user.id } });
    return { success: true, data: { deleted: true } };
  }
}
Inject(PrismaService)(DeviceFixtureController, undefined, 0);
Controller('__test')(DeviceFixtureController);
UseGuards(JwtAuthGuard)(DeviceFixtureController);
Delete('speaking-account')(DeviceFixtureController.prototype, 'cleanup', Object.getOwnPropertyDescriptor(DeviceFixtureController.prototype, 'cleanup'));
CurrentUser('sub')(DeviceFixtureController.prototype, 'cleanup', 0);
class DeviceTestModule {}
Module({ imports: [AppModule], controllers: [DeviceFixtureController] })(DeviceTestModule);

let app, child, stopping;
async function stop() {
  if (stopping) return stopping;
  stopping = (async () => {
    try { if (app) await app.close(); } finally {
      if (child && child.exitCode === null) {
        const ended = new Promise(ok => child.once('exit', ok)); child.kill();
        await Promise.race([ended, new Promise(ok => setTimeout(ok, 3000))]);
      }
    }
  })();
  return stopping;
}
async function freePort() {
  const server = net.createServer();
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  const port = server.address().port; await new Promise(ok => server.close(ok)); return port;
}
async function main() {
  if (process.env.SPEAKING_DEVICE_TEST !== 'true') throw new Error('opt_in_required');
  const db = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(db.hostname) || !db.pathname.endsWith('_test')) throw new Error('local_test_db_required');
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || '') || !/^demo-/.test(process.env.FIREBASE_PROJECT_ID || '')) throw new Error('local_auth_emulator_required');
  const root = resolve(__dirname, '../../..');
  const credentialsPath = realpathSync(process.env.AZURE_SPEECH_ENV_FILE || '');
  const location = relative(root, credentialsPath);
  const localAzureDirectory = relative(resolve(root, 'config/local/azure'), credentialsPath);
  const inIgnoredAzureDirectory = !localAzureDirectory.startsWith('..') && !isAbsolute(localAzureDirectory);
  if (!(location.startsWith('..') || isAbsolute(location) || inIgnoredAzureDirectory)) throw new Error('credentials_must_be_private');
  const apiPort = Number(process.env.PORT || 13000);
  if (![3000, 13000].includes(apiPort)) throw new Error('unsupported_device_port');
  const mlPort = await freePort(), token = randomBytes(32).toString('hex');
  process.env.AUTH_PROVIDER = 'firebase'; process.env.SPEAKING_ENABLED = 'true';
  process.env.ML_SERVICE_URL = `http://127.0.0.1:${mlPort}`;
  process.env.ML_INTERNAL_TOKEN = token;
  child = spawn(process.env.SPEAKING_TEST_PYTHON || 'python', ['-m', 'uvicorn', 'lingoroad_ml.serving.app:app', '--host', '127.0.0.1', '--port', String(mlPort)], {
    cwd: root, windowsHide: true, stdio: 'ignore', env: { ...process.env,
      PYTHONPATH: resolve(root, 'apps/ml'), AZURE_SPEECH_ENV_FILE: credentialsPath,
      LINGOROAD_ML_INTERNAL_TOKEN: token, LINGOROAD_ML_REQUIRED_MODELS: 'speech_azure', LINGOROAD_ML_PREWARM: 'false',
    },
  });
  let childFailed = false; child.on('error', () => { childFailed = true; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (childFailed || child.exitCode !== null) break;
    try {
      const response = await fetch(`${process.env.ML_SERVICE_URL}/ready`, { signal: AbortSignal.timeout(500) });
      if (response.ok && (await response.json()).components.speech_azure === 'ready') { ready = true; break; }
    } catch {}
    await new Promise(ok => setTimeout(ok, 250));
  }
  if (!ready) throw new Error('azure_configuration_not_ready');
  app = await NestFactory.create(DeviceTestModule, new ExpressAdapter(), { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalFilters(new HttpExceptionFilter());
  const prisma = app.get(PrismaService);
  const prompts = await prisma.speakingPrompt.findMany({ where: { published: true }, orderBy: { sortOrder: 'asc' } });
  const texts = ['I have lived here for five years', 'My name is Anna', 'I am a student from Hanoi'];
  if (prompts.length !== 9 || prompts.slice(0, 3).some((prompt, index) => prompt.text !== texts[index])) throw new Error('speaking_seed_required');
  await app.listen(apiPort, '127.0.0.1');
  console.log(`Speaking device server ready at http://127.0.0.1:${apiPort}; local Firebase emulator; Azure configuration ready.`);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stop().catch(() => { console.error('Device server cleanup failed.'); process.exitCode = 1; });
});
main().catch(async () => {
  console.error('Speaking device server failed. Verify opt-in, local test DB, emulator, migrations, seed and Azure configuration.');
  process.exitCode = 1;
  try { await stop(); } catch { console.error('Device server cleanup failed.'); }
});
