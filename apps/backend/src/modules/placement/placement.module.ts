import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlacementController } from './placement.controller';
import { PlacementSessionRepository } from './repositories/placement-session.repository';
import { AssessmentItemRepository } from './repositories/assessment-item.repository';
import { AssessmentResponseRepository } from './repositories/assessment-response.repository';
import { AdaptiveSequencingService } from './services/adaptive-sequencing.service';
import { CefrScoringService } from './services/cefr-scoring.service';
import { InternalAuthGuard } from './guards/internal-auth.guard';
import { StartPlacementUseCase } from './use-cases/start-placement.use-case';
import { GetPlacementStatusUseCase } from './use-cases/get-placement-status.use-case';
import { GetPlacementResultUseCase } from './use-cases/get-placement-result.use-case';
import { SubmitAnswerUseCase } from './use-cases/submit-answer.use-case';

@Module({
  imports: [PrismaModule],
  controllers: [PlacementController],
  providers: [
    // Repositories
    PlacementSessionRepository,
    AssessmentItemRepository,
    AssessmentResponseRepository,

    // Services
    AdaptiveSequencingService,
    CefrScoringService,

    // Guards
    InternalAuthGuard,

    // Use-cases
    StartPlacementUseCase,
    GetPlacementStatusUseCase,
    GetPlacementResultUseCase,
    SubmitAnswerUseCase,
  ],
  exports: [
    PlacementSessionRepository,
    AssessmentItemRepository,
    AssessmentResponseRepository,
    CefrScoringService,
  ],
})
export class PlacementModule {}
