import { Module } from '@nestjs/common';
import { AssessmentModule } from '../assessment/assessment.module';
import { FirebaseAuthModule } from '../auth/firebase/firebase-auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminContentController } from './controllers/admin-content.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminContentService } from './services/admin-content.service';
import { AdminImportService } from './services/admin-import.service';
import { AdminUsersService } from './services/admin-users.service';

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
  ],
  providers: [
    AdminJwtGuard,
    AdminAuthService,
    AdminUsersService,
    AdminAnalyticsService,
    AdminContentService,
    AdminImportService,
  ],
})
export class AdminModule {}
