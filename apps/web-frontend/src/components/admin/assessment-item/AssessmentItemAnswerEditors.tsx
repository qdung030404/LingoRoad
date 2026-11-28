import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AssessmentItemState } from './useAssessmentItemState';

export function renderAnswerAndRubricEditors(
  state: AssessmentItemState,
): React.ReactNode {
  const {
    type,
    usageScope,
    usesChoiceOptions,
    usesRubric,
    maxChoiceOptions,
    minChoiceOptions,
    options,
    setOptions,
    correctIndex,
    setCorrectIndex,
    handleRemoveOption,
    reorderTokensText,
    setReorderTokensText,
    matchingPairs,
    setMatchingPairs,
    targetGrammarsText,
    setTargetGrammarsText,
    wordCountMin,
    setWordCountMin,
    wordCountMax,
    setWordCountMax,
    timeLimitSeconds,
    setTimeLimitSeconds,
    minSpeakingSeconds,
    setMinSpeakingSeconds,
    maxSpeakingSeconds,
    setMaxSpeakingSeconds,
    taskAchievement,
    setTaskAchievement,
    coherenceCohesion,
    setCoherenceCohesion,
    lexicalResource,
    setLexicalResource,
    grammarAccuracy,
    setGrammarAccuracy,
  } = state;

  return (
    <>
      {usesChoiceOptions && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-semibold text-slateDark-800">
              Các phương án trả lời (chọn nút tròn cho đáp án đúng
              {usageScope === 'PLACEMENT'
                ? ' — bắt buộc đúng 4 phương án cho PLACEMENT'
                : ''}
              ) *
            </label>
            <button
              type="button"
              disabled={options.length >= maxChoiceOptions}
              onClick={() => setOptions((prev) => [...prev, ''])}
              className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              <span>Thêm phương án</span>
            </button>
          </div>
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
              {options.length > minChoiceOptions && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(idx)}
                  aria-label={`Xoá phương án ${idx + 1}`}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Xoá
                </button>
              )}
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

          {type === 'ESSAY' && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                  Task Achievement (taskAchievement)
                </label>
                <textarea
                  rows={2}
                  value={taskAchievement}
                  onChange={(e) => setTaskAchievement(e.target.value)}
                  placeholder="Tiêu chí hoàn thành đầy đủ các yêu cầu đề bài..."
                  className="w-full rounded-xl border border-slateDark-200 bg-white p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                  Coherence &amp; Cohesion (coherenceCohesion)
                </label>
                <textarea
                  rows={2}
                  value={coherenceCohesion}
                  onChange={(e) => setCoherenceCohesion(e.target.value)}
                  placeholder="Tiêu chí mạch lạc, bố cục đoạn và từ nối..."
                  className="w-full rounded-xl border border-slateDark-200 bg-white p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                  Lexical Resource (lexicalResource)
                </label>
                <textarea
                  rows={2}
                  value={lexicalResource}
                  onChange={(e) => setLexicalResource(e.target.value)}
                  placeholder="Tiêu chí vốn từ vựng theo bậc CEFR..."
                  className="w-full rounded-xl border border-slateDark-200 bg-white p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                  Grammar Accuracy (grammarAccuracy)
                </label>
                <textarea
                  rows={2}
                  value={grammarAccuracy}
                  onChange={(e) => setGrammarAccuracy(e.target.value)}
                  placeholder="Tiêu chí độ chính xác và đa dạng ngữ pháp..."
                  className="w-full rounded-xl border border-slateDark-200 bg-white p-2.5 text-xs"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
