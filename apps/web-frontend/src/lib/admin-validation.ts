import type {
  AssessmentSkill,
  ItemType,
  ItemUsageScope,
  LearningContentPayload,
  LearningKind,
  LearningQuestionInput,
  LearningStepInput,
} from '../types/admin';

export interface LessonDraftInput {
  code: string;
  kind: LearningKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  passage?: string;
  steps: LearningStepInput[];
  questions: LearningQuestionInput[];
}

export function buildLessonContentFromForm(
  draft: Pick<LessonDraftInput, 'kind' | 'passage' | 'steps' | 'questions'>,
  original?: LearningContentPayload,
): LearningContentPayload {
  const cleanSteps = draft.steps.map((step, index) => ({
    ...step,
    id: step.id.trim() || `step-${index + 1}`,
    title: step.title.trim(),
    body: step.body.trim(),
    ...(step.word?.trim() ? { word: step.word.trim() } : {}),
    ...(step.phonetic?.trim() ? { phonetic: step.phonetic.trim() } : {}),
    ...(step.meaning?.trim() ? { meaning: step.meaning.trim() } : {}),
    ...(step.example?.trim() ? { example: step.example.trim() } : {}),
  }));

  const cleanQuestions = draft.questions.map((question, qIndex) => {
    const qType = question.type ?? 'MULTIPLE_CHOICE';
    const options =
      qType === 'TRUE_FALSE_NOT_GIVEN'
        ? [
            { id: 'A', text: 'True' },
            { id: 'B', text: 'False' },
            { id: 'C', text: 'Not Given' },
          ]
        : question.options.map((opt, optIndex) => ({
            ...opt,
            id: opt.id.trim() || String.fromCharCode(65 + optIndex),
            text: opt.text.trim(),
          }));

    return {
      ...question,
      id: question.id.trim() || `q-${qIndex + 1}`,
      type: qType,
      prompt: question.prompt.trim(),
      options,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation.trim(),
      ...(question.evidence?.trim() ? { evidence: question.evidence.trim() } : {}),
      ...(question.skillCode?.trim()
        ? { skillCode: question.skillCode.trim() }
        : {}),
    };
  });

  const cleanPassage = draft.passage?.trim();
  return {
    ...original,
    steps: cleanSteps,
    questions: cleanQuestions,
    ...(draft.kind === 'READING' ? { passage: cleanPassage } : {}),
  };
}

export function assessmentChoiceDraft(raw: unknown, correctOption?: string | null): {
  options: string[]; correctIndex: number;
} {
  if (!Array.isArray(raw)) return { options: ['', '', '', ''], correctIndex: -1 };
  return {
    options: raw.map(entry => typeof entry === 'string' ? entry : String(entry?.text ?? entry?.id ?? '')),
    correctIndex: raw.findIndex(entry => typeof entry === 'string'
      ? entry.trim() === correctOption?.trim()
      : entry && (entry.id === correctOption || entry.text === correctOption)),
  };
}

export function buildAssessmentChoices(options: string[], correctIndex: number, original: unknown) {
  const saved = options.map((text, index) => {
    const previous = Array.isArray(original) ? original[index] : undefined;
    return previous && typeof previous === 'object' ? { ...previous, text: text.trim() } : text.trim();
  });
  const selected = saved[correctIndex];
  return { options: saved, correctOption: typeof selected === 'string' ? selected : selected?.id ?? selected?.text };
}

export interface AssessmentItemDraftInput {
  skill: AssessmentSkill;
  type: ItemType;
  usageScope: ItemUsageScope;
  passage: string;
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
  if (!Number.isInteger(draft.estimatedMinutes) || draft.estimatedMinutes < 1 || draft.estimatedMinutes > 120) {
    return 'Thời lượng dự kiến phải từ 1 đến 120 phút.';
  }

  for (let i = 0; i < draft.steps.length; i++) {
    const step = draft.steps[i];
    if (!step.title.trim() || !step.body.trim()) {
      return `Bước học #${i + 1} cần có đủ tiêu đề và nội dung.`;
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
      if (!q.options.some((opt) => opt.id === q.correctOptionId)) {
        return `Câu hỏi #${i + 1} chưa chọn đáp án đúng hợp lệ.`;
      }
    }

    if (q.evidence?.trim() && !hasUniqueMatch(passage, q.evidence)) {
      return `Dẫn chứng (evidence) ở câu #${i + 1} phải xuất hiện duy nhất một lần trong đoạn văn.`;
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
      keys.every(key => typeof value[key] === 'string');
    const optionalStrings = (value: Record<string, unknown>, keys: string[]) =>
      keys.every(key => value[key] === undefined || typeof value[key] === 'string');
    if (obj.steps.some(step => !isRecord(step) || !hasStrings(step, ['id', 'title', 'body'])
      || !optionalStrings(step, ['word', 'phonetic', 'meaning', 'example']))
      || obj.questions.some(question => !isRecord(question)
        || !hasStrings(question, ['id', 'prompt', 'correctOptionId', 'explanation'])
        || !optionalStrings(question, ['evidence', 'skillCode'])
        || !Array.isArray(question.options)
        || question.options.some(option => !isRecord(option) || !hasStrings(option, ['id', 'text'])))) {
      return { content: null, error: 'Các bước học, câu hỏi và phương án trong JSON không đúng cấu trúc.' };
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
