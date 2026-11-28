import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { GRAMMAR_FORMULA_FORMS } from '@/lib/admin-validation';
import type {
  GrammarExampleItem,
  GrammarFormulaForm,
  GrammarFormulaItem,
} from '@/types/admin';

export interface UsageNoteFormRow {
  useCaseVi: string;
  signalWordsText: string;
  commonMistakeVi: string;
}

const FORMULA_FORM_LABELS: Record<GrammarFormulaForm, string> = {
  AFFIRMATIVE: 'Khẳng định (AFFIRMATIVE)',
  NEGATIVE: 'Phủ định (NEGATIVE)',
  QUESTION: 'Nghi vấn (QUESTION)',
  NOTE: 'Lưu ý (NOTE)',
};

export function renderGrammarFormulasSection(
  formulas: GrammarFormulaItem[],
  setFormulas: React.Dispatch<React.SetStateAction<GrammarFormulaItem[]>>,
): React.ReactElement {
  return (
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
              {
                form: 'AFFIRMATIVE',
                labelVi: '',
                structure: '',
                noteVi: '',
              },
            ])
          }
          className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-semibold"
        >
          <Plus className="h-3 w-3" /> Thêm
        </button>
      </div>
      {formulas.map((f, idx) => (
        <div
          key={idx}
          className="space-y-2 rounded-xl border border-slateDark-100 bg-white p-3"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
            <select
              value={f.form}
              onChange={(e) =>
                setFormulas((prev) =>
                  prev.map((item, i) =>
                    i === idx
                      ? {
                          ...item,
                          form: e.target.value as GrammarFormulaForm,
                        }
                      : item,
                  ),
                )
              }
              className="rounded-lg border border-slateDark-200 bg-slateDark-25 px-2.5 py-1.5 text-xs sm:col-span-4"
            >
              {GRAMMAR_FORMULA_FORMS.map((formOpt) => (
                <option key={formOpt} value={formOpt}>
                  {FORMULA_FORM_LABELS[formOpt]}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={f.labelVi}
              onChange={(e) =>
                setFormulas((prev) =>
                  prev.map((item, i) =>
                    i === idx ? { ...item, labelVi: e.target.value } : item,
                  ),
                )
              }
              placeholder="Nhãn tiếng Việt * (VD: Câu khẳng định)"
              className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-7"
            />
            <button
              type="button"
              onClick={() =>
                setFormulas((prev) => prev.filter((_, i) => i !== idx))
              }
              aria-label="Xoá công thức"
              className="flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 sm:col-span-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={f.structure}
              onChange={(e) =>
                setFormulas((prev) =>
                  prev.map((item, i) =>
                    i === idx ? { ...item, structure: e.target.value } : item,
                  ),
                )
              }
              placeholder="Công thức * (VD: S + V(s/es) + O)"
              className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 font-mono text-xs"
            />
            <input
              type="text"
              value={f.noteVi ?? ''}
              onChange={(e) =>
                setFormulas((prev) =>
                  prev.map((item, i) =>
                    i === idx ? { ...item, noteVi: e.target.value } : item,
                  ),
                )
              }
              placeholder="Ghi chú tiếng Việt (tuỳ chọn)"
              className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function renderGrammarUsageNotesSection(
  usageNotes: UsageNoteFormRow[],
  setUsageNotes: React.Dispatch<React.SetStateAction<UsageNoteFormRow[]>>,
): React.ReactElement {
  return (
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
              {
                useCaseVi: '',
                signalWordsText: '',
                commonMistakeVi: '',
              },
            ])
          }
          className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-semibold"
        >
          <Plus className="h-3 w-3" /> Thêm
        </button>
      </div>
      {usageNotes.map((u, idx) => (
        <div
          key={idx}
          className="space-y-2 rounded-xl border border-slateDark-100 bg-white p-3"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={u.useCaseVi}
              onChange={(e) =>
                setUsageNotes((prev) =>
                  prev.map((item, i) =>
                    i === idx ? { ...item, useCaseVi: e.target.value } : item,
                  ),
                )
              }
              placeholder="Tình huống sử dụng tiếng Việt * (useCaseVi)"
              className="flex-1 rounded-lg border border-slateDark-200 px-2.5 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() =>
                setUsageNotes((prev) => prev.filter((_, i) => i !== idx))
              }
              aria-label="Xoá cách dùng"
              className="rounded-lg p-1 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="text"
            value={u.signalWordsText}
            onChange={(e) =>
              setUsageNotes((prev) =>
                prev.map((item, i) =>
                  i === idx
                    ? { ...item, signalWordsText: e.target.value }
                    : item,
                ),
              )
            }
            placeholder="Từ dấu hiệu (cách nhau dấu phẩy: always, usually, every day)"
            className="w-full rounded-lg border border-slateDark-200 px-2.5 py-1.5 text-xs"
          />
          <input
            type="text"
            value={u.commonMistakeVi}
            onChange={(e) =>
              setUsageNotes((prev) =>
                prev.map((item, i) =>
                  i === idx
                    ? { ...item, commonMistakeVi: e.target.value }
                    : item,
                ),
              )
            }
            placeholder="Lỗi thường gặp cần tránh (commonMistakeVi — tuỳ chọn)"
            className="w-full rounded-lg border border-slateDark-200 px-2.5 py-1.5 text-xs"
          />
        </div>
      ))}
    </div>
  );
}

export function renderGrammarExamplesSection(
  examples: GrammarExampleItem[],
  setExamples: React.Dispatch<React.SetStateAction<GrammarExampleItem[]>>,
): React.ReactElement {
  return (
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
              { sentenceEn: '', translationVi: '', highlight: '' },
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
            value={ex.sentenceEn}
            onChange={(e) =>
              setExamples((prev) =>
                prev.map((item, i) =>
                  i === idx ? { ...item, sentenceEn: e.target.value } : item,
                ),
              )
            }
            placeholder="Câu tiếng Anh * (sentenceEn)"
            className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-5"
          />
          <input
            type="text"
            value={ex.translationVi}
            onChange={(e) =>
              setExamples((prev) =>
                prev.map((item, i) =>
                  i === idx ? { ...item, translationVi: e.target.value } : item,
                ),
              )
            }
            placeholder="Dịch tiếng Việt * (translationVi)"
            className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-4"
          />
          <input
            type="text"
            value={ex.highlight ?? ''}
            onChange={(e) =>
              setExamples((prev) =>
                prev.map((item, i) =>
                  i === idx ? { ...item, highlight: e.target.value } : item,
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
            aria-label="Xoá ví dụ"
            className="flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 sm:col-span-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
