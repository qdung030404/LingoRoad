import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CefrLevel, PlacementSession, SessionStatus } from '@prisma/client';
import { GetAssessmentResultUseCase } from './get-assessment-result.use-case';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';

describe('GetAssessmentResultUseCase', () => {
  let useCase: GetAssessmentResultUseCase;
  let sessionRepo: jest.Mocked<PlacementSessionRepository>;

  const mockCompletedSession: PlacementSession = {
    id: 'session-1',
    userId: 'user-1',
    status: SessionStatus.COMPLETED,
    currentItemIndex: 15,
    totalItems: 15,
    correctCount: 12,
    estimatedCefr: CefrLevel.B1,
    confidenceScore: 0.88,
    startedAt: new Date(),
    completedAt: new Date(),
  };

  beforeEach(async () => {
    const mockSessionRepo = {
      findByIdWithResponses: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAssessmentResultUseCase,
        { provide: PlacementSessionRepository, useValue: mockSessionRepo },
      ],
    }).compile();

    useCase = module.get<GetAssessmentResultUseCase>(GetAssessmentResultUseCase);
    sessionRepo = module.get(PlacementSessionRepository);
  });

  it('should return result if session is completed and owned by user', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue({
      ...mockCompletedSession,
      responses: [],
    } as any);

    const result = await useCase.execute('user-1', 'session-1');

    expect(result.sessionId).toBe('session-1');
    expect(result.status).toBe(SessionStatus.COMPLETED);
    expect(result.estimatedCefr).toBe(CefrLevel.B1);
    expect(result.correctCount).toBe(12);
  });

  it('should throw NotFoundException if session does not exist', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'non-existent')).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if user does not own session', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue({
      ...mockCompletedSession,
      userId: 'other-user',
      responses: [],
    } as any);

    await expect(useCase.execute('user-1', 'session-1')).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException if session is not yet completed', async () => {
    sessionRepo.findByIdWithResponses.mockResolvedValue({
      ...mockCompletedSession,
      status: SessionStatus.IN_PROGRESS,
      responses: [],
    } as any);

    await expect(useCase.execute('user-1', 'session-1')).rejects.toThrow(BadRequestException);
  });
});
