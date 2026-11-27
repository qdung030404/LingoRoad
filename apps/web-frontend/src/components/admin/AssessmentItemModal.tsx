'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  assessmentChoiceDraft,
  buildAssessmentChoices,
  validateAssessmentItemDraft,
} from '@/lib/admin-validation';
import {
  createAdminAssessmentItem,
  updateAdminAssessmentItem,
} from '@/lib/admin-api';
import type {
  AdminAssessmentGroup,
  AdminAssessmentItem,
  AssessmentSkill,
  CefrDescriptorItem,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from '@/types/admin';
import { MediaUploadField } from './MediaUploadField';

interface AssessmentItemModalProps {
  descriptors: CefrDescriptorItem[];
  groups?: AdminAssessmentGroup[];
  editingItem?: AdminAssessmentItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function extractMatchingPairs(raw: unknown): Array<{ left: string; right: string }> {
  if (Array.isArray(raw)) {
    const pairs = raw
      .filter((entry): entry is { left?: unknown; right?: unknown } =>
        Boolean(entry && typeof entry === 'object'),
      )
      .map((entry) => ({
        left: String(entry.left ?? ''),
        right: String(entry.right ?? ''),
      }));
    if (pairs.length >= 2) return pairs;
  }
  return [
    { left: '', right: '' },
    { left: '', right: '' },
    { left: '', right: '' },
  ];
}

function extractReorderTokens(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((t) => (typeof t === 'string' ? t : String(t))).join(' | ');
  }
  return '';
}

export function AssessmentItemModal({
  descriptors,
  groups = [],
  editingItem = null,
  onClose,
  onSaved,
}: AssessmentItemModalProps): React.ReactElement {
  const isEditing = Boolean(editingItem);
  const initialSkill: AssessmentSkill = editingItem?.skill ?? 'READING';
  const initialLevel: CefrLevel = editingItem?.cefrLevel ?? 'B1';

  const [externalId, setExternalId] = useState(editingItem?.externalId ?? '');
  const [skill, setSkill] = useState<AssessmentSkill>(initialSkill);
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(initialLevel);
  const [usageScope, setUsageScope] = useState<ItemUsageScope>(
    editingItem?.usageScope ?? 'ALL',
  );
  const [type, setType] = useState<ItemType>(
    editingItem?.type ?? 'MULTIPLE_CHOICE',
  );
  const [groupId, setGroupId] = useState(editingItem?.groupId ?? '');
  const [itemOrder, setItemOrder] = useState(editingItem?.itemOrder ?? 1);

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
  const [irtA, setIrtA] = useState<number>(editingItem?.irtA ?? 1.0);
  const [irtB, setIrtB] = useState<number>(
    editingItem?.irtB ?? matchingDescriptors[0]?.defaultIrtB ?? 0,
  );
  const [irtC, setIrtC] = useState<number>(editingItem?.irtC ?? 0.25);
  const [passage, setPassage] = useState(editingItem?.passage ?? '');
  const [audioUrl, setAudioUrl] = useState(editingItem?.audioUrl ?? '');
  const [prompt, setPrompt] = useState(editingItem?.prompt ?? '');

  const initialChoices = assessmentChoiceDraft(
    editingItem?.options,
    editingItem?.correctOption,
  );

  const [options, setOptions] = useState<string[]>(initialChoices.options);
  const [correctIndex, setCorrectIndex] = useState<number>(
    initialChoices.correctIndex,
  );
  const [reorderTokensText, setReorderTokensText] = useState<string>(
    editingItem?.type === 'SENTENCE_REORDER'
      ? extractReorderTokens(editingItem.options)
      : '',
  );
  const [matchingPairs, setMatchingPairs] = useState<
    Array<{ left: string; right: string }>
  >(
    editingItem?.type === 'MATCHING'
      ? extractMatchingPairs(editingItem.options)
      : [
          { left: '', right: '' },
          { left: '', right: '' },
          { left: '', right: '' },
        ],
  );

  // Rubric fields for ESSAY / SPEAKING_PROMPT
  const existingRubric = (editingItem?.rubricCriteria ?? {}) as {
    targetGrammars?: string[];
    wordCount?: { min?: number; max?: number };
    timeLimitSeconds?: number;
    minSpeakingSeconds?: number;
    maxSpeakingSeconds?: number;
  };
  const [targetGrammarsText, setTargetGrammarsText] = useState(
    Array.isArray(existingRubric.targetGrammars)
      ? existingRubric.targetGrammars.join(', ')
      : '',
  );
  const [wordCountMin, setWordCountMin] = useState<string>(
    existingRubric.wordCount?.min !== undefined
      ? String(existingRubric.wordCount.min)
      : '',
  );
  const [wordCountMax, setWordCountMax] = useState<string>(
    existingRubric.wordCount?.max !== undefined
      ? String(existingRubric.wordCount.max)
      : '',
  );
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<string>(
    existingRubric.timeLimitSeconds !== undefined
      ? String(existingRubric.timeLimitSeconds)
      : '',
  );
  const [minSpeakingSeconds, setMinSpeakingSeconds] = useState<string>(
    existingRubric.minSpeakingSeconds !== undefined
      ? String(existingRubric.minSpeakingSeconds)
      : '',
  );
  const [maxSpeakingSeconds, setMaxSpeakingSeconds] = useState<string>(
    existingRubric.maxSpeakingSeconds !== undefined
      ? String(existingRubric.maxSpeakingSeconds)
      : '',
  );

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
  const usesRubric = type === 'ESSAY' || type === 'SPEAKING_PROMPT';

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);

    const validationError = validateAssessmentItemDraft({
      skill,
      type,
      usageScope,
      passage,
      audioUrl: skill === 'LISTENING' ? audioUrl : undefined,
      prompt,
      options,
      correctIndex,
      irtB,
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const cleanOptions = options.map((opt) => opt.trim());

    let structuredOptions: unknown;
    let structuredCorrectOption: string | undefined;

    if (usesChoiceOptions) {
      const built = buildAssessmentChoices(
        cleanOptions,
        correctIndex,
        editingItem?.options,
      );
      structuredOptions = built.options;
      structuredCorrectOption = built.correctOption;
    } else if (type === 'SENTENCE_REORDER') {
      const tokens = reorderTokensText
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tokens.length < 2) {
        setErrorMessage('SENTENCE_REORDER cần tối thiểu 2 mảnh câu cách nhau bởi dấu |.');
        return;
      }
      structuredOptions = tokens;
      structuredCorrectOption = tokens.join(' ');
    } else if (type === 'MATCHING') {
      const cleanPairs = matchingPairs.filter(
        (p) => p.left.trim() && p.right.trim(),
      );
      if (cleanPairs.length < 2) {
        setErrorMessage('MATCHING cần tối thiểu 2 cặp ghép đầy đủ trái – phải.');
        return;
      }
      structuredOptions = cleanPairs.map((p) => ({
        left: p.left.trim(),
        right: p.right.trim(),
      }));
      structuredCorrectOption = JSON.stringify(structuredOptions);
    }

    let rubricCriteria: Record<string, unknown> | undefined;
    if (usesRubric) {
      const grammars = targetGrammarsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const nextRubric: Record<string, unknown> = {};
      if (grammars.length > 0) nextRubric.targetGrammars = grammars;
      if (wordCountMin.trim() || wordCountMax.trim()) {
        nextRubric.wordCount = {
          ...(wordCountMin.trim() ? { min: Number(wordCountMin) } : {}),
          ...(wordCountMax.trim() ? { max: Number(wordCountMax) } : {}),
        };
      }
      if (timeLimitSeconds.trim()) {
        nextRubric.timeLimitSeconds = Number(timeLimitSeconds);
      }
      if (minSpeakingSeconds.trim()) {
        nextRubric.minSpeakingSeconds = Number(minSpeakingSeconds);
      }
      if (maxSpeakingSeconds.trim()) {
        nextRubric.maxSpeakingSeconds = Number(maxSpeakingSeconds);
      }
      if (Object.keys(nextRubric).length > 0) {
        rubricCriteria = nextRubric;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        ...(externalId.trim() ? { externalId: externalId.trim() } : {}),
        ...(groupId ? { groupId, itemOrder } : isEditing ? { groupId: null } : {}),
        skill,
        skillCode: skillCode.trim(),
        cefrLevel,
        type,
        usageScope,
        passage: passage.trim() || undefined,
        audioUrl: audioUrl.trim() || undefined,
        prompt: prompt.trim(),
        ...(structuredOptions !== undefined ? { options: structuredOptions } : {}),
        ...(structuredCorrectOption !== undefined
          ? { correctOption: structuredCorrectOption }
          : {}),
        ...(rubricCriteria !== undefined ? { rubricCriteria } : {}),
        explanation: explanation.trim() || undefined,
        irtA,
        irtB,
        irtC,
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
                Stable External ID (tuỳ chọn)
              </label>
              <input
                type="text"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="vd: placement-reading-b1-05"
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 font-mono text-xs text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Loại câu hỏi *
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
          </div>

          {/* Tham số IRT 3PL & Nhóm đề */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                IRT a (phân biệt)
              </label>
              <input
                type="number"
                step="0.1"
                min={0.1}
                max={5}
                value={irtA}
                onChange={(e) => setIrtA(Number(e.target.value))}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                IRT b (độ khó)
              </label>
              <input
                type="number"
                step="0.1"
                value={irtB}
                onChange={(e) => setIrtB(Number(e.target.value))}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                IRT c (đoán mò)
              </label>
              <input
                type="number"
                step="0.05"
                min={0}
                max={0.5}
                value={irtC}
                onChange={(e) => setIrtC(Number(e.target.value))}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
              />
            </div>
            {groups.length > 0 && (
              <>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                    Thuộc nhóm đề (Group)
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
                    >
                      <option value="">-- Độc lập --</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          [{g.skill} {g.cefrLevel} P{g.partNumber}]{' '}
                          {g.title ?? g.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                    {groupId && (
                      <input
                        type="number"
                        min={1}
                        value={itemOrder}
                        onChange={(e) => setItemOrder(Number(e.target.value))}
                        title="Thứ tự trong nhóm"
                        className="w-16 rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-2 py-2 text-xs"
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {skill === 'LISTENING' && (
            <MediaUploadField
              kind="audio"
              audioScope="placement"
              slug={externalId || 'placement-audio'}
              label={`Âm thanh nghe hiểu WAV ${usageScope === 'PLACEMENT' ? '*' : '(tuỳ chọn)'}`}
              value={audioUrl}
              onChange={(url) => setAudioUrl(url)}
              placeholder="/media/placement/..."
            />
          )}

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
                Các phương án trả lời (chọn nút tròn cho đáp án đúng
                {usageScope === 'PLACEMENT'
                  ? ' — bắt buộc đúng 4 phương án cho PLACEMENT'
                  : ''}
                ) *
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
                      const next = [...options];
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

          {type === 'SENTENCE_REORDER' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Các mảnh câu theo đúng thứ tự (ngăn cách bởi dấu |) *
              </label>
              <input
                type="text"
                value={reorderTokensText}
                onChange={(e) => setReorderTokensText(e.target.value)}
                placeholder="She | goes | to school | every morning"
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>
          )}

          {type === 'MATCHING' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slateDark-800">
                  Các cặp ghép nối (Trái – Phải) *
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setMatchingPairs((prev) => [...prev, { left: '', right: '' }])
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 px-2.5 py-1 text-xs font-semibold"
                >
                  <Plus className="h-3 w-3" />
                  Thêm cặp
                </button>
              </div>
              {matchingPairs.map((pair, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pair.left}
                    onChange={(e) =>
                      setMatchingPairs((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, left: e.target.value } : p,
                        ),
                      )
                    }
                    placeholder={`Vế trái #${idx + 1}`}
                    className="flex-1 rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                  />
                  <span className="text-xs text-slateDark-600">↔</span>
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) =>
                      setMatchingPairs((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, right: e.target.value } : p,
                        ),
                      )
                    }
                    placeholder={`Vế phải #${idx + 1}`}
                    className="flex-1 rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                  />
                  {matchingPairs.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setMatchingPairs((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {usesRubric && (
            <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-25/50 p-4">
              <p className="text-xs font-bold text-slateDark-900">
                Tiêu chí chấm điểm AI (rubricCriteria)
              </p>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                  Cấu trúc ngữ pháp mục tiêu (cách nhau dấu phẩy)
                </label>
                <input
                  type="text"
                  value={targetGrammarsText}
                  onChange={(e) => setTargetGrammarsText(e.target.value)}
                  placeholder="present perfect, passive voice, conditionals"
                  className="w-full rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {type === 'ESSAY' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Số từ tối thiểu
                      </label>
                      <input
                        type="number"
                        min={10}
                        value={wordCountMin}
                        onChange={(e) => setWordCountMin(e.target.value)}
                        placeholder="100"
                        className="w-full rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Số từ tối đa
                      </label>
                      <input
                        type="number"
                        min={20}
                        value={wordCountMax}
                        onChange={(e) => setWordCountMax(e.target.value)}
                        placeholder="250"
                        className="w-full rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Giới hạn giây
                      </label>
                      <input
                        type="number"
                        min={60}
                        value={timeLimitSeconds}
                        onChange={(e) => setTimeLimitSeconds(e.target.value)}
                        placeholder="1200"
                        className="w-full rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Nói tối thiểu (giây)
                      </label>
                      <input
                        type="number"
                        min={5}
                        value={minSpeakingSeconds}
                        onChange={(e) => setMinSpeakingSeconds(e.target.value)}
                        placeholder="20"
                        className="w-full rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Nói tối đa (giây)
                      </label>
                      <input
                        type="number"
                        min={10}
                        value={maxSpeakingSeconds}
                        onChange={(e) => setMaxSpeakingSeconds(e.target.value)}
                        placeholder="90"
                        className="w-full rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                  </>
                )}
              </div>
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
