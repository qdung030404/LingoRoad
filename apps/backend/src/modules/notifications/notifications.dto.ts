import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { NotificationTargetType, NotificationType, Prisma } from '@prisma/client';

export class NotificationListQuery {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  targetType?: NotificationTargetType;
  targetPayload?: Prisma.InputJsonValue | null;
  dedupeKey: string;
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  targetType: NotificationTargetType;
  targetPayload: Prisma.JsonValue | null;
  readAt: Date | null;
  createdAt: Date;
}
