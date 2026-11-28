import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import request = require('supertest');
import { buildCorsOptions } from '../config/cors.config';
import { gzipCompressionMiddleware } from './gzip-compression.middleware';

@Controller()
class CompressionTestController {
  @Get('large-json')
  largeJson() {
    return {
      success: true,
      data: { items: Array.from({ length: 40 }, (_, i) => ({ id: i, text: `item-payload-${i}` })) },
    };
  }

  @Get('small-json')
  smallJson() {
    return { success: true, data: { ok: true } };
  }

  @Get('no-transform')
  @Header('Cache-Control', 'public, no-transform')
  noTransform() {
    return { data: 'x'.repeat(2500) };
  }

  @Get('pre-encoded')
  preEncoded(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Encoding', 'identity');
    res.send(JSON.stringify({ data: 'x'.repeat(2500) }));
  }

  @Get('events')
  sse(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.write(`data: ${'a'.repeat(1500)}\n\n`);
    res.end();
  }

  @Get('streamed-json')
  streamedJson(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.write('{"chunk1":"');
    res.write('a'.repeat(700));
    res.write('","chunk2":"');
    res.write('b'.repeat(700));
    res.end('"}');
  }

  @Get('media/learning/v1/sample.wav')
  mediaStream(@Res() res: Response) {
    const buf = Buffer.alloc(4096, 1);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(buf.length));
    res.send(buf);
  }
}

describe('gzipCompressionMiddleware', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CompressionTestController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.enableCors(
      buildCorsOptions({
        corsAllowedOrigins: 'https://admin.lingoroad.example.com',
        nodeEnv: 'production',
      }),
    );
    app.use(gzipCompressionMiddleware({ threshold: 1024 }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('compresses JSON payloads >= 1024 bytes and preserves CORS Vary: Origin alongside Vary: Accept-Encoding', async () => {
    const res = await request(app.getHttpServer())
      .get('/large-json')
      .set('Origin', 'https://admin.lingoroad.example.com')
      .set('Accept-Encoding', 'gzip')
      .expect(200);

    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.headers['access-control-allow-origin']).toBe('https://admin.lingoroad.example.com');
    const varyTokens = String(res.headers.vary)
      .split(',')
      .map((v) => v.trim().toLowerCase());
    expect(varyTokens).toContain('origin');
    expect(varyTokens).toContain('accept-encoding');
    expect(res.body.data.items).toHaveLength(40);
  });

  it('compresses multi-chunk streamed responses exceeding 1024 bytes', async () => {
    const res = await request(app.getHttpServer())
      .get('/streamed-json')
      .set('Accept-Encoding', 'gzip, deflate')
      .expect(200);

    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.body).toEqual({
      chunk1: 'a'.repeat(700),
      chunk2: 'b'.repeat(700),
    });
  });

  it('skips responses below 1024 bytes while still preserving Vary: Accept-Encoding', async () => {
    const res = await request(app.getHttpServer())
      .get('/small-json')
      .set('Accept-Encoding', 'gzip')
      .expect(200);

    expect(res.headers['content-encoding']).toBeUndefined();
    expect(String(res.headers.vary).toLowerCase()).toContain('accept-encoding');
    expect(res.body).toEqual({ success: true, data: { ok: true } });
  });

  it('skips when Accept-Encoding omits gzip or explicitly sets gzip;q=0', async () => {
    const res = await request(app.getHttpServer())
      .get('/large-json')
      .set('Accept-Encoding', 'gzip;q=0, identity')
      .expect(200);

    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.body.data.items).toHaveLength(40);
  });

  it('skips Cache-Control: no-transform, pre-set Content-Encoding, SSE, and /media/* binary streams', async () => {
    const noTransformRes = await request(app.getHttpServer())
      .get('/no-transform')
      .set('Accept-Encoding', 'gzip')
      .expect(200);
    expect(noTransformRes.headers['content-encoding']).toBeUndefined();

    const preEncodedRes = await request(app.getHttpServer())
      .get('/pre-encoded')
      .set('Accept-Encoding', 'gzip')
      .expect(200);
    expect(preEncodedRes.headers['content-encoding']).toBe('identity');

    const sseRes = await request(app.getHttpServer())
      .get('/events')
      .set('Accept-Encoding', 'gzip')
      .expect(200);
    expect(sseRes.headers['content-encoding']).toBeUndefined();
    expect(sseRes.headers['content-type']).toContain('text/event-stream');

    const mediaRes = await request(app.getHttpServer())
      .get('/media/learning/v1/sample.wav')
      .set('Accept-Encoding', 'gzip')
      .expect(200);
    expect(mediaRes.headers['content-encoding']).toBeUndefined();
    expect(mediaRes.headers['content-length']).toBe('4096');
  });

  it('preserves CORS preflight OPTIONS headers cleanly', async () => {
    const res = await request(app.getHttpServer())
      .options('/large-json')
      .set('Origin', 'https://admin.lingoroad.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(res.headers['access-control-allow-origin']).toBe('https://admin.lingoroad.example.com');
    expect(String(res.headers.vary).toLowerCase()).toContain('origin');
  });
});
