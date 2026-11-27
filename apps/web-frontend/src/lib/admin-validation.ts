import type {
  AssessmentSkill,
  GrammarExampleItem,
  GrammarFormulaForm,
  GrammarFormulaItem,
  GrammarUsageItem,
  ItemType,
  ItemUsageScope,
  SpeakingMode,
} from '../types/admin';

export {
  LISTENING_AUDIO_URL_REGEX,
  LISTENING_DETAIL_SKILL_CODES,
  LISTENING_SKILL_CODES,
  READING_SKILL_CODES,
  buildLessonContentFromForm,
  isSafeImageUrl,
  parseLessonJsonDraft,
  validateLessonDraft,
  type LessonDraftInput,
} from './admin-lesson-validation';

export const GRAMMAR_FORMULA_FORMS: readonly GrammarFormulaForm[] = [
  'AFFIRMATIVE',
  'NEGATIVE',
  'QUESTION',
  'NOTE',
] as const;

export const GRAMMAR_CODE_REGEX = /^grammar(\.[a-z_]+)*$/;

export const SPEAKING_MAX_HINTS = 3;

export function maxSpeakingDurationForMode(mode: SpeakingMode): number {
  return mode === 'TOPIC' || mode === 'PICTURE_DESCRIPTION' ? 60 : 30;
}

export function assessmentChoiceDraft(
  raw: unknown,
  correctOption?: string | null,
): {
  options: string[];
  correctIndex: number;
} {
  if (!Array.isArray(raw)) return { options: ['', '', '', ''], correctIndex: -1 };
  return {
    options: raw.map((entry) =>
      typeof entry === 'string' ? entry : String(entry?.text ?? entry?.id ?? ''),
    ),
    correctIndex: raw.findIndex((entry) =>
      typeof entry === 'string'
        ? entry.trim() === correctOption?.trim()
        : entry && (entry.id === correctOption || entry.text === correctOption),
    ),
  };
}

export function buildAssessmentChoices(
  options: string[],
  correctIndex: number,
  original: unknown,
) {
  const originalArr = Array.isArray(original) ? original : [];
  const usesObjectOptions = originalArr.some(
    (entry) => Boolean(entry) && typeof entry === 'object',
  );
  const usedIds = new Set<string>();
  const saved = options.map((text, index) => {
    const previous = originalArr[index];
    if (previous && typeof previous === 'object') {
      const prevRecord = previous as Record<string, unknown>;
      if (typeof prevRecord.id === 'string') {
        usedIds.add(prevRecord.id);
      }
      return { ...prevRecord, text: text.trim() };
    }
    if (usesObjectOptions) {
      let candidateId = String.fromCharCode(65 + index);
      let suffix = 1;
      while (usedIds.has(candidateId)) {
        candidateId = `opt-${index + suffix}`;
        suffix += 1;
      }
      usedIds.add(candidateId);
      return { id: candidateId, text: text.trim() };
    }
    return text.trim();
  });
  const selected = saved[correctIndex];
  return {
    options: saved,
    correctOption:
      typeof selected === 'string'
        ? selected
        : (selected?.id as string | undefined) ??
          (selected?.text as string | undefined),
  };
}

export interface AssessmentItemDraftInput {
  skill: AssessmentSkill;
  type: ItemType;
  usageScope: ItemUsageScope;
  passage: string;
  audioUrl?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  irtB: number;
}

