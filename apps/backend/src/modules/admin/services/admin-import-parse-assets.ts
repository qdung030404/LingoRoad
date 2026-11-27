import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  Prisma,
  SpeakingMode,
} from '@prisma/client';
import { isSafeImageUrl } from '../../learning/learning.types';
import { MediaStorageService } from '../../media/media-storage.service';
import { validatePreparation } from './admin-speaking.service';
import { resolveAdminPlacementBankVersion } from './assessment-item-integrity';
import {
  ASSESSMENT_SKILL_VALUES,
  CEFR_LEVEL_VALUES,
  ITEM_TYPE_VALUES,
  ImportErrorItem,
  ImportPreviewRecord,
  ImportPreviewSummary,
  NormalizedAssessmentItemInput,
  NormalizedSpeakingPromptInput,
  NormalizedTopicInput,
  NormalizedTopicWordInput,
  SLUG_REGEX,
  SPEAKING_MODE_VALUES,
  USAGE_SCOPE_VALUES,
  UUID_REGEX,
  asTrimmedString,
  extractOptionValues,
  isPlainObject,
  isSafeMediaUrl,
} from './admin-import.types';

export async function parseAssessmentItemsSection(
  rawItems: unknown[],
  existingGroupIds: Set<string>,
  bundleGroupIds: Set<string>,
  existingItemExternalIds: Set<string>,
  mediaStorage: MediaStorageService | undefined,
  counts: ImportPreviewSummary['counts'],
  records: ImportPreviewRecord[],
  errors: ImportErrorItem[],
): Promise<NormalizedAssessmentItemInput[]> {
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
    const itemOrder = raw.itemOrder !== undefined && raw.itemOrder !== null ? Number(raw.itemOrder) : undefined;
    const skill = asTrimmedString(raw.skill).toUpperCase();
    const cefrLevel = asTrimmedString(raw.cefrLevel).toUpperCase();
    const type = (asTrimmedString(raw.type) || ItemType.MULTIPLE_CHOICE).toUpperCase();
    const usageScope = (asTrimmedString(raw.usageScope) || ItemUsageScope.ALL).toUpperCase();
    const skillCode =
      asTrimmedString(raw.skillCode) ||
      (ASSESSMENT_SKILL_VALUES.has(skill) ? `${skill.toLowerCase()}.general` : '');
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
        errors.push({ path: `${path}.externalId`, message: 'externalId tối đa 100 ký tự.' });
        itemValid = false;
      } else if (bundleItemExternalIds.has(externalId)) {
        errors.push({ path: `${path}.externalId`, message: `externalId "${externalId}" bị trùng trong gói JSON.` });
        itemValid = false;
      }
    }
    if (groupId) {
      if (!UUID_REGEX.test(groupId)) {
        errors.push({ path: `${path}.groupId`, message: 'groupId phải là UUID hợp lệ.' });
        itemValid = false;
      } else if (!existingGroupIds.has(groupId) && !bundleGroupIds.has(groupId)) {
        errors.push({ path: `${path}.groupId`, message: `Không tìm thấy groupId "${groupId}" trong DB hoặc gói JSON.` });
        itemValid = false;
      }
    }
    if (itemOrder !== undefined && (!Number.isInteger(itemOrder) || itemOrder < 1)) {
      errors.push({ path: `${path}.itemOrder`, message: 'itemOrder phải là số nguyên >= 1.' });
      itemValid = false;
    }
    if (!ASSESSMENT_SKILL_VALUES.has(skill)) {
      errors.push({ path: `${path}.skill`, message: 'skill phải là READING, LISTENING, WRITING hoặc SPEAKING.' });
      itemValid = false;
    }
    if (!CEFR_LEVEL_VALUES.has(cefrLevel)) {
      errors.push({ path: `${path}.cefrLevel`, message: 'cefrLevel phải thuộc A1..C2.' });
      itemValid = false;
    }
    if (!ITEM_TYPE_VALUES.has(type)) {
      errors.push({ path: `${path}.type`, message: `type "${type}" không hợp lệ.` });
      itemValid = false;
    }
    if (!USAGE_SCOPE_VALUES.has(usageScope)) {
      errors.push({ path: `${path}.usageScope`, message: `usageScope "${usageScope}" không hợp lệ.` });
      itemValid = false;
    }
    if (!skillCode || skillCode.length > 100) {
      errors.push({ path: `${path}.skillCode`, message: 'skillCode không được để trống (<= 100 ký tự).' });
      itemValid = false;
    }
    if (!prompt || prompt.length < 3) {
      errors.push({ path: `${path}.prompt`, message: 'prompt phải có ít nhất 3 ký tự.' });
      itemValid = false;
    }
    if (type === ItemType.MULTIPLE_CHOICE) {
      const optionValues = extractOptionValues(raw.options);
      if (!Array.isArray(raw.options) || raw.options.length < 2 || !correctOption || !optionValues.includes(correctOption)) {
        errors.push({ path: `${path}.options`, message: 'Câu hỏi MULTIPLE_CHOICE cần >= 2 phương án và correctOption khớp một phương án.' });
        itemValid = false;
      }
    }
    if (!Number.isFinite(irtA) || !Number.isFinite(irtB) || !Number.isFinite(irtC)) {
      errors.push({ path: `${path}.irt`, message: 'Các tham số IRT (irtA, irtB, irtC) phải là số hợp lệ.' });
      itemValid = false;
    }
    if (audioUrl && !isSafeMediaUrl(audioUrl)) {
      errors.push({ path: `${path}.audioUrl`, message: 'audioUrl chỉ chấp nhận đường dẫn http(s)://, /media/ hoặc assets/ hợp lệ.' });
      itemValid = false;
    }
    if (rubricCriteria !== undefined && rubricCriteria !== null && !isPlainObject(rubricCriteria)) {
      errors.push({ path: `${path}.rubricCriteria`, message: 'rubricCriteria phải là đối tượng JSON (Object) hoặc null.' });
      itemValid = false;
    }

    let bankVersion: string | null = null;
    if (itemValid) {
      try {
        bankVersion = await resolveAdminPlacementBankVersion(
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
        errors.push({ path, message: error instanceof Error ? error.message : 'Câu hỏi placement không hợp lệ.' });
        itemValid = false;
      }
    }
    if (!itemValid) continue;

    if (externalId) bundleItemExternalIds.add(externalId);
    const op: 'CREATE' | 'UPDATE' = externalId && existingItemExternalIds.has(externalId) ? 'UPDATE' : 'CREATE';
    if (op === 'CREATE') counts.items.create += 1;
    else counts.items.update += 1;

    records.push({ entity: 'item', identifier: externalId ?? `item-${idx + 1}`, title: prompt.slice(0, 80), operation: op });
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
      bankVersion,
      irtA,
      irtB,
      irtC,
    });
  }

  return parsedItems;
}

