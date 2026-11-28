'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  createAdminGrammarTopic,
  updateAdminGrammarTopic,
} from '@/lib/admin-api';
import {
  GRAMMAR_CODE_REGEX,
  GRAMMAR_FORMULA_FORMS,
  normalizeGrammarTopicPayload,
} from '@/lib/admin-validation';
import type {
  AdminGrammarTopic,
  CefrLevel,
  GrammarExampleItem,
  GrammarFormulaItem,
} from '@/types/admin';
import {
  renderGrammarExamplesSection,
  renderGrammarFormulasSection,
  renderGrammarUsageNotesSection,
  type UsageNoteFormRow,
} from './grammar-topic/GrammarTopicSections';

interface GrammarTopicModalProps {
  allTopics: AdminGrammarTopic[];
  editingTopic: AdminGrammarTopic | null;
  onClose: () => void;
  onSaved: () => void;
}

const LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function toInitialFormulas(
  topic: AdminGrammarTopic | null,
): GrammarFormulaItem[] {
  if (Array.isArray(topic?.formulas) && topic.formulas.length > 0) {
    return topic.formulas.map((f) => ({
      form:
        f && (GRAMMAR_FORMULA_FORMS as readonly string[]).includes(f.form)
          ? f.form
          : 'AFFIRMATIVE',
      labelVi: typeof f?.labelVi === 'string' ? f.labelVi : '',
      structure: typeof f?.structure === 'string' ? f.structure : '',
      noteVi: typeof f?.noteVi === 'string' ? f.noteVi : '',
    }));
  }
  return [
    { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: '', noteVi: '' },
  ];
}

function toInitialUsageNotes(
  topic: AdminGrammarTopic | null,
): UsageNoteFormRow[] {
  if (Array.isArray(topic?.usageNotes) && topic.usageNotes.length > 0) {
    return topic.usageNotes.map((u) => ({
      useCaseVi: typeof u?.useCaseVi === 'string' ? u.useCaseVi : '',
      signalWordsText: Array.isArray(u?.signalWords)
        ? u.signalWords
            .filter((word): word is string => typeof word === 'string')
            .join(', ')
        : '',
      commonMistakeVi:
        typeof u?.commonMistakeVi === 'string' ? u.commonMistakeVi : '',
    }));
  }
  return [{ useCaseVi: '', signalWordsText: '', commonMistakeVi: '' }];
}

function toInitialExamples(
  topic: AdminGrammarTopic | null,
): GrammarExampleItem[] {
  if (Array.isArray(topic?.examples) && topic.examples.length > 0) {
    return topic.examples.map((ex) => ({
      sentenceEn: typeof ex?.sentenceEn === 'string' ? ex.sentenceEn : '',
      translationVi:
        typeof ex?.translationVi === 'string' ? ex.translationVi : '',
      highlight: typeof ex?.highlight === 'string' ? ex.highlight : '',
    }));
  }
  return [{ sentenceEn: '', translationVi: '', highlight: '' }];
}

