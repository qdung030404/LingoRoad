import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './modules/prisma/prisma.module';
import { isSqlTimingEnabled, sqlTimingMiddleware } from './modules/prisma/sql-timing';
import { SecurityModule } from './modules/security/security.module';
import { AuthModule } from './modules/auth/auth.module';
import { MlModule } from './modules/ml/ml.module';
import { PlacementModule } from './modules/placement/placement.module';
import { LearningModule } from './modules/learning/learning.module';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { GrammarModule } from './modules/grammar/grammar.module';
import { HealthController } from './health.controller';
import { SpeakingModule } from './modules/speaking/speaking.module';
import { AdminModule } from './modules/admin/admin.module';
import { MediaModule } from './modules/media/media.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),
    PrismaModule,
    MediaModule,
    SecurityModule,
    AuthModule,
    MlModule,
    PlacementModule,
    LearningModule,
    VocabularyModule,
    SpeakingModule,
    AssessmentModule,
    GrammarModule,
    NotificationsModule,
    AdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    if (isSqlTimingEnabled()) {
      consumer.apply(sqlTimingMiddleware).forRoutes('*');
    }
  }
}
