import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
  Prisma,
} from '@prisma/client';

export interface AdminUnitItem {
  id: string;
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
  lessonsCount: number;
}

export interface AdminLessonSummary {
  id: string;
  code: string;
  kind: LearningKind;
  primarySkillCode: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  sortOrder: number;
  published: boolean;
  contentVersion: number;
  questionsCount: number;
  attemptsCount: number;
  unit: {
    id: string;
    code: string;
    title: string;
    cefrLevel: CefrLevel;
  } | null;
  grammarTopic: {
    id: string;
    code: string;
    titleVi: string;
    cefrLevel: CefrLevel;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonsListSummary {
  total: number;
  published: number;
  drafts: number;
  linkedQuestions: number;
}

export interface AdminLessonDetail extends AdminLessonSummary {
  content: Prisma.JsonValue;
}

export interface AdminAssessmentItemView {
  id: string;
  externalId: string | null;
  groupId: string | null;
  itemOrder: number;
  group: {
    id: string;
    title: string | null;
    skill: AssessmentSkill;
    cefrLevel: CefrLevel;
    partNumber: number;
  } | null;
  skill: AssessmentSkill | null;
  skillCode: string;
  cefrLevel: CefrLevel;
  type: ItemType;
  usageScope: ItemUsageScope;
  passage: string | null;
  prompt: string;
  options: Prisma.JsonValue | null;
  correctOption: string | null;
  explanation: string | null;
  audioUrl: string | null;
  rubricCriteria: Prisma.JsonValue | null;
  irtA: number;
  irtB: number;
  irtC: number;
  responsesCount: number;
  activeSessionsCount: number;
  createdAt: Date;
}

export interface AssessmentItemsSummary {
  total: number;
  mcqCount: number;
  clozeAndOtherCount: number;
  coveredSkillsCount: number;
}

export interface AdminAssessmentGroupView {
  id: string;
  skill: AssessmentSkill;
  title: string | null;
  cefrLevel: CefrLevel;
  partNumber: number;
  passage: string | null;
  audioUrl: string | null;
  transcript: string | null;
  usageScope: ItemUsageScope;
  itemsCount: number;
  items?: Array<{
    id: string;
    externalId: string | null;
    itemOrder: number;
    skillCode: string;
    type: ItemType;
    prompt: string;
  }>;
  createdAt: Date;
}

export const LESSON_INCLUDE = {
  unit: {
    select: { id: true, code: true, title: true, cefrLevel: true },
  },
  grammarTopic: {
    select: { id: true, code: true, titleVi: true, cefrLevel: true },
  },
  _count: { select: { attempts: true } },
} as const;

export const ITEM_INCLUDE = {
  group: {
    select: { id: true, title: true, skill: true, cefrLevel: true, partNumber: true },
  },
  _count: { select: { responses: true, currentSessions: true } },
} as const;

export type ItemRowWithCount = {
  id: string;
  externalId: string | null;
  groupId?: string | null;
  itemOrder?: number;
  group?: {
    id: string;
    title: string | null;
    skill: AssessmentSkill;
    cefrLevel: CefrLevel;
    partNumber: number;
  } | null;
  skill: AssessmentSkill | null;
  skillCode: string;
  cefrLevel: CefrLevel;
  type: ItemType;
  usageScope: ItemUsageScope;
  passage: string | null;
  prompt: string;
  options: Prisma.JsonValue | null;
  correctOption: string | null;
  explanation: string | null;
  audioUrl: string | null;
  rubricCriteria?: Prisma.JsonValue | null;
  irtA: number;
  irtB: number;
  irtC: number;
  createdAt: Date;
  _count?: { responses?: number; currentSessions?: number };
};

export function extractQuestionsCount(content: Prisma.JsonValue): number {
  if (
    content &&
    typeof content === 'object' &&
    !Array.isArray(content) &&
    Array.isArray((content as { questions?: unknown }).questions)
  ) {
    return (content as { questions: unknown[] }).questions.length;
  }
  return 0;
}

export function extractPrimarySkillCode(
  kind: LearningKind,
  content: Prisma.JsonValue,
): string {
  if (
    content &&
    typeof content === 'object' &&
    !Array.isArray(content) &&
    Array.isArray((content as { questions?: unknown }).questions)
  ) {
    const firstWithSkill = (
      content as { questions: Array<{ skillCode?: unknown }> }
    ).questions.find(
      (q) => typeof q?.skillCode === 'string' && q.skillCode.trim().length > 0,
    );
    if (firstWithSkill && typeof firstWithSkill.skillCode === 'string') {
      return firstWithSkill.skillCode.trim();
    }
  }
  if (kind === LearningKind.GRAMMAR) return 'grammar.general';
  if (kind === LearningKind.VOCABULARY) return 'vocabulary.general';
  if (kind === LearningKind.READING) return 'reading.comprehension';
  return 'listening.comprehension';
}

export function extractOptionValues(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  const values: string[] = [];
  for (const entry of options) {
    if (typeof entry === 'string' && entry.trim()) {
      values.push(entry.trim());
    } else if (entry && typeof entry === 'object') {
      const obj = entry as { id?: unknown; text?: unknown };
      if (typeof obj.id === 'string' && obj.id.trim()) values.push(obj.id.trim());
      if (typeof obj.text === 'string' && obj.text.trim()) {
        values.push(obj.text.trim());
      }
    }
  }
  return values;
}

export function mapAssessmentItemView(row: ItemRowWithCount): AdminAssessmentItemView {
  return {
    id: row.id,
    externalId: row.externalId ?? null,
    groupId: row.groupId ?? null,
    itemOrder: row.itemOrder ?? 1,
    group: row.group ?? null,
    skill: row.skill,
    skillCode: row.skillCode,
    cefrLevel: row.cefrLevel,
    type: row.type,
    usageScope: row.usageScope,
    passage: row.passage,
    prompt: row.prompt,
    options: row.options,
    correctOption: row.correctOption,
    explanation: row.explanation,
    audioUrl: row.audioUrl,
    rubricCriteria: row.rubricCriteria ?? null,
    irtA: row.irtA,
    irtB: row.irtB,
    irtC: row.irtC,
    responsesCount: row._count?.responses ?? 0,
    activeSessionsCount: row._count?.currentSessions ?? 0,
    createdAt: row.createdAt,
  };
}
