import { CefrLevel, SessionStatus } from '@prisma/client';

export class PlacementStatusResponseDto {
  hasCompleted: boolean;
  currentSessionId?: string | null;
  status?: SessionStatus | null;
  currentIndex?: number;
  totalItems?: number;
  estimatedCefr?: CefrLevel | null;
}
