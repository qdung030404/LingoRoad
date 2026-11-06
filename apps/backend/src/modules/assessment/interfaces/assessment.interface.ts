import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  AssessmentItem as PrismaAssessmentItem,
  AssessmentItemGroup as PrismaAssessmentItemGroup,
} from "@prisma/client";

export type { AssessmentSkill, CefrLevel, ItemType, ItemUsageScope };

export interface SafeAssessmentGroupSummary {
  id: string;
  skill: AssessmentSkill;
  title: string | null;
  cefrLevel: CefrLevel;
  partNumber: number;
  passage: string | null;
  audioUrl: string | null;
  usageScope: ItemUsageScope;
}

export interface SafeAssessmentItem {
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
  group?: SafeAssessmentGroupSummary | null;
}

export interface SafeAssessmentItemGroup {
  id: string;
  skill: AssessmentSkill;
  title: string | null;
  cefrLevel: CefrLevel;
  partNumber: number;
  passage: string | null;
  audioUrl: string | null;
  usageScope: ItemUsageScope;
  items: SafeAssessmentItem[];
}

export type AssessmentItemGroupWithItems = PrismaAssessmentItemGroup & {
  items: PrismaAssessmentItem[];
};
