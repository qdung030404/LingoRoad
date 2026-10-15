import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionStatus } from '@prisma/client';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { AssessmentItemRepository } from '../repositories/assessment-item.repository';
import { AssessmentResponseRepository } from '../repositories/assessment-response.repository';
import { AdaptiveSequencingService } from '../services/adaptive-sequencing.service';
import { CefrScoringService } from '../services/cefr-scoring.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitAnswerDto } from '../dto/submit-answer.dto';
import { SubmitAnswerResponseDto } from '../dto/submit-answer-response.dto';
import { PlacementCompletedEvent } from '../events/placement-completed.event';
import { toSafeItemResponse } from '../utils/item-mapper';

@Injectable()
export class SubmitAnswerUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionRepo: PlacementSessionRepository,
    private readonly itemRepo: AssessmentItemRepository,
    private readonly responseRepo: AssessmentResponseRepository,
    private readonly adaptiveService: AdaptiveSequencingService,
    private readonly scoringService: CefrScoringService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(userId: string, sessionId: string, dto: SubmitAnswerDto): Promise<SubmitAnswerResponseDto> {
    const session = await this.sessionRepo.findByIdWithResponses(sessionId);
    if (!session) {
      throw new NotFoundException('Placement session not found.');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this assessment session.');
    }

    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new BadRequestException('This assessment session is already completed or inactive.');
    }

    // Idempotency check: if answer for this index was already recorded
    const existingResponse = await this.responseRepo.findBySessionAndIndex(sessionId, dto.itemIndex);
    if (existingResponse) {
      if (session.currentItemIndex >= session.totalItems) {
        return {
          isFinished: true,
          result: {
            sessionId: session.id,
            status: session.status,
            estimatedCefr: session.estimatedCefr!,
            correctCount: session.correctCount,
            totalItems: session.totalItems,
            confidenceScore: session.confidenceScore,
            completedAt: session.completedAt || new Date(),
          },
        };
      }

      const answeredIds = session.responses.map((r) => r.itemId);
      const history = session.responses.map((r) => ({ item: r.item, isCorrect: r.isCorrect }));
      const nextItem = await this.adaptiveService.selectNextItem(history, answeredIds);
      if (nextItem) {
        return {
          isFinished: false,
          nextItem: toSafeItemResponse(nextItem, session.currentItemIndex),
        };
      }
    }

    const item = await this.itemRepo.findById(dto.itemId);
    if (!item) {
      throw new NotFoundException('Question item not found.');
    }

    const isCorrect = item.correctOption.trim().toLowerCase() === dto.selectedOption.trim().toLowerCase();

    const newCorrectCount = session.correctCount + (isCorrect ? 1 : 0);
    const nextIndex = dto.itemIndex + 1;

    await this.prisma.$transaction(async (tx) => {
      await this.responseRepo.create(
        {
          sessionId,
          itemId: dto.itemId,
          itemIndex: dto.itemIndex,
          selectedOption: dto.selectedOption,
          isCorrect,
          responseTimeMs: dto.responseTimeMs,
        },
        tx,
      );

      await this.sessionRepo.updateProgress(sessionId, nextIndex, newCorrectCount, tx);
    });

    const updatedSession = await this.sessionRepo.findByIdWithResponses(sessionId);
    const allResponses = updatedSession?.responses || [];

    // Check if session reached total items
    if (nextIndex >= session.totalItems) {
      const scoredItems = allResponses.map((r) => ({ item: r.item, isCorrect: r.isCorrect }));
      const scoreResult = this.scoringService.calculateScore(scoredItems);

      const completedSession = await this.sessionRepo.completeSession(
        sessionId,
        scoreResult.estimatedCefr,
        scoreResult.confidenceScore,
        scoreResult.correctCount,
      );

      this.eventEmitter.emit(
        'placement.completed',
        new PlacementCompletedEvent(
          userId,
          sessionId,
          scoreResult.estimatedCefr,
          scoreResult.correctCount,
          session.totalItems,
          completedSession.completedAt || new Date(),
        ),
      );

      return {
        isFinished: true,
        result: {
          sessionId: completedSession.id,
          status: completedSession.status,
          estimatedCefr: completedSession.estimatedCefr!,
          correctCount: completedSession.correctCount,
          totalItems: completedSession.totalItems,
          confidenceScore: completedSession.confidenceScore,
          completedAt: completedSession.completedAt || new Date(),
        },
      };
    }

    // Select next adaptive item
    const answeredIds = allResponses.map((r) => r.itemId);
    const history = allResponses.map((r) => ({ item: r.item, isCorrect: r.isCorrect }));
    const nextItem = await this.adaptiveService.selectNextItem(history, answeredIds);

    if (!nextItem) {
      // Early finalization if no candidates remain
      const scoredItems = allResponses.map((r) => ({ item: r.item, isCorrect: r.isCorrect }));
      const scoreResult = this.scoringService.calculateScore(scoredItems);
      const completedSession = await this.sessionRepo.completeSession(
        sessionId,
        scoreResult.estimatedCefr,
        scoreResult.confidenceScore,
        scoreResult.correctCount,
      );

      return {
        isFinished: true,
        result: {
          sessionId: completedSession.id,
          status: completedSession.status,
          estimatedCefr: completedSession.estimatedCefr!,
          correctCount: completedSession.correctCount,
          totalItems: completedSession.totalItems,
          confidenceScore: completedSession.confidenceScore,
          completedAt: completedSession.completedAt || new Date(),
        },
      };
    }

    return {
      isFinished: false,
      nextItem: toSafeItemResponse(nextItem, nextIndex),
    };
  }
}
