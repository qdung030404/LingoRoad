import { GetPlacementStatusUseCase } from './get-placement-status.use-case';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import {
  CefrLevel,
  PlacementSession,
  SessionStatus,
} from '../interfaces/placement.interface';

describe('GetPlacementStatusUseCase', () => {
  let useCase: GetPlacementStatusUseCase;
  let sessionRepo: jest.Mocked<PlacementSessionRepository>;

  const USER_ID = 'user-uuid-001';
  const SESSION_ID = 'session-uuid-001';

  beforeEach(() => {
    sessionRepo = {
      findActiveByUserId: jest.fn(),
      findLatestCompletedByUserId: jest.fn(),
    } as unknown as jest.Mocked<PlacementSessionRepository>;

    useCase = new GetPlacementStatusUseCase(sessionRepo);
  });

  it('should return IN_PROGRESS status when user has an active session', async () => {
    const activeSession: PlacementSession = {
      id: SESSION_ID,
      userId: USER_ID,
      status: SessionStatus.IN_PROGRESS,
      currentItemIndex: 4,
      totalItems: 15,
      correctCount: 3,
      estimatedCefr: null,
      confidenceScore: null,
      startedAt: new Date(),
      completedAt: null,
    };
    sessionRepo.findActiveByUserId.mockResolvedValue(activeSession);

    const result = await useCase.execute(USER_ID);

    expect(result.hasCompleted).toBe(false);
    expect(result.currentSessionId).toBe(SESSION_ID);
    expect(result.status).toBe(SessionStatus.IN_PROGRESS);
    expect(result.currentIndex).toBe(4);
    expect(result.totalItems).toBe(15);
  });

  it('should return completed status when user has completed a session previously', async () => {
    sessionRepo.findActiveByUserId.mockResolvedValue(null);
    const completedSession: PlacementSession = {
      id: SESSION_ID,
      userId: USER_ID,
      status: SessionStatus.COMPLETED,
      currentItemIndex: 15,
      totalItems: 15,
      correctCount: 12,
      estimatedCefr: CefrLevel.B1,
      confidenceScore: 0.88,
      startedAt: new Date(),
      completedAt: new Date(),
    };
    sessionRepo.findLatestCompletedByUserId.mockResolvedValue(completedSession);

    const result = await useCase.execute(USER_ID);

    expect(result.hasCompleted).toBe(true);
    expect(result.currentSessionId).toBe(SESSION_ID);
    expect(result.status).toBe(SessionStatus.COMPLETED);
    expect(result.currentIndex).toBe(15);
  });

  it('should return not started status when user has never taken a placement test', async () => {
    sessionRepo.findActiveByUserId.mockResolvedValue(null);
    sessionRepo.findLatestCompletedByUserId.mockResolvedValue(null);

    const result = await useCase.execute(USER_ID);

    expect(result.hasCompleted).toBe(false);
    expect(result.currentSessionId).toBeNull();
    expect(result.status).toBeNull();
    expect(result.currentIndex).toBe(0);
  });
});
