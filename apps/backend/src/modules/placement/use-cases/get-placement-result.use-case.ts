import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { PlacementResult } from '../interfaces/placement.interface';

@Injectable()
export class GetPlacementResultUseCase {
  constructor(private readonly sessionRepo: PlacementSessionRepository) {}

  async execute(sessionId: string, userId: string): Promise<PlacementResult> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundException('PLACEMENT_SESSION_NOT_FOUND');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('FORBIDDEN_RESOURCE');
    }

    if (!session.completedAt || !session.estimatedCefr) {
      throw new ConflictException('PLACEMENT_SESSION_NOT_COMPLETED');
    }

    return {
      sessionId: session.id,
      estimatedCefr: session.estimatedCefr,
      confidenceScore: session.confidenceScore ?? 1.0,
      correctCount: session.correctCount,
      totalItems: session.totalItems,
      completedAt: session.completedAt,
    };
  }
}
