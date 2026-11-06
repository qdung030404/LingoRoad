import { Injectable, NotFoundException } from "@nestjs/common";
import { ItemUsageScope } from "@prisma/client";
import { AssessmentItemGroupRepository } from "../repositories/assessment-item-group.repository";
import { AssessmentSafeMapper } from "../mappers/assessment-safe.mapper";
import { GetPracticeGroupsQueryDto } from "../dto/get-practice-groups-query.dto";
import { AssessmentSafeGroupDto } from "../dto/assessment-safe-group.dto";

export interface PaginatedPracticeGroupsResponse {
  total: number;
  limit: number;
  offset: number;
  data: AssessmentSafeGroupDto[];
}

@Injectable()
export class AssessmentPracticeService {
  constructor(private readonly repository: AssessmentItemGroupRepository) {}

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
}
