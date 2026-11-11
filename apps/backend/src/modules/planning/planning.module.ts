import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({ imports: [PrismaModule], controllers: [PlanningController], providers: [PlanningService], exports: [PlanningService] })
export class PlanningModule {}
