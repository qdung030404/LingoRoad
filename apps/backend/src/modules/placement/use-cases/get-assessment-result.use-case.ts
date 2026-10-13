import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { PlacementResultDto } from '../dto/placement-result.dto';

@Injectable()
export class GetAssessmentResultUseCase {
  constructor(private readonly sessionRepo: PlacementSessionRepository) {}

  async execute(userId: string, sessionId: string): Promise<PlacementResultDto> {
    const session = await this.sessionRepo.findByIdWithResponses(sessionId);
    if (!session) {
      throw new NotFoundException('Placement session not found.');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this assessment session.');
    }

    if (session.status !== SessionStatus.COMPLETED) {
      throw new BadRequestException('Placement session is not completed yet.');
    }

    return {
      sessionId: session.id,
      status: session.status,
      estimatedCefr: session.estimatedCefr!,
      correctCount: session.correctCount,
      totalItems: session.totalItems,
      confidenceScore: session.confidenceScore,
      completedAt: session.completedAt || new Date(),
    };
  }
}
