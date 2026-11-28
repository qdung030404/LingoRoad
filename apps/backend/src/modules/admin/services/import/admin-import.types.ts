import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
  SpeakingMode,
} from '@prisma/client';
import {
  GrammarExampleItem,
  GrammarFormulaItem,
  GrammarUsageItem,
} from '../../../grammar/grammar.types';

export interface ImportErrorItem {
  path: string;
  message: string;
}

export interface ImportPreviewRecord {
  entity:
    | 'unit'
    | 'lesson'
    | 'item'
    | 'topic'
    | 'speakingPrompt'
    | 'grammarTopic'
    | 'assessmentGroup';
  identifier: string;
  title: string;
  operation: 'CREATE' | 'UPDATE';
}

export interface ImportEntityCount {
  create: number;
  update: number;
}

export interface ImportPreviewSummary {
  totalRecords: number;
  counts: {
    units: ImportEntityCount;
    lessons: ImportEntityCount;
    items: ImportEntityCount;
    topics: ImportEntityCount;
    speakingPrompts: ImportEntityCount;
    grammarTopics: ImportEntityCount;
    assessmentGroups: ImportEntityCount;
  };
  records: ImportPreviewRecord[];
}

export interface ImportValidationResult {
  isValid: boolean;
  errors: ImportErrorItem[];
  preview: ImportPreviewSummary;
}

export interface ImportApplyResult {
  appliedAt: Date;
  preview: ImportPreviewSummary;
}

export interface ImportBundleOptions {
  topicWordsMode?: 'replace' | 'merge';
}

export interface NormalizedUnitInput {
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
}

export interface NormalizedLessonInput {
  code: string;
  kind: LearningKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  sortOrder?: number;
  published: boolean;
  unitCode?: string;
  grammarTopicCode?: string;
  content: unknown;
}

export interface NormalizedAssessmentItemInput {
  externalId?: string;
  groupId?: string | null;
  itemOrder?: number;
  skill: AssessmentSkill;
  skillCode: string;
  cefrLevel: CefrLevel;
  type: ItemType;
  usageScope: ItemUsageScope;
  passage?: string | null;
  prompt: string;
  options?: unknown;
  correctOption?: string | null;
  explanation?: string | null;
  audioUrl?: string | null;
  rubricCriteria?: unknown;
  irtA: number;
  irtB: number;
  irtC: number;
}

export interface NormalizedTopicWordInput {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  imageUrl: string | null;
  audioUrl: string | null;
}

export interface NormalizedTopicInput {
  slug: string;
  titleEn: string;
  titleVi: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  words?: NormalizedTopicWordInput[];
}

export interface NormalizedSpeakingPromptInput {
  code: string;
  mode: SpeakingMode;
  title: string;
  text: string;
  difficulty: number;
  maxDurationSeconds: number;
  hints: string[];
  sampleAsset: string | null;
  imageUrl: string | null;
  visualContext: string | null;
  preparation: unknown;
  linkedReadAloudCodes: string[];
  sortOrder?: number;
  published: boolean;
}

export interface NormalizedGrammarTopicInput {
  code: string;
  parentCode: string | null;
  cefrLevel: CefrLevel;
  isLeaf: boolean;
  titleEn: string;
  titleVi: string;
  summaryVi: string;
  formulas: GrammarFormulaItem[];
  usageNotes: GrammarUsageItem[];
  examples: GrammarExampleItem[];
  orderIndex: number;
  published: boolean;
  prerequisiteCodes?: string[];
}

export interface NormalizedAssessmentGroupInput {
  id?: string;
  skill: AssessmentSkill;
  title: string | null;
  cefrLevel: CefrLevel;
  partNumber: number;
  passage: string | null;
  audioUrl: string | null;
  transcript: string | null;
  usageScope: ItemUsageScope;
}

export interface NormalizedBundle {
  units: unknown[];
  lessons: unknown[];
  items: unknown[];
  topics: unknown[];
  speakingPrompts: unknown[];
  grammarTopics: unknown[];
  assessmentGroups: unknown[];
}

export interface ParsedImportBundle {
  units: NormalizedUnitInput[];
  lessons: NormalizedLessonInput[];
  items: NormalizedAssessmentItemInput[];
  topics: NormalizedTopicInput[];
  speakingPrompts: NormalizedSpeakingPromptInput[];
  grammarTopics: NormalizedGrammarTopicInput[];
  assessmentGroups: NormalizedAssessmentGroupInput[];
}

