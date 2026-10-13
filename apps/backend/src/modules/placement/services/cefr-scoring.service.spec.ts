import { CefrLevel, AssessmentItem, ItemType } from '@prisma/client';
import { CefrScoringService, ScoredResponse } from './cefr-scoring.service';

describe('CefrScoringService', () => {
  let service: CefrScoringService;

  beforeEach(() => {
    service = new CefrScoringService();
  });

  const createMockItem = (cefrLevel: CefrLevel): AssessmentItem => ({
    id: 'item-uuid',
    skillCode: 'grammar.test',
    cefrLevel,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'Sample question',
    options: ['A', 'B', 'C', 'D'],
    correctOption: 'A',
    explanation: null,
    audioUrl: null,
    irtA: 1.0,
    irtB: 0.0,
    irtC: 0.25,
    createdAt: new Date(),
  });

  it('should return A1 if response array is empty', () => {
    const result = service.calculateScore([]);
    expect(result.estimatedCefr).toBe(CefrLevel.A1);
    expect(result.confidenceScore).toBe(0.5);
    expect(result.correctCount).toBe(0);
  });

  it('should classify as A1 when accuracy is below 40%', () => {
    const responses: ScoredResponse[] = [
      { item: createMockItem(CefrLevel.A1), isCorrect: true },
      { item: createMockItem(CefrLevel.A1), isCorrect: false },
      { item: createMockItem(CefrLevel.A2), isCorrect: false },
      { item: createMockItem(CefrLevel.A2), isCorrect: false },
      { item: createMockItem(CefrLevel.B1), isCorrect: false },
    ];
    const result = service.calculateScore(responses);
    expect(result.estimatedCefr).toBe(CefrLevel.A1);
    expect(result.correctCount).toBe(1);
  });

  it('should classify as A2 when ability is between 40% and 65%', () => {
    const responses: ScoredResponse[] = [
      { item: createMockItem(CefrLevel.A1), isCorrect: true },
      { item: createMockItem(CefrLevel.A2), isCorrect: true },
      { item: createMockItem(CefrLevel.A2), isCorrect: false },
      { item: createMockItem(CefrLevel.B1), isCorrect: false },
    ];
    const result = service.calculateScore(responses);
    expect(result.estimatedCefr).toBe(CefrLevel.A2);
  });

  it('should classify as B1 when ability is between 65% and 85%', () => {
    const responses: ScoredResponse[] = [
      { item: createMockItem(CefrLevel.A1), isCorrect: true },
      { item: createMockItem(CefrLevel.A2), isCorrect: true },
      { item: createMockItem(CefrLevel.B1), isCorrect: true },
      { item: createMockItem(CefrLevel.B1), isCorrect: true },
      { item: createMockItem(CefrLevel.B2), isCorrect: false },
    ];
    const result = service.calculateScore(responses);
    expect(result.estimatedCefr).toBe(CefrLevel.B1);
  });

  it('should classify as B2 when ability is 85% or higher', () => {
    const responses: ScoredResponse[] = [
      { item: createMockItem(CefrLevel.A2), isCorrect: true },
      { item: createMockItem(CefrLevel.B1), isCorrect: true },
      { item: createMockItem(CefrLevel.B2), isCorrect: true },
      { item: createMockItem(CefrLevel.B2), isCorrect: true },
    ];
    const result = service.calculateScore(responses);
    expect(result.estimatedCefr).toBe(CefrLevel.B2);
    expect(result.confidenceScore).toBeGreaterThan(0.7);
  });
});
