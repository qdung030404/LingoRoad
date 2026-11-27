'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import {
  createAdminLesson,
  createLearningUnit,
  updateAdminLesson,
} from '@/lib/admin-api';
import {
  buildLessonContentFromForm,
  parseLessonJsonDraft,
  validateLessonDraft,
} from '@/lib/admin-validation';
import type {
  AdminLessonItem,
  CefrLevel,
  LearningKind,
  LearningContentPayload,
  LearningQuestionInput,
  LearningQuestionType,
  LearningStepInput,
  LearningUnitItem,
} from '@/types/admin';

interface LessonComposerModalProps {
  units: LearningUnitItem[];
  editingLesson: AdminLessonItem | null;
  onClose: () => void;
  onSaved: () => void;
  onUnitCreated: (unit: LearningUnitItem) => void;
}

function createEmptyQuestion(index: number): LearningQuestionInput {
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
    evidence: '',
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
        explanation: 'Chủ ngữ ngôi thứ ba số ít "She" dùng động từ thêm "-es": goes.',
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
        explanation: 'Chủ ngữ số nhiều "They" phủ định với trợ động từ "do not".',
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
        explanation: 'Câu hỏi thì hiện tại đơn với chủ ngữ số ít dùng trợ động từ "Does".',
      },
    ],
  },
  null,
  2,
);

