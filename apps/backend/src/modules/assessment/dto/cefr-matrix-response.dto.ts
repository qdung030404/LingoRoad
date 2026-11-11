import { AssessmentSkill, CefrLevel } from "@prisma/client";
import { CanDoDescriptor } from "../constants/cefr-can-do-matrix.constant";

export interface CefrMatrixCellStats {
  skill: AssessmentSkill;
  cefrLevel: CefrLevel;
  totalGroups: number;
  totalItems: number;
  descriptors: CanDoDescriptor[];
}

export interface CefrMatrixOverviewResponse {
  totalSupportedLevels: number;
  totalSkills: number;
  matrix: CefrMatrixCellStats[];
  summary: {
    totalGroups: number;
    totalItems: number;
  };
}