export const SLUG_REGEX = /^[a-z0-9-]+$/;
export const GRAMMAR_CODE_REGEX = /^grammar(\.[a-z_]+)*$/;
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_IMPORT_RECORDS = 500;
export const CEFR_LEVEL_VALUES = new Set<string>(Object.values(CefrLevel));
export const LEARNING_KIND_VALUES = new Set<string>(Object.values(LearningKind));
export const ASSESSMENT_SKILL_VALUES = new Set<string>(
  Object.values(AssessmentSkill),
);
export const ITEM_TYPE_VALUES = new Set<string>(Object.values(ItemType));
export const USAGE_SCOPE_VALUES = new Set<string>(Object.values(ItemUsageScope));
export const SPEAKING_MODE_VALUES = new Set<string>(Object.values(SpeakingMode));

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isSafeMediaUrl(url: string): boolean {
  if (
    !url ||
    url.length > 500 ||
    url.includes('..') ||
    /[\s\u0000-\u001f]/.test(url)
  ) {
    return false;
  }
  return (
    /^https?:\/\/[^\s]+$/i.test(url) ||
    /^\/media\/[a-z0-9/_.-]+$/i.test(url) ||
    /^assets\/[a-z0-9/_.-]+$/i.test(url)
  );
}

export function extractOptionValues(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  const values: string[] = [];
  for (const entry of options) {
    if (typeof entry === 'string' && entry.trim()) {
      values.push(entry.trim());
    } else if (isPlainObject(entry)) {
      if (typeof entry.id === 'string' && entry.id.trim()) {
        values.push(entry.id.trim());
      }
      if (typeof entry.text === 'string' && entry.text.trim()) {
        values.push(entry.text.trim());
      }
    }
  }
  return values;
}

export function emptyBundle(): NormalizedBundle {
  return {
    units: [],
    lessons: [],
    items: [],
    topics: [],
    speakingPrompts: [],
    grammarTopics: [],
    assessmentGroups: [],
  };
}

export function emptyParsed(): ParsedImportBundle {
  return {
    units: [],
    lessons: [],
    items: [],
    topics: [],
    speakingPrompts: [],
    grammarTopics: [],
    assessmentGroups: [],
  };
}

export function normalizeBundleShape(rawBundle: unknown): {
  bundle: NormalizedBundle;
  shapeError: string | null;
} {
  if (Array.isArray(rawBundle)) {
    const bundle = emptyBundle();
    for (const entry of rawBundle) {
      if (!isPlainObject(entry)) {
        return {
          bundle,
          shapeError:
            'Mỗi phần tử trong mảng JSON phải là một đối tượng (Object).',
        };
      }
      if (
        ('topic' in entry && 'words' in entry) ||
        ('slug' in entry && 'words' in entry)
      ) {
        bundle.topics.push(entry);
      } else if ('content' in entry && 'kind' in entry) {
        bundle.lessons.push(entry);
      } else if ('mode' in entry && 'text' in entry && 'code' in entry) {
        bundle.speakingPrompts.push(entry);
      } else if ('isLeaf' in entry && 'titleEn' in entry && 'code' in entry) {
        bundle.grammarTopics.push(entry);
      } else if (
        'partNumber' in entry &&
        'skill' in entry &&
        !('prompt' in entry)
      ) {
        bundle.assessmentGroups.push(entry);
      } else if ('prompt' in entry && ('cefrLevel' in entry || 'skill' in entry)) {
        bundle.items.push(entry);
      } else if (
        'code' in entry &&
        'cefrLevel' in entry &&
        'orderIndex' in entry &&
        'title' in entry
      ) {
        bundle.units.push(entry);
      } else {
        return {
          bundle,
          shapeError:
            'Không thể tự nhận diện loại bản ghi trong mảng JSON. Hãy dùng cấu trúc { "units": [], "lessons": [], "items": [], "topics": [], "speakingPrompts": [], "grammarTopics": [], "assessmentGroups": [] }.',
        };
      }
    }
    return { bundle, shapeError: null };
  }

  if (!isPlainObject(rawBundle)) {
    return {
      bundle: emptyBundle(),
      shapeError:
        'Dữ liệu import phải là đối tượng JSON ({ units, lessons, items, topics, speakingPrompts, grammarTopics, assessmentGroups }) hoặc mảng JSON hợp lệ.',
    };
  }

  const keys = [
    'units',
    'lessons',
    'items',
    'topics',
    'speakingPrompts',
    'grammarTopics',
    'assessmentGroups',
  ] as const;
  const bundle = emptyBundle();
  for (const key of keys) {
    const value = rawBundle[key];
    if (value !== undefined && !Array.isArray(value)) {
      return {
        bundle,
        shapeError: `Trường "${key}" bắt buộc phải là một mảng (Array).`,
      };
    }
    bundle[key] = Array.isArray(value) ? value : [];
  }

  return { bundle, shapeError: null };
}
