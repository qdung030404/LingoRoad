import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { AssessmentItemRepository } from '../repositories/assessment-item.repository';
import { AssessmentResponseRepository } from '../repositories/assessment-response.repository';
import { AdaptiveSequencingService } from '../services/adaptive-sequencing.service';
import { CefrScoringService } from '../services/cefr-scoring.service';
import {
  AssessmentResponse,
  SessionStatus,
  SubmitAnswerDto,
  SubmitAnswerResult,
} from '../interfaces/placement.interface';
import { PlacementCompletedEvent } from '../events/placement-completed.event';

@Injectable()
export class SubmitAnswerUseCase {
  private readonly logger = new Logger(SubmitAnswerUseCase.name);

  constructor(
    private readonly sessionRepo: PlacementSessionRepository,
    private readonly itemRepo: AssessmentItemRepository,
    private readonly responseRepo: AssessmentResponseRepository,
    private readonly adaptiveSequencing: AdaptiveSequencingService,
    private readonly cefrScoring: CefrScoringService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    sessionId: string,
    dto: SubmitAnswerDto,
  ): Promise<SubmitAnswerResult> {
    // 1. Load session với responses (đã có sẵn — tránh query thêm ở finalizeSession)
    const session = await this.sessionRepo.findByIdWithResponses(sessionId);
    if (!session) {
      throw new NotFoundException('PLACEMENT_SESSION_NOT_FOUND');
    }

    // 2. Guard: session phải đang IN_PROGRESS
    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new ConflictException('PLACEMENT_SESSION_ALREADY_COMPLETED');
    }

    // 3. Load và validate item trước transaction
    const item = await this.itemRepo.findById(dto.itemId);
    if (!item) {
      throw new NotFoundException('ASSESSMENT_ITEM_NOT_FOUND');
    }

    if (dto.itemIndex !== session.currentItemIndex) {
      throw new BadRequestException('PLACEMENT_INVALID_ITEM_INDEX');
    }

    // 4. Chấm điểm (pure function — không cần DB)
    const isCorrect = this.cefrScoring.evaluateAnswer(
      item.correctOption,
      dto.selectedOption,
    );

    // Sanitize responseTimeMs (không chấp nhận giá trị âm)
    const sanitizedResponseTimeMs =
      typeof dto.responseTimeMs === 'number' && dto.responseTimeMs >= 0
        ? dto.responseTimeMs
        : undefined;

    // 5. CRITICAL FIX: Atomic transaction — idempotency check + write trong cùng 1 tx
    //    Ngăn race condition khi client retry đồng thời (mobile network flakiness).
    let updatedSession: { currentItemIndex: number; correctCount: number; totalItems: number };
    let savedResponses: AssessmentResponse[];

    try {
      const txResult = await this.sessionRepo.prisma.$transaction(async (tx) => {
        // Idempotency check bên trong tx — đảm bảo isolation
        const alreadyAnswered = await this.responseRepo.existsBySessionAndIndex(
          sessionId,
          dto.itemIndex,
          tx,
        );
        if (alreadyAnswered) {
          throw new ConflictException('PLACEMENT_ANSWER_ALREADY_SUBMITTED');
        }

        // Ghi response
        await this.responseRepo.create(
          {
            sessionId,
            itemId: dto.itemId,
            itemIndex: dto.itemIndex,
            selectedOption: dto.selectedOption,
            isCorrect,
            responseTimeMs: sanitizedResponseTimeMs,
          },
          tx,
        );

        // Cập nhật tiến độ session
        const updated = await this.sessionRepo.incrementProgress(
          sessionId,
          isCorrect,
          tx,
        );

        return updated;
      });

      updatedSession = txResult;
      // HIGH FIX: Tái dùng responses từ session đã load (tránh double query)
      savedResponses = [
        ...session.responses,
        {
          id: 'tx-local',
          sessionId,
          itemId: dto.itemId,
          itemIndex: dto.itemIndex,
          selectedOption: dto.selectedOption,
          isCorrect,
          responseTimeMs: dto.responseTimeMs ?? null,
          createdAt: new Date(),
        },
      ];
    } catch (err) {
      if (err instanceof ConflictException || err instanceof NotFoundException) {
        throw err;
      }
      throw err;
    }

    const newIndex = updatedSession.currentItemIndex;
    const isFinished = newIndex >= session.totalItems;

    if (isFinished) {
      return this.finalizeSession(
        session.id,
        session.userId,
        updatedSession,
        savedResponses,
      );
    }

    // 6. Chọn câu hỏi kế tiếp — AdaptiveSequencingService xử lý cache item bank
    const allItems = await this.itemRepo.findAll();
    const nextItem = await this.adaptiveSequencing.selectNextItem(
      savedResponses,
      allItems,
      newIndex,
    );

    return { isFinished: false, nextItem, result: null };
  }

  /**
   * HIGH FIX: Nhận responses đã có sẵn thay vì query lại DB lần 2.
   */
  private async finalizeSession(
    sessionId: string,
    userId: string,
    updatedSession: { correctCount: number; totalItems: number },
    responses: AssessmentResponse[],
  ): Promise<SubmitAnswerResult> {
    const { estimatedCefr, confidenceScore } = this.cefrScoring.calculate(
      responses,
      updatedSession.totalItems,
    );

    const completed = await this.sessionRepo.markAsCompleted(
      sessionId,
      estimatedCefr,
      confidenceScore,
    );

    // MEDIUM FIX: Dùng emitAsync để không block HTTP response
    void this.eventEmitter.emitAsync(
      'placement.completed',
      new PlacementCompletedEvent(
        userId,
        sessionId,
        estimatedCefr,
        confidenceScore,
        updatedSession.correctCount,
        updatedSession.totalItems,
      ),
    );

    this.logger.log(
      `Placement completed for user ${userId}: ${estimatedCefr} (confidence=${confidenceScore.toFixed(2)})`,
    );

    return {
      isFinished: true,
      nextItem: null,
      result: {
        sessionId,
        estimatedCefr,
        confidenceScore,
        correctCount: updatedSession.correctCount,
        totalItems: updatedSession.totalItems,
        completedAt: completed.completedAt ?? new Date(),
      },
    };
  }
}
