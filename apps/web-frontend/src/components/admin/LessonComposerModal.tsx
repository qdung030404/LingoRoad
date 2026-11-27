'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  createAdminLesson,
  createLearningUnit,
  resolveAdminMediaUrl,
  updateAdminLesson,
} from '@/lib/admin-api';
import {
  LISTENING_SKILL_CODES,
  READING_SKILL_CODES,
  buildLessonContentFromForm,
  parseLessonJsonDraft,
  validateLessonDraft,
} from '@/lib/admin-validation';
import type {
  AdminGrammarTopic,
  AdminLessonItem,
  CefrLevel,
  LearningContentPayload,
  LearningKeyVocabInput,
  LearningKind,
  LearningQuestionInput,
  LearningQuestionType,
  LearningStepInput,
  LearningUnitItem,
  ListeningSegmentInput,
} from '@/types/admin';
import { ListeningLessonForm } from './ListeningLessonForm';
import { MediaUploadField } from './MediaUploadField';

interface LessonComposerModalProps {
  units: LearningUnitItem[];
  grammarTopics?: AdminGrammarTopic[];
  editingLesson?: AdminLessonItem | null;
  cloneFrom?: AdminLessonItem | null;
  onClose: () => void;
  onSaved: () => void;
  onUnitCreated: (unit: LearningUnitItem) => void;
}

const MAX_LESSON_CODE_LENGTH = 100;

function buildCloneLessonCode(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return '';
  const suffix = '-copy';
  return `${trimmed.slice(0, Math.max(1, MAX_LESSON_CODE_LENGTH - suffix.length))}${suffix}`;
}

const DEFAULT_LISTENING_QUESTION_SKILLS = [
  'listening.gist',
  'listening.detail',
  'listening.specific_information',
  'listening.speaker_attitude',
  'listening.implied_meaning',
] as const;

function orderEvidenceSegmentIds(
  ids: string[] | undefined,
  segments: ListeningSegmentInput[],
): string[] {
  if (!ids?.length) return [];
  const selected = new Set(ids.map((id) => id.trim()).filter(Boolean));
  return segments.map((seg) => seg.id).filter((id) => selected.has(id));
}

function createEmptyQuestion(
  index: number,
  isListening = false,
  defaultSegmentId = 'seg-1',
): LearningQuestionInput {
  return {
    id: `q-${index + 1}`,
    type: 'MULTIPLE_CHOICE',
    prompt: '',
    options: [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ],
    correctOptionId: 'A',
    explanation: '',
    ...(isListening
      ? {
          skillCode:
            DEFAULT_LISTENING_QUESTION_SKILLS[
              index % DEFAULT_LISTENING_QUESTION_SKILLS.length
            ],
          evidenceSegmentIds: [defaultSegmentId],
        }
      : { evidence: '' }),
  };
}

function createDefaultSteps(): LearningStepInput[] {
  return [
    {
      id: 'step-1',
      title: 'Kiến thức trọng tâm',
      body: '',
    },
  ];
}

function createDefaultListeningSegments(): ListeningSegmentInput[] {
  return [
    {
      id: 'seg-1',
      speaker: 'Speaker A',
      startMs: 0,
      endMs: 15000,
      text: '',
      translationVi: '',
      speakerAvatar: '',
    },
    {
      id: 'seg-2',
      speaker: 'Speaker B',
      startMs: 15000,
      endMs: 30000,
      text: '',
      translationVi: '',
      speakerAvatar: '',
    },
  ];
}

const DEFAULT_JSON_TEMPLATE = JSON.stringify(
  {
    steps: [
      {
        id: 'step-1',
        title: 'Giới thiệu ngữ pháp',
        body: 'Ôn tập cách sử dụng thì hiện tại đơn cho thói quen hằng ngày.',
      },
    ],
    questions: [
      {
        id: 'q-1',
        type: 'MULTIPLE_CHOICE',
        prompt: 'She ___ to school by bus every morning.',
        options: [
          { id: 'A', text: 'go' },
          { id: 'B', text: 'goes' },
          { id: 'C', text: 'going' },
          { id: 'D', text: 'went' },
        ],
        correctOptionId: 'B',
        explanation:
          'Chủ ngữ ngôi thứ ba số ít "She" dùng động từ thêm "-es": goes.',
      },
      {
        id: 'q-2',
        type: 'MULTIPLE_CHOICE',
        prompt: 'They ___ coffee after dinner.',
        options: [
          { id: 'A', text: 'do not drink' },
          { id: 'B', text: 'does not drink' },
          { id: 'C', text: 'not drinks' },
          { id: 'D', text: 'is not drink' },
        ],
        correctOptionId: 'A',
        explanation:
          'Chủ ngữ số nhiều "They" phủ định với trợ động từ "do not".',
      },
      {
        id: 'q-3',
        type: 'MULTIPLE_CHOICE',
        prompt: '___ your brother play football on Sundays?',
        options: [
          { id: 'A', text: 'Do' },
          { id: 'B', text: 'Are' },
          { id: 'C', text: 'Does' },
          { id: 'D', text: 'Is' },
        ],
        correctOptionId: 'C',
        explanation:
          'Câu hỏi thì hiện tại đơn với chủ ngữ số ít dùng trợ động từ "Does".',
      },
    ],
  },
  null,
  2,
);

