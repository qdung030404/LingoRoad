import { Module } from '@nestjs/common';
import { AssessmentModule } from '../assessment/assessment.module';
import { FirebaseAuthModule } from '../auth/firebase/firebase-auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminContentController } from './controllers/admin-content.controller';
import { AdminMediaController } from './controllers/admin-media.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminContentService } from './services/admin-content.service';
import { AdminExportService } from './services/admin-export.service';
import { AdminImportService } from './services/admin-import.service';
import { AdminMediaService } from './services/admin-media.service';
import { AdminSpeakingService } from './services/admin-speaking.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminVocabularyService } from './services/admin-vocabulary.service';

@Module({
  imports: [
    PrismaModule,
    FirebaseAuthModule,
    AssessmentModule,
    VocabularyModule,
  ],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminContentController,
    AdminMediaController,
  ],
  providers: [
    AdminJwtGuard,
    AdminAuditService,
    AdminAuditInterceptor,
    AdminAuthService,
    AdminUsersService,
    AdminAnalyticsService,
    AdminContentService,
    AdminImportService,
    AdminMediaService,
    AdminVocabularyService,
    AdminSpeakingService,
    AdminExportService,
  ],
  exports: [AdminJwtGuard, AdminAuditService, AdminAuditInterceptor],
})
export class AdminModule {}
