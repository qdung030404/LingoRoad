import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentItem, CefrLevel, ItemType } from '@prisma/client';
import { AdaptiveSequencingService } from './adaptive-sequencing.service';
import { MlClientService } from '../../ml/ml-client.service';
import { AssessmentItemRepository } from '../repositories/assessment-item.repository';

describe('AdaptiveSequencingService', () => {
  let service: AdaptiveSequencingService;
  let mlClientService: jest.Mocked<MlClientService>;
  let itemRepo: jest.Mocked<AssessmentItemRepository>;

  const mockItem = (id: string, cefrLevel: CefrLevel): AssessmentItem => ({
    id,
    skillCode: 'grammar.test',
    cefrLevel,
    type: ItemType.MULTIPLE_CHOICE,
    prompt: `Question ${id}`,
    options: ['A', 'B', 'C', 'D'],
    correctOption: 'A',
    explanation: null,
    audioUrl: null,
    irtA: 1.0,
    irtB: 0.0,
    irtC: 0.25,
    createdAt: new Date(),
  });

  beforeEach(async () => {
    const mockMlClient = {
      selectNextCatItem: jest.fn(),
    };

    const mockItemRepository = {
      findCandidatesExcluding: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdaptiveSequencingService,
        { provide: MlClientService, useValue: mockMlClient },
        { provide: AssessmentItemRepository, useValue: mockItemRepository },
      ],
    }).compile();

    service = module.get<AdaptiveSequencingService>(AdaptiveSequencingService);
    mlClientService = module.get(MlClientService);
    itemRepo = module.get(AssessmentItemRepository);
  });

  it('should return null if no candidates are found', async () => {
    itemRepo.findCandidatesExcluding.mockResolvedValue([]);
    const result = await service.selectNextItem([], []);
    expect(result).toBeNull();
  });

  it('should call mlClientService.selectNextCatItem and return selected item', async () => {
    const candidate1 = mockItem('cand-1', CefrLevel.A2);
    const candidate2 = mockItem('cand-2', CefrLevel.B1);

    itemRepo.findCandidatesExcluding.mockResolvedValue([candidate1, candidate2]);
    mlClientService.selectNextCatItem.mockResolvedValue({
      theta: 0.5,
      se: 0.3,
      next_item_id: 'cand-2',
    });

    const result = await service.selectNextItem([], []);
    expect(result).toEqual(candidate2);
    expect(mlClientService.selectNextCatItem).toHaveBeenCalledTimes(1);
  });

  it('should fallback to first candidate if ML client throws an error', async () => {
    const candidate1 = mockItem('cand-1', CefrLevel.A2);
    itemRepo.findCandidatesExcluding.mockResolvedValue([candidate1]);
    mlClientService.selectNextCatItem.mockRejectedValue(new Error('ML connection failed'));

    const result = await service.selectNextItem([], []);
    expect(result).toEqual(candidate1);
  });
});
