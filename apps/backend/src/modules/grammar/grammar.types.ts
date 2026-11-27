import { CefrLevel } from '@prisma/client';

export const GRAMMAR_FORMULA_FORMS = ['AFFIRMATIVE', 'NEGATIVE', 'QUESTION', 'NOTE'] as const;
export type GrammarFormulaForm = (typeof GRAMMAR_FORMULA_FORMS)[number];

export const CEFR_ORDER: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type LearnerGrammarStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';

export interface GrammarFormulaItem {
  form: GrammarFormulaForm;
  labelVi: string;
  structure: string;
  noteVi?: string;
}

export interface GrammarUsageItem {
  useCaseVi: string;
  signalWords?: string[];
  commonMistakeVi?: string;
}

export interface GrammarExampleItem {
  sentenceEn: string;
  translationVi: string;
  highlight?: string;
}

export interface GrammarTopicPayload {
  formulas: GrammarFormulaItem[];
  usageNotes: GrammarUsageItem[];
  examples: GrammarExampleItem[];
}

export interface GrammarTreeNodeDto {
  id: string;
  code: string;
  parentId: string | null;
  parentCode: string | null;
  cefrLevel: CefrLevel;
  isLeaf: boolean;
  titleEn: string;
  titleVi: string;
  summaryVi: string;
  orderIndex: number;
  prerequisiteCodes: string[];
  dependentCodes: string[];
  lessonCount: number;
  practiceItemCount: number;
  learnerStatus?: LearnerGrammarStatus;
  children: GrammarTreeNodeDto[];
}

export interface GrammarCefrLevelSummaryDto {
  cefrLevel: CefrLevel;
  topicCount: number;
  lessonCount: number;
  sampleGroups: string[];
  completedCount?: number;
}

export interface GrammarTopicListItemDto {
  id: string;
  code: string;
  parentCode: string | null;
  cefrLevel: CefrLevel;
  isLeaf: boolean;
  titleEn: string;
  titleVi: string;
  summaryVi: string;
  orderIndex: number;
  formulaPreview: string | null;
  prerequisiteCodes: string[];
  lessonCount: number;
  practiceItemCount: number;
  learnerStatus?: LearnerGrammarStatus;
}

export interface GrammarLinkedLessonDto {
  id: string;
  code: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  cefrLevel?: CefrLevel;
  state?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface GrammarRelatedNodeDto {
  id: string;
  code: string;
  cefrLevel: CefrLevel;
  titleEn: string;
  titleVi: string;
  learnerStatus?: LearnerGrammarStatus;
}

export interface GrammarTopicDetailDto {
  id: string;
  code: string;
  cefrLevel: CefrLevel;
  isLeaf: boolean;
  titleEn: string;
  titleVi: string;
  summaryVi: string;
  orderIndex: number;
  contentVersion: number;
  parent: GrammarRelatedNodeDto | null;
  children: GrammarRelatedNodeDto[];
  formulas: GrammarFormulaItem[];
  usageNotes: GrammarUsageItem[];
  examples: GrammarExampleItem[];
  prerequisites: GrammarRelatedNodeDto[];
  dependents: GrammarRelatedNodeDto[];
  lessons: GrammarLinkedLessonDto[];
  practiceItemCount: number;
  learnerStatus?: LearnerGrammarStatus;
}

export function validateGrammarTopicPayload(payload: GrammarTopicPayload, isLeaf: boolean, code: string): void {
  if (!Array.isArray(payload.formulas) || !Array.isArray(payload.usageNotes) || !Array.isArray(payload.examples)) {
    throw new Error(`Invalid grammar JSON arrays for "${code}".`);
  }
  if (isLeaf && (payload.formulas.length === 0 || payload.usageNotes.length === 0 || payload.examples.length === 0)) {
    throw new Error(`Leaf grammar topic "${code}" must define formulas, usageNotes, and examples.`);
  }
  for (const formula of payload.formulas) {
    if (
      !formula ||
      !(GRAMMAR_FORMULA_FORMS as readonly string[]).includes(formula.form) ||
      !formula.labelVi?.trim() ||
      !formula.structure?.trim()
    ) {
      throw new Error(`Invalid formula entry in "${code}".`);
    }
  }
  for (const usage of payload.usageNotes) {
    if (!usage || !usage.useCaseVi?.trim()) {
      throw new Error(`Invalid usageNote entry in "${code}".`);
    }
    if (usage.signalWords !== undefined && (!Array.isArray(usage.signalWords) || usage.signalWords.some((w) => !w?.trim()))) {
      throw new Error(`Invalid signalWords in "${code}".`);
    }
  }
  for (const ex of payload.examples) {
    if (!ex || !ex.sentenceEn?.trim() || !ex.translationVi?.trim()) {
      throw new Error(`Invalid example entry in "${code}".`);
    }
  }
}
