import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
  Prisma,
  SpeakingMode,
} from '@prisma/client';
import { AssessmentMatrixService } from '../../assessment/services/assessment-matrix.service';
import {
  GrammarExampleItem,
  GrammarFormulaItem,
  GrammarUsageItem,
  validateGrammarTopicPayload,
} from '../../grammar/grammar.types';
import { isSafeImageUrl, validateLearningContent } from '../../learning/learning.types';
import { validateListeningAudio } from '../../learning/listening-media';
import { learningMediaRoot } from '../../learning/learning.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CuratedVocabularyService } from '../../vocabulary/curated-vocabulary.service';
import {
  adminPlacementBankVersion,
  assertReferencedItemUnchanged,
  lockAssessmentItem,
} from './assessment-item-integrity';

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

interface NormalizedUnitInput {
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
}

interface NormalizedLessonInput {
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

interface NormalizedAssessmentItemInput {
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

interface NormalizedTopicWordInput {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  imageUrl: string | null;
  audioUrl: string | null;
}

interface NormalizedTopicInput {
  slug: string;
  titleEn: string;
  titleVi: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  words?: NormalizedTopicWordInput[];
}

interface NormalizedSpeakingPromptInput {
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

interface NormalizedGrammarTopicInput {
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
}

interface NormalizedAssessmentGroupInput {
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

const SLUG_REGEX = /^[a-z0-9-]+$/;
const GRAMMAR_CODE_REGEX = /^grammar\.[a-z0-9._-]+$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IMPORT_RECORDS = 500;
const CEFR_LEVEL_VALUES = new Set<string>(Object.values(CefrLevel));
const LEARNING_KIND_VALUES = new Set<string>(Object.values(LearningKind));
const ASSESSMENT_SKILL_VALUES = new Set<string>(Object.values(AssessmentSkill));
const ITEM_TYPE_VALUES = new Set<string>(Object.values(ItemType));
const USAGE_SCOPE_VALUES = new Set<string>(Object.values(ItemUsageScope));
const SPEAKING_MODE_VALUES = new Set<string>(Object.values(SpeakingMode));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isSafeMediaUrl(url: string): boolean {
  if (!url || url.length > 500 || url.includes('..') || /[\s\u0000-\u001f]/.test(url)) {
    return false;
  }
  return (
    /^https?:\/\/[^\s]+$/i.test(url) ||
    /^\/media\/[a-z0-9/_.-]+$/i.test(url) ||
    /^assets\/[a-z0-9/_.-]+$/i.test(url)
  );
}

function extractOptionValues(options: unknown): string[] {
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

interface NormalizedBundle {
  units: unknown[];
  lessons: unknown[];
  items: unknown[];
  topics: unknown[];
  speakingPrompts: unknown[];
  grammarTopics: unknown[];
  assessmentGroups: unknown[];
}

function emptyBundle(): NormalizedBundle {
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

function emptyParsed() {
  return {
    units: [] as NormalizedUnitInput[],
    lessons: [] as NormalizedLessonInput[],
    items: [] as NormalizedAssessmentItemInput[],
    topics: [] as NormalizedTopicInput[],
    speakingPrompts: [] as NormalizedSpeakingPromptInput[],
    grammarTopics: [] as NormalizedGrammarTopicInput[],
    assessmentGroups: [] as NormalizedAssessmentGroupInput[],
  };
}

@Injectable()
export class AdminImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentMatrixService: AssessmentMatrixService,
    private readonly curatedVocabularyService: CuratedVocabularyService,
  ) {}

  private normalizeBundleShape(rawBundle: unknown): {
    bundle: NormalizedBundle;
    shapeError: string | null;
  } {
    if (Array.isArray(rawBundle)) {
      const bundle = emptyBundle();
      for (const entry of rawBundle) {
        if (!isPlainObject(entry)) {
          return {
            bundle,
            shapeError: 'Mỗi phần tử trong mảng JSON phải là một đối tượng (Object).',
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
        } else if ('partNumber' in entry && 'skill' in entry && !('prompt' in entry)) {
          bundle.assessmentGroups.push(entry);
        } else if ('prompt' in entry && ('cefrLevel' in entry || 'skill' in entry)) {
          bundle.items.push(entry);
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

  private async inspectBundle(rawBundle: unknown): Promise<{
    validation: ImportValidationResult;
    parsed: ReturnType<typeof emptyParsed>;
  }> {
    const emptyPreview: ImportPreviewSummary = {
      totalRecords: 0,
      counts: {
        units: { create: 0, update: 0 },
        lessons: { create: 0, update: 0 },
        items: { create: 0, update: 0 },
        topics: { create: 0, update: 0 },
        speakingPrompts: { create: 0, update: 0 },
        grammarTopics: { create: 0, update: 0 },
        assessmentGroups: { create: 0, update: 0 },
      },
      records: [],
    };

    const { bundle, shapeError } = this.normalizeBundleShape(rawBundle);
    if (shapeError) {
      return {
        validation: {
          isValid: false,
          errors: [{ path: '$', message: shapeError }],
          preview: emptyPreview,
        },
        parsed: emptyParsed(),
      };
    }

    const totalRecords =
      bundle.units.length +
      bundle.lessons.length +
      bundle.items.length +
      bundle.topics.length +
      bundle.speakingPrompts.length +
      bundle.grammarTopics.length +
      bundle.assessmentGroups.length;

    if (totalRecords === 0) {
      return {
        validation: {
          isValid: false,
          errors: [
            {
              path: '$',
              message:
                'Gói JSON không có bản ghi nào (cần ít nhất 1 unit, lesson, item, topic, speakingPrompt, grammarTopic hoặc assessmentGroup).',
            },
          ],
          preview: emptyPreview,
        },
        parsed: emptyParsed(),
      };
    }

    if (totalRecords > MAX_IMPORT_RECORDS) {
      return {
        validation: {
          isValid: false,
          errors: [
            {
              path: '$',
              message: `Mỗi lần import tối đa ${MAX_IMPORT_RECORDS} bản ghi (hiện tại: ${totalRecords}).`,
            },
          ],
          preview: emptyPreview,
        },
        parsed: emptyParsed(),
      };
    }

    const lessonsNeedGrammar = bundle.lessons.some(
      (raw) => isPlainObject(raw) && Boolean(asTrimmedString(raw.grammarTopicCode)),
    );
    const itemsNeedGroups = bundle.items.some(
      (raw) => isPlainObject(raw) && Boolean(asTrimmedString(raw.groupId)),
    );

    const [
      existingUnits,
      existingLessons,
      existingItems,
      existingTopics,
      existingSpeakingPrompts,
      existingGrammarTopics,
      existingAssessmentGroups,
    ] = await Promise.all([
      this.prisma.learningUnit.findMany({
        select: { id: true, code: true, cefrLevel: true, orderIndex: true },
      }),
      bundle.lessons.length > 0
        ? this.prisma.learningLesson.findMany({
            select: { code: true },
          })
        : Promise.resolve([]),
      bundle.items.length > 0
        ? this.prisma.assessmentItem.findMany({
            where: { externalId: { not: null } },
            select: { externalId: true },
          })
        : Promise.resolve([]),
      bundle.topics.length > 0
        ? this.prisma.curatedTopic.findMany({
            select: { slug: true },
          })
        : Promise.resolve([]),
      bundle.speakingPrompts.length > 0
        ? this.prisma.speakingPrompt.findMany({
            select: { code: true },
          })
        : Promise.resolve([]),
      bundle.grammarTopics.length > 0 || lessonsNeedGrammar
        ? this.prisma.grammarTopic.findMany({
            select: { id: true, code: true, isLeaf: true },
          })
        : Promise.resolve([]),
      bundle.assessmentGroups.length > 0 || itemsNeedGroups
        ? this.prisma.assessmentItemGroup.findMany({
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    const existingUnitByCode = new Map(existingUnits.map((u) => [u.code, u]));
    const existingUnitByLevelOrder = new Map(
      existingUnits.map((u) => [`${u.cefrLevel}:${u.orderIndex}`, u.code]),
    );
    const existingLessonCodes = new Set(existingLessons.map((l) => l.code));
    const existingItemExternalIds = new Set(
      existingItems
        .map((i) => i.externalId)
        .filter((id): id is string => typeof id === 'string'),
    );
    const existingTopicSlugs = new Set(existingTopics.map((t) => t.slug));
    const existingSpeakingCodes = new Set(existingSpeakingPrompts.map((s) => s.code));
    const existingGrammarByCode = new Map(
      existingGrammarTopics.map((g) => [g.code, g]),
    );
    const existingGroupIds = new Set(existingAssessmentGroups.map((g) => g.id));

    const errors: ImportErrorItem[] = [];
    const records: ImportPreviewRecord[] = [];
    const counts: ImportPreviewSummary['counts'] = {
      units: { create: 0, update: 0 },
      lessons: { create: 0, update: 0 },
      items: { create: 0, update: 0 },
      topics: { create: 0, update: 0 },
      speakingPrompts: { create: 0, update: 0 },
      grammarTopics: { create: 0, update: 0 },
      assessmentGroups: { create: 0, update: 0 },
    };

    // 1. Units
    const parsedUnits: NormalizedUnitInput[] = [];
    const bundleUnitCodes = new Set<string>();
    const bundleUnitOrderKeys = new Map<string, string>();

    bundle.units.forEach((raw, idx) => {
      const path = `units[${idx}]`;
      if (!isPlainObject(raw)) {
        errors.push({ path, message: 'Unit phải là một đối tượng JSON.' });
        return;
      }
      const code = asTrimmedString(raw.code).toLowerCase();
      const cefrLevel = asTrimmedString(raw.cefrLevel).toUpperCase();
      const orderIndex = Number(raw.orderIndex);
      const title = asTrimmedString(raw.title);
      const description = asTrimmedString(raw.description);

      let itemValid = true;
      if (!code || !SLUG_REGEX.test(code) || code.length > 100) {
        errors.push({
          path: `${path}.code`,
          message: 'Mã chương chỉ gồm chữ thường, số và dấu gạch ngang (<= 100 ký tự).',
        });
        itemValid = false;
      } else if (bundleUnitCodes.has(code)) {
        errors.push({
          path: `${path}.code`,
          message: `Mã chương "${code}" bị trùng trong gói JSON.`,
        });
        itemValid = false;
      }

      if (!CEFR_LEVEL_VALUES.has(cefrLevel)) {
        errors.push({
          path: `${path}.cefrLevel`,
          message: 'cefrLevel phải thuộc A1, A2, B1, B2, C1 hoặc C2.',
        });
        itemValid = false;
      }

      if (!Number.isInteger(orderIndex) || orderIndex < 1) {
        errors.push({
          path: `${path}.orderIndex`,
          message: 'orderIndex phải là số nguyên >= 1.',
        });
        itemValid = false;
      }

      if (!title || title.length > 200) {
        errors.push({
          path: `${path}.title`,
          message: 'Tiêu đề chương không được rỗng và tối đa 200 ký tự.',
        });
        itemValid = false;
      }

      if (!description) {
        errors.push({
          path: `${path}.description`,
          message: 'Mô tả chương không được để trống.',
        });
        itemValid = false;
      }

      if (CEFR_LEVEL_VALUES.has(cefrLevel) && Number.isInteger(orderIndex)) {
        const orderKey = `${cefrLevel}:${orderIndex}`;
        const prevInBundle = bundleUnitOrderKeys.get(orderKey);
        const ownerInDb = existingUnitByLevelOrder.get(orderKey);
        if (prevInBundle && prevInBundle !== code) {
          errors.push({
            path: `${path}.orderIndex`,
            message: `Cặp (${cefrLevel}, orderIndex=${orderIndex}) bị trùng với "${prevInBundle}" trong gói JSON.`,
          });
          itemValid = false;
        } else if (ownerInDb && ownerInDb !== code) {
          errors.push({
            path: `${path}.orderIndex`,
            message: `Bậc ${cefrLevel} đã có chương thứ ${orderIndex} ("${ownerInDb}") trong DB.`,
          });
          itemValid = false;
        } else if (code) {
          bundleUnitOrderKeys.set(orderKey, code);
        }
      }

      if (!itemValid) return;

      bundleUnitCodes.add(code);
      const op: 'CREATE' | 'UPDATE' = existingUnitByCode.has(code)
        ? 'UPDATE'
        : 'CREATE';
      if (op === 'CREATE') counts.units.create += 1;
      else counts.units.update += 1;

      records.push({
        entity: 'unit',
        identifier: code,
        title: `[${cefrLevel}] ${title}`,
        operation: op,
      });
      parsedUnits.push({
        code,
        cefrLevel: cefrLevel as CefrLevel,
        orderIndex,
        title,
        description,
      });
    });

    // 2. Grammar Topics (parsed before Lessons so lessons can reference bundled grammarTopicCode)
    const parsedGrammarTopics: NormalizedGrammarTopicInput[] = [];
    const bundleGrammarByCode = new Map<string, NormalizedGrammarTopicInput>();

    bundle.grammarTopics.forEach((raw, idx) => {
      const path = `grammarTopics[${idx}]`;
      if (!isPlainObject(raw)) {
        errors.push({ path, message: 'GrammarTopic phải là một đối tượng JSON.' });
        return;
      }

      const code = asTrimmedString(raw.code).toLowerCase();
      const parentCode = asTrimmedString(raw.parentCode).toLowerCase() || null;
      const cefrLevel = asTrimmedString(raw.cefrLevel).toUpperCase();
      const isLeaf = typeof raw.isLeaf === 'boolean' ? raw.isLeaf : true;
      const titleEn = asTrimmedString(raw.titleEn);
      const titleVi = asTrimmedString(raw.titleVi);
      const summaryVi = asTrimmedString(raw.summaryVi);
      const orderIndex =
        raw.orderIndex !== undefined ? Number(raw.orderIndex) : idx;
      const published = typeof raw.published === 'boolean' ? raw.published : true;
      const formulas = (Array.isArray(raw.formulas) ? raw.formulas : []) as GrammarFormulaItem[];
      const usageNotes = (Array.isArray(raw.usageNotes) ? raw.usageNotes : []) as GrammarUsageItem[];
      const examples = (Array.isArray(raw.examples) ? raw.examples : []) as GrammarExampleItem[];

      let itemValid = true;
      if (!code || !GRAMMAR_CODE_REGEX.test(code) || code.length > 100) {
        errors.push({
          path: `${path}.code`,
          message: 'Mã ngữ pháp phải bắt đầu bằng "grammar." và chỉ gồm chữ thường/số/._- (<= 100 ký tự).',
        });
        itemValid = false;
      } else if (bundleGrammarByCode.has(code)) {
        errors.push({
          path: `${path}.code`,
          message: `Mã ngữ pháp "${code}" bị trùng trong gói JSON.`,
        });
        itemValid = false;
      }

      if (!CEFR_LEVEL_VALUES.has(cefrLevel)) {
        errors.push({
          path: `${path}.cefrLevel`,
          message: 'cefrLevel phải thuộc A1..C2.',
        });
        itemValid = false;
      }

      if (!titleEn || titleEn.length > 150 || !titleVi || titleVi.length > 150) {
        errors.push({
          path: `${path}.title`,
          message: 'titleEn và titleVi không được rỗng (<= 150 ký tự).',
        });
        itemValid = false;
      }

      if (!Number.isInteger(orderIndex) || orderIndex < 0) {
        errors.push({
          path: `${path}.orderIndex`,
          message: 'orderIndex phải là số nguyên >= 0.',
        });
        itemValid = false;
      }

      if (itemValid) {
        try {
          validateGrammarTopicPayload({ formulas, usageNotes, examples }, isLeaf, code);
        } catch (err) {
          errors.push({
            path,
            message:
              err instanceof Error
                ? err.message
                : 'Nội dung cấu trúc ngữ pháp không hợp lệ.',
          });
          itemValid = false;
        }
      }

      if (!itemValid) return;

      const normalized: NormalizedGrammarTopicInput = {
        code,
        parentCode,
        cefrLevel: cefrLevel as CefrLevel,
        isLeaf,
        titleEn,
        titleVi,
        summaryVi,
        formulas,
        usageNotes,
        examples,
        orderIndex,
        published,
      };
      bundleGrammarByCode.set(code, normalized);
      parsedGrammarTopics.push(normalized);

      const op: 'CREATE' | 'UPDATE' = existingGrammarByCode.has(code)
        ? 'UPDATE'
        : 'CREATE';
      if (op === 'CREATE') counts.grammarTopics.create += 1;
      else counts.grammarTopics.update += 1;

      records.push({
        entity: 'grammarTopic',
        identifier: code,
        title: `[${cefrLevel}] ${titleVi}`,
        operation: op,
      });
    });

    // Validate parentCode links across bundle + DB
    parsedGrammarTopics.forEach((g, idx) => {
      if (!g.parentCode) return;
      if (g.parentCode === g.code) {
        errors.push({
          path: `grammarTopics[${idx}].parentCode`,
          message: `Chủ điểm ngữ pháp "${g.code}" không thể là cha của chính nó.`,
        });
        return;
      }
      const inBundle = bundleGrammarByCode.get(g.parentCode);
      const inDb = existingGrammarByCode.get(g.parentCode);
      if (!inBundle && !inDb) {
        errors.push({
          path: `grammarTopics[${idx}].parentCode`,
          message: `Không tìm thấy parentCode "${g.parentCode}" trong DB hoặc gói JSON.`,
        });
      } else if ((inBundle && inBundle.isLeaf) || (!inBundle && inDb?.isLeaf)) {
        errors.push({
          path: `grammarTopics[${idx}].parentCode`,
          message: `Nút cha "${g.parentCode}" phải là nhóm (isLeaf = false).`,
        });
      }
    });

    // 3. Assessment Groups (parsed before Items so items can reference groupId)
    const parsedGroups: NormalizedAssessmentGroupInput[] = [];
    const bundleGroupIds = new Set<string>();

    bundle.assessmentGroups.forEach((raw, idx) => {
      const path = `assessmentGroups[${idx}]`;
      if (!isPlainObject(raw)) {
        errors.push({ path, message: 'AssessmentGroup phải là một đối tượng JSON.' });
        return;
      }

      const id = asTrimmedString(raw.id) || undefined;
      const skill = asTrimmedString(raw.skill).toUpperCase();
      const cefrLevel = asTrimmedString(raw.cefrLevel).toUpperCase();
      const usageScope = (
        asTrimmedString(raw.usageScope) || ItemUsageScope.ALL
      ).toUpperCase();
      const partNumber =
        raw.partNumber !== undefined ? Number(raw.partNumber) : 1;
      const title = asTrimmedString(raw.title) || null;
      const passage = asTrimmedString(raw.passage) || null;
      const audioUrl = asTrimmedString(raw.audioUrl) || null;
      const transcript = asTrimmedString(raw.transcript) || null;

      let itemValid = true;
      if (id && !UUID_REGEX.test(id)) {
        errors.push({
          path: `${path}.id`,
          message: 'id của AssessmentGroup phải là UUID hợp lệ.',
        });
        itemValid = false;
      }
      if (!ASSESSMENT_SKILL_VALUES.has(skill)) {
        errors.push({
          path: `${path}.skill`,
          message: 'skill phải là READING, LISTENING, WRITING hoặc SPEAKING.',
        });
        itemValid = false;
      }
      if (!CEFR_LEVEL_VALUES.has(cefrLevel)) {
        errors.push({
          path: `${path}.cefrLevel`,
          message: 'cefrLevel phải thuộc A1..C2.',
        });
        itemValid = false;
      }
      if (!USAGE_SCOPE_VALUES.has(usageScope)) {
        errors.push({
          path: `${path}.usageScope`,
          message: `usageScope "${usageScope}" không hợp lệ.`,
        });
        itemValid = false;
      }
      if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 20) {
        errors.push({
          path: `${path}.partNumber`,
          message: 'partNumber phải là số nguyên từ 1 đến 20.',
        });
        itemValid = false;
      }
      if (audioUrl && !isSafeMediaUrl(audioUrl)) {
        errors.push({
          path: `${path}.audioUrl`,
          message: 'audioUrl không hợp lệ.',
        });
        itemValid = false;
      }

      if (!itemValid) return;
      if (id) bundleGroupIds.add(id);

      const op: 'CREATE' | 'UPDATE' =
        id && existingGroupIds.has(id) ? 'UPDATE' : 'CREATE';
      if (op === 'CREATE') counts.assessmentGroups.create += 1;
      else counts.assessmentGroups.update += 1;

      records.push({
        entity: 'assessmentGroup',
        identifier: id ?? `group-${idx + 1}`,
        title: title ?? `[${skill} ${cefrLevel}] Part ${partNumber}`,
        operation: op,
      });
      parsedGroups.push({
        id,
        skill: skill as AssessmentSkill,
        title,
        cefrLevel: cefrLevel as CefrLevel,
        partNumber,
        passage,
        audioUrl,
        transcript,
        usageScope: usageScope as ItemUsageScope,
      });
    });

    // 4. Lessons
    const parsedLessons: NormalizedLessonInput[] = [];
    const bundleLessonCodes = new Set<string>();

    bundle.lessons.forEach((raw, idx) => {
      const path = `lessons[${idx}]`;
      if (!isPlainObject(raw)) {
        errors.push({ path, message: 'Lesson phải là một đối tượng JSON.' });
        return;
      }

      const code = asTrimmedString(raw.code).toLowerCase();
      const kind = asTrimmedString(raw.kind).toUpperCase();
      const title = asTrimmedString(raw.title);
      const description = asTrimmedString(raw.description);
      const estimatedMinutes = Number(raw.estimatedMinutes ?? 5);
      const sortOrderRaw = raw.sortOrder;
      const sortOrder =
        sortOrderRaw !== undefined && sortOrderRaw !== null
          ? Number(sortOrderRaw)
          : undefined;
      const published =
        typeof raw.published === 'boolean' ? raw.published : true;
      const unitCode = asTrimmedString(raw.unitCode).toLowerCase() || undefined;
      const grammarTopicCode =
        asTrimmedString(raw.grammarTopicCode).toLowerCase() || undefined;

      let itemValid = true;
      if (!code || !SLUG_REGEX.test(code) || code.length > 100) {
        errors.push({
          path: `${path}.code`,
          message: 'Mã bài học chỉ gồm chữ thường, số và dấu gạch ngang (<= 100 ký tự).',
        });
        itemValid = false;
      } else if (bundleLessonCodes.has(code)) {
        errors.push({
          path: `${path}.code`,
          message: `Mã bài học "${code}" bị trùng trong gói JSON.`,
        });
        itemValid = false;
      }

      if (!LEARNING_KIND_VALUES.has(kind)) {
        errors.push({
          path: `${path}.kind`,
          message: 'kind phải là GRAMMAR, VOCABULARY, READING hoặc LISTENING.',
        });
        itemValid = false;
      }

      if (!title || title.length > 200) {
        errors.push({
          path: `${path}.title`,
          message: 'Tiêu đề bài học không được rỗng và tối đa 200 ký tự.',
        });
        itemValid = false;
      }

      if (!description) {
        errors.push({
          path: `${path}.description`,
          message: 'Mô tả bài học không được để trống.',
        });
        itemValid = false;
      }

      if (
        !Number.isInteger(estimatedMinutes) ||
        estimatedMinutes < 1 ||
        estimatedMinutes > 120
      ) {
        errors.push({
          path: `${path}.estimatedMinutes`,
          message: 'estimatedMinutes phải là số nguyên từ 1 đến 120.',
        });
        itemValid = false;
      }

      if (
        sortOrder !== undefined &&
        (!Number.isInteger(sortOrder) || sortOrder < 0)
      ) {
        errors.push({
          path: `${path}.sortOrder`,
          message: 'sortOrder phải là số nguyên >= 0.',
        });
        itemValid = false;
      }

      if (
        unitCode &&
        !existingUnitByCode.has(unitCode) &&
        !bundleUnitCodes.has(unitCode)
      ) {
        errors.push({
          path: `${path}.unitCode`,
          message: `Không tìm thấy unitCode "${unitCode}" trong DB hoặc trong danh sách units đính kèm.`,
        });
        itemValid = false;
      }

      if (grammarTopicCode) {
        const bundledTopic = bundleGrammarByCode.get(grammarTopicCode);
        const dbTopic = existingGrammarByCode.get(grammarTopicCode);
        if (!bundledTopic && !dbTopic) {
          errors.push({
            path: `${path}.grammarTopicCode`,
            message: `Không tìm thấy grammarTopicCode "${grammarTopicCode}" trong DB hoặc gói JSON.`,
          });
          itemValid = false;
        } else if (
          (bundledTopic && !bundledTopic.isLeaf) ||
          (!bundledTopic && dbTopic && !dbTopic.isLeaf)
        ) {
          errors.push({
            path: `${path}.grammarTopicCode`,
            message: `Chủ điểm ngữ pháp "${grammarTopicCode}" phải là cấu trúc lá (isLeaf = true).`,
          });
          itemValid = false;
        }
      }

      if (LEARNING_KIND_VALUES.has(kind)) {
        try {
          validateLearningContent(raw.content, kind as LearningKind);
          if (published) validateListeningAudio(raw.content, learningMediaRoot());
        } catch (err) {
          errors.push({
            path: `${path}.content`,
            message:
              err instanceof Error
                ? err.message
                : 'Nội dung bài học không hợp lệ.',
          });
          itemValid = false;
        }
      }

      if (!itemValid) return;

      bundleLessonCodes.add(code);
      const op: 'CREATE' | 'UPDATE' = existingLessonCodes.has(code)
        ? 'UPDATE'
        : 'CREATE';
      if (op === 'CREATE') counts.lessons.create += 1;
      else counts.lessons.update += 1;

      records.push({
        entity: 'lesson',
        identifier: code,
        title,
        operation: op,
      });
      parsedLessons.push({
        code,
        kind: kind as LearningKind,
        title,
        description,
        estimatedMinutes,
        sortOrder,
        published,
        unitCode,
        grammarTopicCode,
        content: raw.content,
      });
    });

    // 5. Assessment Items
    const parsedItems: NormalizedAssessmentItemInput[] = [];
    const bundleItemExternalIds = new Set<string>();

    bundle.items.forEach((raw, idx) => {
      const path = `items[${idx}]`;
      if (!isPlainObject(raw)) {
        errors.push({ path, message: 'Item phải là một đối tượng JSON.' });
        return;
      }

      const externalId = asTrimmedString(raw.externalId) || undefined;
      const groupId = asTrimmedString(raw.groupId) || null;
      const itemOrder =
        raw.itemOrder !== undefined && raw.itemOrder !== null
          ? Number(raw.itemOrder)
          : undefined;
      const skill = asTrimmedString(raw.skill).toUpperCase();
      const cefrLevel = asTrimmedString(raw.cefrLevel).toUpperCase();
      const type = (
        asTrimmedString(raw.type) || ItemType.MULTIPLE_CHOICE
      ).toUpperCase();
      const usageScope = (
        asTrimmedString(raw.usageScope) || ItemUsageScope.ALL
      ).toUpperCase();
      const skillCode =
        asTrimmedString(raw.skillCode) ||
        (ASSESSMENT_SKILL_VALUES.has(skill)
          ? `${skill.toLowerCase()}.general`
          : '');
      const prompt = asTrimmedString(raw.prompt);
      const passage = asTrimmedString(raw.passage) || null;
      const correctOption = asTrimmedString(raw.correctOption) || null;
      const explanation = asTrimmedString(raw.explanation) || null;
      const audioUrl = asTrimmedString(raw.audioUrl) || null;
      const rubricCriteria = raw.rubricCriteria;
      const irtA = raw.irtA !== undefined ? Number(raw.irtA) : 1.0;
      const irtB = raw.irtB !== undefined ? Number(raw.irtB) : 0.0;
      const irtC = raw.irtC !== undefined ? Number(raw.irtC) : 0.25;

      let itemValid = true;
      if (externalId) {
        if (externalId.length > 100) {
          errors.push({
            path: `${path}.externalId`,
            message: 'externalId tối đa 100 ký tự.',
          });
          itemValid = false;
        } else if (bundleItemExternalIds.has(externalId)) {
          errors.push({
            path: `${path}.externalId`,
            message: `externalId "${externalId}" bị trùng trong gói JSON.`,
          });
          itemValid = false;
        }
      }

      if (groupId) {
        if (!UUID_REGEX.test(groupId)) {
          errors.push({
            path: `${path}.groupId`,
            message: 'groupId phải là UUID hợp lệ.',
          });
          itemValid = false;
        } else if (!existingGroupIds.has(groupId) && !bundleGroupIds.has(groupId)) {
          errors.push({
            path: `${path}.groupId`,
            message: `Không tìm thấy groupId "${groupId}" trong DB hoặc gói JSON.`,
          });
          itemValid = false;
        }
      }

      if (itemOrder !== undefined && (!Number.isInteger(itemOrder) || itemOrder < 1)) {
        errors.push({
          path: `${path}.itemOrder`,
          message: 'itemOrder phải là số nguyên >= 1.',
        });
        itemValid = false;
      }

      if (!ASSESSMENT_SKILL_VALUES.has(skill)) {
        errors.push({
          path: `${path}.skill`,
          message: 'skill phải là READING, LISTENING, WRITING hoặc SPEAKING.',
        });
        itemValid = false;
      }

      if (!CEFR_LEVEL_VALUES.has(cefrLevel)) {
        errors.push({
          path: `${path}.cefrLevel`,
          message: 'cefrLevel phải thuộc A1..C2.',
        });
        itemValid = false;
      }

      if (!ITEM_TYPE_VALUES.has(type)) {
        errors.push({
          path: `${path}.type`,
          message: `type "${type}" không hợp lệ.`,
        });
        itemValid = false;
      }

      if (!USAGE_SCOPE_VALUES.has(usageScope)) {
        errors.push({
          path: `${path}.usageScope`,
          message: `usageScope "${usageScope}" không hợp lệ.`,
        });
        itemValid = false;
      }

      if (!skillCode || skillCode.length > 100) {
        errors.push({
          path: `${path}.skillCode`,
          message: 'skillCode không được để trống (<= 100 ký tự).',
        });
        itemValid = false;
      }

      if (!prompt || prompt.length < 3) {
        errors.push({
          path: `${path}.prompt`,
          message: 'prompt phải có ít nhất 3 ký tự.',
        });
        itemValid = false;
      }

      if (type === ItemType.MULTIPLE_CHOICE) {
        const optionValues = extractOptionValues(raw.options);
        if (
          !Array.isArray(raw.options) ||
          raw.options.length < 2 ||
          !correctOption ||
          !optionValues.includes(correctOption)
        ) {
          errors.push({
            path: `${path}.options`,
            message:
              'Câu hỏi MULTIPLE_CHOICE cần >= 2 phương án và correctOption khớp một phương án.',
          });
          itemValid = false;
        }
      }

      if (
        !Number.isFinite(irtA) ||
        !Number.isFinite(irtB) ||
        !Number.isFinite(irtC)
      ) {
        errors.push({
          path: `${path}.irt`,
          message: 'Các tham số IRT (irtA, irtB, irtC) phải là số hợp lệ.',
        });
        itemValid = false;
      }

      if (audioUrl && !isSafeMediaUrl(audioUrl)) {
        errors.push({
          path: `${path}.audioUrl`,
          message:
            'audioUrl chỉ chấp nhận đường dẫn http(s)://, /media/ hoặc assets/ hợp lệ.',
        });
        itemValid = false;
      }

      if (itemValid) {
        try {
          adminPlacementBankVersion({
            type: type as ItemType,
            skill: skill as AssessmentSkill,
            usageScope: usageScope as ItemUsageScope,
            options: (raw.options ?? null) as Prisma.JsonValue,
            correctOption,
            prompt,
            passage,
            audioUrl,
            irtA,
            irtB,
            irtC,
            groupId,
          });
        } catch (error) {
          errors.push({
            path,
            message:
              error instanceof Error
                ? error.message
                : 'Câu hỏi placement không hợp lệ.',
          });
          itemValid = false;
        }
      }

      if (!itemValid) return;

      if (externalId) bundleItemExternalIds.add(externalId);
      const op: 'CREATE' | 'UPDATE' =
        externalId && existingItemExternalIds.has(externalId)
          ? 'UPDATE'
          : 'CREATE';
      if (op === 'CREATE') counts.items.create += 1;
      else counts.items.update += 1;

      records.push({
        entity: 'item',
        identifier: externalId ?? `item-${idx + 1}`,
        title: prompt.slice(0, 80),
        operation: op,
      });
      parsedItems.push({
        externalId,
        groupId,
        itemOrder,
        skill: skill as AssessmentSkill,
        skillCode,
        cefrLevel: cefrLevel as CefrLevel,
        type: type as ItemType,
        usageScope: usageScope as ItemUsageScope,
        passage,
        prompt,
        options: raw.options,
        correctOption,
        explanation,
        audioUrl,
        rubricCriteria,
        irtA,
        irtB,
        irtC,
      });
    });

    // 6. Curated Vocabulary Topics
    const parsedTopics: NormalizedTopicInput[] = [];
    const bundleTopicSlugs = new Set<string>();

    bundle.topics.forEach((raw, idx) => {
      const path = `topics[${idx}]`;
      if (!isPlainObject(raw)) {
        errors.push({ path, message: 'Topic phải là một đối tượng JSON.' });
        return;
      }

      const topicObj = isPlainObject(raw.topic) ? raw.topic : raw;
      const slug = asTrimmedString(topicObj.slug).toLowerCase();
      const titleEn = asTrimmedString(topicObj.titleEn);
      const titleVi = asTrimmedString(topicObj.titleVi);
      const description = asTrimmedString(topicObj.description) || null;
      const icon = asTrimmedString(topicObj.icon) || null;
      const displayOrder =
        topicObj.displayOrder !== undefined
          ? Number(topicObj.displayOrder)
          : idx + 1;

      let itemValid = true;
      if (!slug || !SLUG_REGEX.test(slug) || slug.length > 60) {
        errors.push({
          path: `${path}.slug`,
          message: 'slug chủ đề chỉ gồm chữ thường, số, dấu gạch ngang (<= 60 ký tự).',
        });
        itemValid = false;
      } else if (bundleTopicSlugs.has(slug)) {
        errors.push({
          path: `${path}.slug`,
          message: `slug chủ đề "${slug}" bị trùng trong gói JSON.`,
        });
        itemValid = false;
      }

      if (!titleEn || titleEn.length > 100) {
        errors.push({
          path: `${path}.titleEn`,
          message: 'titleEn không được rỗng và tối đa 100 ký tự.',
        });
        itemValid = false;
      }

      if (!titleVi || titleVi.length > 100) {
        errors.push({
          path: `${path}.titleVi`,
          message: 'titleVi không được rỗng và tối đa 100 ký tự.',
        });
        itemValid = false;
      }

      if (!Number.isInteger(displayOrder) || displayOrder < 0) {
        errors.push({
          path: `${path}.displayOrder`,
          message: 'displayOrder phải là số nguyên >= 0.',
        });
        itemValid = false;
      }

      let normalizedWords: NormalizedTopicWordInput[] | undefined;
      if (raw.words !== undefined) {
        if (!Array.isArray(raw.words)) {
          errors.push({
            path: `${path}.words`,
            message: 'Trường words phải là một mảng.',
          });
          itemValid = false;
        } else {
          normalizedWords = [];
          raw.words.forEach((wordRaw, wIdx) => {
            if (!isPlainObject(wordRaw)) {
              errors.push({
                path: `${path}.words[${wIdx}]`,
                message: 'Mỗi từ vựng phải là một đối tượng JSON.',
              });
              itemValid = false;
              return;
            }
            const word = asTrimmedString(wordRaw.word);
            const meaningVi = asTrimmedString(wordRaw.meaningVi);
            const wordImageUrl = asTrimmedString(wordRaw.imageUrl) || null;
            const wordAudioUrl = asTrimmedString(wordRaw.audioUrl) || null;
            if (!word || word.length > 100 || !meaningVi || meaningVi.length > 500) {
              errors.push({
                path: `${path}.words[${wIdx}]`,
                message: 'Mỗi từ vựng cần word (<= 100) và meaningVi (<= 500) hợp lệ.',
              });
              itemValid = false;
              return;
            }
            if (wordImageUrl && !isSafeMediaUrl(wordImageUrl)) {
              errors.push({
                path: `${path}.words[${wIdx}].imageUrl`,
                message: 'imageUrl từ vựng không đúng định dạng URL an toàn.',
              });
              itemValid = false;
              return;
            }
            if (wordAudioUrl && !isSafeMediaUrl(wordAudioUrl)) {
              errors.push({
                path: `${path}.words[${wIdx}].audioUrl`,
                message: 'audioUrl từ vựng không đúng định dạng URL an toàn.',
              });
              itemValid = false;
              return;
            }
            normalizedWords!.push({
              word,
              phonetic: asTrimmedString(wordRaw.phonetic).slice(0, 100),
              partOfSpeech: asTrimmedString(wordRaw.partOfSpeech).slice(0, 50),
              meaningVi,
              exampleEn: asTrimmedString(wordRaw.exampleEn).slice(0, 1000),
              exampleVi: asTrimmedString(wordRaw.exampleVi).slice(0, 1000),
              imageUrl: wordImageUrl,
              audioUrl: wordAudioUrl,
            });
          });
        }
      }

      if (!itemValid) return;

      bundleTopicSlugs.add(slug);
      const op: 'CREATE' | 'UPDATE' = existingTopicSlugs.has(slug)
        ? 'UPDATE'
        : 'CREATE';
      if (op === 'CREATE') counts.topics.create += 1;
      else counts.topics.update += 1;

      records.push({
        entity: 'topic',
        identifier: slug,
        title: `${titleVi} (${normalizedWords?.length ?? 0} từ)`,
        operation: op,
      });
      parsedTopics.push({
        slug,
        titleEn,
        titleVi,
        description: description ? description.slice(0, 500) : null,
        icon: icon ? icon.slice(0, 50) : null,
        displayOrder,
        words: normalizedWords,
      });
    });

    // 7. Speaking Prompts
    const parsedSpeakingPrompts: NormalizedSpeakingPromptInput[] = [];
    const bundleSpeakingCodes = new Set<string>();

    bundle.speakingPrompts.forEach((raw, idx) => {
      const path = `speakingPrompts[${idx}]`;
      if (!isPlainObject(raw)) {
        errors.push({ path, message: 'SpeakingPrompt phải là một đối tượng JSON.' });
        return;
      }

      const code = asTrimmedString(raw.code).toLowerCase();
      const mode = (
        asTrimmedString(raw.mode) || SpeakingMode.READ_ALOUD
      ).toUpperCase();
      const title = asTrimmedString(raw.title);
      const text = asTrimmedString(raw.text);
      const difficulty = raw.difficulty !== undefined ? Number(raw.difficulty) : 1;
      const maxDurationSeconds =
        raw.maxDurationSeconds !== undefined
          ? Number(raw.maxDurationSeconds)
          : mode === SpeakingMode.TOPIC || mode === SpeakingMode.PICTURE_DESCRIPTION
            ? 60
            : 30;
      const hints = Array.isArray(raw.hints)
        ? raw.hints
            .filter((h): h is string => typeof h === 'string')
            .map((h) => h.trim())
            .filter(Boolean)
        : [];
      const sampleAsset = asTrimmedString(raw.sampleAsset) || null;
      const imageUrl = asTrimmedString(raw.imageUrl) || null;
      const visualContext = asTrimmedString(raw.visualContext) || null;
      const preparation = isPlainObject(raw.preparation) ? raw.preparation : null;
      const linkedReadAloudCodes = Array.isArray(raw.linkedReadAloudCodes)
        ? raw.linkedReadAloudCodes
            .filter((c): c is string => typeof c === 'string')
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean)
        : [];
      const sortOrder =
        raw.sortOrder !== undefined && raw.sortOrder !== null
          ? Number(raw.sortOrder)
          : undefined;
      const published = typeof raw.published === 'boolean' ? raw.published : true;

      let itemValid = true;
      if (!code || !SLUG_REGEX.test(code) || code.length > 100) {
        errors.push({
          path: `${path}.code`,
          message: 'Mã đề luyện nói chỉ gồm chữ thường, số và dấu gạch ngang (<= 100 ký tự).',
        });
        itemValid = false;
      } else if (bundleSpeakingCodes.has(code)) {
        errors.push({
          path: `${path}.code`,
          message: `Mã đề luyện nói "${code}" bị trùng trong gói JSON.`,
        });
        itemValid = false;
      }

      if (!SPEAKING_MODE_VALUES.has(mode)) {
        errors.push({
          path: `${path}.mode`,
          message: 'mode phải là READ_ALOUD, TOPIC, PICTURE_DESCRIPTION hoặc TONGUE_TWISTER.',
        });
        itemValid = false;
      }

      if (!title || title.length > 200) {
        errors.push({
          path: `${path}.title`,
          message: 'Tiêu đề đề luyện nói không được rỗng (<= 200 ký tự).',
        });
        itemValid = false;
      }

      if (!text || text.length < 2) {
        errors.push({
          path: `${path}.text`,
          message: 'Nội dung đề luyện nói (text) không được để trống.',
        });
        itemValid = false;
      }

      if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
        errors.push({
          path: `${path}.difficulty`,
          message: 'difficulty phải là số nguyên từ 1 đến 5.',
        });
        itemValid = false;
      }

      if (
        !Number.isInteger(maxDurationSeconds) ||
        maxDurationSeconds < 5 ||
        maxDurationSeconds > 300
      ) {
        errors.push({
          path: `${path}.maxDurationSeconds`,
          message: 'maxDurationSeconds phải từ 5 đến 300 giây.',
        });
        itemValid = false;
      }

      if (imageUrl && !isSafeImageUrl(imageUrl)) {
        errors.push({
          path: `${path}.imageUrl`,
          message: 'imageUrl không đúng định dạng ảnh an toàn.',
        });
        itemValid = false;
      }

      if (mode === SpeakingMode.PICTURE_DESCRIPTION && !imageUrl) {
        errors.push({
          path: `${path}.imageUrl`,
          message: 'Chế độ PICTURE_DESCRIPTION bắt buộc có imageUrl.',
        });
        itemValid = false;
      }

      if (!itemValid) return;

      bundleSpeakingCodes.add(code);
      const op: 'CREATE' | 'UPDATE' = existingSpeakingCodes.has(code)
        ? 'UPDATE'
        : 'CREATE';
      if (op === 'CREATE') counts.speakingPrompts.create += 1;
      else counts.speakingPrompts.update += 1;

      records.push({
        entity: 'speakingPrompt',
        identifier: code,
        title: `[${mode}] ${title}`,
        operation: op,
      });
      parsedSpeakingPrompts.push({
        code,
        mode: mode as SpeakingMode,
        title,
        text,
        difficulty,
        maxDurationSeconds,
        hints,
        sampleAsset,
        imageUrl,
        visualContext,
        preparation,
        linkedReadAloudCodes,
        sortOrder,
        published,
      });
    });

    return {
      validation: {
        isValid: errors.length === 0,
        errors,
        preview: {
          totalRecords: records.length,
          counts,
          records,
        },
      },
      parsed: {
        units: parsedUnits,
        lessons: parsedLessons,
        items: parsedItems,
        topics: parsedTopics,
        speakingPrompts: parsedSpeakingPrompts,
        grammarTopics: parsedGrammarTopics,
        assessmentGroups: parsedGroups,
      },
    };
  }

  async validateBundle(
    rawBundle: unknown,
    _options?: ImportBundleOptions,
  ): Promise<ImportValidationResult> {
    const { validation } = await this.inspectBundle(rawBundle);
    return validation;
  }

  async applyBundle(
    rawBundle: unknown,
    options?: ImportBundleOptions,
  ): Promise<ImportApplyResult> {
    const { validation, parsed } = await this.inspectBundle(rawBundle);
    if (!validation.isValid) {
      throw new BadRequestException({
        code: 'ADMIN_IMPORT_INVALID',
        message:
          validation.errors[0]?.message ?? 'Gói dữ liệu JSON không hợp lệ.',
        details: validation.errors,
      });
    }

    const topicWordsMode = options?.topicWordsMode ?? 'replace';

    await this.prisma.$transaction(
      async (tx) => {
        // 1. Units
        const unitIdByCode = new Map<string, string>();
        for (const unit of parsed.units) {
          const saved = await tx.learningUnit.upsert({
            where: { code: unit.code },
            create: {
              code: unit.code,
              cefrLevel: unit.cefrLevel,
              orderIndex: unit.orderIndex,
              title: unit.title,
              description: unit.description,
            },
            update: {
              cefrLevel: unit.cefrLevel,
              orderIndex: unit.orderIndex,
              title: unit.title,
              description: unit.description,
            },
            select: { id: true, code: true },
          });
          unitIdByCode.set(saved.code, saved.id);
        }

        // 2. Grammar Topics (upsert groups/roots first, then children)
        const grammarIdByCode = new Map<string, string>();
        if (parsed.grammarTopics.length > 0) {
          const orderedGrammar = [
            ...parsed.grammarTopics.filter((g) => !g.parentCode),
            ...parsed.grammarTopics.filter((g) => Boolean(g.parentCode)),
          ];
          const neededParentCodes = [
            ...new Set(
              orderedGrammar
                .map((g) => g.parentCode)
                .filter((c): c is string => Boolean(c)),
            ),
          ];
          if (neededParentCodes.length > 0) {
            const existingParents = await tx.grammarTopic.findMany({
              where: { code: { in: neededParentCodes } },
              select: { id: true, code: true },
            });
            for (const p of existingParents) {
              grammarIdByCode.set(p.code, p.id);
            }
          }

          for (const g of orderedGrammar) {
            const parentId = g.parentCode
              ? (grammarIdByCode.get(g.parentCode) ?? null)
              : null;
            const saved = await tx.grammarTopic.upsert({
              where: { code: g.code },
              create: {
                code: g.code,
                parentId,
                cefrLevel: g.cefrLevel,
                isLeaf: g.isLeaf,
                titleEn: g.titleEn,
                titleVi: g.titleVi,
                summaryVi: g.summaryVi,
                formulas: g.formulas as unknown as Prisma.InputJsonValue,
                usageNotes: g.usageNotes as unknown as Prisma.InputJsonValue,
                examples: g.examples as unknown as Prisma.InputJsonValue,
                orderIndex: g.orderIndex,
                published: g.published,
              },
              update: {
                parentId,
                cefrLevel: g.cefrLevel,
                titleEn: g.titleEn,
                titleVi: g.titleVi,
                summaryVi: g.summaryVi,
                formulas: g.formulas as unknown as Prisma.InputJsonValue,
                usageNotes: g.usageNotes as unknown as Prisma.InputJsonValue,
                examples: g.examples as unknown as Prisma.InputJsonValue,
                orderIndex: g.orderIndex,
                published: g.published,
                contentVersion: { increment: 1 },
              },
              select: { id: true, code: true },
            });
            grammarIdByCode.set(saved.code, saved.id);
          }
        }

        // 3. Assessment Groups
        for (const group of parsed.assessmentGroups) {
          if (group.id) {
            await tx.assessmentItemGroup.upsert({
              where: { id: group.id },
              create: {
                id: group.id,
                skill: group.skill,
                title: group.title,
                cefrLevel: group.cefrLevel,
                partNumber: group.partNumber,
                passage: group.passage,
                audioUrl: group.audioUrl,
                transcript: group.transcript,
                usageScope: group.usageScope,
              },
              update: {
                skill: group.skill,
                title: group.title,
                cefrLevel: group.cefrLevel,
                partNumber: group.partNumber,
                passage: group.passage,
                audioUrl: group.audioUrl,
                transcript: group.transcript,
                usageScope: group.usageScope,
              },
            });
          } else {
            await tx.assessmentItemGroup.create({
              data: {
                skill: group.skill,
                title: group.title,
                cefrLevel: group.cefrLevel,
                partNumber: group.partNumber,
                passage: group.passage,
                audioUrl: group.audioUrl,
                transcript: group.transcript,
                usageScope: group.usageScope,
              },
            });
          }
        }

        // 4. Lessons
        const missingUnitCodes = parsed.lessons
          .map((l) => l.unitCode)
          .filter(
            (code): code is string =>
              Boolean(code) && !unitIdByCode.has(code as string),
          );
        if (missingUnitCodes.length > 0) {
          const dbUnits = await tx.learningUnit.findMany({
            where: { code: { in: [...new Set(missingUnitCodes)] } },
            select: { id: true, code: true },
          });
          for (const u of dbUnits) {
            unitIdByCode.set(u.code, u.id);
          }
        }

        const missingGrammarCodes = parsed.lessons
          .map((l) => l.grammarTopicCode)
          .filter(
            (code): code is string =>
              Boolean(code) && !grammarIdByCode.has(code as string),
          );
        if (missingGrammarCodes.length > 0) {
          const dbTopics = await tx.grammarTopic.findMany({
            where: { code: { in: [...new Set(missingGrammarCodes)] } },
            select: { id: true, code: true },
          });
          for (const t of dbTopics) {
            grammarIdByCode.set(t.code, t.id);
          }
        }

        let nextSortOrder =
          parsed.lessons.length > 0
            ? ((
                await tx.learningLesson.aggregate({
                  _max: { sortOrder: true },
                })
              )._max.sortOrder ?? 0) + 1
            : 1;

        for (const lesson of parsed.lessons) {
          const unitId = lesson.unitCode
            ? (unitIdByCode.get(lesson.unitCode) ?? null)
            : undefined;
          const grammarTopicId = lesson.grammarTopicCode
            ? (grammarIdByCode.get(lesson.grammarTopicCode) ?? null)
            : undefined;
          const sortOrder = lesson.sortOrder ?? nextSortOrder++;

          await tx.learningLesson.upsert({
            where: { code: lesson.code },
            create: {
              code: lesson.code,
              kind: lesson.kind,
              title: lesson.title,
              description: lesson.description,
              estimatedMinutes: lesson.estimatedMinutes,
              sortOrder,
              published: lesson.published,
              ...(unitId !== undefined ? { unitId } : {}),
              ...(grammarTopicId !== undefined ? { grammarTopicId } : {}),
              content: lesson.content as Prisma.InputJsonValue,
            },
            update: {
              kind: lesson.kind,
              title: lesson.title,
              description: lesson.description,
              estimatedMinutes: lesson.estimatedMinutes,
              ...(lesson.sortOrder !== undefined
                ? { sortOrder: lesson.sortOrder }
                : {}),
              published: lesson.published,
              ...(unitId !== undefined ? { unitId } : {}),
              ...(grammarTopicId !== undefined ? { grammarTopicId } : {}),
              content: lesson.content as Prisma.InputJsonValue,
              contentVersion: { increment: 1 },
            },
          });
        }

        // 5. Assessment Items
        for (const item of parsed.items) {
          const itemData = {
            skill: item.skill,
            skillCode: item.skillCode,
            cefrLevel: item.cefrLevel,
            type: item.type,
            usageScope: item.usageScope,
            passage: item.passage ?? null,
            prompt: item.prompt,
            options:
              item.options !== undefined
                ? (item.options as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            correctOption: item.correctOption ?? null,
            explanation: item.explanation ?? null,
            audioUrl: item.audioUrl ?? null,
            ...(item.rubricCriteria !== undefined
              ? {
                  rubricCriteria: item.rubricCriteria
                    ? (item.rubricCriteria as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
                }
              : {}),
            ...(item.groupId !== undefined && item.groupId !== null
              ? { groupId: item.groupId }
              : {}),
            ...(item.itemOrder !== undefined ? { itemOrder: item.itemOrder } : {}),
            irtA: item.irtA,
            irtB: item.irtB,
            irtC: item.irtC,
          };

          if (item.externalId) {
            let existing = await tx.assessmentItem.findUnique({
              where: { externalId: item.externalId },
              include: {
                _count: { select: { responses: true, currentSessions: true } },
              },
            });
            if (existing) {
              await lockAssessmentItem(tx, existing.id);
              existing = await tx.assessmentItem.findUnique({
                where: { externalId: item.externalId },
                include: {
                  _count: { select: { responses: true, currentSessions: true } },
                },
              });
            }
            const bankVersion = adminPlacementBankVersion({
              ...item,
              options: (item.options ?? null) as Prisma.JsonValue,
              correctOption: item.correctOption ?? null,
              passage: item.passage ?? null,
              audioUrl: item.audioUrl ?? null,
              groupId: item.groupId ?? existing?.groupId,
            });
            if (existing) {
              assertReferencedItemUnchanged(existing, { ...itemData, bankVersion });
            }
            await tx.assessmentItem.upsert({
              where: { externalId: item.externalId },
              create: {
                externalId: item.externalId,
                ...itemData,
                bankVersion,
              },
              update: { ...itemData, bankVersion },
            });
          } else {
            await tx.assessmentItem.create({
              data: {
                ...itemData,
                bankVersion: adminPlacementBankVersion({
                  ...item,
                  options: (item.options ?? null) as Prisma.JsonValue,
                  correctOption: item.correctOption ?? null,
                  passage: item.passage ?? null,
                  audioUrl: item.audioUrl ?? null,
                  groupId: item.groupId ?? null,
                }),
              },
            });
          }
        }

        // 6. Curated Vocabulary Topics
        for (const topic of parsed.topics) {
          const savedTopic = await tx.curatedTopic.upsert({
            where: { slug: topic.slug },
            create: {
              slug: topic.slug,
              titleEn: topic.titleEn,
              titleVi: topic.titleVi,
              description: topic.description,
              icon: topic.icon,
              displayOrder: topic.displayOrder,
            },
            update: {
              titleEn: topic.titleEn,
              titleVi: topic.titleVi,
              description: topic.description,
              icon: topic.icon,
              displayOrder: topic.displayOrder,
            },
            select: { id: true },
          });

          if (topic.words !== undefined) {
            const seen = new Set<string>();
            if (topicWordsMode === 'merge') {
              const existingWords = await tx.curatedTopicWord.findMany({
                where: { topicId: savedTopic.id },
                select: { word: true, partOfSpeech: true },
              });
              for (const ew of existingWords) {
                seen.add(`${ew.word.toLowerCase()}:::${ew.partOfSpeech.toLowerCase()}`);
              }
            } else {
              await tx.curatedTopicWord.deleteMany({
                where: { topicId: savedTopic.id },
              });
            }

            const uniqueWords: NormalizedTopicWordInput[] = [];
            for (const w of topic.words) {
              const key = `${w.word.toLowerCase()}:::${w.partOfSpeech.toLowerCase()}`;
              if (!seen.has(key)) {
                seen.add(key);
                uniqueWords.push(w);
              }
            }

            if (uniqueWords.length > 0) {
              await tx.curatedTopicWord.createMany({
                data: uniqueWords.map((w) => ({
                  topicId: savedTopic.id,
                  word: w.word,
                  phonetic: w.phonetic,
                  partOfSpeech: w.partOfSpeech,
                  meaningVi: w.meaningVi,
                  exampleEn: w.exampleEn,
                  exampleVi: w.exampleVi,
                  imageUrl: w.imageUrl,
                  audioUrl: w.audioUrl,
                })),
              });
            }
          }
        }

        // 7. Speaking Prompts
        if (parsed.speakingPrompts.length > 0) {
          let nextSpeakingOrder =
            ((
              await tx.speakingPrompt.aggregate({
                _max: { sortOrder: true },
              })
            )._max.sortOrder ?? 0) + 1;

          for (const prompt of parsed.speakingPrompts) {
            const sortOrder = prompt.sortOrder ?? nextSpeakingOrder++;
            await tx.speakingPrompt.upsert({
              where: { code: prompt.code },
              create: {
                code: prompt.code,
                mode: prompt.mode,
                title: prompt.title,
                text: prompt.text,
                difficulty: prompt.difficulty,
                maxDurationSeconds: prompt.maxDurationSeconds,
                hints: prompt.hints,
                sampleAsset: prompt.sampleAsset,
                imageUrl: prompt.imageUrl,
                visualContext: prompt.visualContext,
                preparation: prompt.preparation
                  ? (prompt.preparation as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
                linkedReadAloudCodes: prompt.linkedReadAloudCodes,
                sortOrder,
                published: prompt.published,
              },
              update: {
                mode: prompt.mode,
                title: prompt.title,
                text: prompt.text,
                difficulty: prompt.difficulty,
                maxDurationSeconds: prompt.maxDurationSeconds,
                hints: prompt.hints,
                sampleAsset: prompt.sampleAsset,
                imageUrl: prompt.imageUrl,
                visualContext: prompt.visualContext,
                preparation: prompt.preparation
                  ? (prompt.preparation as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
                linkedReadAloudCodes: prompt.linkedReadAloudCodes,
                ...(prompt.sortOrder !== undefined
                  ? { sortOrder: prompt.sortOrder }
                  : {}),
                published: prompt.published,
                contentVersion: { increment: 1 },
              },
            });
          }
        }
      },
      { timeout: 30000 },
    );

    if (parsed.items.length > 0 || parsed.assessmentGroups.length > 0) {
      await this.assessmentMatrixService.invalidateCache();
    }
    if (parsed.topics.length > 0) {
      this.curatedVocabularyService.invalidateTopicsCache();
    }

    return {
      appliedAt: new Date(),
      preview: validation.preview,
    };
  }
}
