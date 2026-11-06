import { Module } from "@nestjs/common";
import { AssessmentController } from "./assessment.controller";
import { AssessmentItemGroupRepository } from "./repositories/assessment-item-group.repository";
import { AssessmentCacheService } from "./services/assessment-cache.service";
import { AssessmentMatrixService } from "./services/assessment-matrix.service";
import { AssessmentPracticeService } from "./services/assessment-practice.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AssessmentController],
  providers: [
    AssessmentCacheService,
    AssessmentItemGroupRepository,
    AssessmentMatrixService,
    AssessmentPracticeService,
  ],
  exports: [
    AssessmentCacheService,
    AssessmentItemGroupRepository,
    AssessmentMatrixService,
    AssessmentPracticeService,
  ],
})
export class AssessmentModule {}
