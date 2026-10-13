import { Injectable } from '@nestjs/common';
import { AssessmentItem } from '@prisma/client';
import { MlClientService } from '../../ml/ml-client.service';
import { AssessmentItemRepository } from '../repositories/assessment-item.repository';

export interface ResponseHistoryItem {
  item: AssessmentItem;
  isCorrect: boolean;
}

@Injectable()
export class AdaptiveSequencingService {
  constructor(
    private readonly mlClientService: MlClientService,
    private readonly itemRepo: AssessmentItemRepository,
  ) {}

  async selectNextItem(
    historyItems: ResponseHistoryItem[],
    excludedItemIds: string[],
  ): Promise<AssessmentItem | null> {
    const candidates = await this.itemRepo.findCandidatesExcluding(excludedItemIds, 50);
    if (!candidates || candidates.length === 0) {
      return null;
    }

    const history = historyItems.map((h) => ({
      a: h.item.irtA,
      b: h.item.irtB,
      c: h.item.irtC,
      correct: h.isCorrect,
    }));

    const candidatePayload = candidates.map((c) => ({
      item_id: c.id,
      a: c.irtA,
      b: c.irtB,
      c: c.irtC,
    }));

    try {
      const catResult = await this.mlClientService.selectNextCatItem(
        history,
        candidatePayload,
      );

      const selected = candidates.find((c) => c.id === catResult.next_item_id);
      return selected || candidates[0];
    } catch {
      return candidates[0];
    }
  }
}
