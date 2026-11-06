import { Test, TestingModule } from "@nestjs/testing";
import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from "@prisma/client";
import { AssessmentItemGroupRepository } from "./assessment-item-group.repository";
import { PrismaService } from "../../prisma/prisma.service";

describe("AssessmentItemGroupRepository", () => {
  let repository: AssessmentItemGroupRepository;
  let prisma: {
    assessmentItemGroup: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    assessmentItem: {
      findMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
  };

  const sampleGroup = {
    id: "grp-uuid-1",
    skill: AssessmentSkill.READING,
    title: "Sample Reading Group",
    cefrLevel: CefrLevel.B1,
    partNumber: 3,
    passage: "Passage text",
    audioUrl: null,
    transcript: null,
    usageScope: ItemUsageScope.PRACTICE,
    createdAt: new Date(),
    items: [],
  };

  beforeEach(async () => {
    prisma = {
      assessmentItemGroup: {
        findMany: jest.fn().mockResolvedValue([sampleGroup]),
        findFirst: jest.fn().mockResolvedValue(sampleGroup),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([
          {
            skill: AssessmentSkill.READING,
            cefrLevel: CefrLevel.B1,
            _count: { id: 1 },
          },
        ]),
      },
      assessmentItem: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([
          {
            skill: AssessmentSkill.READING,
            cefrLevel: CefrLevel.B1,
            _count: { id: 4 },
          },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentItemGroupRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<AssessmentItemGroupRepository>(
      AssessmentItemGroupRepository,
    );
  });

  describe("findPracticeGroups", () => {
    it("should query groups with PRACTICE and ALL usageScope, and apply filters", async () => {
      const [groups, total] = await repository.findPracticeGroups({
        skill: AssessmentSkill.READING,
        cefrLevel: CefrLevel.B1,
        partNumber: 3,
        limit: 10,
        offset: 0,
      });

      expect(prisma.assessmentItemGroup.findMany).toHaveBeenCalledWith({
        where: {
          usageScope: { in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL] },
          skill: AssessmentSkill.READING,
          cefrLevel: CefrLevel.B1,
          partNumber: 3,
        },
        include: {
          items: {
            where: {
              usageScope: { in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL] },
            },
            orderBy: [{ itemOrder: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: [
          { cefrLevel: "asc" },
          { partNumber: "asc" },
          { createdAt: "desc" },
        ],
        skip: 0,
        take: 10,
      });
      expect(groups).toHaveLength(1);
      expect(total).toBe(1);
    });
  });

  describe("findByIdWithItems", () => {
    it("should find group by ID and filter allowedScopes when provided", async () => {
      const group = await repository.findByIdWithItems("grp-uuid-1", [
        ItemUsageScope.PRACTICE,
        ItemUsageScope.ALL,
      ]);

      expect(prisma.assessmentItemGroup.findFirst).toHaveBeenCalledWith({
        where: {
          id: "grp-uuid-1",
          usageScope: { in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL] },
        },
        include: {
          items: {
            where: {
              usageScope: { in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL] },
            },
            orderBy: [{ itemOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      });
      expect(group?.id).toBe("grp-uuid-1");
    });
  });

  describe("countStatsBySkillAndLevel", () => {
    it("should perform group and item groupBy queries for matrix stats with usageScope and non-null skill filter", async () => {
      const stats = await repository.countStatsBySkillAndLevel();

      expect(prisma.assessmentItemGroup.groupBy).toHaveBeenCalledWith({
        by: ["skill", "cefrLevel"],
        where: {
          usageScope: { in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL] },
        },
        _count: { id: true },
      });
      expect(prisma.assessmentItem.groupBy).toHaveBeenCalledWith({
        by: ["skill", "cefrLevel"],
        where: {
          usageScope: { in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL] },
          skill: { not: null },
        },
        _count: { id: true },
      });
      expect(stats.groupCounts).toHaveLength(1);
      expect(stats.itemCounts).toHaveLength(1);
    });
  });

  describe("findItemsBySkillCode", () => {
    it("should filter allowedScopes for standalone items and grouped items when allowedScopes are given", async () => {
      await repository.findItemsBySkillCode({
        skillCode: "reading.skimming",
        cefrLevel: CefrLevel.B1,
        limit: 15,
        offset: 5,
        allowedScopes: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL],
      });

      expect(prisma.assessmentItem.findMany).toHaveBeenCalledWith({
        where: {
          skillCode: "reading.skimming",
          cefrLevel: CefrLevel.B1,
          usageScope: { in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL] },
          OR: [
            { groupId: null },
            {
              group: {
                usageScope: {
                  in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL],
                },
              },
            },
          ],
        },
        include: { group: true },
        orderBy: { createdAt: "desc" },
        skip: 5,
        take: 15,
      });
    });

    it("should clamp limit to max 50 and min 1", async () => {
      await repository.findItemsBySkillCode({
        skillCode: "reading.skimming",
        limit: 100,
        offset: -5,
      });

      expect(prisma.assessmentItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        }),
      );
    });
  });
});
