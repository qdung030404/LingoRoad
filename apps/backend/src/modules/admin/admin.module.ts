import { Module } from '@nestjs/common';
import { AssessmentModule } from '../assessment/assessment.module';
import { FirebaseAuthModule } from '../auth/firebase/firebase-auth.module';
import { MlModule } from '../ml/ml.module';
import { PlanningModule } from '../planning/planning.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SpeakingModule } from '../speaking/speaking.module';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { ClientIpThrottlerGuard } from '../../common/guards/client-ip-throttler.guard';
import { AdminAssessmentController } from './controllers/admin-assessment.controller';
import { AdminAuditImportController } from './controllers/admin-audit-import.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminContentController } from './controllers/admin-content.controller';
import { AdminMediaController } from './controllers/admin-media.controller';
import { AdminOpsController } from './controllers/admin-ops.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminVocabularySpeakingController } from './controllers/admin-vocabulary-speaking.controller';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminContentService } from './services/admin-content.service';
import { AdminExportService } from './services/admin-export.service';
import { AdminImportService } from './services/admin-import.service';
import { AdminMediaService } from './services/admin-media.service';
import { AdminOpsService } from './services/admin-ops.service';
import { AdminSpeakingService } from './services/admin-speaking.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminVocabularyService } from './services/admin-vocabulary.service';

@Module({
  imports: [
    PrismaModule,
    FirebaseAuthModule,
    AssessmentModule,
    VocabularyModule,
    SpeakingModule,
    MlModule,
    PlanningModule,
  ],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminContentController,
    AdminAssessmentController,
    AdminVocabularySpeakingController,
    AdminAuditImportController,
    AdminMediaController,
    AdminOpsController,
  ],
  providers: [
    AdminJwtGuard,
    ClientIpThrottlerGuard,
    AdminAuditService,
    AdminAuditInterceptor,
    AdminAuthService,
    AdminUsersService,
    AdminAnalyticsService,
    AdminContentService,
    AdminImportService,
    AdminMediaService,
    AdminOpsService,
    AdminVocabularyService,
    AdminSpeakingService,
    AdminExportService,
  ],
  exports: [AdminJwtGuard, AdminAuditService, AdminAuditInterceptor],
})
export class AdminModule {}
