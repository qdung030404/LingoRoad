import { Injectable, Logger } from '@nestjs/common';
import { MlClientService } from '../../ml/ml-client.service';
import {
  AssessmentItem,
  AssessmentItemPublic,
  AssessmentResponse,
  ItemType,
} from '../interfaces/placement.interface';
import { CatCandidate, CatHistoryEntry } from '../../ml/interfaces/ml-client.interface';

/**
 * AdaptiveSequencingService chọn câu hỏi tiếp theo dựa trên
 * lịch sử trả lời và thuật toán CAT (Computerized Adaptive Testing).
 * Nếu ML service offline, fallback về InProcessCatFallback.
 */
@Injectable()
export class AdaptiveSequencingService {
  private readonly logger = new Logger(AdaptiveSequencingService.name);

  constructor(private readonly mlClientService: MlClientService) {}

  /**
   * Chọn câu hỏi tiếp theo từ danh sách ứng viên dựa trên lịch sử làm bài.
   * Trả về null nếu không còn câu hỏi phù hợp.
   */
  async selectNextItem(
    responses: AssessmentResponse[],
    candidates: AssessmentItem[],
    nextIndex: number,
  ): Promise<AssessmentItemPublic | null> {
    if (candidates.length === 0) {
      return null;
    }

    const answeredIds = new Set(responses.map((r) => r.itemId));
    const remaining = candidates.filter((c) => !answeredIds.has(c.id));

    if (remaining.length === 0) {
      return null;
    }

    try {
      const history: CatHistoryEntry[] = responses.map((r) => {
        const item = candidates.find((c) => c.id === r.itemId);
        return {
          a: item?.irtA ?? 1.0,
          b: item?.irtB ?? 0.0,
          c: item?.irtC ?? 0.25,
          correct: r.isCorrect,
        };
      });

      const catCandidates: CatCandidate[] = remaining.map((item) => ({
        item_id: item.id,
        a: item.irtA,
        b: item.irtB,
        c: item.irtC,
      }));

      const catResult = await this.mlClientService.selectNextCatItem(
        history,
        catCandidates,
      );

      const selectedId = catResult.next_item_id;
      const selected = remaining.find((c) => c.id === selectedId) ?? remaining[0];

      return this.toPublic(selected, nextIndex);
    } catch (err) {
      this.logger.warn(
        `CAT ML service unavailable, falling back to sequential selection: ${String(err)}`,
      );
      return this.toPublic(remaining[0], nextIndex);
    }
  }

  /**
   * Chuyển AssessmentItem sang dạng public (không có correctOption).
   */
  toPublic(item: AssessmentItem, index: number): AssessmentItemPublic {
    return {
      id: item.id,
      index,
      type: item.type as ItemType,
      prompt: item.prompt,
      options: item.options,
      mediaUrl: null,
    };
  }
}
