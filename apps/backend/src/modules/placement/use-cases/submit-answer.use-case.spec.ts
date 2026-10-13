import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentItem, CefrLevel, ItemType, PlacementSession, SessionStatus } from '@prisma/client';
import { SubmitAnswerUseCase } from './submit-answer.use-case';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { AssessmentItemRepository } from '../repositories/assessment-item.repository';
import { AssessmentResponseRepository } from '../repositories/assessment-response.repository';
import { AdaptiveSequencingService } from '../services/adaptive-sequencing.service';
import { CefrScoringService } from '../services/cefr-scoring.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SubmitAnswerUseCase', () => {
  let useCase: SubmitAnswerUseCase;
  let sessionRepo: jest.Mocked<PlacementSessionRepository>;
  let itemRepo: jest.Mocked<AssessmentItemRepository>;
  let responseRepo: jest.Mocked<AssessmentResponseRepository>;
  let adaptiveService: jest.Mocked<AdaptiveSequencingService>;
  let scoringService: jest.Mocked<CefrScoringService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let prismaMock: { $transaction: jest.Mock };

  const mockItem: AssessmentItem = {
    id: 'item-1',
    skillCode: 'grammar.verbs',
    cefrLevel: CefrLevel.A2,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'She ___ to the cinema.',
    options: ['go', 'went', 'gone', 'going'],
    correctOption: 'went',
    explanation: null,
    audioUrl: null,
    irtA: 1.0,
    irtB: 0.0,
    irtC: 0.25,
    createdAt: new Date(),
  };

  const mockSession: PlacementSession = {
    id: 'session-1',
    userId: 'user-1',
    status: SessionStatus.IN_PROGRESS,
    currentItemIndex: 0,
    totalItems: 15,
    correctCount: 0,
    estimatedCefr: null,
    confidenceScore: null,
    startedAt: new Date(),
    completedAt: null,
  };

  beforeEach(async () => {
    const mockSessionRepo = {
      findByIdWithResponses: jest.fn(),
      updateProgress: jest.fn(),
      completeSession: jest.fn(),
    };

    const mockItemRepo = {
      findById: jest.fn(),
    };

    const mockResponseRepo = {
      findBySessionAndIndex: jest.fn(),
      create: jest.fn(),
    };

    const mockAdaptiveService = {
      selectNextItem: jest.fn(),
    };

    const mockScoringService = {
      calculateScore: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitAnswerUseCase,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PlacementSessionRepository, useValue: mockSessionRepo },
        { provide: AssessmentItemRepository, useValue: mockItemRepo },
        { provide: AssessmentResponseRepository, useValue: mockResponseRepo },
        { provide: AdaptiveSequencingService, useValue: mockAdaptiveService },
        { provide: CefrScoringService, useValue: mockScoringService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    useCase = module.get<SubmitAnswerUseCase>(SubmitAnswerUseCase);
    sessionRepo = module.get(PlacementSessionRepository);
    itemRepo = module.get(AssessmentItemRepository);
    responseRepo = module.get(AssessmentResponseRepository);
    adaptiveService = module.get(AdaptiveSequencingService);
    scoringService = module.get(CefrScoringService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should throw NotFoundException if session is not found', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(null);

    await expect(
      useCase.execute('user-1', 'non-existent', {
        itemId: 'item-1',
        itemIndex: 0,
        selectedOption: 'went',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if userId does not own session', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue({
      ...mockSession,
      userId: 'other-user',
      responses: [],
    } as any);

    await expect(
      useCase.execute('user-1', 'session-1', {
        itemId: 'item-1',
        itemIndex: 0,
        selectedOption: 'went',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException if session is already completed', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue({
      ...mockSession,
      status: SessionStatus.COMPLETED,
      responses: [],
    } as any);

    await expect(
      useCase.execute('user-1', 'session-1', {
        itemId: 'item-1',
        itemIndex: 0,
        selectedOption: 'went',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should record answer and return next item when test is not yet finished', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValueOnce({
      ...mockSession,
      responses: [],
    } as any);
    responseRepo.findBySessionAndIndex.mockResolvedValue(null);
    itemRepo.findById.mockResolvedValue(mockItem);

    const nextMockItem: AssessmentItem = {
      ...mockItem,
      id: 'item-2',
      cefrLevel: CefrLevel.B1,
    };

    sessionRepo.findByIdWithResponses.mockResolvedValueOnce({
      ...mockSession,
      currentItemIndex: 1,
      correctCount: 1,
      responses: [
        {
          id: 'resp-1',
          sessionId: 'session-1',
          itemId: 'item-1',
          itemIndex: 0,
          selectedOption: 'went',
          isCorrect: true,
          responseTimeMs: 3000,
          createdAt: new Date(),
          item: mockItem,
        },
      ],
    } as any);

    adaptiveService.selectNextItem.mockResolvedValue(nextMockItem);

    const result = await useCase.execute('user-1', 'session-1', {
      itemId: 'item-1',
      itemIndex: 0,
      selectedOption: 'went',
      responseTimeMs: 3000,
    });

    expect(result.isFinished).toBe(false);
    expect(result.nextItem?.id).toBe('item-2');
    expect(result.nextItem?.index).toBe(1);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(responseRepo.create).toHaveBeenCalledWith(
      {
        sessionId: 'session-1',
        itemId: 'item-1',
        itemIndex: 0,
        selectedOption: 'went',
        isCorrect: true,
        responseTimeMs: 3000,
      },
      expect.anything(),
    );
  });

  it('should finalize test and emit placement.completed when 15th item is submitted', async () => {
    const sessionNearEnd = {
      ...mockSession,
      currentItemIndex: 14,
      totalItems: 15,
      correctCount: 10,
      responses: [],
    };

    sessionRepo.findByIdWithResponses.mockResolvedValueOnce(sessionNearEnd as any);
    responseRepo.findBySessionAndIndex.mockResolvedValue(null);
    itemRepo.findById.mockResolvedValue(mockItem);

    sessionRepo.findByIdWithResponses.mockResolvedValueOnce({
      ...sessionNearEnd,
      currentItemIndex: 15,
      correctCount: 11,
      responses: Array(15).fill({
        item: mockItem,
        isCorrect: true,
      }),
    } as any);

    scoringService.calculateScore.mockReturnValue({
      estimatedCefr: CefrLevel.B1,
      confidenceScore: 0.88,
      correctCount: 11,
      totalCount: 15,
    });

    sessionRepo.completeSession.mockResolvedValue({
      ...sessionNearEnd,
      status: SessionStatus.COMPLETED,
      estimatedCefr: CefrLevel.B1,
      confidenceScore: 0.88,
      correctCount: 11,
      completedAt: new Date(),
    } as any);

    const result = await useCase.execute('user-1', 'session-1', {
      itemId: 'item-1',
      itemIndex: 14,
      selectedOption: 'went',
    });

    expect(result.isFinished).toBe(true);
    expect(result.result?.status).toBe(SessionStatus.COMPLETED);
    expect(result.result?.estimatedCefr).toBe(CefrLevel.B1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'placement.completed',
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        estimatedCefr: CefrLevel.B1,
      }),
    );
  });
});