export function validateAssessmentItemDraft(
  draft: AssessmentItemDraftInput,
): string | null {
  if (!draft.prompt.trim() || draft.prompt.trim().length < 3) {
    return 'Nội dung câu hỏi cần ít nhất 3 ký tự.';
  }

  if (!Number.isFinite(draft.irtB)) {
    return 'Độ khó IRT (b) phải là một số hợp lệ.';
  }

  const isPlacement = draft.usageScope === 'PLACEMENT';
  if (isPlacement) {
    if (draft.type !== 'MULTIPLE_CHOICE') {
      return 'Câu hỏi phạm vi PLACEMENT phải thuộc loại MULTIPLE_CHOICE.';
    }
    if (draft.skill !== 'READING' && draft.skill !== 'LISTENING') {
      return 'Câu hỏi phạm vi PLACEMENT chỉ hỗ trợ kỹ năng READING hoặc LISTENING.';
    }
    if (draft.skill === 'READING' && !draft.passage.trim()) {
      return 'Câu hỏi READING phạm vi PLACEMENT bắt buộc phải có đoạn văn đính kèm.';
    }
    if (
      draft.skill === 'LISTENING' &&
      draft.audioUrl !== undefined &&
      !draft.audioUrl.trim()
    ) {
      return 'Câu hỏi LISTENING phạm vi PLACEMENT bắt buộc phải có tệp âm thanh WAV (/media/placement/...).';
    }
  }

  const usesChoiceOptions =
    draft.type === 'MULTIPLE_CHOICE' ||
    draft.type === 'CLOZE' ||
    draft.type === 'GAP_FILL';

  if (usesChoiceOptions) {
    const cleanOptions = draft.options.map((opt) => opt.trim());
    if (isPlacement && cleanOptions.length !== 4) {
      return 'Câu hỏi phạm vi PLACEMENT bắt buộc phải có đúng 4 phương án trả lời.';
    }
    if (cleanOptions.length < 2 || cleanOptions.some((opt) => !opt)) {
      return isPlacement
        ? 'Câu hỏi phạm vi PLACEMENT cần nhập đầy đủ cả 4 phương án trả lời.'
        : 'Vui lòng nhập đầy đủ ít nhất 2 phương án trả lời.';
    }
    if (new Set(cleanOptions).size !== cleanOptions.length) {
      return 'Các phương án trả lời không được trùng nhau.';
    }
    if (draft.correctIndex < 0 || draft.correctIndex >= cleanOptions.length) {
      return 'Vui lòng chọn đáp án đúng.';
    }
  }

  return null;
}

export interface AssessmentRubricFormFields {
  targetGrammarsText: string;
  wordCountMin: string;
  wordCountMax: string;
  timeLimitSeconds: string;
  minSpeakingSeconds: string;
  maxSpeakingSeconds: string;
  taskAchievement?: string;
  coherenceCohesion?: string;
  lexicalResource?: string;
  grammarAccuracy?: string;
}

const WRITING_RUBRIC_KEYS = [
  'taskAchievement',
  'coherenceCohesion',
  'lexicalResource',
  'grammarAccuracy',
] as const;

