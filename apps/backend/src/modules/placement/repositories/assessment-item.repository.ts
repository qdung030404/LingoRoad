import { Injectable } from '@nestjs/common';
import { AssessmentItem, CefrLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssessmentItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AssessmentItem | null> {
    return this.prisma.assessmentItem.findUnique({
      where: { id },
    });
  }

  async findInitialItem(): Promise<AssessmentItem | null> {
    const a2Items = await this.prisma.assessmentItem.findMany({
      where: { cefrLevel: CefrLevel.A2 },
      take: 20,
    });

    if (a2Items.length > 0) {
      const randomIndex = Math.floor(Math.random() * a2Items.length);
      return a2Items[randomIndex];
    }

    // Fallback: any item
    return this.prisma.assessmentItem.findFirst();
  }

  async findCandidatesExcluding(excludedItemIds: string[], limit = 50): Promise<AssessmentItem[]> {
    return this.prisma.assessmentItem.findMany({
      where: {
        id: {
          notIn: excludedItemIds,
        },
      },
      take: limit,
    });
  }

  async count(): Promise<number> {
    return this.prisma.assessmentItem.count();
  }
}
