import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
  Prisma,
} from '@prisma/client';
import { validateLearningContent } from '../../../learning/learning.types';
import { learningMediaRoot } from '../../../learning/learning.service';
import { validateListeningAudio } from '../../../learning/listening-media';
import { MediaStorageService } from '../../../media/media-storage.service';
import { resolveAdminPlacementBankVersion } from '../assessment-item-integrity';
import { ExistingGrammarTopicRecord } from './admin-import-grammar.validator';
import {
  ASSESSMENT_SKILL_VALUES,
  asTrimmedString,
  CEFR_LEVEL_VALUES,
  extractOptionValues,
  ImportErrorItem,
  ImportPreviewRecord,
  ImportPreviewSummary,
  isPlainObject,
  isSafeMediaUrl,
  ITEM_TYPE_VALUES,
  LEARNING_KIND_VALUES,
  NormalizedAssessmentItemInput,
  NormalizedGrammarTopicInput,
  NormalizedLessonInput,
  SLUG_REGEX,
  USAGE_SCOPE_VALUES,
  UUID_REGEX,
} from './admin-import.types';

export async function validateAndParseLessons(params: {
  rawLessons: unknown[];
  existingUnitByCode: Map<string, unknown>;
  bundleUnitCodes: Set<string>;
  bundleGrammarByCode: Map<string, NormalizedGrammarTopicInput>;
  existingGrammarByCode: Map<string, ExistingGrammarTopicRecord>;
  existingLessonCodes: Set<string>;
  mediaStorage?: MediaStorageService;
  errors: ImportErrorItem[];
  records: ImportPreviewRecord[];
  counts: ImportPreviewSummary['counts'];
}): Promise<NormalizedLessonInput[]> {
  const {
    rawLessons,
    existingUnitByCode,
    bundleUnitCodes,
    bundleGrammarByCode,
    existingGrammarByCode,
    existingLessonCodes,
    mediaStorage,
    errors,
    records,
    counts,
  } = params;

  const parsedLessons: NormalizedLessonInput[] = [];
  const bundleLessonCodes = new Set<string>();

  for (let idx = 0; idx < rawLessons.length; idx++) {
    const raw = rawLessons[idx];
    const path = `lessons[${idx}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: 'Lesson phải là một đối tượng JSON.' });
      continue;
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
    const published = typeof raw.published === 'boolean' ? raw.published : true;
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
        if (published) {
          if (mediaStorage) {
            await mediaStorage.verifyListeningAudio(
              raw.content,
              learningMediaRoot(),
            );
          } else {
            validateListeningAudio(raw.content, learningMediaRoot());
          }
        }
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

    if (!itemValid) continue;

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
  }

  return parsedLessons;
}

export async function validateAndParseAssessmentItems(params: {
  rawItems: unknown[];
  existingGroupIds: Set<string>;
  bundleGroupIds: Set<string>;
  existingItemExternalIds: Set<string>;
  mediaStorage?: MediaStorageService;
  errors: ImportErrorItem[];
  records: ImportPreviewRecord[];
  counts: ImportPreviewSummary['counts'];
}): Promise<NormalizedAssessmentItemInput[]> {
  const {
    rawItems,
    existingGroupIds,
    bundleGroupIds,
    existingItemExternalIds,
    mediaStorage,
    errors,
    records,
    counts,
  } = params;

  const parsedItems: NormalizedAssessmentItemInput[] = [];
  const bundleItemExternalIds = new Set<string>();

  for (let idx = 0; idx < rawItems.length; idx++) {
    const raw = rawItems[idx];
    const path = `items[${idx}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: 'Item phải là một đối tượng JSON.' });
      continue;
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
        await resolveAdminPlacementBankVersion(
          {
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
          },
          mediaStorage,
        );
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

    if (!itemValid) continue;

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
  }

  return parsedItems;
}