export function parseVocabularyTopicsSection(
  rawTopics: unknown[],
  existingTopicSlugs: Set<string>,
  counts: ImportPreviewSummary['counts'],
  records: ImportPreviewRecord[],
  errors: ImportErrorItem[],
): NormalizedTopicInput[] {
  const parsedTopics: NormalizedTopicInput[] = [];
  const bundleTopicSlugs = new Set<string>();

  rawTopics.forEach((raw, idx) => {
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
    const displayOrder = topicObj.displayOrder !== undefined ? Number(topicObj.displayOrder) : idx + 1;

    let itemValid = true;
    if (!slug || !SLUG_REGEX.test(slug) || slug.length > 60) {
      errors.push({ path: `${path}.slug`, message: 'slug chủ đề chỉ gồm chữ thường, số, dấu gạch ngang (<= 60 ký tự).' });
      itemValid = false;
    } else if (bundleTopicSlugs.has(slug)) {
      errors.push({ path: `${path}.slug`, message: `slug chủ đề "${slug}" bị trùng trong gói JSON.` });
      itemValid = false;
    }
    if (!titleEn || titleEn.length > 100) {
      errors.push({ path: `${path}.titleEn`, message: 'titleEn không được rỗng và tối đa 100 ký tự.' });
      itemValid = false;
    }
    if (!titleVi || titleVi.length > 100) {
      errors.push({ path: `${path}.titleVi`, message: 'titleVi không được rỗng và tối đa 100 ký tự.' });
      itemValid = false;
    }
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      errors.push({ path: `${path}.displayOrder`, message: 'displayOrder phải là số nguyên >= 0.' });
      itemValid = false;
    }

    let normalizedWords: NormalizedTopicWordInput[] | undefined;
    if (raw.words !== undefined) {
      if (!Array.isArray(raw.words)) {
        errors.push({ path: `${path}.words`, message: 'Trường words phải là một mảng.' });
        itemValid = false;
      } else {
        normalizedWords = [];
        raw.words.forEach((wordRaw, wIdx) => {
          if (!isPlainObject(wordRaw)) {
            errors.push({ path: `${path}.words[${wIdx}]`, message: 'Mỗi từ vựng phải là một đối tượng JSON.' });
            itemValid = false;
            return;
          }
          const word = asTrimmedString(wordRaw.word);
          const meaningVi = asTrimmedString(wordRaw.meaningVi);
          const wordImageUrl = asTrimmedString(wordRaw.imageUrl) || null;
          const wordAudioUrl = asTrimmedString(wordRaw.audioUrl) || null;
          if (!word || word.length > 100 || !meaningVi || meaningVi.length > 500) {
            errors.push({ path: `${path}.words[${wIdx}]`, message: 'Mỗi từ vựng cần word (<= 100) và meaningVi (<= 500) hợp lệ.' });
            itemValid = false;
            return;
          }
          if (wordImageUrl && !isSafeMediaUrl(wordImageUrl)) {
            errors.push({ path: `${path}.words[${wIdx}].imageUrl`, message: 'imageUrl từ vựng không đúng định dạng URL an toàn.' });
            itemValid = false;
            return;
          }
          if (wordAudioUrl && !isSafeMediaUrl(wordAudioUrl)) {
            errors.push({ path: `${path}.words[${wIdx}].audioUrl`, message: 'audioUrl từ vựng không đúng định dạng URL an toàn.' });
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
    const op: 'CREATE' | 'UPDATE' = existingTopicSlugs.has(slug) ? 'UPDATE' : 'CREATE';
    if (op === 'CREATE') counts.topics.create += 1;
    else counts.topics.update += 1;

    records.push({ entity: 'topic', identifier: slug, title: `${titleVi} (${normalizedWords?.length ?? 0} từ)`, operation: op });
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

  return parsedTopics;
}

export function parseSpeakingPromptsSection(
  rawPrompts: unknown[],
  existingSpeakingCodes: Set<string>,
  counts: ImportPreviewSummary['counts'],
  records: ImportPreviewRecord[],
  errors: ImportErrorItem[],
): NormalizedSpeakingPromptInput[] {
  const parsedSpeakingPrompts: NormalizedSpeakingPromptInput[] = [];
  const bundleSpeakingCodes = new Set<string>();

  rawPrompts.forEach((raw, idx) => {
    const path = `speakingPrompts[${idx}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: 'SpeakingPrompt phải là một đối tượng JSON.' });
      return;
    }

    const code = asTrimmedString(raw.code).toLowerCase();
    const mode = (asTrimmedString(raw.mode) || SpeakingMode.READ_ALOUD).toUpperCase();
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
      ? raw.hints.filter((h): h is string => typeof h === 'string').map((h) => h.trim()).filter(Boolean)
      : [];
    const sampleAsset = asTrimmedString(raw.sampleAsset) || null;
    const imageUrl = asTrimmedString(raw.imageUrl) || null;
    const visualContext = asTrimmedString(raw.visualContext) || null;
    let preparation: Record<string, unknown> | null = null;
    const linkedReadAloudCodes = Array.isArray(raw.linkedReadAloudCodes)
      ? raw.linkedReadAloudCodes.filter((c): c is string => typeof c === 'string').map((c) => c.trim().toLowerCase()).filter(Boolean)
      : [];
    const sortOrder = raw.sortOrder !== undefined && raw.sortOrder !== null ? Number(raw.sortOrder) : undefined;
    const published = typeof raw.published === 'boolean' ? raw.published : true;

    let itemValid = true;
    if (!code || !SLUG_REGEX.test(code) || code.length > 100) {
      errors.push({ path: `${path}.code`, message: 'Mã đề luyện nói chỉ gồm chữ thường, số và dấu gạch ngang (<= 100 ký tự).' });
      itemValid = false;
    } else if (bundleSpeakingCodes.has(code)) {
      errors.push({ path: `${path}.code`, message: `Mã đề luyện nói "${code}" bị trùng trong gói JSON.` });
      itemValid = false;
    }
    if (!SPEAKING_MODE_VALUES.has(mode)) {
      errors.push({ path: `${path}.mode`, message: 'mode phải là READ_ALOUD, TOPIC, PICTURE_DESCRIPTION hoặc TONGUE_TWISTER.' });
      itemValid = false;
    }
    if (!title || title.length > 200) {
      errors.push({ path: `${path}.title`, message: 'Tiêu đề đề luyện nói không được rỗng (<= 200 ký tự).' });
      itemValid = false;
    }
    if (!text || text.length < 2 || text.length > 1000) {
      errors.push({ path: `${path}.text`, message: 'Nội dung đề luyện nói (text) phải từ 2 đến 1000 ký tự.' });
      itemValid = false;
    }
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
      errors.push({ path: `${path}.difficulty`, message: 'difficulty phải là số nguyên từ 1 đến 5.' });
      itemValid = false;
    }
    const modeMaxDuration = mode === SpeakingMode.TOPIC || mode === SpeakingMode.PICTURE_DESCRIPTION ? 60 : 30;
    if (!Number.isInteger(maxDurationSeconds) || maxDurationSeconds < 5 || maxDurationSeconds > modeMaxDuration) {
      errors.push({ path: `${path}.maxDurationSeconds`, message: `maxDurationSeconds cho chế độ ${mode} phải từ 5 đến ${modeMaxDuration} giây.` });
      itemValid = false;
    }
    if (hints.length > 3) {
      errors.push({ path: `${path}.hints`, message: 'Mỗi đề luyện nói chỉ được tối đa 3 gợi ý (hints).' });
      itemValid = false;
    }
    if (sampleAsset && sampleAsset.length > 100) {
      errors.push({ path: `${path}.sampleAsset`, message: 'sampleAsset tối đa 100 ký tự.' });
      itemValid = false;
    }
    if (linkedReadAloudCodes.length > 10) {
      errors.push({ path: `${path}.linkedReadAloudCodes`, message: 'linkedReadAloudCodes tối đa 10 mã.' });
      itemValid = false;
    }
    if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
      errors.push({ path: `${path}.sortOrder`, message: 'sortOrder phải là số nguyên >= 0.' });
      itemValid = false;
    }
    if (visualContext && visualContext.length > 2000) {
      errors.push({ path: `${path}.visualContext`, message: 'visualContext tối đa 2000 ký tự.' });
      itemValid = false;
    }
    if (imageUrl && !isSafeImageUrl(imageUrl)) {
      errors.push({ path: `${path}.imageUrl`, message: 'imageUrl không đúng định dạng ảnh an toàn.' });
      itemValid = false;
    }
    if (mode === SpeakingMode.PICTURE_DESCRIPTION && !imageUrl) {
      errors.push({ path: `${path}.imageUrl`, message: 'Chế độ PICTURE_DESCRIPTION bắt buộc có imageUrl.' });
      itemValid = false;
    }
    if (raw.preparation !== undefined && raw.preparation !== null) {
      if (!isPlainObject(raw.preparation)) {
        errors.push({ path: `${path}.preparation`, message: 'preparation phải là một đối tượng JSON hợp lệ.' });
        itemValid = false;
      } else {
        try {
          preparation = validatePreparation(raw.preparation);
        } catch (err) {
          errors.push({
            path: `${path}.preparation`,
            message: err instanceof Error ? err.message : 'Nội dung preparation không hợp lệ.',
          });
          itemValid = false;
        }
      }
    }
    if (!itemValid) return;

    bundleSpeakingCodes.add(code);
    const op: 'CREATE' | 'UPDATE' = existingSpeakingCodes.has(code) ? 'UPDATE' : 'CREATE';
    if (op === 'CREATE') counts.speakingPrompts.create += 1;
    else counts.speakingPrompts.update += 1;

    records.push({ entity: 'speakingPrompt', identifier: code, title: `[${mode}] ${title}`, operation: op });
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

  return parsedSpeakingPrompts;
}
