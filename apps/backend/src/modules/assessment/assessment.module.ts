import { Module } from "@nestjs/common";
import { AssessmentController } from "./assessment.controller";
import { AssessmentItemGroupRepository } from "./repositories/assessment-item-group.repository";
import { AssessmentCacheService } from "./services/assessment-cache.service";
import { AssessmentMatrixService } from "./services/assessment-matrix.service";
import { AssessmentPracticeService } from "./services/assessment-practice.service";
import { EvaluateCefrWritingUseCase } from "./services/evaluate-cefr-writing.use-case";
import { PrismaModule } from "../prisma/prisma.module";
import { MlModule } from "../ml/ml.module";

@Module({
  imports: [PrismaModule, MlModule],
  controllers: [AssessmentController],
  providers: [
    AssessmentCacheService,
    AssessmentItemGroupRepository,
    AssessmentMatrixService,
    AssessmentPracticeService,
    EvaluateCefrWritingUseCase,
  ],
  exports: [
    AssessmentCacheService,
    AssessmentItemGroupRepository,
    AssessmentMatrixService,
    AssessmentPracticeService,
    EvaluateCefrWritingUseCase,
  ],
})
export class AssessmentModule {}