export function mergeAssessmentRubricCriteria(
  originalRubric: Record<string, unknown> | null | undefined,
  formFields: AssessmentRubricFormFields,
  itemType: ItemType,
): Record<string, unknown> | null {
  if (itemType !== 'ESSAY' && itemType !== 'SPEAKING_PROMPT') {
    return null;
  }

  const next: Record<string, unknown> =
    originalRubric &&
    typeof originalRubric === 'object' &&
    !Array.isArray(originalRubric)
      ? { ...originalRubric }
      : {};

  const grammars = formFields.targetGrammarsText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (grammars.length > 0) next.targetGrammars = grammars;
  else delete next.targetGrammars;

  if (itemType === 'ESSAY') {
    const minStr = formFields.wordCountMin.trim();
    const maxStr = formFields.wordCountMax.trim();
    const parsedMin = minStr !== '' ? Number(minStr) : undefined;
    const parsedMax = maxStr !== '' ? Number(maxStr) : undefined;
    const validMin = parsedMin !== undefined && Number.isFinite(parsedMin) ? parsedMin : undefined;
    const validMax = parsedMax !== undefined && Number.isFinite(parsedMax) ? parsedMax : undefined;

    if (validMin !== undefined || validMax !== undefined) {
      next.wordCount = {
        ...(validMin !== undefined ? { min: validMin } : {}),
        ...(validMax !== undefined ? { max: validMax } : {}),
      };
    } else {
      delete next.wordCount;
    }

    const timeStr = formFields.timeLimitSeconds.trim();
    const parsedTime = timeStr !== '' ? Number(timeStr) : undefined;
    if (parsedTime !== undefined && Number.isFinite(parsedTime)) next.timeLimitSeconds = parsedTime;
    else delete next.timeLimitSeconds;

    delete next.minSpeakingSeconds;
    delete next.maxSpeakingSeconds;

    for (const key of WRITING_RUBRIC_KEYS) {
      const rawValue = formFields[key];
      if (rawValue !== undefined) {
        const trimmed = rawValue.trim();
        if (trimmed) next[key] = trimmed;
        else delete next[key];
      }
    }
  } else {
    const minSpeakStr = formFields.minSpeakingSeconds.trim();
    const parsedMinSpeak = minSpeakStr !== '' ? Number(minSpeakStr) : undefined;
    if (parsedMinSpeak !== undefined && Number.isFinite(parsedMinSpeak)) next.minSpeakingSeconds = parsedMinSpeak;
    else delete next.minSpeakingSeconds;

    const maxSpeakStr = formFields.maxSpeakingSeconds.trim();
    const parsedMaxSpeak = maxSpeakStr !== '' ? Number(maxSpeakStr) : undefined;
    if (parsedMaxSpeak !== undefined && Number.isFinite(parsedMaxSpeak)) next.maxSpeakingSeconds = parsedMaxSpeak;
    else delete next.maxSpeakingSeconds;

    delete next.wordCount;
    delete next.timeLimitSeconds;
  }

  return Object.keys(next).length > 0 ? next : null;
}

export interface GrammarFormulaDraftInput {
  form?: GrammarFormulaForm | string;
  labelVi?: string;
  structure?: string;
  noteVi?: string;
}

export interface GrammarUsageDraftInput {
  useCaseVi?: string;
  signalWords?: string[];
  signalWordsText?: string;
  commonMistakeVi?: string;
}

export interface GrammarExampleDraftInput {
  sentenceEn?: string;
  translationVi?: string;
  highlight?: string;
}

export interface NormalizedGrammarTopicPayload {
  formulas: GrammarFormulaItem[];
  usageNotes: GrammarUsageItem[];
  examples: GrammarExampleItem[];
  error: string | null;
}

