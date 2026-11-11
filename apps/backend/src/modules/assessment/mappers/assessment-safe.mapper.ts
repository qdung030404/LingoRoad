import { AssessmentItem, AssessmentItemGroup } from "@prisma/client";
import { AssessmentSafeItemDto } from "../dto/assessment-safe-item.dto";
import { AssessmentSafeGroupDto } from "../dto/assessment-safe-group.dto";
import { AssessmentItemGroupWithItems } from "../interfaces/assessment.interface";

export class AssessmentSafeMapper {
  /**
   * Khử trùng rubricCriteria để chỉ giữ lại các ràng buộc khách quan công khai cho thí sinh
   * (như wordCount, timeLimitSeconds, preparationTimeSeconds, minSpeakingSeconds, maxSpeakingSeconds),
   * triệt để loại bỏ barem chấm điểm chi tiết (taskAchievement, lexicalResource, grammarAccuracy,
   * fluencyCoherence, pronunciation, grammarRange...) để ngăn ngừa lộ gợi ý làm bài.
   */
  private static sanitizeRubricCriteria(
    rubricCriteria: unknown,
  ): Record<string, unknown> | null {
    if (
      !rubricCriteria ||
      typeof rubricCriteria !== "object" ||
      Array.isArray(rubricCriteria)
    ) {
      return null;
    }
    const criteriaObj = rubricCriteria as Record<string, unknown>;
    const publicRubric: Record<string, unknown> = {};

    const ALLOWED_PUBLIC_KEYS = [
      "wordCount",
      "timeLimitSeconds",
      "preparationTimeSeconds",
      "minSpeakingSeconds",
      "maxSpeakingSeconds",
      "targetBandScore",
    ] as const;

    for (const key of ALLOWED_PUBLIC_KEYS) {
      if (key in criteriaObj && criteriaObj[key] !== undefined && criteriaObj[key] !== null) {
        publicRubric[key] = criteriaObj[key];
      }
    }

    return Object.keys(publicRubric).length > 0 ? publicRubric : null;
  }

  /**
   * Chuyển đổi một AssessmentItem sang Safe DTO,
   * triệt để loại bỏ correctOption, explanation, rubric chấm điểm nội bộ và các tham số IRT (irtA, irtB, irtC)
   * nhằm bảo mật tối đa dữ liệu thi và thuật toán thích ứng (Zero Leak Policy).
   */
  static toSafeItem(
    item: AssessmentItem & { group?: AssessmentItemGroup | null },
  ): AssessmentSafeItemDto {
    const safeItem: AssessmentSafeItemDto = {
      id: item.id,
      groupId: item.groupId,
      itemOrder: item.itemOrder ?? 1,
      externalId: item.externalId,
      skill: item.skill,
      skillCode: item.skillCode,
      cefrLevel: item.cefrLevel,
      type: item.type,
      prompt: item.prompt,
      options: item.options,
      passage: item.passage,
      audioUrl: item.audioUrl,
      rubricCriteria: AssessmentSafeMapper.sanitizeRubricCriteria(
        item.rubricCriteria,
      ),
      usageScope: item.usageScope,
    };

    if (item.group) {
      safeItem.group = {
        id: item.group.id,
        skill: item.group.skill,
        title: item.group.title,
        cefrLevel: item.group.cefrLevel,
        partNumber: item.group.partNumber,
        passage: item.group.passage,
        audioUrl: item.group.audioUrl,
        usageScope: item.group.usageScope,
      };
    }

    return safeItem;
  }

  /**
   * Chuyển đổi danh sách AssessmentItem sang danh sách Safe DTO.
   */
  static toSafeItemList(
    items: Array<AssessmentItem & { group?: AssessmentItemGroup | null }>,
  ): AssessmentSafeItemDto[] {
    return items.map((item) => AssessmentSafeMapper.toSafeItem(item));
  }

  /**
   * Chuyển đổi một AssessmentItemGroup kèm các items con sang Safe DTO,
   * triệt để loại bỏ transcript của group và đáp án của các câu hỏi con.
   */
  static toSafeGroup(
    group: AssessmentItemGroupWithItems,
  ): AssessmentSafeGroupDto {
    return {
      id: group.id,
      skill: group.skill,
      title: group.title,
      cefrLevel: group.cefrLevel,
      partNumber: group.partNumber,
      passage: group.passage,
      audioUrl: group.audioUrl,
      usageScope: group.usageScope,
      items: (group.items || []).map((item) =>
        AssessmentSafeMapper.toSafeItem(item),
      ),
    };
  }

  /**
   * Chuyển đổi danh sách nhóm bài tập sang danh sách Safe DTO.
   */
  static toSafeGroupList(
    groups: AssessmentItemGroupWithItems[],
  ): AssessmentSafeGroupDto[] {
    return groups.map((group) => AssessmentSafeMapper.toSafeGroup(group));
  }
}
