import { Injectable } from '@nestjs/common';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { PlacementStatusResult } from '../interfaces/placement.interface';

@Injectable()
export class GetPlacementStatusUseCase {
  constructor(private readonly sessionRepo: PlacementSessionRepository) {}

  async execute(userId: string): Promise<PlacementStatusResult> {
    // 1. Kiểm tra session đang IN_PROGRESS
    const activeSession = await this.sessionRepo.findActiveByUserId(userId);
    if (activeSession) {
      return {
        hasCompleted: false,
        currentSessionId: activeSession.id,
        status: activeSession.status,
        currentIndex: activeSession.currentItemIndex,
        totalItems: activeSession.totalItems,
      };
    }

    // 2. Kiểm tra xem người học đã từng hoàn thành bài kiểm tra nào chưa
    const completedSession =
      await this.sessionRepo.findLatestCompletedByUserId(userId);
    if (completedSession) {
      return {
        hasCompleted: true,
        currentSessionId: completedSession.id,
        status: completedSession.status,
        currentIndex: completedSession.currentItemIndex,
        totalItems: completedSession.totalItems,
      };
    }

    // 3. Người học mới tinh, chưa từng bắt đầu
    return {
      hasCompleted: false,
      currentSessionId: null,
      status: null,
      currentIndex: 0,
      totalItems: 15,
    };
  }
}
