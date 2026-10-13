import { Injectable } from '@nestjs/common';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { PlacementStatusResponseDto } from '../dto/placement-status-response.dto';

@Injectable()
export class GetPlacementStatusUseCase {
  constructor(private readonly sessionRepo: PlacementSessionRepository) {}

  async execute(userId: string): Promise<PlacementStatusResponseDto> {
    const activeSession = await this.sessionRepo.findActiveByUserId(userId);
    if (activeSession) {
      return {
        hasCompleted: false,
        currentSessionId: activeSession.id,
        status: activeSession.status,
        currentIndex: activeSession.currentItemIndex,
        totalItems: activeSession.totalItems,
        estimatedCefr: null,
      };
    }

    const completedSession = await this.sessionRepo.findLatestCompletedByUserId(userId);
    if (completedSession) {
      return {
        hasCompleted: true,
        currentSessionId: completedSession.id,
        status: completedSession.status,
        currentIndex: completedSession.totalItems,
        totalItems: completedSession.totalItems,
        estimatedCefr: completedSession.estimatedCefr,
      };
    }

    return {
      hasCompleted: false,
      currentSessionId: null,
      status: null,
      currentIndex: 0,
      totalItems: 15,
      estimatedCefr: null,
    };
  }
}