export function LessonComposerModal({
  units,
  grammarTopics = [],
  editingLesson = null,
  cloneFrom = null,
  onClose,
  onSaved,
  onUnitCreated,
}: LessonComposerModalProps): React.ReactElement {
  const isEditing = Boolean(editingLesson);
  const isCloning = !editingLesson && Boolean(cloneFrom);
  const sourceLesson = editingLesson ?? cloneFrom ?? null;
  const initialContent = sourceLesson?.content;
  const [contentBase, setContentBase] = useState<
    LearningContentPayload | undefined
  >(initialContent);

  const [mode, setMode] = useState<'form' | 'json' | 'preview'>('form');
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>(
    {},
  );
  const [code, setCode] = useState(
    editingLesson
      ? editingLesson.code
      : cloneFrom
        ? buildCloneLessonCode(cloneFrom.code)
        : '',
  );
  const [kind, setKind] = useState<LearningKind>(
    sourceLesson?.kind ?? 'GRAMMAR',
  );
  const [title, setTitle] = useState(
    editingLesson
      ? editingLesson.title
      : cloneFrom
        ? `${cloneFrom.title} (Bản sao)`
        : '',
  );
  const [description, setDescription] = useState(
    sourceLesson?.description ?? '',
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    sourceLesson?.estimatedMinutes ?? 5,
  );
  const [sortOrder, setSortOrder] = useState<string>(
    editingLesson?.sortOrder !== undefined ? String(editingLesson.sortOrder) : '',
  );
  const [unitId, setUnitId] = useState<string>(sourceLesson?.unit?.id ?? '');
  const [grammarTopicId, setGrammarTopicId] = useState<string>(
    sourceLesson?.grammarTopic?.id ?? '',
  );
  const [published, setPublished] = useState<boolean>(
    editingLesson ? editingLesson.published : cloneFrom ? false : true,
  );

  const [passage, setPassage] = useState(initialContent?.passage ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(
    initialContent?.coverImageUrl ?? '',
  );
  const [keyVocabulary, setKeyVocabulary] = useState<LearningKeyVocabInput[]>(
    initialContent?.keyVocabulary?.map((item) => ({ ...item })) ?? [],
  );
  const [audioUrl, setAudioUrl] = useState(initialContent?.audioUrl ?? '');
  const [audioDurationMs, setAudioDurationMs] = useState(
    initialContent?.audioDurationMs ?? 35000,
  );
  const [preparation, setPreparation] = useState(
    initialContent?.preparation
      ? { ...initialContent.preparation }
      : { situation: '', objective: '' },
  );
  const [transcriptSegments, setTranscriptSegments] = useState<
    ListeningSegmentInput[]
  >(
    initialContent?.transcriptSegments?.length
      ? initialContent.transcriptSegments.map((seg) => ({ ...seg }))
      : createDefaultListeningSegments(),
  );
  const [steps, setSteps] = useState<LearningStepInput[]>(
    initialContent?.steps
      ? initialContent.steps.map((step) => ({ ...step }))
      : sourceLesson?.kind === 'LISTENING'
        ? []
        : createDefaultSteps(),
  );
  const [questions, setQuestions] = useState<LearningQuestionInput[]>(
    initialContent?.questions?.length
      ? initialContent.questions.map((q) => ({
          ...q,
          options: q.options.map((opt) => ({ ...opt })),
          ...(q.evidenceSegmentIds
            ? { evidenceSegmentIds: [...q.evidenceSegmentIds] }
            : {}),
        }))
      : [createEmptyQuestion(0), createEmptyQuestion(1), createEmptyQuestion(2)],
  );
  const [rawJson, setRawJson] = useState<string>(
    initialContent
      ? JSON.stringify(initialContent, null, 2)
      : DEFAULT_JSON_TEMPLATE,
  );

  const [showQuickUnit, setShowQuickUnit] = useState(false);
  const [unitCode, setUnitCode] = useState('');
  const [unitLevel, setUnitLevel] = useState<CefrLevel>('A1');
  const [unitOrder, setUnitOrder] = useState(1);
  const [unitTitle, setUnitTitle] = useState('');
  const [unitDescription, setUnitDescription] = useState('');
  const [creatingUnit, setCreatingUnit] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const leafGrammarTopics = grammarTopics.filter((g) => g.isLeaf);

  const buildCurrentDraftPayload = (): LearningContentPayload =>
    buildLessonContentFromForm(
      {
        kind,
        passage: kind === 'READING' ? passage : undefined,
        coverImageUrl,
        keyVocabulary,
        audioUrl: kind === 'LISTENING' ? audioUrl : undefined,
        audioDurationMs: kind === 'LISTENING' ? audioDurationMs : undefined,
        preparation: kind === 'LISTENING' ? preparation : undefined,
        transcriptSegments:
          kind === 'LISTENING' ? transcriptSegments : undefined,
        steps: kind === 'LISTENING' ? [] : steps,
        questions,
      },
      contentBase,
    );

  const syncFromParsedContent = (parsed: LearningContentPayload): void => {
    setContentBase(parsed);
    setSteps(parsed.steps);
    setQuestions(parsed.questions);
    setPassage(parsed.passage ?? '');
    setCoverImageUrl(parsed.coverImageUrl ?? '');
    setKeyVocabulary(parsed.keyVocabulary ?? []);
    if (parsed.audioUrl !== undefined) setAudioUrl(parsed.audioUrl);
    if (parsed.audioDurationMs !== undefined) {
      setAudioDurationMs(parsed.audioDurationMs);
    }
    if (parsed.preparation) setPreparation(parsed.preparation);
    if (parsed.transcriptSegments?.length) {
      setTranscriptSegments(parsed.transcriptSegments);
    }
  };

  const handleSegmentsChange = (nextSegments: ListeningSegmentInput[]): void => {
    setTranscriptSegments(nextSegments);
    setQuestions((prev) =>
      prev.map((q) => {
        if (!q.evidenceSegmentIds?.length) return q;
        return {
          ...q,
          evidenceSegmentIds: orderEvidenceSegmentIds(
            q.evidenceSegmentIds,
            nextSegments,
          ),
        };
      }),
    );
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawJson(text);
    setMode('json');
    setErrorMessage(null);
  };

  const handleQuickCreateUnit = async (): Promise<void> => {
    setErrorMessage(null);
    setCreatingUnit(true);
    try {
      const created = await createLearningUnit({
        code: unitCode.trim().toLowerCase(),
        cefrLevel: unitLevel,
        orderIndex: unitOrder,
        title: unitTitle.trim(),
        description: unitDescription.trim(),
      });
      onUnitCreated(created);
      setUnitId(created.id);
      setShowQuickUnit(false);
      setUnitCode('');
      setUnitTitle('');
      setUnitDescription('');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể tạo chương học mới.',
      );
    } finally {
      setCreatingUnit(false);
    }
  };

  const handleKindChange = (nextKind: LearningKind): void => {
    setKind(nextKind);
    if (nextKind === 'LISTENING') {
      setSteps([]);
      const nextSegments =
        transcriptSegments.length >= 2
          ? transcriptSegments
          : createDefaultListeningSegments();
      if (transcriptSegments.length < 2) {
        setTranscriptSegments(nextSegments);
      }
      if (keyVocabulary.length < 3) {
        const padded = [...keyVocabulary];
        while (padded.length < 3) {
          padded.push({
            id: `kv-${padded.length + 1}`,
            word: '',
            meaning: '',
            phonetic: '',
            example: '',
            translation: '',
            imageUrl: '',
          });
        }
        setKeyVocabulary(padded);
      }
      const defaultSegId = nextSegments[0]?.id ?? 'seg-1';
      setQuestions((prev) => {
        const normalized = prev.map((q, idx) => {
          const paddedOptions =
            q.options.length === 4
              ? q.options
              : [
                  { id: 'A', text: q.options[0]?.text ?? '' },
                  { id: 'B', text: q.options[1]?.text ?? '' },
                  { id: 'C', text: q.options[2]?.text ?? '' },
                  { id: 'D', text: q.options[3]?.text ?? '' },
                ];
          const validSkill =
            q.skillCode &&
            (LISTENING_SKILL_CODES as readonly string[]).includes(q.skillCode)
              ? q.skillCode
              : DEFAULT_LISTENING_QUESTION_SKILLS[
                  idx % DEFAULT_LISTENING_QUESTION_SKILLS.length
                ];
          const orderedEv = orderEvidenceSegmentIds(
            q.evidenceSegmentIds,
            nextSegments,
          );
          const nextQuestion: LearningQuestionInput = {
            ...q,
            type: 'MULTIPLE_CHOICE',
            options: paddedOptions,
            correctOptionId: paddedOptions.some(
              (opt) => opt.id === q.correctOptionId,
            )
              ? q.correctOptionId
              : 'A',
            skillCode: validSkill,
            evidenceSegmentIds: orderedEv.length > 0 ? orderedEv : [defaultSegId],
          };
          delete nextQuestion.evidence;
          return nextQuestion;
        });
        while (normalized.length < 5) {
          normalized.push(
            createEmptyQuestion(normalized.length, true, defaultSegId),
          );
        }
        return normalized;
      });
    } else {
      setQuestions((prev) =>
        prev.map((q) => {
          const nextQuestion: LearningQuestionInput = { ...q };
          delete nextQuestion.evidenceSegmentIds;
          if (nextKind !== 'READING') {
            delete nextQuestion.evidence;
          }
          if (
            !q.skillCode ||
            !(READING_SKILL_CODES as readonly string[]).includes(q.skillCode)
          ) {
            delete nextQuestion.skillCode;
          }
          return nextQuestion;
        }),
      );
    }
  };

  const handleQuestionTypeChange = (
    qIndex: number,
    nextType: LearningQuestionType,
  ): void => {
    if (kind === 'LISTENING') return;
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIndex) return q;
        if (nextType === 'TRUE_FALSE_NOT_GIVEN') {
          return {
            ...q,
            type: nextType,
            options: [
              { id: 'A', text: 'True' },
              { id: 'B', text: 'False' },
              { id: 'C', text: 'Not Given' },
            ],
            correctOptionId: ['A', 'B', 'C'].includes(q.correctOptionId)
              ? q.correctOptionId
              : 'A',
          };
        }
        const paddedOptions =
          q.options.length === 4
            ? q.options
            : [
                { id: 'A', text: q.options[0]?.text ?? '' },
                { id: 'B', text: q.options[1]?.text ?? '' },
                { id: 'C', text: q.options[2]?.text ?? '' },
                { id: 'D', text: '' },
              ];
        return {
          ...q,
          type: nextType,
          options: paddedOptions,
        };
      }),
    );
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);

    let contentPayload: LearningContentPayload;
    if (mode === 'json') {
      const parsed = parseLessonJsonDraft(rawJson);
      if (!parsed.content || parsed.error) {
        setErrorMessage(parsed.error || 'Nội dung JSON không hợp lệ.');
        return;
      }
      const jsonValidationError = validateLessonDraft({
        code,
        kind,
        title,
        description,
        estimatedMinutes,
        passage: parsed.content.passage,
        coverImageUrl: parsed.content.coverImageUrl,
        keyVocabulary: parsed.content.keyVocabulary,
        listeningVersion: parsed.content.listeningVersion,
        audioUrl: parsed.content.audioUrl,
        audioDurationMs: parsed.content.audioDurationMs,
        transcript: parsed.content.transcript,
        preparation: parsed.content.preparation,
        transcriptSegments: parsed.content.transcriptSegments,
        steps: parsed.content.steps,
        questions: parsed.content.questions,
      });
      if (jsonValidationError) {
        setErrorMessage(jsonValidationError);
        return;
      }
      contentPayload = parsed.content;
    } else {
      const validationError = validateLessonDraft({
        code,
        kind,
        title,
        description,
        estimatedMinutes,
        passage: kind === 'READING' ? passage : undefined,
        coverImageUrl,
        keyVocabulary,
        audioUrl: kind === 'LISTENING' ? audioUrl : undefined,
        audioDurationMs: kind === 'LISTENING' ? audioDurationMs : undefined,
        preparation: kind === 'LISTENING' ? preparation : undefined,
        transcriptSegments:
          kind === 'LISTENING' ? transcriptSegments : undefined,
        steps: kind === 'LISTENING' ? [] : steps,
        questions,
      });
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }
      contentPayload = buildCurrentDraftPayload();
    }

    const parsedSortOrder =
      sortOrder.trim() !== '' && Number.isInteger(Number(sortOrder))
        ? Number(sortOrder)
        : undefined;

    setSubmitting(true);
    try {
      const payload = {
        code: code.trim().toLowerCase(),
        kind,
        title: title.trim(),
        description: description.trim(),
        estimatedMinutes,
        ...(parsedSortOrder !== undefined ? { sortOrder: parsedSortOrder } : {}),
        published,
        unitId: unitId || null,
        ...(kind === 'GRAMMAR' || grammarTopicId
          ? { grammarTopicId: grammarTopicId || null }
          : {}),
        content: contentPayload,
      };
      if (editingLesson) {
        await updateAdminLesson(editingLesson.id, payload);
      } else {
        await createAdminLesson(payload);
      }
      onSaved();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Lưu bài tập thất bại. Vui lòng kiểm tra lại dữ liệu.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const previewPayload =
    mode === 'preview' ? buildCurrentDraftPayload() : null;
  const previewQuestions = previewPayload?.questions ?? [];
  const previewAnsweredCount = previewQuestions.reduce((count, q, idx) => {
    const qKey = `${idx}-${q.id}`;
    return previewAnswers[qKey] !== undefined ? count + 1 : count;
  }, 0);
  const previewCorrectCount = previewQuestions.reduce((count, q, idx) => {
    const qKey = `${idx}-${q.id}`;
    return previewAnswers[qKey] === q.correctOptionId ? count + 1 : count;
  }, 0);
  const previewRevealedSegmentIds = new Set<string>();
  previewQuestions.forEach((q, idx) => {
    const qKey = `${idx}-${q.id}`;
    if (previewAnswers[qKey] !== undefined && q.evidenceSegmentIds?.length) {
      q.evidenceSegmentIds.forEach((segId) =>
        previewRevealedSegmentIds.add(segId),
      );
    }
  });
  const previewSegmentsById = new Map<string, ListeningSegmentInput>(
    (previewPayload?.transcriptSegments ?? []).map((seg) => [seg.id, seg]),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slateDark-900">
              {isEditing
                ? 'Chỉnh sửa bài tập'
                : isCloning
                  ? 'Nhân bản bài tập'
                  : 'Thêm bài tập lộ trình mới'}
            </h2>
            <p className="text-xs text-slateDark-700">
              Hỗ trợ soạn trực quan đầy đủ Ngữ pháp, Từ vựng, Đọc hiểu & Nghe hiểu
              v1.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="rounded-lg p-2 text-slateDark-700 transition hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex-1 space-y-6 overflow-y-auto p-6"
        >
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Thông tin cơ bản */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Mã bài tập (slug) *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="vd: grammar-a1-present-simple-01"
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Loại bài tập *
              </label>
              <select
                value={kind}
                onChange={(e) => handleKindChange(e.target.value as LearningKind)}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="GRAMMAR">Ngữ pháp (GRAMMAR)</option>
                <option value="VOCABULARY">Từ vựng (VOCABULARY)</option>
                <option value="READING">Đọc hiểu (READING)</option>
                <option value="LISTENING">Nghe hiểu (LISTENING v1)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Tiêu đề bài tập *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Thì Hiện tại đơn trong giao tiếp hằng ngày"
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Mô tả ngắn *
              </label>
              <textarea
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả mục tiêu học tập của bài tập..."
                className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-slateDark-800">
                  Thuộc chương học (Unit)
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickUnit((prev) => !prev)}
                  className="text-xs font-semibold text-brand-700 hover:underline"
                >
                  {showQuickUnit ? 'Đóng tạo nhanh' : '+ Tạo chương mới'}
                </button>
              </div>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="">-- Chưa gắn chương học --</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    [{unit.cefrLevel}] Chương {unit.orderIndex}: {unit.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Thời lượng *
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Thứ tự
                </label>
                <input
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  placeholder="Tự động"
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col justify-end pb-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slateDark-900">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span>Xuất bản</span>
                </label>
              </div>
            </div>

            {kind === 'GRAMMAR' && leafGrammarTopics.length > 0 && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Liên kết Chủ điểm Ngữ pháp (Grammar DAG Leaf)
                </label>
                <select
                  value={grammarTopicId}
                  onChange={(e) => setGrammarTopicId(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">-- Không liên kết --</option>
                  {leafGrammarTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      [{topic.cefrLevel}] {topic.titleVi} ({topic.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {showQuickUnit && (
            <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-25 p-4">
              <p className="text-xs font-bold text-brand-800">
                Tạo nhanh Chương học (Learning Unit)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  placeholder="Mã chương (vd: a1-unit-5)"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <select
                  value={unitLevel}
                  onChange={(e) => setUnitLevel(e.target.value as CefrLevel)}
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                  {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Bậc {lvl}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={unitOrder}
                  onChange={(e) => setUnitOrder(Number(e.target.value))}
                  placeholder="Thứ tự"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={unitTitle}
                  onChange={(e) => setUnitTitle(e.target.value)}
                  placeholder="Tên chương học"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={unitDescription}
                  onChange={(e) => setUnitDescription(e.target.value)}
                  placeholder="Mô tả chương học"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={creatingUnit}
                  onClick={() => void handleQuickCreateUnit()}
                  className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {creatingUnit ? 'Đang tạo...' : 'Lưu chương mới'}
                </button>
              </div>
            </div>
          )}

          {/* Chuyển đổi chế độ soạn thảo */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slateDark-100 pt-4">
            <div className="inline-flex rounded-xl bg-slateDark-50 p-1">
              <button
                type="button"
                onClick={() => {
                  if (mode === 'json') {
                    const parsed = parseLessonJsonDraft(rawJson);
                    if (!parsed.content || parsed.error) {
                      setErrorMessage(parsed.error);
                      return;
                    }
                    syncFromParsedContent(parsed.content);
                  }
                  setErrorMessage(null);
                  setMode('form');
                }}
                className={
                  mode === 'form'
                    ? 'rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slateDark-900 shadow-sm'
                    : 'rounded-lg px-3.5 py-1.5 text-xs font-medium text-slateDark-700'
                }
              >
                Biểu mẫu trực quan
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mode !== 'json') {
                    setRawJson(
                      JSON.stringify(buildCurrentDraftPayload(), null, 2),
                    );
                  }
                  setMode('json');
                }}
                className={
                  mode === 'json'
                    ? 'rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slateDark-900 shadow-sm'
                    : 'rounded-lg px-3.5 py-1.5 text-xs font-medium text-slateDark-700'
                }
              >
                Soạn JSON nâng cao
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'json') {
                    const parsed = parseLessonJsonDraft(rawJson);
                    if (!parsed.content || parsed.error) {
                      setErrorMessage(parsed.error);
                      return;
                    }
                    syncFromParsedContent(parsed.content);
                  }
                  setErrorMessage(null);
                  setMode('preview');
                }}
                className={
                  mode === 'preview'
                    ? 'inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slateDark-900 shadow-sm'
                    : 'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium text-slateDark-700'
                }
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Xem trước</span>
              </button>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50">
              <Upload className="h-3.5 w-3.5" />
              <span>Nạp từ tệp .json</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleFileUpload(e)}
                className="hidden"
              />
            </label>
          </div>

          {mode === 'json' ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Nội dung JSON bài học (steps, questions, passage / listening v1)
              </label>
              <textarea
                rows={14}
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                spellCheck={false}
                className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 font-mono text-xs text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>
          ) : mode === 'preview' && previewPayload ? (
            <div className="space-y-4 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-bold text-brand-800">
                    {kind}
                  </span>
                  <h3 className="mt-1 text-base font-extrabold text-slateDark-900">
                    {title || '(Chưa có tiêu đề)'}
                  </h3>
                  <p className="text-xs text-slateDark-700">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slateDark-700 shadow-sm">
                    {estimatedMinutes} phút · {previewPayload.questions.length} câu hỏi
                  </span>
                  <span className="rounded-full border border-brand-200 bg-brand-25 px-2.5 py-1 text-xs font-semibold text-brand-800">
                    Đã thử: {previewAnsweredCount}/{previewPayload.questions.length}
                    {previewAnsweredCount > 0
                      ? ` · Đúng ${previewCorrectCount}/${previewAnsweredCount}`
                      : ''}
                  </span>
                  <button
                    type="button"
                    disabled={previewAnsweredCount === 0}
                    onClick={() => setPreviewAnswers({})}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Làm lại preview</span>
                  </button>
                </div>
              </div>

              {previewPayload.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveAdminMediaUrl(previewPayload.coverImageUrl)}
                  alt={title}
                  className="max-h-48 w-full rounded-xl object-cover"
                />
              )}

              {previewPayload.audioUrl && (
                <div className="space-y-1">
                  <audio
                    controls
                    src={resolveAdminMediaUrl(previewPayload.audioUrl)}
                    className="w-full"
                  />
                  {previewPayload.audioDurationMs !== undefined && (
                    <p className="text-[11px] text-slateDark-600">
                      Thời lượng: {(previewPayload.audioDurationMs / 1000).toFixed(1)}s (
                      {previewPayload.audioDurationMs}ms)
                    </p>
                  )}
                </div>
              )}

              {previewPayload.preparation && (
                <div className="rounded-xl border border-brand-100 bg-brand-25/50 p-3.5 text-xs">
                  <p className="font-bold uppercase tracking-wider text-brand-800">
                    Bối cảnh chuẩn bị (Preparation)
                  </p>
                  <p className="mt-1 text-slateDark-800">
                    <span className="font-semibold">Tình huống:</span>{' '}
                    {previewPayload.preparation.situation}
                  </p>
                  <p className="mt-0.5 text-slateDark-800">
                    <span className="font-semibold">Mục tiêu:</span>{' '}
                    {previewPayload.preparation.objective}
                  </p>
                </div>
              )}

              {previewPayload.keyVocabulary &&
                previewPayload.keyVocabulary.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                      Từ vựng trọng tâm ({previewPayload.keyVocabulary.length})
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {previewPayload.keyVocabulary.map((vocab, idx) => (
                        <div
                          key={vocab.id || idx}
                          className="flex gap-2.5 rounded-xl border border-slateDark-100 bg-white p-3"
                        >
                          {vocab.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={resolveAdminMediaUrl(vocab.imageUrl)}
                              alt={vocab.word}
                              className="h-12 w-12 shrink-0 rounded-lg border border-slateDark-200 object-cover"
                            />
                          )}
                          <div className="min-w-0 text-xs">
                            <p className="font-bold text-slateDark-900">
                              {vocab.word}{' '}
                              {vocab.phonetic && (
                                <span className="font-normal text-slateDark-600">
                                  {vocab.phonetic}
                                </span>
                              )}
                            </p>
                            <p className="text-slateDark-700">{vocab.meaning}</p>
                            {vocab.example && (
                              <p className="mt-0.5 text-[11px] italic text-slateDark-600">
                                {vocab.example}
                                {vocab.translation ? ` — ${vocab.translation}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {previewPayload.transcriptSegments &&
                previewPayload.transcriptSegments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                      Transcript Segments ({previewPayload.transcriptSegments.length})
                    </p>
                    <div className="space-y-2">
                      {previewPayload.transcriptSegments.map((seg, idx) => {
                        const isEvidenceRevealed = previewRevealedSegmentIds.has(
                          seg.id,
                        );
                        return (
                          <div
                            key={seg.id || idx}
                            className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs transition ${
                              isEvidenceRevealed
                                ? 'border-brand-300 bg-brand-25/70'
                                : 'border-slateDark-100 bg-white'
                            }`}
                          >
                            {seg.speakerAvatar && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={resolveAdminMediaUrl(seg.speakerAvatar)}
                                alt={seg.speaker}
                                className="h-9 w-9 shrink-0 rounded-full border border-slateDark-200 object-cover"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-800">
                                  {seg.id}
                                </span>
                                <span className="font-bold text-slateDark-900">
                                  {seg.speaker}
                                </span>
                                <span className="font-mono text-[11px] text-slateDark-600">
                                  {seg.startMs}–{seg.endMs} ms
                                </span>
                                {isEvidenceRevealed && (
                                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    Dẫn chứng liên kết
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-slateDark-900">{seg.text}</p>
                              <p className="mt-0.5 text-[11px] text-slateDark-600">
                                {seg.translationVi}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {previewPayload.passage && (
                <div className="whitespace-pre-wrap rounded-xl border border-slateDark-200 bg-white p-4 text-sm leading-relaxed text-slateDark-800">
                  {previewPayload.passage}
                </div>
              )}

              {previewPayload.steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                    Các bước hướng dẫn ({previewPayload.steps.length})
                  </p>
                  {previewPayload.steps.map((s, idx) => (
                    <div
                      key={idx}
                      className="space-y-1.5 rounded-xl border border-slateDark-100 bg-white p-3"
                    >
                      <p className="text-xs font-bold text-slateDark-900">
                        {idx + 1}. {s.title}
                      </p>
                      <p className="text-xs text-slateDark-700">{s.body}</p>
                      {(s.word || s.meaning) && (
                        <p className="text-[11px] text-slateDark-700">
                          <span className="font-semibold">{s.word}</span>{' '}
                          {s.phonetic ? `(${s.phonetic})` : ''}{' '}
                          {s.meaning ? `— ${s.meaning}` : ''}
                        </p>
                      )}
                      {s.audioUrl && (
                        <audio
                          controls
                          src={resolveAdminMediaUrl(s.audioUrl)}
                          className="h-8 w-full"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                    Câu hỏi luyện tập tương tác ({previewPayload.questions.length})
                  </p>
                  <p className="text-[11px] text-slateDark-600">
                    Bấm vào phương án để kiểm tra đúng/sai, giải thích & dẫn chứng
                  </p>
                </div>
                {previewPayload.questions.map((q, idx) => {
                  const qKey = `${idx}-${q.id}`;
                  const selectedOptionId = previewAnswers[qKey];
                  const hasAnswered = selectedOptionId !== undefined;
                  const isCorrectAnswer =
                    hasAnswered && selectedOptionId === q.correctOptionId;

                  return (
                    <div
                      key={qKey}
                      className="rounded-xl border border-slateDark-100 bg-white p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slateDark-900">
                          Câu {idx + 1}: {q.prompt || '(Chưa nhập câu hỏi)'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {q.skillCode && (
                            <span className="rounded bg-slateDark-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slateDark-700">
                              {q.skillCode}
                            </span>
                          )}
                          {hasAnswered && (
                            <span
                              className={
                                isCorrectAnswer
                                  ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700'
                                  : 'inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700'
                              }
                            >
                              {isCorrectAnswer ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              <span>{isCorrectAnswer ? 'Đúng' : 'Sai'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {q.options.map((opt) => {
                          const isSelected = selectedOptionId === opt.id;
                          const isCorrectOption = opt.id === q.correctOptionId;

                          let optionClass =
                            'border-slateDark-200 bg-slateDark-25 text-slateDark-800 hover:border-brand-400 hover:bg-brand-25/50';
                          if (hasAnswered) {
                            if (isCorrectOption) {
                              optionClass =
                                'border-emerald-400 bg-emerald-50 font-semibold text-emerald-900';
                            } else if (isSelected) {
                              optionClass =
                                'border-red-400 bg-red-50 font-semibold text-red-900';
                            } else {
                              optionClass =
                                'border-slateDark-100 bg-slateDark-25/60 text-slateDark-600';
                            }
                          }

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() =>
                                setPreviewAnswers((prev) => ({
                                  ...prev,
                                  [qKey]: opt.id,
                                }))
                              }
                              className={`space-y-1.5 rounded-lg border px-3 py-2 text-left text-xs transition ${optionClass}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span>
                                  <strong>{opt.id}.</strong>{' '}
                                  {opt.text || '(Trống)'}
                                </span>
                                {hasAnswered && isCorrectOption && (
                                  <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>
                                      {isSelected ? 'Bạn chọn' : 'Đáp án đúng'}
                                    </span>
                                  </span>
                                )}
                                {hasAnswered && isSelected && !isCorrectOption && (
                                  <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-red-700">
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span>Bạn chọn</span>
                                  </span>
                                )}
                              </div>
                              {opt.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={resolveAdminMediaUrl(opt.imageUrl)}
                                  alt={opt.text}
                                  className="h-20 w-full rounded-md border border-slateDark-200 object-cover"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {hasAnswered ? (
                        <div
                          className={`mt-3 space-y-1.5 rounded-xl border p-3 text-[11px] ${
                            isCorrectAnswer
                              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                              : 'border-red-200 bg-red-50/70 text-red-950'
                          }`}
                        >
                          <p className="font-bold">
                            {isCorrectAnswer
                              ? 'Chính xác! Bạn đã chọn đúng đáp án.'
                              : `Chưa chính xác. Đáp án đúng là phương án ${q.correctOptionId}.`}
                          </p>
                          <p className="text-slateDark-800">
                            <span className="font-semibold">Giải thích:</span>{' '}
                            {q.explanation || '(Chưa nhập giải thích)'}
                          </p>
                          {q.evidence && (
                            <p className="text-brand-800">
                              <span className="font-semibold">Dẫn chứng:</span>{' '}
                              &ldquo;{q.evidence}&rdquo;
                            </p>
                          )}
                          {q.evidenceSegmentIds &&
                            q.evidenceSegmentIds.length > 0 && (
                              <div className="space-y-1 pt-0.5">
                                <p className="font-mono font-semibold text-brand-800">
                                  Đoạn dẫn chứng:{' '}
                                  {q.evidenceSegmentIds.join(', ')}
                                </p>
                                {q.evidenceSegmentIds.map((segId) => {
                                  const seg = previewSegmentsById.get(segId);
                                  if (!seg) return null;
                                  return (
                                    <div
                                      key={segId}
                                      className="rounded-lg border border-brand-100 bg-white/80 px-2.5 py-1.5 text-[11px] text-slateDark-800"
                                    >
                                      <span className="font-mono font-bold text-brand-700">
                                        [{seg.id}]
                                      </span>{' '}
                                      <span className="font-semibold">
                                        {seg.speaker}:
                                      </span>{' '}
                                      {seg.text}
                                      {seg.translationVi && (
                                        <span className="block text-[10px] text-slateDark-600">
                                          {seg.translationVi}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                        </div>
                      ) : (
                        <p className="mt-2.5 text-[11px] text-slateDark-600">
                          Chọn một phương án để kiểm tra đáp án và mở giải thích /
                          dẫn chứng.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Ảnh bìa bài học */}
              <MediaUploadField
                kind="image"
                slug={code || 'lesson-cover'}
                label="Ảnh bìa bài học (coverImageUrl — tuỳ chọn)"
                value={coverImageUrl}
                onChange={(url) => setCoverImageUrl(url)}
                placeholder="/media/learning/v1/images/... hoặc https://..."
              />

              {/* Form chuyên biệt cho LISTENING v1 */}
              {kind === 'LISTENING' && (
                <ListeningLessonForm
                  lessonCode={code}
                  audioUrl={audioUrl}
                  audioDurationMs={audioDurationMs}
                  preparation={preparation}
                  keyVocabulary={keyVocabulary}
                  transcriptSegments={transcriptSegments}
                  onAudioChange={(url, durationMs) => {
                    setAudioUrl(url);
                    if (durationMs) setAudioDurationMs(durationMs);
                  }}
                  onDurationChange={setAudioDurationMs}
                  onPreparationChange={setPreparation}
                  onKeyVocabularyChange={setKeyVocabulary}
                  onSegmentsChange={handleSegmentsChange}
                />
              )}

              {kind === 'READING' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                    Đoạn văn đọc hiểu (Passage) *
                  </label>
                  <textarea
                    rows={5}
                    value={passage}
                    onChange={(e) => setPassage(e.target.value)}
                    placeholder="Nhập đoạn văn tiếng Anh cho bài đọc hiểu..."
                    className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Từ vựng trọng tâm cho READING / VOCABULARY / GRAMMAR */}
              {kind !== 'LISTENING' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slateDark-900">
                        Từ vựng trọng tâm ({keyVocabulary.length} — tuỳ chọn)
                      </h3>
                      <p className="text-xs text-slateDark-700">
                        Hỗ trợ hiển thị thẻ từ vựng đi kèm bài học (xoá hết để làm trống).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setKeyVocabulary((prev) => [
                          ...prev,
                          {
                            id: `kv-${prev.length + 1}`,
                            word: '',
                            meaning: '',
                            phonetic: '',
                            example: '',
                            translation: '',
                            imageUrl: '',
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Thêm từ vựng</span>
                    </button>
                  </div>

                  {keyVocabulary.map((vocab, vIdx) => (
                    <div
                      key={`non-listening-kv-${vIdx}`}
                      className="space-y-2.5 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slateDark-700">
                          Từ vựng #{vIdx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setKeyVocabulary((prev) =>
                              prev.filter((_, idx) => idx !== vIdx),
                            )
                          }
                          aria-label="Xoá từ vựng"
                          className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <input
                          type="text"
                          value={vocab.word}
                          onChange={(e) =>
                            setKeyVocabulary((prev) =>
                              prev.map((item, idx) =>
                                idx === vIdx
                                  ? { ...item, word: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Từ tiếng Anh *"
                          className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={vocab.phonetic ?? ''}
                          onChange={(e) =>
                            setKeyVocabulary((prev) =>
                              prev.map((item, idx) =>
                                idx === vIdx
                                  ? { ...item, phonetic: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Phiên âm (/.../)"
                          className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={vocab.meaning}
                          onChange={(e) =>
                            setKeyVocabulary((prev) =>
                              prev.map((item, idx) =>
                                idx === vIdx
                                  ? { ...item, meaning: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Nghĩa tiếng Việt *"
                          className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          value={vocab.example ?? ''}
                          onChange={(e) =>
                            setKeyVocabulary((prev) =>
                              prev.map((item, idx) =>
                                idx === vIdx
                                  ? { ...item, example: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Câu ví dụ tiếng Anh"
                          className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={vocab.translation ?? ''}
                          onChange={(e) =>
                            setKeyVocabulary((prev) =>
                              prev.map((item, idx) =>
                                idx === vIdx
                                  ? { ...item, translation: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Dịch ví dụ tiếng Việt"
                          className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs"
                        />
                      </div>
                      <MediaUploadField
                        kind="image"
                        slug={`${code || 'lesson'}-vocab-${vIdx + 1}`}
                        label="Ảnh minh họa từ vựng (tuỳ chọn)"
                        value={vocab.imageUrl ?? ''}
                        onChange={(url) =>
                          setKeyVocabulary((prev) =>
                            prev.map((item, idx) =>
                              idx === vIdx ? { ...item, imageUrl: url } : item,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Các bước lý thuyết (ẩn hoàn toàn trên LISTENING v1) */}
              {kind !== 'LISTENING' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slateDark-900">
                      Các bước hướng dẫn ({steps.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setSteps((prev) => [
                          ...prev,
                          {
                            id: `step-${prev.length + 1}`,
                            title: '',
                            body: '',
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Thêm bước</span>
                    </button>
                  </div>

                  {steps.map((step, sIdx) => (
                    <div
                      key={`step-row-${sIdx}`}
                      className="space-y-3 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slateDark-700">
                          Bước học #{sIdx + 1}
                        </span>
                        {steps.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setSteps((prev) =>
                                prev.filter((_, idx) => idx !== sIdx),
                              )
                            }
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Xoá bước
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) =>
                          setSteps((prev) =>
                            prev.map((item, idx) =>
                              idx === sIdx
                                ? { ...item, title: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Tiêu đề bước học"
                        className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3.5 py-2 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                      />
                      <textarea
                        rows={2}
                        value={step.body}
                        onChange={(e) =>
                          setSteps((prev) =>
                            prev.map((item, idx) =>
                              idx === sIdx
                                ? { ...item, body: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Nội dung giải thích kiến thức hoặc ví dụ minh hoạ..."
                        className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-white p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                      />
                      {kind === 'VOCABULARY' && (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <input
                            type="text"
                            value={step.word ?? ''}
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((item, idx) =>
                                  idx === sIdx
                                    ? { ...item, word: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder="Từ vựng (word)"
                            className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={step.phonetic ?? ''}
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((item, idx) =>
                                  idx === sIdx
                                    ? { ...item, phonetic: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder="Phiên âm IPA (phonetic)"
                            className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={step.meaning ?? ''}
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((item, idx) =>
                                  idx === sIdx
                                    ? { ...item, meaning: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder="Nghĩa tiếng Việt (meaning)"
                            className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={step.example ?? ''}
                            onChange={(e) =>
                              setSteps((prev) =>
                                prev.map((item, idx) =>
                                  idx === sIdx
                                    ? { ...item, example: e.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder="Câu ví dụ (example)"
                            className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs"
                          />
                          <div className="space-y-1.5 sm:col-span-2">
                            <input
                              type="text"
                              value={step.audioUrl ?? ''}
                              onChange={(e) =>
                                setSteps((prev) =>
                                  prev.map((item, idx) =>
                                    idx === sIdx
                                      ? { ...item, audioUrl: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="URL âm thanh phát âm từ vựng (audioUrl — tuỳ chọn, vd: https://...)"
                              className="w-full rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                            />
                            {step.audioUrl?.trim() && (
                              <audio
                                controls
                                src={resolveAdminMediaUrl(step.audioUrl)}
                                className="h-8 w-full"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Câu hỏi luyện tập */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slateDark-900">
                    Ngân hàng câu hỏi ({questions.length}/
                    {kind === 'LISTENING' ? '5 — chuẩn 5 câu' : '10 — tối thiểu 3 câu'})
                  </h3>
                  <button
                    type="button"
                    disabled={
                      kind === 'LISTENING'
                        ? questions.length >= 5
                        : questions.length >= 10
                    }
                    onClick={() =>
                      setQuestions((prev) => [
                        ...prev,
                        createEmptyQuestion(
                          prev.length,
                          kind === 'LISTENING',
                          transcriptSegments[0]?.id ?? 'seg-1',
                        ),
                      ])
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm câu hỏi</span>
                  </button>
                </div>

                {questions.map((question, qIdx) => {
                  const qType =
                    kind === 'LISTENING'
                      ? 'MULTIPLE_CHOICE'
                      : (question.type ?? 'MULTIPLE_CHOICE');
                  const minQuestions = kind === 'LISTENING' ? 5 : 3;
                  return (
                    <div
                      key={`question-row-${qIdx}`}
                      className="space-y-3 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slateDark-900">
                          Câu hỏi #{qIdx + 1}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {(kind === 'READING' || kind === 'LISTENING') && (
                            <select
                              value={question.skillCode ?? ''}
                              onChange={(e) =>
                                setQuestions((prev) =>
                                  prev.map((item, idx) =>
                                    idx === qIdx
                                      ? { ...item, skillCode: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-medium text-slateDark-800 focus:border-brand-500 focus:outline-none"
                            >
                              <option value="">-- skillCode --</option>
                              {(kind === 'LISTENING'
                                ? LISTENING_SKILL_CODES
                                : READING_SKILL_CODES
                              ).map((sc) => (
                                <option key={sc} value={sc}>
                                  {sc}
                                </option>
                              ))}
                            </select>
                          )}
                          <select
                            value={qType}
                            disabled={kind === 'LISTENING'}
                            onChange={(e) =>
                              handleQuestionTypeChange(
                                qIdx,
                                e.target.value as LearningQuestionType,
                              )
                            }
                            className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-medium text-slateDark-800 focus:border-brand-500 focus:outline-none disabled:opacity-60"
                          >
                            <option value="MULTIPLE_CHOICE">
                              Trắc nghiệm 4 chọn 1
                            </option>
                            <option value="GAP_FILL">Điền vào chỗ trống</option>
                            <option value="TRUE_FALSE_NOT_GIVEN">
                              True / False / Not Given
                            </option>
                          </select>
                          {questions.length > minQuestions && (
                            <button
                              type="button"
                              onClick={() =>
                                setQuestions((prev) =>
                                  prev.filter((_, idx) => idx !== qIdx),
                                )
                              }
                              aria-label="Xoá câu hỏi"
                              className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={question.prompt}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((item, idx) =>
                              idx === qIdx
                                ? { ...item, prompt: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder={
                          qType === 'GAP_FILL'
                            ? 'Nhập câu hỏi có chứa ___ (vd: She ___ to work every day.)'
                            : 'Nhập nội dung câu hỏi tiếng Anh...'
                        }
                        className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-white p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                      />

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {question.options.map((opt, optIdx) => (
                          <div
                            key={`${question.id}-${opt.id}`}
                            className="space-y-1.5 rounded-xl border border-slateDark-100 bg-white p-2"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${qIdx}`}
                                checked={question.correctOptionId === opt.id}
                                onChange={() =>
                                  setQuestions((prev) =>
                                    prev.map((item, idx) =>
                                      idx === qIdx
                                        ? { ...item, correctOptionId: opt.id }
                                        : item,
                                    ),
                                  )
                                }
                                aria-label={`Chọn ${opt.id} là đáp án đúng`}
                                className="h-4 w-4 accent-brand-600"
                              />
                              <span className="w-5 text-xs font-bold text-slateDark-700">
                                {opt.id}.
                              </span>
                              <input
                                type="text"
                                readOnly={qType === 'TRUE_FALSE_NOT_GIVEN'}
                                value={opt.text}
                                onChange={(e) =>
                                  setQuestions((prev) =>
                                    prev.map((item, idx) =>
                                      idx === qIdx
                                        ? {
                                            ...item,
                                            options: item.options.map(
                                              (o, oIdx) =>
                                                oIdx === optIdx
                                                  ? { ...o, text: e.target.value }
                                                  : o,
                                            ),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder={`Phương án ${opt.id}`}
                                className="flex-1 rounded-lg border border-slateDark-200 bg-slateDark-25 px-2.5 py-1.5 text-xs text-slateDark-900 read-only:bg-slateDark-100 focus:border-brand-500 focus:outline-none"
                              />
                            </div>
                            {qType !== 'TRUE_FALSE_NOT_GIVEN' && (
                              <input
                                type="text"
                                value={opt.imageUrl ?? ''}
                                onChange={(e) =>
                                  setQuestions((prev) =>
                                    prev.map((item, idx) =>
                                      idx === qIdx
                                        ? {
                                            ...item,
                                            options: item.options.map(
                                              (o, oIdx) =>
                                                oIdx === optIdx
                                                  ? {
                                                      ...o,
                                                      imageUrl: e.target.value,
                                                    }
                                                  : o,
                                            ),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="Ảnh phương án (tuỳ chọn, URL)"
                                className="w-full rounded-lg border border-slateDark-100 bg-white px-2.5 py-1 text-[11px] text-slateDark-700 focus:border-brand-500 focus:outline-none"
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      <textarea
                        rows={2}
                        value={question.explanation}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((item, idx) =>
                              idx === qIdx
                                ? { ...item, explanation: e.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Giải thích đáp án (tiếng Việt)..."
                        className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-white p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                      />

                      {kind === 'READING' && (
                        <input
                          type="text"
                          value={question.evidence ?? ''}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((item, idx) =>
                                idx === qIdx
                                  ? { ...item, evidence: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Câu dẫn chứng nguyên văn trong đoạn văn (tuỳ chọn)"
                          className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3.5 py-2 text-xs text-slateDark-900 focus:border-brand-500 focus:outline-none"
                        />
                      )}

                      {kind === 'LISTENING' && (
                        <div className="space-y-1.5 rounded-xl border border-slateDark-100 bg-white p-3">
                          <p className="text-[11px] font-semibold text-slateDark-800">
                            Chọn đoạn transcript dẫn chứng (evidenceSegmentIds) *
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {transcriptSegments.map((seg) => {
                              const checked = (
                                question.evidenceSegmentIds ?? []
                              ).includes(seg.id);
                              return (
                                <label
                                  key={seg.id}
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slateDark-200 bg-slateDark-25 px-2.5 py-1 text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      setQuestions((prev) =>
                                        prev.map((item, idx) => {
                                          if (idx !== qIdx) return item;
                                          const current =
                                            item.evidenceSegmentIds ?? [];
                                          const rawNext = e.target.checked
                                            ? [...current, seg.id]
                                            : current.filter(
                                                (id) => id !== seg.id,
                                              );
                                          return {
                                            ...item,
                                            evidenceSegmentIds:
                                              orderEvidenceSegmentIds(
                                                rawNext,
                                                transcriptSegments,
                                              ),
                                          };
                                        }),
                                      );
                                    }}
                                    className="h-3.5 w-3.5 accent-brand-600"
                                  />
                                  <span className="font-mono font-semibold">
                                    {seg.id}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slateDark-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slateDark-200 bg-white px-5 py-2.5 text-sm font-semibold text-slateDark-900 hover:bg-slateDark-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {submitting
                ? 'Đang lưu...'
                : isEditing
                  ? 'Lưu thay đổi'
                  : isCloning
                    ? 'Tạo bản sao'
                    : 'Tạo bài tập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
