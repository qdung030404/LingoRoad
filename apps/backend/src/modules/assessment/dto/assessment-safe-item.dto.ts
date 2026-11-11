import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from "@prisma/client";

export interface AssessmentSafeGroupSummaryDto {
  id: string;
  skill: AssessmentSkill;
  title: string | null;
  cefrLevel: CefrLevel;
  partNumber: number;
  passage: string | null;
  audioUrl: string | null;
  usageScope: ItemUsageScope;
}

export class AssessmentSafeItemDto {
  id: string;
  groupId: string | null;
  itemOrder: number;
  externalId: string | null;
  skill: AssessmentSkill | null;
  skillCode: string;
  cefrLevel: CefrLevel;
  type: ItemType;
  prompt: string;
  options: unknown | null;
  passage: string | null;
  audioUrl: string | null;
  rubricCriteria: unknown | null;
  usageScope: ItemUsageScope;
  group?: AssessmentSafeGroupSummaryDto | null;
}