export function LessonComposerModal({
  units,
  editingLesson,
  onClose,
  onSaved,
  onUnitCreated,
}: LessonComposerModalProps): React.ReactElement {
  const isEditing = Boolean(editingLesson);
  const initialContent = editingLesson?.content;
  const [contentBase, setContentBase] = useState<LearningContentPayload | undefined>(initialContent);

  const [mode, setMode] = useState<'form' | 'json'>(
    editingLesson?.kind === 'LISTENING' ||
      initialContent?.listeningVersion === 1
      ? 'json'
      : 'form',
  );
  const [code, setCode] = useState(editingLesson?.code ?? '');
  const [kind, setKind] = useState<LearningKind>(
    editingLesson?.kind ?? 'GRAMMAR',
  );
  const [title, setTitle] = useState(editingLesson?.title ?? '');
  const [description, setDescription] = useState(
    editingLesson?.description ?? '',
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    editingLesson?.estimatedMinutes ?? 5,
  );
  const [unitId, setUnitId] = useState<string>(editingLesson?.unit?.id ?? '');
  const [published, setPublished] = useState<boolean>(
    editingLesson?.published ?? true,
  );
  const [passage, setPassage] = useState(initialContent?.passage ?? '');
  const [steps, setSteps] = useState<LearningStepInput[]>(
    initialContent?.steps
      ? initialContent.steps
      : createDefaultSteps(),
  );
  const [questions, setQuestions] = useState<LearningQuestionInput[]>(
    initialContent?.questions?.length
      ? initialContent.questions
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

  const handleQuestionTypeChange = (
    qIndex: number,
    nextType: LearningQuestionType,
  ): void => {
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

    let contentPayload;
    if (mode === 'json') {
      if (!/^[a-z0-9-]+$/.test(code.trim())) {
        setErrorMessage(
          'Mã bài học chỉ được chứa chữ thường (a-z), số (0-9) và dấu gạch ngang (-).',
        );
        return;
      }
      if (!title.trim() || !description.trim()) {
        setErrorMessage('Vui lòng nhập đầy đủ tiêu đề và mô tả bài tập.');
        return;
      }
      const parsed = parseLessonJsonDraft(rawJson);
      if (!parsed.content || parsed.error) {
        setErrorMessage(parsed.error || 'Nội dung JSON không hợp lệ.');
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
        passage,
        steps,
        questions,
      });
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }
      contentPayload = buildLessonContentFromForm({
        kind,
        passage,
        steps,
        questions,
      }, contentBase);
    }

    setSubmitting(true);
    try {
      const payload = {
        code: code.trim().toLowerCase(),
        kind,
        title: title.trim(),
        description: description.trim(),
        estimatedMinutes,
        published,
        unitId: unitId || null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slateDark-900">
              {isEditing ? 'Chỉnh sửa bài tập' : 'Thêm bài tập lộ trình mới'}
            </h2>
            <p className="text-xs text-slateDark-700">
              Cấu trúc nội dung được kiểm định tương thích trực tiếp với ứng dụng
              học viên.
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
                onChange={(e) => {
                  const nextKind = e.target.value as LearningKind;
                  setKind(nextKind);
                  if (nextKind === 'LISTENING') setMode('json');
                }}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="GRAMMAR">Ngữ pháp (GRAMMAR)</option>
                <option value="VOCABULARY">Từ vựng (VOCABULARY)</option>
                <option value="READING">Đọc hiểu (READING)</option>
                <option value="LISTENING">Nghe hiểu (LISTENING - JSON)</option>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Thời lượng (phút) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col justify-end pb-2">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slateDark-900">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span>Xuất bản ngay</span>
                </label>
              </div>
            </div>
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
                  {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map(
                    (lvl) => (
                      <option key={lvl} value={lvl}>
                        Bậc {lvl}
                      </option>
                    ),
                  )}
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
                disabled={kind === 'LISTENING'}
                onClick={() => {
                  if (mode === 'json') {
                    const parsed = parseLessonJsonDraft(rawJson);
                    if (!parsed.content || parsed.error) {
                      setErrorMessage(parsed.error);
                      return;
                    }
                    setContentBase(parsed.content);
                    setSteps(parsed.content.steps);
                    setQuestions(parsed.content.questions);
                    setPassage(parsed.content.passage ?? '');
                  }
                  setErrorMessage(null);
                  setMode('form');
                }}
                className={
                  mode === 'form'
                    ? 'rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slateDark-900 shadow-sm'
                    : 'rounded-lg px-3.5 py-1.5 text-xs font-medium text-slateDark-700 disabled:opacity-40'
                }
              >
                Biểu mẫu trực quan
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'form') {
                    setRawJson(
                      JSON.stringify(
                        buildLessonContentFromForm({
                          kind,
                          passage,
                          steps,
                          questions,
                        }, contentBase),
                        null,
                        2,
                      ),
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
          ) : (
            <div className="space-y-6">
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

              {/* Các bước lý thuyết */}
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
                  </div>
                ))}
              </div>

              {/* Câu hỏi luyện tập */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slateDark-900">
                    Ngân hàng câu hỏi ({questions.length}/10 — tối thiểu 3 câu)
                  </h3>
                  <button
                    type="button"
                    disabled={questions.length >= 10}
                    onClick={() =>
                      setQuestions((prev) => [
                        ...prev,
                        createEmptyQuestion(prev.length),
                      ])
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm câu hỏi</span>
                  </button>
                </div>

                {questions.map((question, qIdx) => {
                  const qType = question.type ?? 'MULTIPLE_CHOICE';
                  return (
                    <div
                      key={`question-row-${qIdx}`}
                      className="space-y-3 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slateDark-900">
                          Câu hỏi #{qIdx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={qType}
                            onChange={(e) =>
                              handleQuestionTypeChange(
                                qIdx,
                                e.target.value as LearningQuestionType,
                              )
                            }
                            className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-medium text-slateDark-800 focus:border-brand-500 focus:outline-none"
                          >
                            <option value="MULTIPLE_CHOICE">Trắc nghiệm 4 chọn 1</option>
                            <option value="GAP_FILL">Điền vào chỗ trống</option>
                            <option value="TRUE_FALSE_NOT_GIVEN">
                              True / False / Not Given
                            </option>
                          </select>
                          {questions.length > 3 && (
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
                            className="flex items-center gap-2"
                          >
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
                                          options: item.options.map((o, oIdx) =>
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
                              className="flex-1 rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none read-only:bg-slateDark-100"
                            />
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
                  : 'Tạo bài tập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
