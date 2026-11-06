import { Injectable } from "@nestjs/common";
import { AssessmentSkill, CefrLevel, ItemUsageScope } from "@prisma/client";
import {
  ASSESSMENT_SKILLS,
  CEFR_LEVELS,
  findDescriptors,
  CanDoDescriptor,
} from "../constants/cefr-can-do-matrix.constant";
import { AssessmentItemGroupRepository } from "../repositories/assessment-item-group.repository";
import { AssessmentCacheService } from "./assessment-cache.service";
import {
  CefrMatrixCellStats,
  CefrMatrixOverviewResponse,
} from "../dto/cefr-matrix-response.dto";
import { AssessmentSafeItemDto } from "../dto/assessment-safe-item.dto";
import { AssessmentSafeMapper } from "../mappers/assessment-safe.mapper";

export interface PaginatedItemsByDescriptorResponse {
  data: AssessmentSafeItemDto[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class AssessmentMatrixService {
  private static readonly MATRIX_CACHE_KEY =
    "lingoroad:assessment:matrix:overview";
  private static readonly MATRIX_CACHE_TTL_SEC = 15 * 60; // 15 minutes

  constructor(
    private readonly repository: AssessmentItemGroupRepository,
    private readonly cacheService: AssessmentCacheService,
  ) {}

  async getMatrixOverview(
    forceRefresh = false,
  ): Promise<CefrMatrixOverviewResponse> {
    if (!forceRefresh) {
      const cached =
        await this.cacheService.get<CefrMatrixOverviewResponse>(
          AssessmentMatrixService.MATRIX_CACHE_KEY,
        );
      if (cached) {
        return cached;
      }
    }

    const { groupCounts, itemCounts } =
      await this.repository.countStatsBySkillAndLevel();

    const groupCountMap = new Map<string, number>();
    for (const row of groupCounts) {
      groupCountMap.set(`${row.skill}_${row.cefrLevel}`, row._count.id);
    }

    const itemCountMap = new Map<string, number>();
    for (const row of itemCounts) {
      if (row.skill) {
        itemCountMap.set(`${row.skill}_${row.cefrLevel}`, row._count.id);
      }
    }

    let totalGroups = 0;
    let totalItems = 0;

    const matrix: CefrMatrixCellStats[] = [];

    for (const skill of ASSESSMENT_SKILLS) {
      for (const level of CEFR_LEVELS) {
        const key = `${skill}_${level}`;
        const groups = groupCountMap.get(key) ?? 0;
        const items = itemCountMap.get(key) ?? 0;

        totalGroups += groups;
        totalItems += items;

        const descriptors = findDescriptors(skill, level) as CanDoDescriptor[];

        matrix.push({
          skill: skill as AssessmentSkill,
          cefrLevel: level as CefrLevel,
          totalGroups: groups,
          totalItems: items,
          descriptors,
        });
      }
    }

    const result: CefrMatrixOverviewResponse = {
      totalSupportedLevels: CEFR_LEVELS.length,
      totalSkills: ASSESSMENT_SKILLS.length,
      matrix,
      summary: {
        totalGroups,
        totalItems,
      },
    };

    await this.cacheService.set(
      AssessmentMatrixService.MATRIX_CACHE_KEY,
      result,
      AssessmentMatrixService.MATRIX_CACHE_TTL_SEC,
    );
    return result;
  }

  async invalidateCache(): Promise<void> {
    await this.cacheService.del(AssessmentMatrixService.MATRIX_CACHE_KEY);
  }

  async getItemsByDescriptor(
    skillCode: string,
    cefrLevel?: CefrLevel,
    pagination?: { limit?: number; offset?: number },
  ): Promise<PaginatedItemsByDescriptorResponse> {
    const limit = pagination?.limit ?? 20;
    const offset = pagination?.offset ?? 0;

    const [items, total] = await this.repository.findItemsBySkillCode({
      skillCode,
      cefrLevel,
      limit,
      offset,
      allowedScopes: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL],
    });

    return {
      data: AssessmentSafeMapper.toSafeItemList(items),
      total,
      limit,
      offset,
    };
  }
}
