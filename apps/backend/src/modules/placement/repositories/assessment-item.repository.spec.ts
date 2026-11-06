import { Test, TestingModule } from '@nestjs/testing';
import { ItemType, ItemUsageScope, CefrLevel } from '@prisma/client';
import { AssessmentItemRepository } from './assessment-item.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('AssessmentItemRepository (Placement Module)', () => {
  let repository: AssessmentItemRepository;
  let prisma: {
    assessmentItem: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const mockItem = {
    id: 'item-uuid-1',
    externalId: 'ext-1',
    skillCode: 'reading.general',
    cefrLevel: CefrLevel.A2,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: 'Sample Question',
    options: ['A', 'B', 'C', 'D'],
    correctOption: 'A',
    usageScope: ItemUsageScope.PLACEMENT,
    irtA: 1.0,
    irtB: 0.0,
    irtC: 0.25,
  };

  beforeEach(async () => {
    prisma = {
      assessmentItem: {
        findUnique: jest.fn().mockResolvedValue(mockItem),
        findMany: jest.fn().mockResolvedValue([mockItem]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentItemRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<AssessmentItemRepository>(AssessmentItemRepository);
  });

  describe('findById', () => {
    it('should query item by id', async () => {
      const item = await repository.findById('item-uuid-1');
      expect(item).toEqual(mockItem);
      expect(prisma.assessmentItem.findUnique).toHaveBeenCalledWith({
        where: { id: 'item-uuid-1' },
      });
    });
  });

  describe('findByCefrLevel', () => {
    it('should query items with usageScope, valid placement item types, groupId: null, and non-null correctOption', async () => {
      const items = await repository.findByCefrLevel(CefrLevel.A2);
      expect(items).toEqual([mockItem]);
      expect(prisma.assessmentItem.findMany).toHaveBeenCalledWith({
        where: {
          cefrLevel: CefrLevel.A2,
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
      });
    });
  });

  describe('findAll', () => {
    it('should query items with usageScope, placement types, groupId: null, and non-null correctOption and cache results', async () => {
      const firstCall = await repository.findAll();
      expect(firstCall).toEqual([mockItem]);
      expect(prisma.assessmentItem.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.assessmentItem.findMany).toHaveBeenCalledWith({
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
      });

      // Second call should hit in-memory cache
      const secondCall = await repository.findAll();
      expect(secondCall).toEqual([mockItem]);
      expect(prisma.assessmentItem.findMany).toHaveBeenCalledTimes(1);

      // Clear cache and call again
      repository.clearCache();
      await repository.findAll();
      expect(prisma.assessmentItem.findMany).toHaveBeenCalledTimes(2);
    });

    it('should isolate placement from grouped items and items without correct answers', async () => {
      await repository.findAll();
      const lastCallArgs = prisma.assessmentItem.findMany.mock.calls[0][0];
      expect(lastCallArgs.where.groupId).toBeNull();
      expect(lastCallArgs.where.correctOption).toEqual({ not: null });
    });
  });

  describe('findManyByIds', () => {
    it('should query items matching list of IDs', async () => {
      const items = await repository.findManyByIds(['item-uuid-1']);
      expect(items).toEqual([mockItem]);
      expect(prisma.assessmentItem.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['item-uuid-1'] } },
      });
    });
  });
});
