import 'class-validator';
import 'class-transformer';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication, ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { buildCorsOptions } from './common/config/cors.config';
import { placementMediaRoot } from './modules/placement/services/demo-placement.service';
import { learningMediaRoot } from './modules/learning/learning.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(),
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
  app.useStaticAssets(placementMediaRoot(), { prefix: '/media/placement/', index: false, dotfiles: 'deny' });
  app.useStaticAssets(learningMediaRoot(), { prefix: '/media/learning/', index: false, dotfiles: 'deny' });

  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  logger.log(`LingoRoad Backend is running on: http://localhost:${port}`);
}

void bootstrap();
