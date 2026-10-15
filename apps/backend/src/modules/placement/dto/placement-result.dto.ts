import { CefrLevel, SessionStatus } from '@prisma/client';

export class PlacementResultDto {
  sessionId: string;
  status: SessionStatus;
  estimatedCefr: CefrLevel;
  correctCount: number;
  totalItems: number;
  confidenceScore?: number | null;
  completedAt: Date;
}
