import { NotFoundException } from '@nestjs/common';
import { StartPlacementUseCase } from './start-placement.use-case';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { AssessmentItemRepository } from '../repositories/assessment-item.repository';
import { AdaptiveSequencingService } from '../services/adaptive-sequencing.service';
import {
  AssessmentItem,
  AssessmentItemPublic,
  CefrLevel,
  ItemType,
  PlacementSession,
  PlacementSessionWithResponses,
  SessionStatus,
} from '../interfaces/placement.interface';

describe('StartPlacementUseCase', () => {
  let useCase: StartPlacementUseCase;
  let sessionRepo: jest.Mocked<PlacementSessionRepository>;
  let itemRepo: jest.Mocked<AssessmentItemRepository>;
  let adaptiveSequencing: jest.Mocked<AdaptiveSequencingService>;

  const USER_ID = 'user-uuid-001';
  const SESSION_ID = 'session-uuid-001';

  const mockItem: AssessmentItem = {
    id: 'item-uuid-001',
    skillCode: 'grammar-past-simple',
    cefrLevel: CefrLevel.A2,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'Yesterday they ___ home.',
    options: ['go', 'went', 'gone'],
    correctOption: 'went',
    explanation: null,
    irtA: 1.0,
    irtB: 0.0,
    irtC: 0.25,
    createdAt: new Date(),
  };

  const mockPublicItem: AssessmentItemPublic = {
    id: 'item-uuid-001',
    index: 0,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'Yesterday they ___ home.',
    options: ['go', 'went', 'gone'],
    mediaUrl: null,
  };

  beforeEach(() => {
    sessionRepo = {
      findActiveByUserId: jest.fn(),
      findByIdWithResponses: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<PlacementSessionRepository>;

    itemRepo = {
      findByCefrLevel: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<AssessmentItemRepository>;

    adaptiveSequencing = {
      selectNextItem: jest.fn(),
      toPublic: jest.fn(),
    } as unknown as jest.Mocked<AdaptiveSequencingService>;

    useCase = new StartPlacementUseCase(
      sessionRepo,
      itemRepo,
      adaptiveSequencing,
    );
  });

  it('should resume existing IN_PROGRESS session if found', async () => {
    const existingSession: PlacementSession = {
      id: SESSION_ID,
      userId: USER_ID,
      status: SessionStatus.IN_PROGRESS,
      currentItemIndex: 2,
      totalItems: 15,
      correctCount: 1,
      estimatedCefr: null,
      confidenceScore: null,
      startedAt: new Date(),
      completedAt: null,
    };

    const sessionWithResponses: PlacementSessionWithResponses = {
      ...existingSession,
      responses: [],
    };

    sessionRepo.findActiveByUserId.mockResolvedValue(existingSession);
    sessionRepo.findByIdWithResponses.mockResolvedValue(sessionWithResponses);
    itemRepo.findAll.mockResolvedValue([mockItem]);
    adaptiveSequencing.selectNextItem.mockResolvedValue(mockPublicItem);

    const result = await useCase.execute(USER_ID);

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.firstItem).toEqual(mockPublicItem);
    expect(sessionRepo.create).not.toHaveBeenCalled();
  });

  it('should create new session with 15 items when no active session exists', async () => {
    sessionRepo.findActiveByUserId.mockResolvedValue(null);
    const newSession: PlacementSession = {
      id: SESSION_ID,
      userId: USER_ID,
      status: SessionStatus.IN_PROGRESS,
      currentItemIndex: 0,
      totalItems: 15,
      correctCount: 0,
      estimatedCefr: null,
      confidenceScore: null,
      startedAt: new Date(),
      completedAt: null,
    };
    sessionRepo.create.mockResolvedValue(newSession);
    itemRepo.findByCefrLevel.mockResolvedValue([mockItem]);
    adaptiveSequencing.toPublic.mockReturnValue(mockPublicItem);

    const result = await useCase.execute(USER_ID);

    expect(sessionRepo.create).toHaveBeenCalledWith({
      userId: USER_ID,
      totalItems: 15,
    });
    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.totalItems).toBe(15);
    expect(result.firstItem).toEqual(mockPublicItem);
  });

  it('should throw NotFoundException when item bank is completely empty', async () => {
    sessionRepo.findActiveByUserId.mockResolvedValue(null);
    sessionRepo.create.mockResolvedValue({
      id: SESSION_ID,
      userId: USER_ID,
      status: SessionStatus.IN_PROGRESS,
      currentItemIndex: 0,
      totalItems: 15,
      correctCount: 0,
      estimatedCefr: null,
      confidenceScore: null,
      startedAt: new Date(),
      completedAt: null,
    });
    itemRepo.findByCefrLevel.mockResolvedValue([]);
    itemRepo.findAll.mockResolvedValue([]);

    await expect(useCase.execute(USER_ID)).rejects.toThrow(NotFoundException);
  });
});
