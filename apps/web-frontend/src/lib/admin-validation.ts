import type {
  AssessmentSkill,
  GrammarExampleItem,
  GrammarFormulaForm,
  GrammarFormulaItem,
  GrammarUsageItem,
  ItemType,
  ItemUsageScope,
  LearningContentPayload,
  LearningKeyVocabInput,
  LearningKind,
  LearningQuestionInput,
  LearningStepInput,
  ListeningSegmentInput,
  SpeakingMode,
} from '../types/admin';

export const READING_SKILL_CODES = [
  'reading.skimming',
  'reading.main_idea',
  'reading.inference',
  'reading.scanning',
  'reading.context_clues',
  'reading.text_structure',
  'reading.fact_opinion',
  'reading.author_purpose',
  'reading.critical_reading',
  'reading.text_types',
  'reading.text_types.short_stories',
  'reading.text_types.news_articles',
  'reading.text_types.informal_letters',
  'reading.text_types.formal_letters',
  'reading.text_types.reports',
  'reading.text_types.academic_texts',
  'reading.text_types.literary_texts',
] as const;

export const LISTENING_SKILL_CODES = [
  'listening.basic_dialogues',
  'listening.gist',
  'listening.detail',
  'listening.numbers_dates_times',
  'listening.directions',
  'listening.specific_information',
  'listening.speaker_attitude',
  'listening.note_taking',
  'listening.implied_meaning',
  'listening.accents',
  'listening.discussions',
  'listening.lectures',
] as const;

export const LISTENING_DETAIL_SKILL_CODES = [
  'listening.specific_information',
  'listening.detail',
  'listening.numbers_dates_times',
] as const;

export const LISTENING_AUDIO_URL_REGEX =
  /^\/media\/learning\/v1\/([a-z0-9]+(?:-[a-z0-9]+)*\.wav)$/;

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

export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || trimmed !== value) return false;
  if (trimmed.includes('..') || /[\s\u0000-\u001f]/.test(trimmed)) return false;
  return (
    /^\/media\/learning\/v1\/images\/[a-z0-9-]+(?:\.(?:svg|png|webp|jpg|jpeg))$/i.test(
      trimmed,
    ) ||
    /^assets\/illustrations\/[a-z0-9-]+(?:\.(?:svg|png|webp|jpg|jpeg))$/i.test(
      trimmed,
    ) ||
    /^https:\/\/[^\s]+$/i.test(trimmed)
  );
}