export function normalizeGrammarTopicPayload(input: {
  isLeaf: boolean;
  formulas?: GrammarFormulaDraftInput[];
  usageNotes?: GrammarUsageDraftInput[];
  examples?: GrammarExampleDraftInput[];
}): NormalizedGrammarTopicPayload {
  if (!input.isLeaf) {
    return { formulas: [], usageNotes: [], examples: [], error: null };
  }

  const formulas: GrammarFormulaItem[] = [];
  for (let i = 0; i < (input.formulas ?? []).length; i++) {
    const row = input.formulas![i];
    const labelVi = (row?.labelVi ?? '').trim();
    const structure = (row?.structure ?? '').trim();
    const noteVi = (row?.noteVi ?? '').trim();
    const form = (row?.form ?? 'AFFIRMATIVE') as GrammarFormulaForm;

    if (!labelVi && !structure && !noteVi) continue;
    if (!(GRAMMAR_FORMULA_FORMS as readonly string[]).includes(form)) {
      return { formulas: [], usageNotes: [], examples: [], error: `Công thức #${i + 1} có loại câu (form) không hợp lệ.` };
    }
    if (!labelVi || !structure) {
      return { formulas: [], usageNotes: [], examples: [], error: `Công thức #${i + 1} cần đầy đủ nhãn tiếng Việt và cấu trúc.` };
    }
    formulas.push({ form, labelVi, structure, ...(noteVi ? { noteVi } : {}) });
  }
  if (formulas.length === 0) {
    return { formulas: [], usageNotes: [], examples: [], error: 'Chủ điểm ngữ pháp lá (Leaf) cần ít nhất 1 công thức cấu trúc.' };
  }
  if (formulas.length > 20) {
    return { formulas: [], usageNotes: [], examples: [], error: 'Tối đa 20 công thức cho mỗi chủ điểm ngữ pháp.' };
  }

  const usageNotes: GrammarUsageItem[] = [];
  for (let i = 0; i < (input.usageNotes ?? []).length; i++) {
    const row = input.usageNotes![i];
    const useCaseVi = (row?.useCaseVi ?? '').trim();
    const commonMistakeVi = (row?.commonMistakeVi ?? '').trim();
    const signalWords =
      typeof row?.signalWordsText === 'string'
        ? row.signalWordsText.split(',').map((w) => w.trim()).filter(Boolean)
        : Array.isArray(row?.signalWords)
          ? row.signalWords.filter((w): w is string => typeof w === 'string').map((w) => w.trim()).filter(Boolean)
          : [];

    if (!useCaseVi && signalWords.length === 0 && !commonMistakeVi) continue;
    if (!useCaseVi) {
      return { formulas: [], usageNotes: [], examples: [], error: `Cách dùng #${i + 1} cần mô tả tình huống sử dụng tiếng Việt.` };
    }
    if (signalWords.length > 30) {
      return { formulas: [], usageNotes: [], examples: [], error: `Cách dùng #${i + 1} chỉ cho phép tối đa 30 từ dấu hiệu.` };
    }
    usageNotes.push({
      useCaseVi,
      ...(signalWords.length > 0 ? { signalWords } : {}),
      ...(commonMistakeVi ? { commonMistakeVi } : {}),
    });
  }
  if (usageNotes.length === 0) {
    return { formulas: [], usageNotes: [], examples: [], error: 'Chủ điểm ngữ pháp lá (Leaf) cần ít nhất 1 ghi chú cách dùng.' };
  }
  if (usageNotes.length > 20) {
    return { formulas: [], usageNotes: [], examples: [], error: 'Tối đa 20 ghi chú cách dùng cho mỗi chủ điểm ngữ pháp.' };
  }

  const examples: GrammarExampleItem[] = [];
  for (let i = 0; i < (input.examples ?? []).length; i++) {
    const row = input.examples![i];
    const sentenceEn = (row?.sentenceEn ?? '').trim();
    const translationVi = (row?.translationVi ?? '').trim();
    const highlight = (row?.highlight ?? '').trim();

    if (!sentenceEn && !translationVi && !highlight) continue;
    if (!sentenceEn || !translationVi) {
      return { formulas: [], usageNotes: [], examples: [], error: `Ví dụ #${i + 1} cần đầy đủ câu tiếng Anh và bản dịch tiếng Việt.` };
    }
    examples.push({ sentenceEn, translationVi, ...(highlight ? { highlight } : {}) });
  }
  if (examples.length === 0) {
    return { formulas: [], usageNotes: [], examples: [], error: 'Chủ điểm ngữ pháp lá (Leaf) cần ít nhất 1 ví dụ song ngữ.' };
  }
  if (examples.length > 20) {
    return { formulas: [], usageNotes: [], examples: [], error: 'Tối đa 20 ví dụ cho mỗi chủ điểm ngữ pháp.' };
  }

  return { formulas, usageNotes, examples, error: null };
}

export type PaginationToken = number | 'ellipsis';

export function computePaginationRange(
  currentPage: number,
  totalPages: number,
): PaginationToken[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, idx) => idx + 1);

  const result: PaginationToken[] = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) result.push('ellipsis');
  for (let p = left; p <= right; p++) result.push(p);
  if (right < totalPages - 1) result.push('ellipsis');
  result.push(totalPages);

  return result;
}
