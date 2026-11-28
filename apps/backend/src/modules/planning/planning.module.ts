import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({ imports: [PrismaModule, NotificationsModule], controllers: [PlanningController], providers: [PlanningService], exports: [PlanningService] })
export class PlanningModule {}
