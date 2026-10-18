import { Injectable } from '@nestjs/common';
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
      where: { cefrLevel },
    }) as unknown as Promise<AssessmentItem[]>;
  }

  /**
   * Tải toàn bộ item bank có cache in-memory TTL 10 phút.
   * Ngăn chặn tình trạng O(N*1000) DB queries khi nhiều người dùng làm bài đồng thời.
   */
  async findAll(): Promise<AssessmentItem[]> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.items;
    }
    const items = (await this.prisma.assessmentItem.findMany()) as unknown as AssessmentItem[];
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
