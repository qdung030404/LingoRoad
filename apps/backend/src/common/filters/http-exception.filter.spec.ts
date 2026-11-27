import { Controller, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import request = require('supertest');
import { HttpExceptionFilter } from './http-exception.filter';
@Controller('admin/imports')
class ProbeController { @Post('validate') validate() { return { success: true }; } }
@Module({ controllers: [ProbeController] })
class ProbeModule {}
describe('Bulk JSON request boundary', () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(ProbeModule, new ExpressAdapter(), { logger: false });
    app.useBodyParser('json', { limit: '5mb' });
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  it('accepts curriculum larger than the old 100 KB limit', async () => {
    await request(app.getHttpServer()).post('/admin/imports/validate').send({ bundle: 'x'.repeat(110000) }).expect(201);
  });
  it('returns a structured 413 beyond the bounded import limit', async () => {
    const response = await request(app.getHttpServer()).post('/admin/imports/validate').send({ bundle: 'x'.repeat(5 * 1024 * 1024) }).expect(413);
    expect(response.body.error.code).toBe('REQUEST_BODY_TOO_LARGE');
  });
});