export interface LessonDraftInput {
  code: string;
  kind: LearningKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  passage?: string;
  coverImageUrl?: string;
  keyVocabulary?: LearningKeyVocabInput[];
  listeningVersion?: number;
  audioUrl?: string;
  audioDurationMs?: number;
  transcript?: string;
  preparation?: {
    situation: string;
    objective: string;
  };
  transcriptSegments?: ListeningSegmentInput[];
  steps: LearningStepInput[];
  questions: LearningQuestionInput[];
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function buildLessonContentFromForm(
  draft: Pick<
    LessonDraftInput,
    | 'kind'
    | 'passage'
    | 'coverImageUrl'
    | 'keyVocabulary'
    | 'audioUrl'
    | 'audioDurationMs'
    | 'preparation'
    | 'transcriptSegments'
    | 'steps'
    | 'questions'
  >,
  original?: LearningContentPayload,
): LearningContentPayload {
  const isListening = draft.kind === 'LISTENING';
  const isReading = draft.kind === 'READING';

  const cleanSteps = isListening
    ? []
    : draft.steps.map((step, index) => {
        const { word, phonetic, meaning, example, audioUrl, ...rest } = step;
        return {
          ...rest,
          id: step.id.trim() || `step-${index + 1}`,
          title: step.title.trim(),
          body: step.body.trim(),
          ...(word?.trim() ? { word: word.trim() } : {}),
          ...(phonetic?.trim() ? { phonetic: phonetic.trim() } : {}),
          ...(meaning?.trim() ? { meaning: meaning.trim() } : {}),
          ...(example?.trim() ? { example: example.trim() } : {}),
          ...(audioUrl?.trim() ? { audioUrl: audioUrl.trim() } : {}),
        };
      });

  const cleanSegments = isListening
    ? (draft.transcriptSegments ?? []).map((seg, idx) => {
        const { speakerAvatar, ...rest } = seg;
        return {
          ...rest,
          id: seg.id.trim() || `seg-${idx + 1}`,
          speaker: seg.speaker.trim() || `Speaker ${idx + 1}`,
          startMs: Math.max(0, Math.round(Number(seg.startMs) || 0)),
          endMs: Math.max(0, Math.round(Number(seg.endMs) || 0)),
          text: seg.text.trim(),
          translationVi: seg.translationVi.trim(),
          ...(speakerAvatar?.trim()
            ? { speakerAvatar: speakerAvatar.trim() }
            : {}),
        };
      })
    : [];

  const segmentOrder = new Map<string, number>(
    cleanSegments.map((seg, idx) => [seg.id, idx]),
  );

  const cleanQuestions = draft.questions.map((question, qIndex) => {
    const qType = isListening
      ? 'MULTIPLE_CHOICE'
      : (question.type ?? 'MULTIPLE_CHOICE');
    const options =
      qType === 'TRUE_FALSE_NOT_GIVEN'
        ? [
            { id: 'A', text: 'True' },
            { id: 'B', text: 'False' },
            { id: 'C', text: 'Not Given' },
          ]
        : question.options.map((opt, optIndex) => {
            const { imageUrl, ...optRest } = opt;
            return {
              ...optRest,
              id: opt.id.trim() || String.fromCharCode(65 + optIndex),
              text: opt.text.trim(),
              ...(imageUrl?.trim() ? { imageUrl: imageUrl.trim() } : {}),
            };
          });

    const { evidence, skillCode, evidenceSegmentIds, ...qRest } = question;
    const cleanSkillCode = skillCode?.trim();
    const cleanEvidence = isReading ? evidence?.trim() : undefined;

    let cleanEvidenceSegmentIds: string[] | undefined;
    if (isListening && evidenceSegmentIds?.length) {
      const deduped = Array.from(
        new Set(evidenceSegmentIds.map((s) => s.trim()).filter(Boolean)),
      );
      const ordered =
        cleanSegments.length > 0
          ? deduped
              .filter((id) => segmentOrder.has(id))
              .sort(
                (a, b) =>
                  (segmentOrder.get(a) ?? 0) - (segmentOrder.get(b) ?? 0),
              )
          : deduped;
      if (ordered.length > 0) {
        cleanEvidenceSegmentIds = ordered;
      }
    }

    return {
      ...qRest,
      id: question.id.trim() || `q-${qIndex + 1}`,
      type: qType,
      prompt: question.prompt.trim(),
      options,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation.trim(),
      ...(cleanEvidence ? { evidence: cleanEvidence } : {}),
      ...(cleanSkillCode ? { skillCode: cleanSkillCode } : {}),
      ...(cleanEvidenceSegmentIds
        ? { evidenceSegmentIds: cleanEvidenceSegmentIds }
        : {}),
    };
  });

  const cleanPassage = draft.passage?.trim();
  const nextCoverImage =
    draft.coverImageUrl !== undefined
      ? draft.coverImageUrl.trim() || undefined
      : original?.coverImageUrl;

  const nextKeyVocab =
    draft.keyVocabulary !== undefined
      ? draft.keyVocabulary
          .filter((item) => item.word.trim() || item.meaning.trim())
          .map((item, idx) => {
            const { phonetic, example, translation, imageUrl, ...vRest } = item;
            return {
              ...vRest,
              id: item.id.trim() || `v-${idx + 1}`,
              word: item.word.trim(),
              meaning: item.meaning.trim(),
              ...(phonetic?.trim() ? { phonetic: phonetic.trim() } : {}),
              ...(example?.trim() ? { example: example.trim() } : {}),
              ...(translation?.trim()
                ? { translation: translation.trim() }
                : {}),
              ...(imageUrl?.trim() ? { imageUrl: imageUrl.trim() } : {}),
            };
          })
      : original?.keyVocabulary;

  if (isListening) {
    const syncedTranscript = cleanSegments
      .map((seg) => seg.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const result: LearningContentPayload = {
      ...original,
      listeningVersion: 1,
      steps: [],
      questions: cleanQuestions,
      audioUrl: draft.audioUrl?.trim() || original?.audioUrl || '',
      audioDurationMs: Math.round(
        Number(draft.audioDurationMs ?? original?.audioDurationMs ?? 30000),
      ),
      transcript: syncedTranscript || original?.transcript || '',
      preparation: {
        situation:
          draft.preparation?.situation?.trim() ??
          original?.preparation?.situation ??
          '',
        objective:
          draft.preparation?.objective?.trim() ??
          original?.preparation?.objective ??
          '',
      },
      keyVocabulary: nextKeyVocab ?? [],
      transcriptSegments: cleanSegments,
    };

    delete result.passage;
    if (nextCoverImage) {
      result.coverImageUrl = nextCoverImage;
    } else if (draft.coverImageUrl !== undefined) {
      delete result.coverImageUrl;
    }
    return result;
  }

  const result: LearningContentPayload = {
    ...original,
    steps: cleanSteps,
    questions: cleanQuestions,
  };

  delete result.listeningVersion;
  delete result.audioDurationMs;
  delete result.preparation;
  delete result.transcriptSegments;
  delete result.audioUrl;
  delete result.transcript;

  if (isReading && cleanPassage) {
    result.passage = cleanPassage;
  } else {
    delete result.passage;
  }

  if (nextCoverImage) {
    result.coverImageUrl = nextCoverImage;
  } else if (draft.coverImageUrl !== undefined) {
    delete result.coverImageUrl;
  }

  if (nextKeyVocab && nextKeyVocab.length > 0) {
    result.keyVocabulary = nextKeyVocab;
  } else if (draft.keyVocabulary !== undefined) {
    delete result.keyVocabulary;
  }

  return result;
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
  if (grammars.length > 0) {
    next.targetGrammars = grammars;
  } else {
    delete next.targetGrammars;
  }

  if (itemType === 'ESSAY') {
    const minStr = formFields.wordCountMin.trim();
    const maxStr = formFields.wordCountMax.trim();
    const parsedMin = minStr !== '' ? Number(minStr) : undefined;
    const parsedMax = maxStr !== '' ? Number(maxStr) : undefined;
    const validMin =
      parsedMin !== undefined && Number.isFinite(parsedMin)
        ? parsedMin
        : undefined;
    const validMax =
      parsedMax !== undefined && Number.isFinite(parsedMax)
        ? parsedMax
        : undefined;

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
    if (parsedTime !== undefined && Number.isFinite(parsedTime)) {
      next.timeLimitSeconds = parsedTime;
    } else {
      delete next.timeLimitSeconds;
    }

    delete next.minSpeakingSeconds;
    delete next.maxSpeakingSeconds;

    for (const key of WRITING_RUBRIC_KEYS) {
      const rawValue = formFields[key];
      if (rawValue !== undefined) {
        const trimmed = rawValue.trim();
        if (trimmed) {
          next[key] = trimmed;
        } else {
          delete next[key];
        }
      }
    }
  } else {
    const minSpeakStr = formFields.minSpeakingSeconds.trim();
    const parsedMinSpeak = minSpeakStr !== '' ? Number(minSpeakStr) : undefined;
    if (parsedMinSpeak !== undefined && Number.isFinite(parsedMinSpeak)) {
      next.minSpeakingSeconds = parsedMinSpeak;
    } else {
      delete next.minSpeakingSeconds;
    }

    const maxSpeakStr = formFields.maxSpeakingSeconds.trim();
    const parsedMaxSpeak = maxSpeakStr !== '' ? Number(maxSpeakStr) : undefined;
    if (parsedMaxSpeak !== undefined && Number.isFinite(parsedMaxSpeak)) {
      next.maxSpeakingSeconds = parsedMaxSpeak;
    } else {
      delete next.maxSpeakingSeconds;
    }

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
      return {
        formulas: [],
        usageNotes: [],
        examples: [],
        error: `Công thức #${i + 1} có loại câu (form) không hợp lệ.`,
      };
    }
    if (!labelVi || !structure) {
      return {
        formulas: [],
        usageNotes: [],
        examples: [],
        error: `Công thức #${i + 1} cần đầy đủ nhãn tiếng Việt và cấu trúc.`,
      };
    }
    formulas.push({
      form,
      labelVi,
      structure,
      ...(noteVi ? { noteVi } : {}),
    });
  }
  if (formulas.length === 0) {
    return {
      formulas: [],
      usageNotes: [],
      examples: [],
      error: 'Chủ điểm ngữ pháp lá (Leaf) cần ít nhất 1 công thức cấu trúc.',
    };
  }
  if (formulas.length > 20) {
    return {
      formulas: [],
      usageNotes: [],
      examples: [],
      error: 'Tối đa 20 công thức cho mỗi chủ điểm ngữ pháp.',
    };
  }

  const usageNotes: GrammarUsageItem[] = [];
  for (let i = 0; i < (input.usageNotes ?? []).length; i++) {
    const row = input.usageNotes![i];
    const useCaseVi = (row?.useCaseVi ?? '').trim();
    const commonMistakeVi = (row?.commonMistakeVi ?? '').trim();
    const signalWords =
      typeof row?.signalWordsText === 'string'
        ? row.signalWordsText
            .split(',')
            .map((w) => w.trim())
            .filter(Boolean)
        : Array.isArray(row?.signalWords)
          ? row.signalWords
              .filter((w): w is string => typeof w === 'string')
              .map((w) => w.trim())
              .filter(Boolean)
          : [];

    if (!useCaseVi && signalWords.length === 0 && !commonMistakeVi) continue;
    if (!useCaseVi) {
      return {
        formulas: [],
        usageNotes: [],
        examples: [],
        error: `Cách dùng #${i + 1} cần mô tả tình huống sử dụng tiếng Việt.`,
      };
    }
    if (signalWords.length > 30) {
      return {
        formulas: [],
        usageNotes: [],
        examples: [],
        error: `Cách dùng #${i + 1} chỉ cho phép tối đa 30 từ dấu hiệu.`,
      };
    }
    usageNotes.push({
      useCaseVi,
      ...(signalWords.length > 0 ? { signalWords } : {}),
      ...(commonMistakeVi ? { commonMistakeVi } : {}),
    });
  }
  if (usageNotes.length === 0) {
    return {
      formulas: [],
      usageNotes: [],
      examples: [],
      error: 'Chủ điểm ngữ pháp lá (Leaf) cần ít nhất 1 ghi chú cách dùng.',
    };
  }
  if (usageNotes.length > 20) {
    return {
      formulas: [],
      usageNotes: [],
      examples: [],
      error: 'Tối đa 20 ghi chú cách dùng cho mỗi chủ điểm ngữ pháp.',
    };
  }

  const examples: GrammarExampleItem[] = [];
  for (let i = 0; i < (input.examples ?? []).length; i++) {
    const row = input.examples![i];
    const sentenceEn = (row?.sentenceEn ?? '').trim();
    const translationVi = (row?.translationVi ?? '').trim();
    const highlight = (row?.highlight ?? '').trim();

    if (!sentenceEn && !translationVi && !highlight) continue;
    if (!sentenceEn || !translationVi) {
      return {
        formulas: [],
        usageNotes: [],
        examples: [],
        error: `Ví dụ #${i + 1} cần đầy đủ câu tiếng Anh và bản dịch tiếng Việt.`,
      };
    }
    examples.push({
      sentenceEn,
      translationVi,
      ...(highlight ? { highlight } : {}),
    });
  }
  if (examples.length === 0) {
    return {
      formulas: [],
      usageNotes: [],
      examples: [],
      error: 'Chủ điểm ngữ pháp lá (Leaf) cần ít nhất 1 ví dụ song ngữ.',
    };
  }
  if (examples.length > 20) {
    return {
      formulas: [],
      usageNotes: [],
      examples: [],
      error: 'Tối đa 20 ví dụ cho mỗi chủ điểm ngữ pháp.',
    };
  }

  return { formulas, usageNotes, examples, error: null };
}

function hasUniqueMatch(passage: string, evidence: string): boolean {
  const needle = evidence.trim().toLowerCase();
  const haystack = passage.toLowerCase();
  if (!needle || !haystack.trim()) return false;
  const first = haystack.indexOf(needle);
  return first !== -1 && haystack.indexOf(needle, first + 1) === -1;
}

export function validateLessonDraft(draft: LessonDraftInput): string | null {
  const code = draft.code.trim();
  if (!/^[a-z0-9-]+$/.test(code)) {
    return 'Mã bài học chỉ được chứa chữ thường (a-z), số (0-9) và dấu gạch ngang (-).';
  }
  if (!draft.title.trim()) {
    return 'Tiêu đề bài tập không được để trống.';
  }
  if (!draft.description.trim()) {
    return 'Mô tả ngắn không được để trống.';
  }
  if (
    !Number.isInteger(draft.estimatedMinutes) ||
    draft.estimatedMinutes < 1 ||
    draft.estimatedMinutes > 120
  ) {
    return 'Thời lượng dự kiến phải từ 1 đến 120 phút.';
  }

  const coverUrl = draft.coverImageUrl?.trim();
  if (coverUrl && !isSafeImageUrl(coverUrl)) {
    return 'Ảnh bìa (coverImageUrl) phải dùng https:// hoặc đường dẫn ảnh hợp lệ (/media/learning/v1/images/...).';
  }

  const activeVocab = (draft.keyVocabulary ?? []).filter(
    (v) =>
      v.word.trim() ||
      v.meaning.trim() ||
      v.phonetic?.trim() ||
      v.example?.trim() ||
      v.translation?.trim() ||
      v.imageUrl?.trim(),
  );
  const vocabIds = new Set<string>();
  const vocabPairs = new Set<string>();
  for (let i = 0; i < activeVocab.length; i++) {
    const v = activeVocab[i];
    const word = v.word.trim();
    const meaning = v.meaning.trim();
    const vId = v.id.trim() || `v-${i + 1}`;
    if (!word || word.length > 100 || !meaning || meaning.length > 500) {
      return `Từ vựng trọng tâm #${i + 1} cần đầy đủ từ tiếng Anh (<= 100 ký tự) và nghĩa tiếng Việt (<= 500 ký tự).`;
    }
    if (vocabIds.has(vId)) {
      return `Trùng mã từ vựng trọng tâm: ${vId}.`;
    }
    vocabIds.add(vId);
    const imgUrl = v.imageUrl?.trim();
    if (imgUrl && !isSafeImageUrl(imgUrl)) {
      return `Ảnh minh họa của từ vựng #${i + 1} (${word}) không hợp lệ.`;
    }
    const pairKey = `${word.toLowerCase()}||${meaning.toLowerCase()}`;
    if (vocabPairs.has(pairKey)) {
      return `Từ vựng trọng tâm bị trùng lặp: "${word}".`;
    }
    vocabPairs.add(pairKey);
  }

  if (draft.kind === 'LISTENING') {
    if (draft.listeningVersion !== undefined && draft.listeningVersion !== 1) {
      return 'Bài Nghe hiểu phải dùng chuẩn listeningVersion = 1.';
    }
    if (draft.steps.length !== 0) {
      return 'Bài Nghe hiểu chuẩn v1 yêu cầu không có bước hướng dẫn (steps phải rỗng).';
    }
    if (draft.passage?.trim()) {
      return 'Bài Nghe hiểu chuẩn v1 không sử dụng trường passage (đoạn văn đọc hiểu).';
    }
    const cleanAudioUrl = draft.audioUrl?.trim() ?? '';
    if (!cleanAudioUrl || !LISTENING_AUDIO_URL_REGEX.test(cleanAudioUrl)) {
      return 'Bài nghe hiểu (LISTENING) bắt buộc dùng đường dẫn WAV chuẩn /media/learning/v1/<slug>.wav.';
    }
    const dur = Number(draft.audioDurationMs);
    if (!Number.isInteger(dur) || dur < 30000 || dur > 90000) {
      return 'Thời lượng audio bài Nghe hiểu phải là số nguyên trong khoảng 30.000ms – 90.000ms (30–90 giây).';
    }
    if (
      !draft.preparation?.situation?.trim() ||
      !draft.preparation?.objective?.trim()
    ) {
      return 'Bài Nghe hiểu cần nhập đủ tình huống (situation) và mục tiêu (objective) trong phần Chuẩn bị.';
    }
    if (activeVocab.length < 3 || activeVocab.length > 5) {
      return 'Bài Nghe hiểu chuẩn v1 cần từ 3 đến 5 từ vựng trọng tâm (keyVocabulary) hợp lệ và không trùng lặp.';
    }
    const segs = draft.transcriptSegments ?? [];
    if (segs.length < 2) {
      return 'Bài Nghe hiểu cần tối thiểu 2 đoạn hội thoại (transcriptSegments).';
    }
    const segmentIds = new Set<string>();
    let previousEnd = 0;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const segId = seg.id.trim() || `seg-${i + 1}`;
      if (segmentIds.has(segId)) {
        return `Trùng mã đoạn transcript: ${segId}.`;
      }
      segmentIds.add(segId);
      if (!seg.speaker.trim() || !seg.text.trim() || !seg.translationVi.trim()) {
        return `Đoạn transcript #${i + 1} cần đầy đủ người nói, nội dung tiếng Anh và bản dịch tiếng Việt.`;
      }
      const avatar = seg.speakerAvatar?.trim();
      if (avatar && !isSafeImageUrl(avatar)) {
        return `Ảnh đại diện người nói (speakerAvatar) ở đoạn #${i + 1} không hợp lệ.`;
      }
      if (!Number.isInteger(seg.startMs) || !Number.isInteger(seg.endMs)) {
        return `Đoạn transcript #${i + 1} phải có mốc startMs và endMs là số nguyên (ms).`;
      }
      if (seg.startMs < previousEnd) {
        return `Đoạn transcript #${i + 1} bị chồng lấn thời gian (startMs phải >= ${previousEnd}ms).`;
      }
      if (seg.endMs <= seg.startMs) {
        return `Đoạn transcript #${i + 1} có mốc kết thúc (endMs) phải lớn hơn bắt đầu (startMs).`;
      }
      if (seg.endMs > dur) {
        return `Đoạn transcript #${i + 1} vượt quá tổng thời lượng audio (${dur}ms).`;
      }
      previousEnd = seg.endMs;
    }

    if (
      draft.transcript !== undefined &&
      normalizeWhitespace(draft.transcript) !==
        normalizeWhitespace(segs.map((s) => s.text).join(' '))
    ) {
      return 'Trường transcript của bài Nghe hiểu phải khớp chính xác với nội dung nối từ các transcriptSegments (không kèm tên người nói).';
    }

    if (draft.questions.length !== 5) {
      return 'Bài Nghe hiểu chuẩn v1 yêu cầu đúng 5 câu hỏi.';
    }

    let hasGist = false;
    let hasDetailGroup = false;
    for (let i = 0; i < draft.questions.length; i++) {
      const q = draft.questions[i];
      const qType = q.type ?? 'MULTIPLE_CHOICE';
      if (qType !== 'MULTIPLE_CHOICE') {
        return `Câu hỏi Nghe hiểu #${i + 1} bắt buộc phải là trắc nghiệm MULTIPLE_CHOICE.`;
      }
      if (q.evidence?.trim()) {
        return `Câu hỏi Nghe hiểu #${i + 1} không sử dụng trường evidence văn bản (chỉ dùng evidenceSegmentIds).`;
      }
      const sc = q.skillCode?.trim() ?? '';
      if (!sc || !(LISTENING_SKILL_CODES as readonly string[]).includes(sc)) {
        return `Câu hỏi Nghe hiểu #${i + 1} phải chọn skillCode hợp lệ trong danh mục Nghe hiểu chuẩn.`;
      }
      if (sc === 'listening.gist') hasGist = true;
      if ((LISTENING_DETAIL_SKILL_CODES as readonly string[]).includes(sc)) {
        hasDetailGroup = true;
      }
      const evIds = (q.evidenceSegmentIds ?? [])
        .map((s) => s.trim())
        .filter(Boolean);
      if (evIds.length === 0) {
        return `Câu hỏi Nghe hiểu #${i + 1} cần gắn ít nhất 1 đoạn transcript dẫn chứng.`;
      }
      if (new Set(evIds).size !== evIds.length) {
        return `Câu hỏi Nghe hiểu #${i + 1} có đoạn dẫn chứng bị trùng lặp.`;
      }
      if (evIds.some((id) => !segmentIds.has(id))) {
        return `Câu hỏi Nghe hiểu #${i + 1} tham chiếu đoạn transcript không tồn tại.`;
      }
      const optionTexts = q.options.map((o) => o.text.trim().toLowerCase());
      if (q.options.length === 4 && new Set(optionTexts).size !== 4) {
        return `Câu hỏi Nghe hiểu #${i + 1} phải có 4 phương án trả lời khác nhau (không phân biệt hoa/thường).`;
      }
    }

    if (!hasGist) {
      return 'Bài Nghe hiểu chuẩn v1 cần ít nhất 1 câu hỏi có skillCode là "listening.gist".';
    }
    if (!hasDetailGroup) {
      return 'Bài Nghe hiểu chuẩn v1 cần ít nhất 1 câu hỏi thuộc nhóm chi tiết (listening.specific_information, listening.detail hoặc listening.numbers_dates_times).';
    }
  } else {
    const stepIds = new Set<string>();
    for (let i = 0; i < draft.steps.length; i++) {
      const step = draft.steps[i];
      const stepId = step.id.trim() || `step-${i + 1}`;
      if (stepIds.has(stepId)) {
        return `Mã bước học bị trùng: ${stepId}.`;
      }
      stepIds.add(stepId);
      if (!step.title.trim() || !step.body.trim()) {
        return `Bước học #${i + 1} cần có đủ tiêu đề và nội dung.`;
      }
    }
  }

