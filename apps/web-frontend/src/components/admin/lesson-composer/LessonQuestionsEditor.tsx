'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { LISTENING_SKILL_CODES, READING_SKILL_CODES } from '@/lib/admin-validation';
import type { LearningQuestionType } from '@/types/admin';
import { MediaUploadField } from '../MediaUploadField';
import { createEmptyQuestion, orderEvidenceSegmentIds } from './lesson-composer.helpers';
import type { LessonComposerState } from './useLessonComposerState';

export function LessonQuestionsEditor({
  state,
}: {
  state: LessonComposerState;
}): React.ReactElement {
  const {
    kind,
    code,
    questions,
    setQuestions,
    transcriptSegments,
    handleQuestionTypeChange,
  } = state;
  return (
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
  );
}
