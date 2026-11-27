import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { AssessmentMatrixService } from '../../assessment/services/assessment-matrix.service';
import { MediaStorageService } from '../../media/media-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CuratedVocabularyService } from '../../vocabulary/curated-vocabulary.service';
import { applyParsedBundleTransaction } from './admin-import-apply';
import {
  parseAssessmentItemsSection,
  parseSpeakingPromptsSection,
  parseVocabularyTopicsSection,
} from './admin-import-parse-assets';
import {
  normalizeBundleShapeHelper,
  parseAssessmentGroupsSection,
  parseGrammarTopicsSection,
  parseLessonsSection,
  parseUnitsSection,
} from './admin-import-parse-curriculum';
import {
  ImportApplyResult,
  ImportBundleOptions,
  ImportErrorItem,
  ImportPreviewRecord,
  ImportPreviewSummary,
  ImportValidationResult,
  MAX_IMPORT_RECORDS,
  ParsedImportBundle,
  asTrimmedString,
  emptyParsed,
  isPlainObject,
} from './admin-import.types';

export {
  ImportApplyResult,
  ImportBundleOptions,
  ImportEntityCount,
  ImportErrorItem,
  ImportPreviewRecord,
  ImportPreviewSummary,
  ImportValidationResult,
} from './admin-import.types';

@Injectable()
export class AdminImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentMatrixService: AssessmentMatrixService,
    private readonly curatedVocabularyService: CuratedVocabularyService,
    @Optional() private readonly mediaStorage?: MediaStorageService,
  ) {}

  private async inspectBundle(rawBundle: unknown): Promise<{
    validation: ImportValidationResult;
    parsed: ParsedImportBundle;
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

    const { bundle, shapeError } = normalizeBundleShapeHelper(rawBundle);
    if (shapeError) {
      return {
        validation: { isValid: false, errors: [{ path: '$', message: shapeError }], preview: emptyPreview },
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
        ? this.prisma.learningLesson.findMany({ select: { code: true } })
        : Promise.resolve([]),
      bundle.items.length > 0
        ? this.prisma.assessmentItem.findMany({
            where: { externalId: { not: null } },
            select: { externalId: true },
          })
        : Promise.resolve([]),
      bundle.topics.length > 0
        ? this.prisma.curatedTopic.findMany({ select: { slug: true } })
        : Promise.resolve([]),
      bundle.speakingPrompts.length > 0
        ? this.prisma.speakingPrompt.findMany({ select: { code: true } })
        : Promise.resolve([]),
      bundle.grammarTopics.length > 0 || lessonsNeedGrammar
        ? this.prisma.grammarTopic.findMany({
            select: {
              id: true,
              code: true,
              isLeaf: true,
              parentId: true,
              parent: { select: { code: true } },
            },
          })
        : Promise.resolve([]),
      bundle.assessmentGroups.length > 0 || itemsNeedGroups
        ? this.prisma.assessmentItemGroup.findMany({ select: { id: true } })
        : Promise.resolve([]),
    ]);

    const existingUnitByCode = new Map(existingUnits.map((u) => [u.code, u]));
    const existingUnitByLevelOrder = new Map(
      existingUnits.map((u) => [`${u.cefrLevel}:${u.orderIndex}`, u.code]),
    );
    const existingLessonCodes = new Set(existingLessons.map((l) => l.code));
    const existingItemExternalIds = new Set(
      existingItems.map((i) => i.externalId).filter((id): id is string => typeof id === 'string'),
    );
    const existingTopicSlugs = new Set(existingTopics.map((t) => t.slug));
    const existingSpeakingCodes = new Set(existingSpeakingPrompts.map((s) => s.code));
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

    const { parsedUnits, bundleUnitCodes } = parseUnitsSection(
      bundle.units,
      existingUnitByCode,
      existingUnitByLevelOrder,
      counts,
      records,
      errors,
    );

    const { parsedGrammarTopics, bundleGrammarByCode, existingGrammarByCode } =
      await parseGrammarTopicsSection(
        this.prisma,
        bundle.grammarTopics,
        existingGrammarTopics,
        counts,
        records,
        errors,
      );

    const { parsedGroups, bundleGroupIds } = parseAssessmentGroupsSection(
      bundle.assessmentGroups,
      existingGroupIds,
      counts,
      records,
      errors,
    );

    const parsedLessons = await parseLessonsSection(
      bundle.lessons,
      existingUnitByCode,
      bundleUnitCodes,
      existingGrammarByCode,
      bundleGrammarByCode,
      existingLessonCodes,
      this.mediaStorage,
      counts,
      records,
      errors,
    );

    const parsedItems = await parseAssessmentItemsSection(
      bundle.items,
      existingGroupIds,
      bundleGroupIds,
      existingItemExternalIds,
      this.mediaStorage,
      counts,
      records,
      errors,
    );

    const parsedTopics = parseVocabularyTopicsSection(
      bundle.topics,
      existingTopicSlugs,
      counts,
      records,
      errors,
    );

    const parsedSpeakingPrompts = parseSpeakingPromptsSection(
      bundle.speakingPrompts,
      existingSpeakingCodes,
      counts,
      records,
      errors,
    );

    return {
      validation: {
        isValid: errors.length === 0,
        errors,
        preview: { totalRecords: records.length, counts, records },
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
        message: validation.errors[0]?.message ?? 'Gói dữ liệu JSON không hợp lệ.',
        details: validation.errors,
      });
    }

    const topicWordsMode = options?.topicWordsMode ?? 'replace';

    await this.prisma.$transaction(
      async (tx) => applyParsedBundleTransaction(tx, parsed, topicWordsMode, this.mediaStorage),
      { timeout: 30000 },
    );

    if (parsed.items.length > 0 || parsed.assessmentGroups.length > 0) {
      await this.assessmentMatrixService.invalidateCache();
    }
    if (parsed.topics.length > 0) {
      this.curatedVocabularyService.invalidateTopicsCache();
    }

    return { appliedAt: new Date(), preview: validation.preview };
  }
}
