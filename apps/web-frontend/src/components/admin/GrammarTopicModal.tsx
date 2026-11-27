'use client';

import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  createAdminGrammarTopic,
  updateAdminGrammarTopic,
} from '@/lib/admin-api';
import type {
  AdminGrammarTopic,
  CefrLevel,
  GrammarExampleItem,
  GrammarFormulaItem,
  GrammarUsageItem,
} from '@/types/admin';

interface GrammarTopicModalProps {
  allTopics: AdminGrammarTopic[];
  editingTopic: AdminGrammarTopic | null;
  onClose: () => void;
  onSaved: () => void;
}

const LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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

  const [formulas, setFormulas] = useState<GrammarFormulaItem[]>(
    Array.isArray(editingTopic?.formulas) && editingTopic.formulas.length > 0
      ? editingTopic.formulas
      : [{ label: 'Khẳng định', structure: '', example: '' }],
  );
  const [usageNotes, setUsageNotes] = useState<GrammarUsageItem[]>(
    Array.isArray(editingTopic?.usageNotes) && editingTopic.usageNotes.length > 0
      ? editingTopic.usageNotes
      : [{ title: 'Cách dùng chính', description: '', signalWords: [] }],
  );
  const [examples, setExamples] = useState<GrammarExampleItem[]>(
    Array.isArray(editingTopic?.examples) && editingTopic.examples.length > 0
      ? editingTopic.examples
      : [{ en: '', vi: '', highlight: '' }],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    const cleanCode = code.trim().toLowerCase();
    if (!isEditing && !/^grammar\.[a-z0-9._-]+$/.test(cleanCode)) {
      setError('Mã chủ điểm phải bắt đầu bằng "grammar." và chỉ gồm chữ thường/số/._-.');
      return;
    }

    const cleanFormulas = isLeaf
      ? formulas
          .filter((f) => f.label.trim() && f.structure.trim())
          .map((f) => ({
            label: f.label.trim(),
            structure: f.structure.trim(),
            ...(f.example?.trim() ? { example: f.example.trim() } : {}),
          }))
      : [];

    const cleanUsage = isLeaf
      ? usageNotes
          .filter((u) => u.title.trim() && u.description.trim())
          .map((u) => ({
            title: u.title.trim(),
            description: u.description.trim(),
            ...(u.signalWords?.length
              ? { signalWords: u.signalWords.map((s) => s.trim()).filter(Boolean) }
              : {}),
          }))
      : [];

    const cleanExamples = isLeaf
      ? examples
          .filter((ex) => ex.en.trim() && ex.vi.trim())
          .map((ex) => ({
            en: ex.en.trim(),
            vi: ex.vi.trim(),
            ...(ex.highlight?.trim() ? { highlight: ex.highlight.trim() } : {}),
          }))
      : [];

    setSaving(true);
    try {
      if (editingTopic) {
        await updateAdminGrammarTopic(editingTopic.id, {
          parentId: parentId || null,
          cefrLevel,
          titleEn: titleEn.trim(),
          titleVi: titleVi.trim(),
          summaryVi: summaryVi.trim(),
          formulas: cleanFormulas,
          usageNotes: cleanUsage,
          examples: cleanExamples,
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
          formulas: cleanFormulas,
          usageNotes: cleanUsage,
          examples: cleanExamples,
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
              {/* Công thức */}
              <div className="space-y-2.5 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-slateDark-800">
                    Công thức cấu trúc (Formulas)
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setFormulas((prev) => [
                        ...prev,
                        { label: '', structure: '', example: '' },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-semibold"
                  >
                    <Plus className="h-3 w-3" /> Thêm
                  </button>
                </div>
                {formulas.map((f, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                    <input
                      type="text"
                      value={f.label}
                      onChange={(e) =>
                        setFormulas((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, label: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Nhãn (VD: Khẳng định)"
                      className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-3"
                    />
                    <input
                      type="text"
                      value={f.structure}
                      onChange={(e) =>
                        setFormulas((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, structure: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Công thức (S + V(s/es) + O)"
                      className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 font-mono text-xs sm:col-span-4"
                    />
                    <input
                      type="text"
                      value={f.example ?? ''}
                      onChange={(e) =>
                        setFormulas((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, example: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Ví dụ minh họa"
                      className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-4"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormulas((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 sm:col-span-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Cách dùng */}
              <div className="space-y-2.5 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-slateDark-800">
                    Cách dùng & Dấu hiệu nhận biết (Usage Notes)
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setUsageNotes((prev) => [
                        ...prev,
                        { title: '', description: '', signalWords: [] },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-semibold"
                  >
                    <Plus className="h-3 w-3" /> Thêm
                  </button>
                </div>
                {usageNotes.map((u, idx) => (
                  <div key={idx} className="space-y-2 rounded-xl bg-white p-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={u.title}
                        onChange={(e) =>
                          setUsageNotes((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, title: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Tiêu đề cách dùng"
                        className="flex-1 rounded-lg border border-slateDark-200 px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setUsageNotes((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={u.description}
                      onChange={(e) =>
                        setUsageNotes((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, description: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Giải thích chi tiết cách dùng"
                      className="w-full rounded-lg border border-slateDark-200 px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={(u.signalWords ?? []).join(', ')}
                      onChange={(e) =>
                        setUsageNotes((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? {
                                  ...item,
                                  signalWords: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }
                              : item,
                          ),
                        )
                      }
                      placeholder="Từ dấu hiệu (cách nhau dấu phẩy: always, usually, every day)"
                      className="w-full rounded-lg border border-slateDark-200 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Ví dụ */}
              <div className="space-y-2.5 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-slateDark-800">
                    Ví dụ song ngữ (Examples)
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setExamples((prev) => [
                        ...prev,
                        { en: '', vi: '', highlight: '' },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-semibold"
                  >
                    <Plus className="h-3 w-3" /> Thêm
                  </button>
                </div>
                {examples.map((ex, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                    <input
                      type="text"
                      value={ex.en}
                      onChange={(e) =>
                        setExamples((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, en: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Câu tiếng Anh"
                      className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-5"
                    />
                    <input
                      type="text"
                      value={ex.vi}
                      onChange={(e) =>
                        setExamples((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, vi: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Dịch tiếng Việt"
                      className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-4"
                    />
                    <input
                      type="text"
                      value={ex.highlight ?? ''}
                      onChange={(e) =>
                        setExamples((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, highlight: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Highlight"
                      className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setExamples((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 sm:col-span-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
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
              {saving ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo chủ điểm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
