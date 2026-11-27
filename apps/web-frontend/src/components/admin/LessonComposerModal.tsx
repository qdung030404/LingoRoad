'use client';

import React, { useState } from 'react';
import { Eye, Upload, X } from 'lucide-react';
import { createAdminLesson, createLearningUnit, updateAdminLesson } from '@/lib/admin-api';
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
import {
  DEFAULT_JSON_TEMPLATE,
  DEFAULT_LISTENING_QUESTION_SKILLS,
  buildCloneLessonCode,
  createDefaultListeningSegments,
  createDefaultSteps,
  createEmptyQuestion,
  orderEvidenceSegmentIds,
  renderLessonQuestionsSection,
  renderNonListeningVocabAndSteps,
} from './LessonComposerFormSections';
import { renderLessonPreviewPane } from './LessonComposerPreview';
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
  const [contentBase, setContentBase] = useState<LearningContentPayload | undefined>(initialContent);

  const [mode, setMode] = useState<'form' | 'json' | 'preview'>('form');
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [code, setCode] = useState(
    editingLesson ? editingLesson.code : cloneFrom ? buildCloneLessonCode(cloneFrom.code) : '',
  );
  const [kind, setKind] = useState<LearningKind>(sourceLesson?.kind ?? 'GRAMMAR');
  const [title, setTitle] = useState(
    editingLesson ? editingLesson.title : cloneFrom ? `${cloneFrom.title} (Bản sao)` : '',
  );
  const [description, setDescription] = useState(sourceLesson?.description ?? '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(sourceLesson?.estimatedMinutes ?? 5);
  const [sortOrder, setSortOrder] = useState<string>(
    editingLesson?.sortOrder !== undefined ? String(editingLesson.sortOrder) : '',
  );
  const [unitId, setUnitId] = useState<string>(sourceLesson?.unit?.id ?? '');
  const [grammarTopicId, setGrammarTopicId] = useState<string>(sourceLesson?.grammarTopic?.id ?? '');
  const [published, setPublished] = useState<boolean>(
    editingLesson ? editingLesson.published : cloneFrom ? false : true,
  );

  const [passage, setPassage] = useState(initialContent?.passage ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(initialContent?.coverImageUrl ?? '');
  const [keyVocabulary, setKeyVocabulary] = useState<LearningKeyVocabInput[]>(
    initialContent?.keyVocabulary?.map((item) => ({ ...item })) ?? [],
  );
  const [audioUrl, setAudioUrl] = useState(initialContent?.audioUrl ?? '');
  const [audioDurationMs, setAudioDurationMs] = useState(initialContent?.audioDurationMs ?? 35000);
  const [preparation, setPreparation] = useState(
    initialContent?.preparation ? { ...initialContent.preparation } : { situation: '', objective: '' },
  );
  const [transcriptSegments, setTranscriptSegments] = useState<ListeningSegmentInput[]>(
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
          ...(q.evidenceSegmentIds ? { evidenceSegmentIds: [...q.evidenceSegmentIds] } : {}),
        }))
      : [createEmptyQuestion(0), createEmptyQuestion(1), createEmptyQuestion(2)],
  );
  const [rawJson, setRawJson] = useState<string>(
    initialContent ? JSON.stringify(initialContent, null, 2) : DEFAULT_JSON_TEMPLATE,
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
        transcriptSegments: kind === 'LISTENING' ? transcriptSegments : undefined,
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
    if (parsed.audioDurationMs !== undefined) setAudioDurationMs(parsed.audioDurationMs);
    if (parsed.preparation) setPreparation(parsed.preparation);
    if (parsed.transcriptSegments?.length) setTranscriptSegments(parsed.transcriptSegments);
  };

  const handleSegmentsChange = (nextSegments: ListeningSegmentInput[]): void => {
    setTranscriptSegments(nextSegments);
    setQuestions((prev) =>
      prev.map((q) =>
        q.evidenceSegmentIds?.length
          ? { ...q, evidenceSegmentIds: orderEvidenceSegmentIds(q.evidenceSegmentIds, nextSegments) }
          : q,
      ),
    );
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRawJson(await file.text());
    setMode('json');
    setErrorMessage(null);
  };

  const handleQuickCreateUnit = async (): Promise<void> => {
    if (creatingUnit) return;
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
      setErrorMessage(err instanceof Error ? err.message : 'Không thể tạo chương học mới.');
    } finally {
      setCreatingUnit(false);
    }
  };

  const handleKindChange = (nextKind: LearningKind): void => {
    setKind(nextKind);
    if (nextKind !== 'GRAMMAR') {
      setGrammarTopicId('');
    }
    if (nextKind === 'LISTENING') {
      setSteps([]);
      const nextSegments = transcriptSegments.length >= 2 ? transcriptSegments : createDefaultListeningSegments();
      if (transcriptSegments.length < 2) setTranscriptSegments(nextSegments);
      if (keyVocabulary.length < 3) {
        const padded = [...keyVocabulary];
        while (padded.length < 3) {
          padded.push({ id: `kv-${padded.length + 1}`, word: '', meaning: '', phonetic: '', example: '', translation: '', imageUrl: '' });
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
            q.skillCode && (LISTENING_SKILL_CODES as readonly string[]).includes(q.skillCode)
              ? q.skillCode
              : DEFAULT_LISTENING_QUESTION_SKILLS[idx % DEFAULT_LISTENING_QUESTION_SKILLS.length];
          const orderedEv = orderEvidenceSegmentIds(q.evidenceSegmentIds, nextSegments);
          const nextQuestion: LearningQuestionInput = {
            ...q,
            type: 'MULTIPLE_CHOICE',
            options: paddedOptions,
            correctOptionId: paddedOptions.some((opt) => opt.id === q.correctOptionId) ? q.correctOptionId : 'A',
            skillCode: validSkill,
            evidenceSegmentIds: orderedEv.length > 0 ? orderedEv : [defaultSegId],
          };
          delete nextQuestion.evidence;
          return nextQuestion;
        });
        while (normalized.length < 5) normalized.push(createEmptyQuestion(normalized.length, true, defaultSegId));
        return normalized;
      });
    } else {
      setQuestions((prev) =>
        prev.map((q) => {
          const nextQuestion: LearningQuestionInput = { ...q };
          delete nextQuestion.evidenceSegmentIds;
          if (nextKind !== 'READING') delete nextQuestion.evidence;
          if (!q.skillCode || !(READING_SKILL_CODES as readonly string[]).includes(q.skillCode)) {
            delete nextQuestion.skillCode;
          }
          return nextQuestion;
        }),
      );
    }
  };

  const handleQuestionTypeChange = (qIndex: number, nextType: LearningQuestionType): void => {
    if (kind === 'LISTENING') return;
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIndex) return q;
        if (nextType === 'TRUE_FALSE_NOT_GIVEN') {
          return {
            ...q,
            type: nextType,
            options: [{ id: 'A', text: 'True' }, { id: 'B', text: 'False' }, { id: 'C', text: 'Not Given' }],
            correctOptionId: ['A', 'B', 'C'].includes(q.correctOptionId) ? q.correctOptionId : 'A',
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
        return { ...q, type: nextType, options: paddedOptions };
      }),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting) return;
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
        transcriptSegments: kind === 'LISTENING' ? transcriptSegments : undefined,
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
      sortOrder.trim() !== '' && Number.isInteger(Number(sortOrder)) ? Number(sortOrder) : undefined;

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
        grammarTopicId: kind === 'GRAMMAR' ? (grammarTopicId || null) : null,
        content: contentPayload,
      };
      if (editingLesson) await updateAdminLesson(editingLesson.id, payload);
      else await createAdminLesson(payload);
      onSaved();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Lưu bài tập thất bại. Vui lòng kiểm tra lại dữ liệu.');
    } finally {
      setSubmitting(false);
    }
  };

  const previewPayload = mode === 'preview' ? buildCurrentDraftPayload() : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slateDark-900">
              {isEditing ? 'Chỉnh sửa bài tập' : isCloning ? 'Nhân bản bài tập' : 'Thêm bài tập lộ trình mới'}
            </h2>
            <p className="text-xs text-slateDark-700">
              Hỗ trợ soạn trực quan đầy đủ Ngữ pháp, Từ vựng, Đọc hiểu & Nghe hiểu v1.
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

        <form onSubmit={(event) => void handleSubmit(event)} className="flex-1 space-y-6 overflow-y-auto p-6">
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">Mã bài tập (slug) *</label>
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
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">Loại bài tập *</label>
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
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">Tiêu đề bài tập *</label>
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
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">Mô tả ngắn *</label>
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
                <label className="text-xs font-semibold text-slateDark-800">Thuộc chương học (Unit)</label>
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
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">Thời lượng *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={120}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">Thứ tự</label>
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
              <p className="text-xs font-bold text-brand-800">Tạo nhanh Chương học (Learning Unit)</p>
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
                  if (mode !== 'json') setRawJson(JSON.stringify(buildCurrentDraftPayload(), null, 2));
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
              <input type="file" accept=".json,application/json" onChange={(e) => void handleFileUpload(e)} className="hidden" />
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
            renderLessonPreviewPane({
              kind,
              title,
              description,
              estimatedMinutes,
              previewPayload,
              previewAnswers,
              onResetAnswers: () => setPreviewAnswers({}),
              onSelectAnswer: (qKey, optionId) =>
                setPreviewAnswers((prev) => ({ ...prev, [qKey]: optionId })),
            })
          ) : (
            <div className="space-y-6">
              <MediaUploadField
                kind="image"
                slug={code || 'lesson-cover'}
                label="Ảnh bìa bài học (coverImageUrl — tuỳ chọn)"
                value={coverImageUrl}
                onChange={(url) => setCoverImageUrl(url)}
                placeholder="/media/learning/v1/images/... hoặc https://..."
              />

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

              {kind !== 'LISTENING' &&
                renderNonListeningVocabAndSteps({
                  code,
                  kind,
                  keyVocabulary,
                  setKeyVocabulary,
                  steps,
                  setSteps,
                })}

              {renderLessonQuestionsSection({
                kind,
                questions,
                transcriptSegments,
                setQuestions,
                onQuestionTypeChange: handleQuestionTypeChange,
              })}
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
              {submitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : isCloning ? 'Tạo bản sao' : 'Tạo bài tập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
