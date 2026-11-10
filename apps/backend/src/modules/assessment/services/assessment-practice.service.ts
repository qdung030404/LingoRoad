import { Injectable, NotFoundException } from "@nestjs/common";
import { CefrLevel, ItemUsageScope } from "@prisma/client";
import { AssessmentItemGroupRepository } from "../repositories/assessment-item-group.repository";
import { AssessmentCacheService } from "./assessment-cache.service";
import { AssessmentSafeMapper } from "../mappers/assessment-safe.mapper";
import { GetPracticeGroupsQueryDto } from "../dto/get-practice-groups-query.dto";
import { AssessmentSafeGroupDto } from "../dto/assessment-safe-group.dto";
import { AssessmentSafeItemDto } from "../dto/assessment-safe-item.dto";

export interface PaginatedPracticeGroupsResponse {
  total: number;
  limit: number;
  offset: number;
  data: AssessmentSafeGroupDto[];
}

@Injectable()
export class AssessmentPracticeService {
  constructor(
    private readonly repository: AssessmentItemGroupRepository,
    private readonly cacheService: AssessmentCacheService,
  ) {}

  async getPracticeGroups(
    query: GetPracticeGroupsQueryDto,
  ): Promise<PaginatedPracticeGroupsResponse> {
    const [groups, total] = await this.repository.findPracticeGroups({
      skill: query.skill,
      cefrLevel: query.cefrLevel,
      partNumber: query.partNumber,
      limit: query.limit,
      offset: query.offset,
    });

    const safeData = AssessmentSafeMapper.toSafeGroupList(groups);

    return {
      total,
      limit: query.limit,
      offset: query.offset,
      data: safeData,
    };
  }

  async getPracticeGroupById(id: string): Promise<AssessmentSafeGroupDto> {
    const group = await this.repository.findByIdWithItems(id, [
      ItemUsageScope.PRACTICE,
      ItemUsageScope.ALL,
    ]);
    if (!group) {
      throw new NotFoundException(
        `Nhóm bài tập có ID ${id} không tồn tại hoặc không khả dụng cho luyện tập.`,
      );
    }

    return AssessmentSafeMapper.toSafeGroup(group);
  }

  async getWritingPracticeItems(
    cefrLevel?: CefrLevel,
    pagination?: { limit?: number; offset?: number },
  ): Promise<{ items: AssessmentSafeItemDto[]; total: number }> {
    const limit = Math.min(Math.max(pagination?.limit ?? 20, 1), 50);
    const offset = Math.max(pagination?.offset ?? 0, 0);
    const cacheKey = `assessment:writing:items:${cefrLevel ?? "ALL"}:${limit}:${offset}`;

    const cached = await this.cacheService.get<{
      items: AssessmentSafeItemDto[];
      total: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const [items, total] = await this.repository.findWritingPracticeItems({
      cefrLevel,
      limit,
      offset,
    });
    const result = {
      items: items.map((item) => AssessmentSafeMapper.toSafeItem(item)),
      total,
    };

    // Cache static writing bank for 15 minutes (900 seconds)
    await this.cacheService.set(cacheKey, result, 900);
    return result;
  }
}