  if (draft.questions.length < 3 || draft.questions.length > 10) {
    return 'Mỗi bài tập cần có từ 3 đến 10 câu hỏi.';
  }

  const passage = draft.passage?.trim() ?? '';
  if (draft.kind === 'READING' && !passage) {
    return 'Bài tập Đọc hiểu (READING) cần có đoạn văn đọc hiểu.';
  }

  const questionIds = new Set<string>();
  for (let i = 0; i < draft.questions.length; i++) {
    const q = draft.questions[i];
    const qId = q.id.trim() || `q-${i + 1}`;
    if (questionIds.has(qId)) {
      return `Mã câu hỏi bị trùng: ${qId}.`;
    }
    questionIds.add(qId);

    if (!q.prompt.trim()) {
      return `Câu hỏi #${i + 1} chưa có nội dung đề bài.`;
    }
    if (!q.explanation.trim()) {
      return `Câu hỏi #${i + 1} chưa có giải thích đáp án.`;
    }

    const qType = q.type ?? 'MULTIPLE_CHOICE';
    if (qType === 'GAP_FILL' && !/_{3,}|…/.test(q.prompt)) {
      return `Câu hỏi điền khuyết #${i + 1} phải chứa chỗ trống (___ hoặc …).`;
    }

    if (qType === 'TRUE_FALSE_NOT_GIVEN') {
      if (!['A', 'B', 'C'].includes(q.correctOptionId)) {
        return `Câu hỏi #${i + 1} (True/False/Not Given) cần chọn đáp án đúng là A, B hoặc C.`;
      }
    } else {
      if (q.options.length !== 4 || q.options.some((opt) => !opt.text.trim())) {
        return `Câu hỏi #${i + 1} cần đủ 4 phương án trả lời không rỗng.`;
      }
      if (
        new Set(q.options.map((opt) => opt.id.trim())).size !== q.options.length
      ) {
        return `Câu hỏi #${i + 1} có mã phương án bị trùng.`;
      }
      if (!q.options.some((opt) => opt.id === q.correctOptionId)) {
        return `Câu hỏi #${i + 1} chưa chọn đáp án đúng hợp lệ.`;
      }
      const optionImages = q.options.map((opt) => opt.imageUrl?.trim() || undefined);
      if (optionImages.some((url) => url !== undefined)) {
        if (
          optionImages.some((url) => !isSafeImageUrl(url)) ||
          new Set(optionImages).size !== q.options.length
        ) {
          return `Ảnh phương án ở câu #${i + 1} phải có đủ 4 URL ảnh hợp lệ và không trùng nhau.`;
        }
      }
    }

    if (draft.kind !== 'LISTENING') {
      const sc = q.skillCode?.trim();
      if (sc && !(READING_SKILL_CODES as readonly string[]).includes(sc)) {
        return `Mã kỹ năng "${sc}" ở câu #${i + 1} không nằm trong 17 mã kỹ năng Đọc hiểu chuẩn.`;
      }
      if (q.evidence?.trim() && !hasUniqueMatch(passage, q.evidence)) {
        return `Dẫn chứng (evidence) ở câu #${i + 1} phải xuất hiện duy nhất một lần trong đoạn văn.`;
      }
    }
  }

