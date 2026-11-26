'use client';

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  createAdminAssessmentItem,
  updateAdminAssessmentItem,
} from '@/lib/admin-api';
import type {
  AdminAssessmentItem,
  AssessmentSkill,
  CefrDescriptorItem,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from '@/types/admin';

interface AssessmentItemModalProps {
  descriptors: CefrDescriptorItem[];
  editingItem?: AdminAssessmentItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function normalizeOptionStrings(raw: unknown): [string, string, string, string] {
  const result: [string, string, string, string] = ['', '', '', ''];
  if (!Array.isArray(raw)) return result;
  for (let i = 0; i < Math.min(4, raw.length); i++) {
    const entry = raw[i];
    if (typeof entry === 'string') {
      result[i] = entry;
    } else if (entry && typeof entry === 'object') {
      const obj = entry as { text?: unknown; id?: unknown };
      result[i] = String(obj.text ?? obj.id ?? '');
    }
  }
  return result;
}

export function AssessmentItemModal({
  descriptors,
  editingItem = null,
  onClose,
  onSaved,
}: AssessmentItemModalProps): React.ReactElement {
  const isEditing = Boolean(editingItem);
  const initialSkill: AssessmentSkill = editingItem?.skill ?? 'READING';
  const initialLevel: CefrLevel = editingItem?.cefrLevel ?? 'B1';

  const [skill, setSkill] = useState<AssessmentSkill>(initialSkill);
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(initialLevel);
  const [usageScope, setUsageScope] = useState<ItemUsageScope>(
    editingItem?.usageScope ?? 'ALL',
  );
  const [type, setType] = useState<ItemType>(
    editingItem?.type ?? 'MULTIPLE_CHOICE',
  );

  const matchingDescriptors = useMemo(
    () =>
      descriptors.filter(
        (d) => d.skill === skill && d.cefrLevel === cefrLevel,
      ),
    [descriptors, skill, cefrLevel],
  );

  const [skillCode, setSkillCode] = useState<string>(
    editingItem?.skillCode ??
      matchingDescriptors[0]?.skillCode ??
      'reading.skimming',
  );
  const [irtB, setIrtB] = useState<number>(
    editingItem?.irtB ?? matchingDescriptors[0]?.defaultIrtB ?? 0,
  );
  const [passage, setPassage] = useState(editingItem?.passage ?? '');
  const [prompt, setPrompt] = useState(editingItem?.prompt ?? '');

  const initialOpts = normalizeOptionStrings(editingItem?.options);
  const initialCorrectIdx = Math.max(
    0,
    initialOpts.findIndex(
      (opt) => opt.trim() === (editingItem?.correctOption ?? '').trim(),
    ),
  );

  const [options, setOptions] =
    useState<[string, string, string, string]>(initialOpts);
  const [correctIndex, setCorrectIndex] = useState<number>(initialCorrectIdx);
  const [explanation, setExplanation] = useState(
    editingItem?.explanation ?? '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const syncDescriptorDefaults = (
    nextSkill: AssessmentSkill,
    nextLevel: CefrLevel,
  ): void => {
    const matched = descriptors.find(
      (d) => d.skill === nextSkill && d.cefrLevel === nextLevel,
    );
    if (matched) {
      setSkillCode(matched.skillCode);
      setIrtB(matched.defaultIrtB);
    }
  };

  const usesChoiceOptions =
    type === 'MULTIPLE_CHOICE' || type === 'CLOZE' || type === 'GAP_FILL';

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);

    if (!prompt.trim() || prompt.trim().length < 3) {
      setErrorMessage('Nội dung câu hỏi cần ít nhất 3 ký tự.');
      return;
    }

    const cleanOptions = options.map((opt) => opt.trim());
    if (usesChoiceOptions) {
      if (cleanOptions.some((opt) => !opt)) {
        setErrorMessage('Vui lòng nhập đầy đủ 4 phương án trả lời.');
        return;
      }
      if (new Set(cleanOptions).size !== 4) {
        setErrorMessage('4 phương án trả lời không được trùng nhau.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        skill,
        skillCode: skillCode.trim(),
        cefrLevel,
        type,
        usageScope,
        passage: passage.trim() || undefined,
        prompt: prompt.trim(),
        ...(usesChoiceOptions
          ? {
              options: cleanOptions,
              correctOption: cleanOptions[correctIndex],
            }
          : {}),
        explanation: explanation.trim() || undefined,
        irtA: editingItem?.irtA ?? 1.0,
        irtB,
        irtC: editingItem?.irtC ?? 0.25,
      };

      if (editingItem) {
        await updateAdminAssessmentItem(editingItem.id, payload);
      } else {
        await createAdminAssessmentItem(payload);
      }
      onSaved();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể lưu câu hỏi.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slateDark-900">
              {isEditing
                ? 'Chỉnh sửa câu hỏi Item Bank'
                : 'Tạo item mới trong Item Bank'}
            </h2>
            <p className="text-xs text-slateDark-700">
              Hệ thống tự động làm mới cache ma trận CEFR sau khi lưu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="rounded-lg p-2 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex-1 space-y-4 overflow-y-auto p-6"
        >
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Kỹ năng *
              </label>
              <select
                value={skill}
                onChange={(e) => {
                  const nextSkill = e.target.value as AssessmentSkill;
                  setSkill(nextSkill);
                  syncDescriptorDefaults(nextSkill, cefrLevel);
                }}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="READING">READING</option>
                <option value="LISTENING">LISTENING</option>
                <option value="WRITING">WRITING</option>
                <option value="SPEAKING">SPEAKING</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Bậc CEFR *
              </label>
              <select
                value={cefrLevel}
                onChange={(e) => {
                  const nextLevel = e.target.value as CefrLevel;
                  setCefrLevel(nextLevel);
                  syncDescriptorDefaults(skill, nextLevel);
                }}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Mã Can-Do Descriptor *
              </label>
              {matchingDescriptors.length > 0 &&
              matchingDescriptors.some((d) => d.skillCode === skillCode) ? (
                <select
                  value={skillCode}
                  onChange={(e) => {
                    const selectedCode = e.target.value;
                    setSkillCode(selectedCode);
                    const matched = matchingDescriptors.find(
                      (d) => d.skillCode === selectedCode,
                    );
                    if (matched) setIrtB(matched.defaultIrtB);
                  }}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  {matchingDescriptors.map((d) => (
                    <option
                      key={`${d.skillCode}-${d.cefrLevel}`}
                      value={d.skillCode}
                    >
                      {d.skillCode} — {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={skillCode}
                  onChange={(e) => setSkillCode(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Phạm vi sử dụng
                </label>
                <select
                  value={usageScope}
                  onChange={(e) =>
                    setUsageScope(e.target.value as ItemUsageScope)
                  }
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="ALL">ALL</option>
                  <option value="PLACEMENT">PLACEMENT</option>
                  <option value="PRACTICE">PRACTICE</option>
                  <option value="MOCK_EXAM">MOCK_EXAM</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Độ khó IRT (b)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={irtB}
                  onChange={(e) => setIrtB(Number(e.target.value))}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
              Loại câu hỏi
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ItemType)}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            >
              <option value="MULTIPLE_CHOICE">MULTIPLE_CHOICE</option>
              <option value="CLOZE">CLOZE</option>
              <option value="GAP_FILL">GAP_FILL</option>
              <option value="SENTENCE_REORDER">SENTENCE_REORDER</option>
              <option value="MATCHING">MATCHING</option>
              <option value="ESSAY">ESSAY (Viết tự luận)</option>
              <option value="SPEAKING_PROMPT">SPEAKING_PROMPT</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
              Đoạn văn đính kèm (tuỳ chọn)
            </label>
            <textarea
              rows={3}
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              placeholder="Nhập đoạn văn đọc hiểu nếu câu hỏi đi kèm ngữ cảnh..."
              className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
              Đề bài / Câu hỏi *
            </label>
            <textarea
              rows={2}
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Nhập nội dung câu hỏi..."
              className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            />
          </div>

          {usesChoiceOptions && (
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-slateDark-800">
                4 phương án trả lời (chọn nút tròn cho đáp án đúng) *
              </label>
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="assessment-correct-option"
                    checked={correctIndex === idx}
                    onChange={() => setCorrectIndex(idx)}
                    aria-label={`Chọn phương án ${idx + 1} làm đáp án đúng`}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <input
                    type="text"
                    required
                    value={opt}
                    onChange={(e) => {
                      const next = [...options] as [
                        string,
                        string,
                        string,
                        string,
                      ];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Phương án ${String.fromCharCode(65 + idx)}`}
                    className="flex-1 rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
              Giải thích đáp án (tiếng Việt)
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Giải thích lý do đáp án đúng..."
              className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            />
          </div>

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
                  : 'Thêm câu hỏi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
