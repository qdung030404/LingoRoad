import { Injectable } from '@nestjs/common';
import { ItemType, ItemUsageScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AssessmentItem, CefrLevel } from '../interfaces/placement.interface';

@Injectable()
export class AssessmentItemRepository {
  private cache: { items: AssessmentItem[]; expiresAt: number } | null = null;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(private readonly prisma: PrismaService) {}

  async findById(itemId: string): Promise<AssessmentItem | null> {
    return this.prisma.assessmentItem.findUnique({
      where: { id: itemId },
    }) as Promise<AssessmentItem | null>;
  }

  async findByCefrLevel(cefrLevel: CefrLevel): Promise<AssessmentItem[]> {
    return this.prisma.assessmentItem.findMany({
      where: {
        cefrLevel,
        groupId: null,
        correctOption: { not: null },
        usageScope: { in: [ItemUsageScope.PLACEMENT, ItemUsageScope.ALL] },
        type: {
          in: [
            ItemType.MULTIPLE_CHOICE,
            ItemType.CLOZE,
            ItemType.SENTENCE_REORDER,
            ItemType.MATCHING,
          ],
        },
      },
    }) as unknown as Promise<AssessmentItem[]>;
  }

  /**
   * Tải toàn bộ item bank dùng cho Placement có cache in-memory TTL 10 phút.
   * Chỉ lấy các câu hỏi đơn lẻ (groupId: null) có đáp án (correctOption !== null),
   * có usageScope là PLACEMENT hoặc ALL, loại trừ các dạng tự luận (ESSAY, SPEAKING_PROMPT)
   * và các câu hỏi con phụ thuộc bài đọc/nghe chùm (Stimulus Isolation Policy).
   */
  async findAll(): Promise<AssessmentItem[]> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.items;
    }
    const items = (await this.prisma.assessmentItem.findMany({
      where: {
        groupId: null,
        correctOption: { not: null },
        usageScope: { in: [ItemUsageScope.PLACEMENT, ItemUsageScope.ALL] },
        type: {
          in: [
            ItemType.MULTIPLE_CHOICE,
            ItemType.CLOZE,
            ItemType.SENTENCE_REORDER,
            ItemType.MATCHING,
          ],
        },
      },
    })) as unknown as AssessmentItem[];
    this.cache = { items, expiresAt: now + this.CACHE_TTL_MS };
    return items;
  }

  /**
   * Xóa cache in-memory (dùng cho test hoặc khi CMS cập nhật item bank).
   */
  clearCache(): void {
    this.cache = null;
  }

  async findManyByIds(ids: string[]): Promise<AssessmentItem[]> {
    return this.prisma.assessmentItem.findMany({
      where: { id: { in: ids } },
    }) as unknown as Promise<AssessmentItem[]>;
  }
}
