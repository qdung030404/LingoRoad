import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PlacementSessionRepository } from '../repositories/placement-session.repository';
import { AssessmentItemRepository } from '../repositories/assessment-item.repository';
import { AdaptiveSequencingService } from '../services/adaptive-sequencing.service';
import {
  CefrLevel,
  StartPlacementResult,
} from '../interfaces/placement.interface';

@Injectable()
export class StartPlacementUseCase {
  private readonly logger = new Logger(StartPlacementUseCase.name);

  constructor(
    private readonly sessionRepo: PlacementSessionRepository,
    private readonly itemRepo: AssessmentItemRepository,
    private readonly adaptiveSequencing: AdaptiveSequencingService,
  ) {}

  async execute(userId: string): Promise<StartPlacementResult> {
    // 1. Kiểm tra xem người học có session đang IN_PROGRESS hay không
    const existingSession = await this.sessionRepo.findActiveByUserId(userId);
    if (existingSession) {
      this.logger.log(
        `User ${userId} resuming existing placement session: ${existingSession.id} at index ${existingSession.currentItemIndex}`,
      );

      const sessionWithResponses =
        await this.sessionRepo.findByIdWithResponses(existingSession.id);
      const responses = sessionWithResponses?.responses ?? [];
      const allItems = await this.itemRepo.findAll();

      const nextItem = await this.adaptiveSequencing.selectNextItem(
        responses,
        allItems,
        existingSession.currentItemIndex,
      );

      if (!nextItem) {
        throw new NotFoundException('NO_ASSESSMENT_ITEMS_AVAILABLE');
      }

      return {
        sessionId: existingSession.id,
        totalItems: existingSession.totalItems,
        firstItem: nextItem,
      };
    }

    // 2. Nếu chưa có, tạo phiên kiểm tra mới với 15 câu hỏi
    const newSession = await this.sessionRepo.create({
      userId,
      totalItems: 15,
    });

    // 3. Chọn câu hỏi khởi đầu (mặc định thử sức ở cấp độ A2 theo Domain Spec §7.3)
    const a2Items = await this.itemRepo.findByCefrLevel(CefrLevel.A2);
    let initialItem = a2Items.length > 0 ? a2Items[0] : null;

    if (!initialItem) {
      const allItems = await this.itemRepo.findAll();
      if (allItems.length === 0) {
        throw new NotFoundException('ASSESSMENT_ITEM_BANK_EMPTY');
      }
      initialItem = allItems[0];
    }

    const firstItemPublic = this.adaptiveSequencing.toPublic(initialItem, 0);

    this.logger.log(
      `Created new placement session ${newSession.id} for user ${userId}`,
    );

    return {
      sessionId: newSession.id,
      totalItems: newSession.totalItems,
      firstItem: firstItemPublic,
    };
  }
}
