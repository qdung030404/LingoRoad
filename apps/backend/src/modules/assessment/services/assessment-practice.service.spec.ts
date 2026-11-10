import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from "@prisma/client";
import { AssessmentPracticeService } from "./assessment-practice.service";
import { AssessmentItemGroupRepository } from "../repositories/assessment-item-group.repository";
import { AssessmentCacheService } from "./assessment-cache.service";
import { AssessmentItemGroupWithItems } from "../interfaces/assessment.interface";

describe("AssessmentPracticeService", () => {
  let service: AssessmentPracticeService;
  let repository: jest.Mocked<Partial<AssessmentItemGroupRepository>>;
  let cacheService: jest.Mocked<Partial<AssessmentCacheService>>;

  const mockGroup: AssessmentItemGroupWithItems = {
    id: "grp-123",
    skill: AssessmentSkill.READING,
    title: "Reading Test 1",
    cefrLevel: CefrLevel.B1,
    partNumber: 3,
    passage: "A long passage",
    audioUrl: null,
    transcript: "Secret transcript",
    usageScope: ItemUsageScope.PRACTICE,
    createdAt: new Date(),
    items: [
      {
        id: "itm-1",
        groupId: "grp-123",
        itemOrder: 1,
        externalId: "ext-1",
        bankVersion: "v1",
        skill: AssessmentSkill.READING,
        skillCode: "reading.skimming",
        cefrLevel: CefrLevel.B1,
        type: ItemType.MULTIPLE_CHOICE,
        prompt: "Question 1",
        options: ["A", "B"],
        correctOption: "A",
        explanation: "Why A is right",
        audioUrl: null,
        passage: null,
        rubricCriteria: null,
        usageScope: ItemUsageScope.ALL,
        irtA: 1.0,
        irtB: 0.1,
        irtC: 0.25,
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    repository = {
      findPracticeGroups: jest.fn().mockResolvedValue([[mockGroup], 1]),
      findByIdWithItems: jest
        .fn()
        .mockImplementation((id: string, allowedScopes?: ItemUsageScope[]) => {
          if (
            id === "grp-123" &&
            (!allowedScopes || allowedScopes.includes(mockGroup.usageScope))
          ) {
            return Promise.resolve(mockGroup);
          }
          return Promise.resolve(null);
        }),
      findWritingPracticeItems: jest.fn().mockResolvedValue([
        [
          {
            id: "itm-write-1",
            groupId: null,
            itemOrder: 1,
            externalId: "ext-write-1",
            bankVersion: "v1",
            skill: AssessmentSkill.WRITING,
            skillCode: "writing.opinion_essay",
            cefrLevel: CefrLevel.B2,
            type: ItemType.ESSAY,
            prompt: "Write an essay about environment.",
            options: null,
            correctOption: null,
            explanation: null,
            audioUrl: null,
            passage: null,
            rubricCriteria: { wordCount: "200-250" },
            usageScope: ItemUsageScope.PRACTICE,
            irtA: 1.0,
            irtB: 0.1,
            irtC: 0.25,
            createdAt: new Date(),
          },
        ],
        1,
      ]),
    };

    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentPracticeService,
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

    service = module.get<AssessmentPracticeService>(AssessmentPracticeService);
  });

  it("should return safe paginated groups without leaking confidential fields", async () => {
    const result = await service.getPracticeGroups({
      skill: AssessmentSkill.READING,
      cefrLevel: CefrLevel.B1,
      limit: 10,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("grp-123");

    // Ensure transcript is stripped
    const groupRecord = result.data[0] as unknown as Record<string, unknown>;
    expect(groupRecord.transcript).toBeUndefined();

    // Ensure child answers are stripped
    const childRecord = result.data[0].items[0] as unknown as Record<
      string,
      unknown
    >;
    expect(childRecord.correctOption).toBeUndefined();
  });

  it("should throw NotFoundException when group does not exist", async () => {
    await expect(
      service.getPracticeGroupById("non-existent-id"),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw NotFoundException when group exists but belongs to PLACEMENT scope", async () => {
    repository.findByIdWithItems = jest.fn().mockResolvedValue(null);
    await expect(
      service.getPracticeGroupById("placement-group-id"),
    ).rejects.toThrow(NotFoundException);
    expect(repository.findByIdWithItems).toHaveBeenCalledWith(
      "placement-group-id",
      [ItemUsageScope.PRACTICE, ItemUsageScope.ALL],
    );
  });

  it("should return safe group when found by ID", async () => {
    const result = await service.getPracticeGroupById("grp-123");
    expect(result.id).toBe("grp-123");
    const groupRecord = result as unknown as Record<string, unknown>;
    expect(groupRecord.transcript).toBeUndefined();
  });

  it("should return safe writing practice items and total count", async () => {
    const result = await service.getWritingPracticeItems(CefrLevel.B2);
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("itm-write-1");
    expect(result.items[0].skillCode).toBe("writing.opinion_essay");
    expect(result.items[0].prompt).toBe("Write an essay about environment.");
    expect(repository.findWritingPracticeItems).toHaveBeenCalledWith({
      cefrLevel: CefrLevel.B2,
      limit: 20,
      offset: 0,
    });
    expect(cacheService.set).toHaveBeenCalled();
  });

  it("should return cached writing practice items on cache hit without querying repository", async () => {
    cacheService.get = jest.fn().mockResolvedValue({
      items: [{ id: "cached-item", prompt: "Cached prompt" } as any],
      total: 1,
    });

    const result = await service.getWritingPracticeItems(CefrLevel.B1);
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe("cached-item");
    expect(repository.findWritingPracticeItems).not.toHaveBeenCalled();
  });
});