  return null;
}

export function parseLessonJsonDraft(rawJson: string): {
  content: LearningContentPayload | null;
  error: string | null;
} {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        content: null,
        error: 'JSON nội dung bài học phải là một đối tượng (Object).',
      };
    }

    const obj = parsed as Partial<LearningContentPayload>;
    if (!Array.isArray(obj.steps) || !Array.isArray(obj.questions)) {
      return {
        content: null,
        error: 'JSON bài học bắt buộc phải có mảng "steps" và mảng "questions".',
      };
    }

    if (obj.questions.length < 3 || obj.questions.length > 10) {
      return {
        content: null,
        error: 'Mảng "questions" trong JSON phải có từ 3 đến 10 câu hỏi.',
      };
    }

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    const hasStrings = (value: Record<string, unknown>, keys: string[]) =>
      keys.every((key) => typeof value[key] === 'string');
    const optionalStrings = (value: Record<string, unknown>, keys: string[]) =>
      keys.every(
        (key) => value[key] === undefined || typeof value[key] === 'string',
      );
    if (
      obj.steps.some(
        (step) =>
          !isRecord(step) ||
          !hasStrings(step, ['id', 'title', 'body']) ||
          !optionalStrings(step, [
            'word',
            'phonetic',
            'meaning',
            'example',
            'audioUrl',
          ]),
      ) ||
      obj.questions.some(
        (question) =>
          !isRecord(question) ||
          !hasStrings(question, [
            'id',
            'prompt',
            'correctOptionId',
            'explanation',
          ]) ||
          !optionalStrings(question, ['evidence', 'skillCode']) ||
          !Array.isArray(question.options) ||
          question.options.some(
            (option) =>
              !isRecord(option) ||
              !hasStrings(option, ['id', 'text']) ||
              !optionalStrings(option, ['imageUrl']),
          ),
      )
    ) {
      return {
        content: null,
        error: 'Các bước học, câu hỏi và phương án trong JSON không đúng cấu trúc.',
      };
    }

    return {
      content: parsed as LearningContentPayload,
      error: null,
    };
  } catch (error) {
    return {
      content: null,
      error:
        error instanceof Error
          ? `Lỗi cú pháp JSON: ${error.message}`
          : 'JSON không hợp lệ.',
    };
  }
}

export type PaginationToken = number | 'ellipsis';

export function computePaginationRange(
  currentPage: number,
  totalPages: number,
): PaginationToken[] {
  if (totalPages <= 1) {
    return totalPages === 1 ? [1] : [];
  }
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const result: PaginationToken[] = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) {
    result.push('ellipsis');
  }
  for (let p = left; p <= right; p++) {
    result.push(p);
  }
  if (right < totalPages - 1) {
    result.push('ellipsis');
  }
  result.push(totalPages);

  return result;
}

export interface FormattedAppVersion {
  shortText: string;
  pillText: string;
  fullText: string;
  isCommitSha: boolean;
}

export function formatAppVersion(raw?: string | null): FormattedAppVersion {
  const fullText = (raw ?? '').trim() || 'unknown';
  const isCommitSha = /^[0-9a-f]{12,40}$/i.test(fullText);
  if (isCommitSha) {
    const shortText = fullText.slice(0, 8);
    return {
      shortText,
      pillText: `#${shortText}`,
      fullText,
      isCommitSha: true,
    };
  }
  return {
    shortText: fullText,
    pillText: fullText.startsWith('v') ? fullText : `v${fullText}`,
    fullText,
    isCommitSha: false,
  };
}
