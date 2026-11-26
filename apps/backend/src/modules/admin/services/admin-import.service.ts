import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
  Prisma,
} from '@prisma/client';
import { AssessmentMatrixService } from '../../assessment/services/assessment-matrix.service';
import { validateLearningContent } from '../../learning/learning.types';
import { PrismaService } from '../../prisma/prisma.service';
import { CuratedVocabularyService } from '../../vocabulary/curated-vocabulary.service';

export interface ImportErrorItem {
  path: string;
  message: string;
}

export interface ImportPreviewRecord {
  entity: 'unit' | 'lesson' | 'item' | 'topic';
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
  content: unknown;
}

interface NormalizedAssessmentItemInput {
  externalId?: string;
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

const SLUG_REGEX = /^[a-z0-9-]+$/;
const MAX_IMPORT_RECORDS = 500;
const CEFR_LEVEL_VALUES = new Set<string>(Object.values(CefrLevel));
const LEARNING_KIND_VALUES = new Set<string>(Object.values(LearningKind));
const ASSESSMENT_SKILL_VALUES = new Set<string>(Object.values(AssessmentSkill));
const ITEM_TYPE_VALUES = new Set<string>(Object.values(ItemType));
const USAGE_SCOPE_VALUES = new Set<string>(Object.values(ItemUsageScope));

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
      const bundle: NormalizedBundle = {
        units: [],
        lessons: [],
        items: [],
        topics: [],
      };
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
        } else if ('prompt' in entry && ('cefrLevel' in entry || 'skill' in entry)) {
          bundle.items.push(entry);
        } else {
          return {
            bundle,
            shapeError:
              'Không thể tự nhận diện loại bản ghi trong mảng JSON. Hãy dùng cấu trúc { "units": [], "lessons": [], "items": [], "topics": [] }.',
          };
        }
      }
      return { bundle, shapeError: null };
    }

    if (!isPlainObject(rawBundle)) {
      return {
        bundle: { units: [], lessons: [], items: [], topics: [] },
        shapeError:
          'Dữ liệu import phải là đối tượng JSON ({ units, lessons, items, topics }) hoặc mảng JSON hợp lệ.',
      };
    }

    const keys = ['units', 'lessons', 'items', 'topics'] as const;
    const bundle: NormalizedBundle = {
      units: [],
      lessons: [],
      items: [],
      topics: [],
    };
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
    parsed: {
      units: NormalizedUnitInput[];
      lessons: NormalizedLessonInput[];
      items: NormalizedAssessmentItemInput[];
      topics: NormalizedTopicInput[];
    };
  }> {
    const emptyPreview: ImportPreviewSummary = {
      totalRecords: 0,
      counts: {
        units: { create: 0, update: 0 },
        lessons: { create: 0, update: 0 },
        items: { create: 0, update: 0 },
        topics: { create: 0, update: 0 },
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
        parsed: { units: [], lessons: [], items: [], topics: [] },
      };
    }

    const totalRecords =
      bundle.units.length +
      bundle.lessons.length +
      bundle.items.length +
      bundle.topics.length;

    if (totalRecords === 0) {
      return {
        validation: {
          isValid: false,
          errors: [
            {
              path: '$',
              message:
                'Gói JSON không có bản ghi nào (cần ít nhất 1 unit, lesson, item hoặc topic).',
            },
          ],
          preview: emptyPreview,
        },
        parsed: { units: [], lessons: [], items: [], topics: [] },
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
        parsed: { units: [], lessons: [], items: [], topics: [] },
      };
    }

    const [existingUnits, existingLessons, existingItems, existingTopics] =
      await Promise.all([
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

    const errors: ImportErrorItem[] = [];
    const records: ImportPreviewRecord[] = [];
    const counts: ImportPreviewSummary['counts'] = {
      units: { create: 0, update: 0 },
      lessons: { create: 0, update: 0 },
      items: { create: 0, update: 0 },
      topics: { create: 0, update: 0 },
    };

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

      if (LEARNING_KIND_VALUES.has(kind)) {
        try {
          validateLearningContent(raw.content, kind as LearningKind);
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
        content: raw.content,
      });
    });

    const parsedItems: NormalizedAssessmentItemInput[] = [];
    const bundleItemExternalIds = new Set<string>();

    bundle.items.forEach((raw, idx) => {
      const path = `items[${idx}]`;
      if (!isPlainObject(raw)) {
        errors.push({ path, message: 'Item phải là một đối tượng JSON.' });
        return;
      }

      const externalId = asTrimmedString(raw.externalId) || undefined;
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
        irtA,
        irtB,
        irtC,
      });
    });

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
      },
    };
  }

  async validateBundle(rawBundle: unknown): Promise<ImportValidationResult> {
    const { validation } = await this.inspectBundle(rawBundle);
    return validation;
  }

  async applyBundle(rawBundle: unknown): Promise<ImportApplyResult> {
    const { validation, parsed } = await this.inspectBundle(rawBundle);
    if (!validation.isValid) {
      throw new BadRequestException({
        code: 'ADMIN_IMPORT_INVALID',
        message:
          validation.errors[0]?.message ?? 'Gói dữ liệu JSON không hợp lệ.',
        details: validation.errors,
      });
    }

    await this.prisma.$transaction(
      async (tx) => {
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
              content: lesson.content as Prisma.InputJsonValue,
              contentVersion: { increment: 1 },
            },
          });
        }

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
            irtA: item.irtA,
            irtB: item.irtB,
            irtC: item.irtC,
          };

          if (item.externalId) {
            await tx.assessmentItem.upsert({
              where: { externalId: item.externalId },
              create: {
                externalId: item.externalId,
                ...itemData,
              },
              update: itemData,
            });
          } else {
            await tx.assessmentItem.create({
              data: itemData,
            });
          }
        }

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
            await tx.curatedTopicWord.deleteMany({
              where: { topicId: savedTopic.id },
            });

            const uniqueWords: NormalizedTopicWordInput[] = [];
            const seen = new Set<string>();
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
      },
      { timeout: 30000 },
    );

    if (parsed.items.length > 0) {
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
