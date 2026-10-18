import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GetPlacementResultUseCase } from './get-placement-result.use-case';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import {
  CefrLevel,
  PlacementSession,
  SessionStatus,
} from '../interfaces/placement.interface';

describe('GetPlacementResultUseCase', () => {
  let useCase: GetPlacementResultUseCase;
  let sessionRepo: jest.Mocked<PlacementSessionRepository>;

  const USER_ID = 'user-uuid-001';
  const OTHER_USER_ID = 'user-uuid-002';
  const SESSION_ID = 'session-uuid-001';

  beforeEach(() => {
    sessionRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<PlacementSessionRepository>;

    useCase = new GetPlacementResultUseCase(sessionRepo);
  });

  it('should throw NotFoundException when session does not exist', async () => {
    sessionRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(SESSION_ID, USER_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw ForbiddenException when user is not the session owner', async () => {
    const session: PlacementSession = {
      id: SESSION_ID,
      userId: OTHER_USER_ID,
      status: SessionStatus.COMPLETED,
      currentItemIndex: 15,
      totalItems: 15,
      correctCount: 12,
      estimatedCefr: CefrLevel.B1,
      confidenceScore: 0.9,
      startedAt: new Date(),
      completedAt: new Date(),
    };
    sessionRepo.findById.mockResolvedValue(session);

    await expect(useCase.execute(SESSION_ID, USER_ID)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should throw ConflictException when session is not yet completed', async () => {
    const session: PlacementSession = {
      id: SESSION_ID,
      userId: USER_ID,
      status: SessionStatus.IN_PROGRESS,
      currentItemIndex: 5,
      totalItems: 15,
      correctCount: 4,
      estimatedCefr: null,
      confidenceScore: null,
      startedAt: new Date(),
      completedAt: null,
    };
    sessionRepo.findById.mockResolvedValue(session);

    await expect(useCase.execute(SESSION_ID, USER_ID)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should return PlacementResult when session is completed and owned by user', async () => {
    const completedAt = new Date();
    const session: PlacementSession = {
      id: SESSION_ID,
      userId: USER_ID,
      status: SessionStatus.COMPLETED,
      currentItemIndex: 15,
      totalItems: 15,
      correctCount: 12,
      estimatedCefr: CefrLevel.B1,
      confidenceScore: 0.88,
      startedAt: new Date(),
      completedAt,
    };
    sessionRepo.findById.mockResolvedValue(session);

    const result = await useCase.execute(SESSION_ID, USER_ID);

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.estimatedCefr).toBe(CefrLevel.B1);
    expect(result.confidenceScore).toBe(0.88);
    expect(result.correctCount).toBe(12);
    expect(result.totalItems).toBe(15);
    expect(result.completedAt).toEqual(completedAt);
  });
});
