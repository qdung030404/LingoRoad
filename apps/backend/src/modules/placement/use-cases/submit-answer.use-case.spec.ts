import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubmitAnswerUseCase } from './submit-answer.use-case';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { AssessmentItemRepository } from '../repositories/assessment-item.repository';
import { AssessmentResponseRepository } from '../repositories/assessment-response.repository';
import { AdaptiveSequencingService } from '../services/adaptive-sequencing.service';
import { CefrScoringService } from '../services/cefr-scoring.service';
import {
  AssessmentItem,
  AssessmentItemPublic,
  AssessmentResponse,
  CefrLevel,
  ItemType,
  PlacementSessionWithResponses,
  SessionStatus,
  SubmitAnswerDto,
} from '../interfaces/placement.interface';

describe('SubmitAnswerUseCase', () => {
  let useCase: SubmitAnswerUseCase;
  let sessionRepo: jest.Mocked<PlacementSessionRepository>;
  let itemRepo: jest.Mocked<AssessmentItemRepository>;
  let responseRepo: jest.Mocked<AssessmentResponseRepository>;
  let adaptiveSequencing: jest.Mocked<AdaptiveSequencingService>;
  let cefrScoring: jest.Mocked<CefrScoringService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  // ─── Fixtures ────────────────────────────────────────────────────────────────

  const SESSION_ID = 'session-uuid-001';
  const USER_ID = 'user-uuid-001';
  const ITEM_ID = 'item-uuid-001';

  const mockItem: AssessmentItem = {
    id: ITEM_ID,
    skillCode: 'grammar-present-simple',
    prompt: 'She ___ like tea.',
    type: ItemType.MULTIPLE_CHOICE,
    options: ["don't", "doesn't", 'not'],
    correctOption: "doesn't",
    explanation: null,
    cefrLevel: CefrLevel.A2,
    irtA: 1.0,
    irtB: 0.0,
    irtC: 0.25,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockSession = (
    overrides: Partial<PlacementSessionWithResponses> = {},
  ): PlacementSessionWithResponses => ({
    id: SESSION_ID,
    userId: USER_ID,
    status: SessionStatus.IN_PROGRESS,
    currentItemIndex: 0,
    totalItems: 3,
    correctCount: 0,
    estimatedCefr: null,
    confidenceScore: null,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    completedAt: null,
    responses: [],
    ...overrides,
  });

  const mockPublicItem: AssessmentItemPublic = {
    id: 'item-uuid-002',
    index: 1,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'Next question?',
    options: ['A', 'B', 'C'],
    mediaUrl: null,
  };

  const mockResponse: AssessmentResponse = {
    id: 'resp-uuid-001',
    sessionId: SESSION_ID,
    itemId: ITEM_ID,
    itemIndex: 0,
    selectedOption: "doesn't",
    isCorrect: true,
    responseTimeMs: 3500,
    createdAt: new Date(),
  };

  const validDto: SubmitAnswerDto = {
    itemId: ITEM_ID,
    itemIndex: 0,
    selectedOption: "doesn't",
    responseTimeMs: 3500,
  };

  // ─── Setup ────────────────────────────────────────────────────────────────────

  /**
   * Helper tạo mock transaction: prisma.$transaction() gọi callback với tx mock
   * và trả về kết quả của callback.
   */
  const mockPrismaTransaction = (
    sessionResult: Partial<PlacementSessionWithResponses> = {},
  ): void => {
    const updated = {
      ...mockSession(),
      ...sessionResult,
    };
    responseRepo.existsBySessionAndIndex.mockResolvedValue(false);
    responseRepo.create.mockResolvedValue(mockResponse);
    sessionRepo.incrementProgress.mockResolvedValue(
      updated as unknown as PlacementSessionWithResponses,
    );

    (sessionRepo.prisma as unknown as { $transaction: jest.Mock }).$transaction =
      jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));
  };

  beforeEach(() => {
    sessionRepo = {
      findByIdWithResponses: jest.fn(),
      incrementProgress: jest.fn(),
      markAsCompleted: jest.fn(),
      prisma: {
        $transaction: jest.fn(),
      },
    } as unknown as jest.Mocked<PlacementSessionRepository>;

    itemRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<AssessmentItemRepository>;

    responseRepo = {
      existsBySessionAndIndex: jest.fn(),
      create: jest.fn(),
      findBySessionId: jest.fn(),
      prisma: {},
    } as unknown as jest.Mocked<AssessmentResponseRepository>;

    adaptiveSequencing = {
      selectNextItem: jest.fn(),
    } as unknown as jest.Mocked<AdaptiveSequencingService>;

    cefrScoring = {
      evaluateAnswer: jest.fn(),
      calculate: jest.fn(),
    } as unknown as jest.Mocked<CefrScoringService>;

    eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EventEmitter2>;

    useCase = new SubmitAnswerUseCase(
      sessionRepo,
      itemRepo,
      responseRepo,
      adaptiveSequencing,
      cefrScoring,
      eventEmitter,
    );
  });

  // ─── Tests: guard checks (before transaction) ─────────────────────────────────

  it('should throw NotFoundException when session does not exist', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(null);

    await expect(useCase.execute(SESSION_ID, validDto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw ConflictException when session is COMPLETED', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(
      mockSession({ status: SessionStatus.COMPLETED }),
    );

    await expect(useCase.execute(SESSION_ID, validDto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw ConflictException when session is ABANDONED', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(
      mockSession({ status: SessionStatus.ABANDONED }),
    );

    await expect(useCase.execute(SESSION_ID, validDto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw NotFoundException when item does not exist', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(mockSession());
    itemRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(SESSION_ID, validDto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException when itemIndex does not match currentItemIndex', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(
      mockSession({ currentItemIndex: 1 }),
    );
    itemRepo.findById.mockResolvedValue(mockItem);

    const wrongIndexDto: SubmitAnswerDto = { ...validDto, itemIndex: 0 };
    await expect(useCase.execute(SESSION_ID, wrongIndexDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw ConflictException when item is already answered (idempotency race condition check)', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(mockSession());
    itemRepo.findById.mockResolvedValue(mockItem);
    cefrScoring.evaluateAnswer.mockReturnValue(true);

    responseRepo.existsBySessionAndIndex.mockResolvedValue(true);
    (sessionRepo.prisma as unknown as { $transaction: jest.Mock }).$transaction =
      jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({}));

    await expect(useCase.execute(SESSION_ID, validDto)).rejects.toThrow(
      ConflictException,
    );
    expect(responseRepo.create).not.toHaveBeenCalled();
    expect(sessionRepo.incrementProgress).not.toHaveBeenCalled();
  });

  it('should sanitize negative responseTimeMs to undefined when saving response', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(mockSession());
    itemRepo.findById.mockResolvedValue(mockItem);
    cefrScoring.evaluateAnswer.mockReturnValue(true);
    mockPrismaTransaction({ currentItemIndex: 1, correctCount: 1 });
    itemRepo.findAll.mockResolvedValue([mockItem]);
    adaptiveSequencing.selectNextItem.mockResolvedValue(mockPublicItem);

    const negativeTimeDto: SubmitAnswerDto = { ...validDto, responseTimeMs: -500 };
    await useCase.execute(SESSION_ID, negativeTimeDto);

    expect(responseRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        responseTimeMs: undefined,
      }),
      expect.anything(),
    );
  });

  // ─── Tests: mid-session (not finished) ───────────────────────────────────────

  it('should return nextItem when session is not yet finished', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(mockSession());
    itemRepo.findById.mockResolvedValue(mockItem);
    cefrScoring.evaluateAnswer.mockReturnValue(true);
    mockPrismaTransaction({ currentItemIndex: 1, correctCount: 1 });
    itemRepo.findAll.mockResolvedValue([mockItem]);
    adaptiveSequencing.selectNextItem.mockResolvedValue(mockPublicItem);

    const result = await useCase.execute(SESSION_ID, validDto);

    expect(result.isFinished).toBe(false);
    expect(result.nextItem).toEqual(mockPublicItem);
    expect(result.result).toBeNull();
    expect(sessionRepo.markAsCompleted).not.toHaveBeenCalled();
    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('should return { isFinished: false, nextItem: null } when item bank is exhausted', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(mockSession());
    itemRepo.findById.mockResolvedValue(mockItem);
    cefrScoring.evaluateAnswer.mockReturnValue(true);
    mockPrismaTransaction({ currentItemIndex: 1, correctCount: 1 });
    itemRepo.findAll.mockResolvedValue([mockItem]);
    // selectNextItem returns null when no candidates remain
    adaptiveSequencing.selectNextItem.mockResolvedValue(null);

    const result = await useCase.execute(SESSION_ID, validDto);

    expect(result.isFinished).toBe(false);
    expect(result.nextItem).toBeNull();
  });

  // ─── Tests: session finalization ──────────────────────────────────────────────

  it('should finalize session and emit PlacementCompletedEvent when last answer is submitted', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(
      mockSession({ totalItems: 1 }),
    );
    itemRepo.findById.mockResolvedValue(mockItem);
    cefrScoring.evaluateAnswer.mockReturnValue(true);
    mockPrismaTransaction({ currentItemIndex: 1, correctCount: 1, totalItems: 1 });
    cefrScoring.calculate.mockReturnValue({
      estimatedCefr: CefrLevel.B1,
      confidenceScore: 1.0,
    });
    const completedSession = {
      ...mockSession({ totalItems: 1 }),
      status: SessionStatus.COMPLETED,
      estimatedCefr: CefrLevel.B1,
      confidenceScore: 1.0,
      completedAt: new Date(),
    };
    sessionRepo.markAsCompleted.mockResolvedValue(completedSession);

    const result = await useCase.execute(SESSION_ID, validDto);

    expect(result.isFinished).toBe(true);
    expect(result.nextItem).toBeNull();
    expect(result.result?.estimatedCefr).toBe(CefrLevel.B1);
    expect(result.result?.confidenceScore).toBe(1.0);
    expect(sessionRepo.markAsCompleted).toHaveBeenCalledWith(
      SESSION_ID,
      CefrLevel.B1,
      1.0,
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'placement.completed',
      expect.objectContaining({
        userId: USER_ID,
        sessionId: SESSION_ID,
        estimatedCefr: CefrLevel.B1,
      }),
    );
  });
});
