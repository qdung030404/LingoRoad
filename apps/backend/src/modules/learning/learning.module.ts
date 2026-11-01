import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';

@Module({ imports: [PrismaModule], controllers: [LearningController], providers: [LearningService] })
export class LearningModule {}
