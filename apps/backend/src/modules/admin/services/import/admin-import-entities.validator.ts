import {
  AssessmentSkill,
  CefrLevel,
  ItemUsageScope,
  SpeakingMode,
} from '@prisma/client';
import { isSafeImageUrl } from '../../../learning/learning.types';
import {
  ASSESSMENT_SKILL_VALUES,
  asTrimmedString,
  CEFR_LEVEL_VALUES,
  ImportErrorItem,
  ImportPreviewRecord,
  ImportPreviewSummary,
  isPlainObject,
  isSafeMediaUrl,
  NormalizedAssessmentGroupInput,
  NormalizedSpeakingPromptInput,
  NormalizedTopicInput,
  NormalizedTopicWordInput,
  NormalizedUnitInput,
  SLUG_REGEX,
  SPEAKING_MODE_VALUES,
  USAGE_SCOPE_VALUES,
  UUID_REGEX,
} from './admin-import.types';

export function validateAndParseUnits(params: {
  rawUnits: unknown[];
  existingUnitByCode: Map<string, { id: string; code: string; cefrLevel: CefrLevel; orderIndex: number }>;
  existingUnitByLevelOrder: Map<string, string>;
  errors: ImportErrorItem[];
  records: ImportPreviewRecord[];
  counts: ImportPreviewSummary['counts'];
}): {
  parsedUnits: NormalizedUnitInput[];
  bundleUnitCodes: Set<string>;
} {
  const {
    rawUnits,
    existingUnitByCode,
    existingUnitByLevelOrder,
    errors,
    records,
    counts,
  } = params;

  const parsedUnits: NormalizedUnitInput[] = [];
  const bundleUnitCodes = new Set<string>();
  const bundleUnitOrderKeys = new Map<string, string>();

  rawUnits.forEach((raw, idx) => {
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

  return { parsedUnits, bundleUnitCodes };
}

export function validateAndParseAssessmentGroups(params: {
  rawGroups: unknown[];
  existingGroupIds: Set<string>;
  errors: ImportErrorItem[];
  records: ImportPreviewRecord[];
  counts: ImportPreviewSummary['counts'];
}): {
  parsedGroups: NormalizedAssessmentGroupInput[];
  bundleGroupIds: Set<string>;
} {
  const { rawGroups, existingGroupIds, errors, records, counts } = params;
  const parsedGroups: NormalizedAssessmentGroupInput[] = [];
  const bundleGroupIds = new Set<string>();

  rawGroups.forEach((raw, idx) => {
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
    const partNumber = raw.partNumber !== undefined ? Number(raw.partNumber) : 1;
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

  return { parsedGroups, bundleGroupIds };
}

export function validateAndParseTopics(params: {
  rawTopics: unknown[];
  existingTopicSlugs: Set<string>;
  errors: ImportErrorItem[];
  records: ImportPreviewRecord[];
  counts: ImportPreviewSummary['counts'];
}): NormalizedTopicInput[] {
  const { rawTopics, existingTopicSlugs, errors, records, counts } = params;
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
    const displayOrder =
      topicObj.displayOrder !== undefined ? Number(topicObj.displayOrder) : idx + 1;

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

  return parsedTopics;
}

export function validateAndParseSpeakingPrompts(params: {
  rawSpeakingPrompts: unknown[];
  existingSpeakingCodes: Set<string>;
  errors: ImportErrorItem[];
  records: ImportPreviewRecord[];
  counts: ImportPreviewSummary['counts'];
}): NormalizedSpeakingPromptInput[] {
  const {
    rawSpeakingPrompts,
    existingSpeakingCodes,
    errors,
    records,
    counts,
  } = params;
  const parsedSpeakingPrompts: NormalizedSpeakingPromptInput[] = [];
  const bundleSpeakingCodes = new Set<string>();

  rawSpeakingPrompts.forEach((raw, idx) => {
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
        message:
          'mode phải là READ_ALOUD, TOPIC, PICTURE_DESCRIPTION hoặc TONGUE_TWISTER.',
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

    if (!text || text.length < 2 || text.length > 1000) {
      errors.push({
        path: `${path}.text`,
        message: 'Nội dung đề luyện nói (text) phải từ 2 đến 1000 ký tự.',
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

    const modeMaxDuration =
      mode === SpeakingMode.TOPIC || mode === SpeakingMode.PICTURE_DESCRIPTION
        ? 60
        : 30;
    if (
      !Number.isInteger(maxDurationSeconds) ||
      maxDurationSeconds < 5 ||
      maxDurationSeconds > modeMaxDuration
    ) {
      errors.push({
        path: `${path}.maxDurationSeconds`,
        message: `maxDurationSeconds cho chế độ ${mode} phải từ 5 đến ${modeMaxDuration} giây.`,
      });
      itemValid = false;
    }

    if (hints.length > 3) {
      errors.push({
        path: `${path}.hints`,
        message: 'Mỗi đề luyện nói chỉ được tối đa 3 gợi ý (hints).',
      });
      itemValid = false;
    }

    if (visualContext && visualContext.length > 2000) {
      errors.push({
        path: `${path}.visualContext`,
        message: 'visualContext tối đa 2000 ký tự.',
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

  return parsedSpeakingPrompts;
}
