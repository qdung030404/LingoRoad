import { Injectable } from '@nestjs/common';
import { AssessmentResponse, CefrLevel } from '../interfaces/placement.interface';

export interface CefrScoringResult {
  estimatedCefr: CefrLevel;
  confidenceScore: number;
}

/**
 * CefrScoringService ước lượng trình độ CEFR dựa trên
 * tỉ lệ câu trả lời đúng theo domain spec Business Rules §7.
 *
 * Cutoff Rules:
 *  < 40%  → A1
 *  40–65% → A2
 *  65–85% → B1
 *  ≥ 85%  → B2
 */
@Injectable()
export class CefrScoringService {
  /**
   * Tính toán CEFR và confidence score từ danh sách câu trả lời.
   */
  calculate(
    responses: AssessmentResponse[],
    totalItems: number,
  ): CefrScoringResult {
    if (responses.length === 0) {
      return { estimatedCefr: CefrLevel.A1, confidenceScore: 0 };
    }

    const correctCount = responses.filter((r) => r.isCorrect).length;
    const ratio = correctCount / totalItems;

    const estimatedCefr = this.mapRatioToCefr(ratio);
    const confidenceScore = this.calculateConfidence(responses.length, totalItems);

    return { estimatedCefr, confidenceScore };
  }

  /**
   * Ánh xạ tỉ lệ đúng → CEFR theo cutoff rules.
   */
  private mapRatioToCefr(ratio: number): CefrLevel {
    if (ratio >= 0.85) return CefrLevel.B2;
    if (ratio >= 0.65) return CefrLevel.B1;
    if (ratio >= 0.40) return CefrLevel.A2;
    return CefrLevel.A1;
  }

  /**
   * Confidence tăng tuyến tính theo tỉ lệ câu đã trả lời (0.0 – 1.0).
   */
  private calculateConfidence(answered: number, total: number): number {
    if (total === 0) return 0;
    return Math.min(1, answered / total);
  }

  /**
   * Đánh giá đơn lẻ một câu trả lời — dùng bởi SubmitAnswerUseCase.
   */
  evaluateAnswer(correctOption: string, selectedOption: string): boolean {
    return correctOption.trim() === selectedOption.trim();
  }
}