export function GrammarTopicModal({
  allTopics,
  editingTopic,
  onClose,
  onSaved,
}: GrammarTopicModalProps): React.ReactElement {
  const isEditing = Boolean(editingTopic);
  const groupTopics = allTopics.filter(
    (t) => !t.isLeaf && t.id !== editingTopic?.id,
  );

  const [code, setCode] = useState(editingTopic?.code ?? 'grammar.');
  const [isLeaf, setIsLeaf] = useState(editingTopic?.isLeaf ?? true);
  const [parentId, setParentId] = useState(editingTopic?.parentId ?? '');
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(
    editingTopic?.cefrLevel ?? 'A1',
  );
  const [titleEn, setTitleEn] = useState(editingTopic?.titleEn ?? '');
  const [titleVi, setTitleVi] = useState(editingTopic?.titleVi ?? '');
  const [summaryVi, setSummaryVi] = useState(editingTopic?.summaryVi ?? '');
  const [orderIndex, setOrderIndex] = useState(editingTopic?.orderIndex ?? 0);
  const [published, setPublished] = useState(editingTopic?.published ?? true);

  const [formulas, setFormulas] = useState<GrammarFormulaItem[]>(() =>
    toInitialFormulas(editingTopic),
  );
  const [usageNotes, setUsageNotes] = useState<UsageNoteFormRow[]>(() =>
    toInitialUsageNotes(editingTopic),
  );
  const [examples, setExamples] = useState<GrammarExampleItem[]>(() =>
    toInitialExamples(editingTopic),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    const cleanCode = code.trim().toLowerCase();
    if (!isEditing && !GRAMMAR_CODE_REGEX.test(cleanCode)) {
      setError(
        'Mã cấu trúc ngữ pháp phải khớp định dạng grammar hoặc grammar.<nhóm>.<tên> (chỉ gồm chữ thường a-z và dấu gạch dưới _).',
      );
      return;
    }

    const normalized = normalizeGrammarTopicPayload({
      isLeaf,
      formulas,
      usageNotes,
      examples,
    });
    if (normalized.error) {
      setError(normalized.error);
      return;
    }

    setSaving(true);
    try {
      if (editingTopic) {
        await updateAdminGrammarTopic(editingTopic.id, {
          parentId: parentId || null,
          cefrLevel,
          titleEn: titleEn.trim(),
          titleVi: titleVi.trim(),
          summaryVi: summaryVi.trim(),
          formulas: normalized.formulas,
          usageNotes: normalized.usageNotes,
          examples: normalized.examples,
          orderIndex,
          published,
        });
      } else {
        await createAdminGrammarTopic({
          code: cleanCode,
          parentId: parentId || null,
          cefrLevel,
          isLeaf,
          titleEn: titleEn.trim(),
          titleVi: titleVi.trim(),
          summaryVi: summaryVi.trim(),
          formulas: normalized.formulas,
          usageNotes: normalized.usageNotes,
          examples: normalized.examples,
          orderIndex,
          published,
        });
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể lưu chủ điểm ngữ pháp.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slateDark-900">
            {isEditing ? 'Sửa chủ điểm Ngữ pháp' : 'Tạo chủ điểm Ngữ pháp mới'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex-1 space-y-5 overflow-y-auto p-6"
        >
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Mã định danh (grammar.*) *
              </label>
              <input
                type="text"
                required
                disabled={isEditing}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="grammar.tenses.present_simple"
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 font-mono text-xs disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Loại nút
              </label>
              <select
                disabled={isEditing}
                value={isLeaf ? 'leaf' : 'group'}
                onChange={(e) => setIsLeaf(e.target.value === 'leaf')}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs disabled:opacity-60"
              >
                <option value="leaf">Cấu trúc lá (Leaf)</option>
                <option value="group">Nhóm chuyên đề (Group)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Bậc CEFR *
              </label>
              <select
                value={cefrLevel}
                onChange={(e) => setCefrLevel(e.target.value as CefrLevel)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Thuộc nhóm cha (Parent)
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
              >
                <option value="">-- Nhóm gốc (Root) --</option>
                {groupTopics.map((g) => (
                  <option key={g.id} value={g.id}>
                    [{g.cefrLevel}] {g.titleVi}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                  Thứ tự
                </label>
                <input
                  type="number"
                  min={0}
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                />
              </div>
              <label className="mb-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Tên tiếng Việt *
              </label>
              <input
                type="text"
                required
                value={titleVi}
                onChange={(e) => setTitleVi(e.target.value)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Tên tiếng Anh *
              </label>
              <input
                type="text"
                required
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Tóm tắt kiến thức (tiếng Việt)
            </label>
            <textarea
              rows={2}
              value={summaryVi}
              onChange={(e) => setSummaryVi(e.target.value)}
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-sm"
            />
          </div>

          {isLeaf && (
            <>
              {renderGrammarFormulasSection(formulas, setFormulas)}
              {renderGrammarUsageNotesSection(usageNotes, setUsageNotes)}
              {renderGrammarExamplesSection(examples, setExamples)}
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-slateDark-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slateDark-200 px-5 py-2 text-sm font-semibold text-slateDark-900"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary rounded-xl px-6 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving
                ? 'Đang lưu...'
                : isEditing
                  ? 'Lưu thay đổi'
                  : 'Tạo chủ điểm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
