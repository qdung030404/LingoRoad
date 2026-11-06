import { AssessmentSkill, CefrLevel, ItemUsageScope } from "@prisma/client";
import { AssessmentSafeItemDto } from "./assessment-safe-item.dto";

export class AssessmentSafeGroupDto {
  id: string;
  skill: AssessmentSkill;
  title: string | null;
  cefrLevel: CefrLevel;
  partNumber: number;
  passage: string | null;
  audioUrl: string | null;
  usageScope: ItemUsageScope;
  items: AssessmentSafeItemDto[];
}
