import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlacementController } from './placement.controller';
import { PlacementSessionRepository } from './repositories/placement-session.repository';
import { AssessmentItemRepository } from './repositories/assessment-item.repository';
import { AssessmentResponseRepository } from './repositories/assessment-response.repository';
import { AdaptiveSequencingService } from './services/adaptive-sequencing.service';
import { CefrScoringService } from './services/cefr-scoring.service';
import { GetPlacementStatusUseCase } from './use-cases/get-placement-status.use-case';
import { StartAssessmentUseCase } from './use-cases/start-assessment.use-case';
import { SubmitAnswerUseCase } from './use-cases/submit-answer.use-case';
import { GetAssessmentResultUseCase } from './use-cases/get-assessment-result.use-case';
import { ImportItemsUseCase } from './use-cases/import-items.use-case';
import { InternalAuthGuard } from './guards/internal-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [PlacementController],
  providers: [
    PlacementSessionRepository,
    AssessmentItemRepository,
    AssessmentResponseRepository,
    AdaptiveSequencingService,
    CefrScoringService,
    GetPlacementStatusUseCase,
    StartAssessmentUseCase,
    SubmitAnswerUseCase,
    GetAssessmentResultUseCase,
    ImportItemsUseCase,
    InternalAuthGuard,
  ],
  exports: [
    PlacementSessionRepository,
    AssessmentItemRepository,
    CefrScoringService,
  ],
})
export class PlacementModule {}
