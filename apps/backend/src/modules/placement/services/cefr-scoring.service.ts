import { Injectable } from '@nestjs/common';
import { AssessmentItem, CefrLevel } from '@prisma/client';

export interface ScoredResponse {
  item: AssessmentItem;
  isCorrect: boolean;
}

export interface CefrScoringResult {
  estimatedCefr: CefrLevel;
  confidenceScore: number;
  correctCount: number;
  totalCount: number;
}

@Injectable()
export class CefrScoringService {
  calculateScore(responses: ScoredResponse[]): CefrScoringResult {
    const totalCount = responses.length;
    if (totalCount === 0) {
      return {
        estimatedCefr: CefrLevel.A1,
        confidenceScore: 0.5,
        correctCount: 0,
        totalCount: 0,
      };
    }

    const correctCount = responses.filter((r) => r.isCorrect).length;
    const accuracy = correctCount / totalCount;

    // Weight responses according to item difficulty
    let weightedScore = 0;
    let maxWeightedScore = 0;

    for (const r of responses) {
      let weight = 1.0;
      switch (r.item.cefrLevel) {
        case CefrLevel.A1:
          weight = 1.0;
          break;
        case CefrLevel.A2:
          weight = 1.5;
          break;
        case CefrLevel.B1:
          weight = 2.0;
          break;
        case CefrLevel.B2:
        case CefrLevel.C1:
        case CefrLevel.C2:
          weight = 2.5;
          break;
      }
      maxWeightedScore += weight;
      if (r.isCorrect) {
        weightedScore += weight;
      }
    }

    const normalizedAbility = maxWeightedScore > 0 ? weightedScore / maxWeightedScore : accuracy;

    let estimatedCefr: CefrLevel;
    if (normalizedAbility < 0.4) {
      estimatedCefr = CefrLevel.A1;
    } else if (normalizedAbility < 0.65) {
      estimatedCefr = CefrLevel.A2;
    } else if (normalizedAbility < 0.85) {
      estimatedCefr = CefrLevel.B1;
    } else {
      estimatedCefr = CefrLevel.B2;
    }

    // Confidence score based on number of items completed and consistency
    const completeness = Math.min(1.0, totalCount / 15);
    const confidenceScore = Math.round((0.65 + completeness * 0.25) * 100) / 100;

    return {
      estimatedCefr,
      confidenceScore,
      correctCount,
      totalCount,
    };
  }
}
