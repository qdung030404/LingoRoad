import { Test, TestingModule } from '@nestjs/testing';
import { CefrLevel, ItemType } from '@prisma/client';
import { ImportItemsUseCase } from './import-items.use-case';
import { PrismaService } from '../../prisma/prisma.service';
import { RawItemDto } from '../dto/import-items.dto';

describe('ImportItemsUseCase', () => {
  let useCase: ImportItemsUseCase;
  let prismaMock: {
    assessmentItem: {
      count: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      assessmentItem: {
        count: jest.fn().mockResolvedValue(10),
        create: jest.fn().mockResolvedValue({ id: 'item-new-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportItemsUseCase,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    useCase = module.get<ImportItemsUseCase>(ImportItemsUseCase);
  });

  it('should return 0 imported count if empty array provided', async () => {
    const result = await useCase.execute([]);
    expect(result).toEqual({ importedCount: 0, totalInDb: 10 });
    expect(prismaMock.assessmentItem.create).not.toHaveBeenCalled();
    expect(prismaMock.assessmentItem.count).toHaveBeenCalledTimes(1);
  });

  it('should skip items missing prompt or correctOption', async () => {
    const items: RawItemDto[] = [
      {
        skillCode: 'grammar.verbs',
        cefrLevel: 'a2',
        prompt: '',
        correctOption: 'went',
        options: ['go', 'went'],
      },
      {
        skillCode: 'grammar.verbs',
        cefrLevel: 'a2',
        prompt: 'She ___ yesterday.',
        correctOption: '',
        options: ['go', 'went'],
      },
    ];

    const result = await useCase.execute(items);
    expect(result.importedCount).toBe(0);
    expect(prismaMock.assessmentItem.create).not.toHaveBeenCalled();
  });

  it('should import items correctly and map CEFR levels and question types', async () => {
    prismaMock.assessmentItem.count.mockResolvedValue(12);

    const items: RawItemDto[] = [
      {
        skillCode: 'vocab.food',
        stem: 'He ate an ___',
        correctAnswer: 'apple',
        options: ['apple', 'car', 'pen', 'sky'],
        cefrLevel: 'b1',
        type: 'cloze',
        a: 1.2,
        b: -0.5,
        c: 0.0,
      },
      {
        skillCode: 'listening.intro',
        prompt: 'Listen and choose',
        correctOption: 'Option A',
        options: ['Option A', 'Option B'],
        cefrLevel: 'INVALID_LEVEL',
        type: 'mcq',
      },
    ];

    const result = await useCase.execute(items);
    expect(result).toEqual({ importedCount: 2, totalInDb: 12 });
    expect(prismaMock.assessmentItem.create).toHaveBeenCalledTimes(2);

    // Verify first item mapping
    expect(prismaMock.assessmentItem.create).toHaveBeenNthCalledWith(1, {
      data: {
        skillCode: 'vocab.food',
        cefrLevel: CefrLevel.B1,
        type: ItemType.CLOZE,
        prompt: 'He ate an ___',
        options: ['apple', 'car', 'pen', 'sky'],
        correctOption: 'apple',
        explanation: null,
        audioUrl: null,
        irtA: 1.2,
        irtB: -0.5,
        irtC: 0.0,
      },
    });

    // Verify second item fallback
    expect(prismaMock.assessmentItem.create).toHaveBeenNthCalledWith(2, {
      data: {
        skillCode: 'listening.intro',
        cefrLevel: CefrLevel.A2, // Fallback for invalid level
        type: ItemType.MULTIPLE_CHOICE,
        prompt: 'Listen and choose',
        options: ['Option A', 'Option B'],
        correctOption: 'Option A',
        explanation: null,
        audioUrl: null,
        irtA: 1.0,
        irtB: 0.0,
        irtC: 0.25,
      },
    });
  });
});
