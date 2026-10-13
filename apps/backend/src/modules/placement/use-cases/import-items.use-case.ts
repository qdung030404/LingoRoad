import { Injectable, Logger } from '@nestjs/common';
import { CefrLevel, ItemType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RawItemDto } from '../dto/import-items.dto';

export interface ImportItemsResult {
  importedCount: number;
  totalInDb: number;
}

@Injectable()
export class ImportItemsUseCase {
  private readonly logger = new Logger(ImportItemsUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(items: RawItemDto[]): Promise<ImportItemsResult> {
    if (!items || items.length === 0) {
      const totalInDb = await this.prisma.assessmentItem.count();
      return { importedCount: 0, totalInDb };
    }

    let importedCount = 0;
    for (const item of items) {
      const prompt = item.prompt || item.stem || '';
      const correctOption = item.correctOption || item.correctAnswer || '';
      if (!prompt || !correctOption) continue;

      const cefrLevel = this.mapCefrLevel(item.cefrLevel);
      const itemType = this.mapItemType(item.type);
      const irtA = item.irtA ?? item.a ?? 1.0;
      const irtB = item.irtB ?? item.b ?? 0.0;
      const irtC = item.irtC ?? item.c ?? 0.25;

      try {
        await this.prisma.assessmentItem.create({
          data: {
            skillCode: item.skillCode,
            cefrLevel,
            type: itemType,
            prompt,
            options: item.options,
            correctOption,
            explanation: item.explanation || null,
            audioUrl: item.audioUrl || null,
            irtA,
            irtB,
            irtC,
          },
        });
        importedCount++;
      } catch (err: unknown) {
        this.logger.error('Error creating assessment item in DB', err);
        throw err;
      }
    }

    const totalInDb = await this.prisma.assessmentItem.count();
    return { importedCount, totalInDb };
  }

  private mapCefrLevel(levelStr?: string): CefrLevel {
    const normalized = (levelStr || '').toUpperCase();
    if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(normalized)) {
      return normalized as CefrLevel;
    }
    return CefrLevel.A2;
  }

  private mapItemType(typeStr?: string): ItemType {
    switch (typeStr?.toLowerCase()) {
      case 'cloze':
        return ItemType.CLOZE;
      case 'sentence_reorder':
        return ItemType.SENTENCE_REORDER;
      case 'matching':
        return ItemType.MATCHING;
      case 'mcq':
      case 'multiple_choice':
      default:
        return ItemType.MULTIPLE_CHOICE;
    }
  }
}
