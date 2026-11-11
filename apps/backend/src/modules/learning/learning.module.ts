import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { PlanningModule } from '../planning/planning.module';

@Module({ imports: [PrismaModule, PlanningModule], controllers: [LearningController], providers: [LearningService] })
export class LearningModule {}
