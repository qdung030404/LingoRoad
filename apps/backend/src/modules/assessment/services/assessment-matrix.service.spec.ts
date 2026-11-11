import { Test, TestingModule } from "@nestjs/testing";
import {
  AssessmentItem,
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from "@prisma/client";
import { AssessmentMatrixService } from "./assessment-matrix.service";
import { AssessmentItemGroupRepository } from "../repositories/assessment-item-group.repository";
import { AssessmentCacheService } from "./assessment-cache.service";

describe("AssessmentMatrixService", () => {
  let service: AssessmentMatrixService;
  let repository: jest.Mocked<Partial<AssessmentItemGroupRepository>>;
  let cacheService: AssessmentCacheService;

  beforeEach(async () => {
    repository = {
      countStatsBySkillAndLevel: jest.fn().mockResolvedValue({
        groupCounts: [
          {
            skill: AssessmentSkill.READING,
            cefrLevel: CefrLevel.B1,
            _count: { id: 3 },
          },
          {
            skill: AssessmentSkill.LISTENING,
            cefrLevel: CefrLevel.B2,
            _count: { id: 2 },
          },
        ],
        itemCounts: [
          {
            skill: AssessmentSkill.READING,
            cefrLevel: CefrLevel.B1,
            _count: { id: 12 },
          },
          {
            skill: AssessmentSkill.LISTENING,
            cefrLevel: CefrLevel.B2,
            _count: { id: 8 },
          },
        ],
      }),
      findItemsBySkillCode: jest.fn().mockResolvedValue([[], 0]),
    };

    const cacheStore = new Map<string, unknown>();
    cacheService = {
      get: jest.fn().mockImplementation((key: string) => Promise.resolve(cacheStore.get(key) ?? null)),
      set: jest.fn().mockImplementation((key: string, val: unknown) => {
        cacheStore.set(key, val);
        return Promise.resolve();
      }),
      del: jest.fn().mockImplementation((key: string) => {
        cacheStore.delete(key);
        return Promise.resolve();
      }),
      isUsingRedis: jest.fn().mockReturnValue(false),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as unknown as AssessmentCacheService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentMatrixService,
        {
          provide: AssessmentItemGroupRepository,
          useValue: repository,
        },
        {
          provide: AssessmentCacheService,
          useValue: cacheService,
        },
      ],
    }).compile();

    service = module.get<AssessmentMatrixService>(AssessmentMatrixService);
  });

  it("should generate matrix of 24 cells (6 CEFR levels * 4 skills)", async () => {
    const result = await service.getMatrixOverview();

    expect(result.totalSupportedLevels).toBe(6);
    expect(result.totalSkills).toBe(4);
    expect(result.matrix).toHaveLength(24);

    // Reading B1 check
    const readingB1 = result.matrix.find(
      (cell) =>
        cell.skill === AssessmentSkill.READING &&
        cell.cefrLevel === CefrLevel.B1,
    );
    expect(readingB1).toBeDefined();
    expect(readingB1?.totalGroups).toBe(3);
    expect(readingB1?.totalItems).toBe(12);
    expect(readingB1?.descriptors.length).toBeGreaterThan(0);

    // Summary check
    expect(result.summary.totalGroups).toBe(5);
    expect(result.summary.totalItems).toBe(20);
  });

  it("should cache matrix overview and not query repository again on subsequent calls within TTL", async () => {
    await service.getMatrixOverview();
    await service.getMatrixOverview();
    expect(repository.countStatsBySkillAndLevel).toHaveBeenCalledTimes(1);

    // Invalidate cache and call again
    service.invalidateCache();
    await service.getMatrixOverview();
    expect(repository.countStatsBySkillAndLevel).toHaveBeenCalledTimes(2);
  });

  it("should delegate findItemsBySkillCode to repository and return safe items (Zero Leakage)", async () => {
    repository.findItemsBySkillCode = jest.fn().mockResolvedValue([
      [
        {
          id: "itm-1",
          groupId: null,
          itemOrder: 1,
          externalId: "ext-1",
          bankVersion: "v1",
          skill: AssessmentSkill.READING,
          skillCode: "reading.skimming",
          cefrLevel: CefrLevel.B1,
          type: ItemType.MULTIPLE_CHOICE,
          prompt: "Prompt text",
          options: ["A", "B"],
          correctOption: "Secret Answer",
          explanation: "Secret Explanation",
          audioUrl: null,
          passage: null,
          rubricCriteria: null,
          usageScope: ItemUsageScope.ALL,
          irtA: 1,
          irtB: 0,
          irtC: 0.25,
          createdAt: new Date(),
          group: null,
        } as AssessmentItem & { group: null },
      ],
      1,
    ]);

    const result = await service.getItemsByDescriptor(
      "reading.skimming",
      CefrLevel.B1,
    );
    expect(repository.findItemsBySkillCode).toHaveBeenCalledWith({
      skillCode: "reading.skimming",
      cefrLevel: CefrLevel.B1,
      limit: 20,
      offset: 0,
      allowedScopes: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL],
    });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe("itm-1");
    const dynamicItem = result.data[0] as unknown as Record<string, unknown>;
    expect(dynamicItem.correctOption).toBeUndefined();
    expect(dynamicItem.explanation).toBeUndefined();
    expect(dynamicItem.irtA).toBeUndefined();
  });
});
