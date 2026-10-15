import { Test, TestingModule } from '@nestjs/testing';
import { CefrLevel, PlacementSession, SessionStatus } from '@prisma/client';
import { GetPlacementStatusUseCase } from './get-placement-status.use-case';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';

describe('GetPlacementStatusUseCase', () => {
  let useCase: GetPlacementStatusUseCase;
  let sessionRepo: jest.Mocked<PlacementSessionRepository>;

  const mockSession: PlacementSession = {
    id: 'session-1',
    userId: 'user-1',
    status: SessionStatus.IN_PROGRESS,
    currentItemIndex: 4,
    totalItems: 15,
    correctCount: 3,
    estimatedCefr: null,
    confidenceScore: null,
    startedAt: new Date(),
    completedAt: null,
  };

  beforeEach(async () => {
    const mockSessionRepo = {
      findActiveByUserId: jest.fn(),
      findLatestCompletedByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPlacementStatusUseCase,
        { provide: PlacementSessionRepository, useValue: mockSessionRepo },
      ],
    }).compile();

    useCase = module.get<GetPlacementStatusUseCase>(GetPlacementStatusUseCase);
    sessionRepo = module.get(PlacementSessionRepository);
  });

  it('should return in-progress status if active session exists', async () => {
    sessionRepo.findActiveByUserId.mockResolvedValue(mockSession);

    const result = await useCase.execute('user-1');

    expect(result.hasCompleted).toBe(false);
    expect(result.currentSessionId).toBe('session-1');
    expect(result.status).toBe(SessionStatus.IN_PROGRESS);
    expect(result.currentIndex).toBe(4);
    expect(result.totalItems).toBe(15);
  });

  it('should return completed status if latest completed session exists', async () => {
    sessionRepo.findActiveByUserId.mockResolvedValue(null);
    sessionRepo.findLatestCompletedByUserId.mockResolvedValue({
      ...mockSession,
      status: SessionStatus.COMPLETED,
      estimatedCefr: CefrLevel.B1,
    });

    const result = await useCase.execute('user-1');

    expect(result.hasCompleted).toBe(true);
    expect(result.status).toBe(SessionStatus.COMPLETED);
    expect(result.estimatedCefr).toBe(CefrLevel.B1);
  });

  it('should return default not-started status if no session exists', async () => {
    sessionRepo.findActiveByUserId.mockResolvedValue(null);
    sessionRepo.findLatestCompletedByUserId.mockResolvedValue(null);

    const result = await useCase.execute('user-1');

    expect(result.hasCompleted).toBe(false);
    expect(result.currentSessionId).toBeNull();
    expect(result.status).toBeNull();
  });
});
