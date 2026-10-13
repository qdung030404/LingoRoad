import { Injectable, NotFoundException } from '@nestjs/common';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { AssessmentItemRepository } from '../repositories/assessment-item.repository';
import { AdaptiveSequencingService } from '../services/adaptive-sequencing.service';
import { StartAssessmentResponseDto } from '../dto/start-assessment-response.dto';
import { toSafeItemResponse } from '../utils/item-mapper';

@Injectable()
export class StartAssessmentUseCase {
  constructor(
    private readonly sessionRepo: PlacementSessionRepository,
    private readonly itemRepo: AssessmentItemRepository,
    private readonly adaptiveService: AdaptiveSequencingService,
  ) {}

  async execute(userId: string): Promise<StartAssessmentResponseDto> {
    const activeSession = await this.sessionRepo.findActiveByUserId(userId);

    if (activeSession) {
      const fullSession = await this.sessionRepo.findByIdWithResponses(activeSession.id);
      const responses = fullSession?.responses || [];

      let currentItem = null;
      if (responses.length > 0) {
        // If there are responses, get candidates excluding already answered items
        const answeredIds = responses.map((r) => r.itemId);
        const historyItems = responses.map((r) => ({ item: r.item, isCorrect: r.isCorrect }));
        currentItem = await this.adaptiveService.selectNextItem(historyItems, answeredIds);
      }

      if (!currentItem) {
        currentItem = await this.itemRepo.findInitialItem();
      }

      if (!currentItem) {
        throw new NotFoundException('No assessment questions available in the question bank.');
      }

      return {
        sessionId: activeSession.id,
        totalItems: activeSession.totalItems,
        firstItem: toSafeItemResponse(currentItem, activeSession.currentItemIndex),
        isResumed: true,
      };
    }

    const initialItem = await this.itemRepo.findInitialItem();
    if (!initialItem) {
      throw new NotFoundException('No assessment questions available in the question bank.');
    }

    const newSession = await this.sessionRepo.create(userId, 15);

    return {
      sessionId: newSession.id,
      totalItems: newSession.totalItems,
      firstItem: toSafeItemResponse(initialItem, 0),
      isResumed: false,
    };
  }
}
