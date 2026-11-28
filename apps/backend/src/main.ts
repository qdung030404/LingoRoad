import 'class-validator';
import 'class-transformer';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication, ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { buildCorsOptions } from './common/config/cors.config';
import { normalizeForwardedForHeader } from './common/guards/client-ip-throttler.guard';
import { gzipCompressionMiddleware } from './common/middleware/gzip-compression.middleware';
import { placementMediaRoot } from './modules/placement/services/demo-placement.service';
import { learningMediaRoot } from './modules/learning/learning.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(),
  );

  app.disable('x-powered-by');
  const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
  app.set(
    'trust proxy',
    Number.isFinite(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1,
  );

  // Normalize Azure App Service IPv4:port entries in x-forwarded-for while preserving IPv6.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      req.headers['x-forwarded-for'] = normalizeForwardedForHeader(xff);
    }
    next();
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: { maxAge: 31536000, includeSubDomains: true },
    }),
  );

  // Bound bulk curriculum imports while retaining the default parser for other bodies.
  app.useBodyParser('json', { limit: '5mb' });

  const configService = app.get(ConfigService);
  app.enableCors(
    buildCorsOptions({
      corsAllowedOrigins: configService.get<string>('CORS_ALLOWED_ORIGINS'),
      nodeEnv: configService.get<string>('NODE_ENV'),
    }),
  );

  app.use(gzipCompressionMiddleware({ threshold: 1024 }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  const setMediaSecurityHeaders = (res: { setHeader: (name: string, value: string) => void }) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  };
  app.useStaticAssets(placementMediaRoot(), {
    prefix: '/media/placement/',
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
    setHeaders: setMediaSecurityHeaders,
  });
  app.useStaticAssets(learningMediaRoot(), {
    prefix: '/media/learning/',
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
    setHeaders: setMediaSecurityHeaders,
  });

  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  logger.log(`LingoRoad Backend is running on: http://localhost:${port}`);
}

void bootstrap();
