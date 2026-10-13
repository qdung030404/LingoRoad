import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentItem, CefrLevel, ItemType, PlacementSession, SessionStatus } from '@prisma/client';
import { StartAssessmentUseCase } from './start-assessment.use-case';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { AssessmentItemRepository } from '../repositories/assessment-item.repository';
import { AdaptiveSequencingService } from '../services/adaptive-sequencing.service';

describe('StartAssessmentUseCase', () => {
  let useCase: StartAssessmentUseCase;
  let sessionRepo: jest.Mocked<PlacementSessionRepository>;
  let itemRepo: jest.Mocked<AssessmentItemRepository>;
  let adaptiveService: jest.Mocked<AdaptiveSequencingService>;

  const mockItem: AssessmentItem = {
    id: 'item-1',
    skillCode: 'grammar.verbs',
    cefrLevel: CefrLevel.A2,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'Choose the correct form',
    options: ['A', 'B', 'C', 'D'],
    correctOption: 'B',
    explanation: 'Explanation',
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
      findActiveByUserId: jest.fn(),
      findByIdWithResponses: jest.fn(),
      create: jest.fn(),
    };

    const mockItemRepo = {
      findInitialItem: jest.fn(),
    };

    const mockAdaptiveService = {
      selectNextItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartAssessmentUseCase,
        { provide: PlacementSessionRepository, useValue: mockSessionRepo },
        { provide: AssessmentItemRepository, useValue: mockItemRepo },
        { provide: AdaptiveSequencingService, useValue: mockAdaptiveService },
      ],
    }).compile();

    useCase = module.get<StartAssessmentUseCase>(StartAssessmentUseCase);
    sessionRepo = module.get(PlacementSessionRepository);
    itemRepo = module.get(AssessmentItemRepository);
    adaptiveService = module.get(AdaptiveSequencingService);
  });

  it('should create a new session and return first item when no active session exists', async () => {
    sessionRepo.findActiveByUserId.mockResolvedValue(null);
    itemRepo.findInitialItem.mockResolvedValue(mockItem);
    sessionRepo.create.mockResolvedValue(mockSession);

    const result = await useCase.execute('user-1');

    expect(result.sessionId).toBe('session-1');
    expect(result.totalItems).toBe(15);
    expect(result.firstItem.id).toBe('item-1');
    expect(result.firstItem.options).toEqual(['A', 'B', 'C', 'D']);
    expect((result.firstItem as any).correctOption).toBeUndefined(); // Zero Solution Leakage
    expect(result.isResumed).toBe(false);
  });

  it('should resume existing session when active session is found', async () => {
    sessionRepo.findActiveByUserId.mockResolvedValue(mockSession);
    sessionRepo.findByIdWithResponses.mockResolvedValue({
      ...mockSession,
      responses: [],
    } as any);
    itemRepo.findInitialItem.mockResolvedValue(mockItem);

    const result = await useCase.execute('user-1');

    expect(result.sessionId).toBe('session-1');
    expect(result.isResumed).toBe(true);
  });

  it('should throw NotFoundException when no items exist in question bank', async () => {
    sessionRepo.findActiveByUserId.mockResolvedValue(null);
    itemRepo.findInitialItem.mockResolvedValue(null);

    await expect(useCase.execute('user-1')).rejects.toThrow(NotFoundException);
  });
});
