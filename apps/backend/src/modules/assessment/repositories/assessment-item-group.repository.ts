import { Injectable } from "@nestjs/common";
import {
  Prisma,
  AssessmentItem,
  AssessmentItemGroup,
  AssessmentSkill,
  CefrLevel,
  ItemUsageScope,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AssessmentItemGroupWithItems } from "../interfaces/assessment.interface";

export interface PracticeGroupFilter {
  skill?: AssessmentSkill;
  cefrLevel?: CefrLevel;
  partNumber?: number;
  limit: number;
  offset: number;
}

export interface FindItemsByDescriptorFilter {
  skillCode: string;
  cefrLevel?: CefrLevel;
  limit?: number;
  offset?: number;
  allowedScopes?: ItemUsageScope[];
}

@Injectable()
export class AssessmentItemGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPracticeGroups(
    filter: PracticeGroupFilter,
  ): Promise<[AssessmentItemGroupWithItems[], number]> {
    const where: Prisma.AssessmentItemGroupWhereInput = {
      usageScope: {
        in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL],
      },
    };

    if (filter.skill) {
      where.skill = filter.skill;
    }
    if (filter.cefrLevel) {
      where.cefrLevel = filter.cefrLevel;
    }
    if (filter.partNumber !== undefined) {
      where.partNumber = filter.partNumber;
    }

    const [groups, total] = await Promise.all([
      this.prisma.assessmentItemGroup.findMany({
        where,
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
        skip: filter.offset,
        take: filter.limit,
      }),
      this.prisma.assessmentItemGroup.count({ where }),
    ]);

    return [groups as AssessmentItemGroupWithItems[], total];
  }

  async findByIdWithItems(
    id: string,
    allowedScopes?: ItemUsageScope[],
  ): Promise<AssessmentItemGroupWithItems | null> {
    const where: Prisma.AssessmentItemGroupWhereInput = { id };
    if (allowedScopes && allowedScopes.length > 0) {
      where.usageScope = { in: allowedScopes };
    }

    const itemsWhere: Prisma.AssessmentItemWhereInput = {};
    if (allowedScopes && allowedScopes.length > 0) {
      itemsWhere.usageScope = { in: allowedScopes };
    }

    const group = await this.prisma.assessmentItemGroup.findFirst({
      where,
      include: {
        items: {
          where: itemsWhere,
          orderBy: [{ itemOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return group as AssessmentItemGroupWithItems | null;
  }

  async countStatsBySkillAndLevel(
    allowedScopes: ItemUsageScope[] = [
      ItemUsageScope.PRACTICE,
      ItemUsageScope.ALL,
    ],
  ): Promise<{
    groupCounts: Array<{
      skill: AssessmentSkill;
      cefrLevel: CefrLevel;
      _count: { id: number };
    }>;
    itemCounts: Array<{
      cefrLevel: CefrLevel;
      skill: AssessmentSkill | null;
      _count: { id: number };
    }>;
  }> {
    const whereScope = { in: allowedScopes };
    const [groupCounts, itemCounts] = await Promise.all([
      this.prisma.assessmentItemGroup.groupBy({
        by: ["skill", "cefrLevel"],
        where: { usageScope: whereScope },
        _count: { id: true },
      }),
      this.prisma.assessmentItem.groupBy({
        by: ["skill", "cefrLevel"],
        where: { usageScope: whereScope, skill: { not: null } },
        _count: { id: true },
      }),
    ]);

    return { groupCounts, itemCounts };
  }

  async findItemsBySkillCode(
    filter: FindItemsByDescriptorFilter,
  ): Promise<
    [Array<AssessmentItem & { group: AssessmentItemGroup | null }>, number]
  > {
    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 50);
    const offset = Math.max(filter.offset ?? 0, 0);

    const where: Prisma.AssessmentItemWhereInput = {
      skillCode: filter.skillCode,
    };
    if (filter.cefrLevel) {
      where.cefrLevel = filter.cefrLevel;
    }
    if (filter.allowedScopes && filter.allowedScopes.length > 0) {
      where.usageScope = { in: filter.allowedScopes };
      where.OR = [
        { groupId: null },
        { group: { usageScope: { in: filter.allowedScopes } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.assessmentItem.findMany({
        where,
        include: {
          group: true,
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      this.prisma.assessmentItem.count({ where }),
    ]);

    return [items, total];
  }
}
