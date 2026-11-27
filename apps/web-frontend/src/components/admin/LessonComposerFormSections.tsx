import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { resolveAdminMediaUrl } from '@/lib/admin-api';
import { LISTENING_SKILL_CODES, READING_SKILL_CODES } from '@/lib/admin-validation';
import type {
  LearningKeyVocabInput,
  LearningKind,
  LearningQuestionInput,
  LearningQuestionType,
  LearningStepInput,
  ListeningSegmentInput,
} from '@/types/admin';
import { MediaUploadField } from './MediaUploadField';

export const MAX_LESSON_CODE_LENGTH = 100;

export function nextUniquePrefixedId(prefix: string, existingIds: readonly string[]): string {
  const used = new Set(existingIds.map((id) => id.trim()));
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let maxNum = 0;
  for (const id of existingIds) {
    const match = pattern.exec(id.trim());
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  let nextNum = maxNum + 1;
  while (used.has(`${prefix}-${nextNum}`)) {
    nextNum += 1;
  }
  return `${prefix}-${nextNum}`;
}

export function buildCloneLessonCode(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return '';
  const suffix = '-copy';
  return `${trimmed.slice(0, Math.max(1, MAX_LESSON_CODE_LENGTH - suffix.length))}${suffix}`;
}

export function createDefaultSteps(): LearningStepInput[] {
  return [{ id: 'step-1', title: 'Kiến thức trọng tâm', body: '' }];
}

export function createDefaultListeningSegments(): ListeningSegmentInput[] {
  return [
    { id: 'seg-1', speaker: 'Speaker A', startMs: 0, endMs: 15000, text: '', translationVi: '', speakerAvatar: '' },
    { id: 'seg-2', speaker: 'Speaker B', startMs: 15000, endMs: 30000, text: '', translationVi: '', speakerAvatar: '' },
  ];
}

export const DEFAULT_JSON_TEMPLATE = JSON.stringify(
  {
    steps: [
      { id: 'step-1', title: 'Giới thiệu ngữ pháp', body: 'Ôn tập cách sử dụng thì hiện tại đơn cho thói quen hằng ngày.' },
    ],
    questions: [
      {
        id: 'q-1',
        type: 'MULTIPLE_CHOICE',
        prompt: 'She ___ to school by bus every morning.',
        options: [{ id: 'A', text: 'go' }, { id: 'B', text: 'goes' }, { id: 'C', text: 'going' }, { id: 'D', text: 'went' }],
        correctOptionId: 'B',
        explanation: 'Chủ ngữ ngôi thứ ba số ít "She" dùng động từ thêm "-es": goes.',
      },
      {
        id: 'q-2',
        type: 'MULTIPLE_CHOICE',
        prompt: 'They ___ coffee after dinner.',
        options: [{ id: 'A', text: 'do not drink' }, { id: 'B', text: 'does not drink' }, { id: 'C', text: 'not drinks' }, { id: 'D', text: 'is not drink' }],
        correctOptionId: 'A',
        explanation: 'Chủ ngữ số nhiều "They" phủ định với trợ động từ "do not".',
      },
      {
        id: 'q-3',
        type: 'MULTIPLE_CHOICE',
        prompt: '___ your brother play football on Sundays?',
        options: [{ id: 'A', text: 'Do' }, { id: 'B', text: 'Are' }, { id: 'C', text: 'Does' }, { id: 'D', text: 'Is' }],
        correctOptionId: 'C',
        explanation: 'Câu hỏi thì hiện tại đơn với chủ ngữ số ít dùng trợ động từ "Does".',
      },
    ],
  },
  null,
  2,
);

export function orderEvidenceSegmentIds(
  ids: string[] | undefined,
  segments: ListeningSegmentInput[],
): string[] {
  if (!ids?.length) return [];
  const selected = new Set(ids.map((id) => id.trim()).filter(Boolean));
  return segments.map((seg) => seg.id).filter((id) => selected.has(id));
}

export function createEmptyQuestion(
  index: number,
  isListening = false,
  defaultSegmentId = 'seg-1',
  existingIds: readonly string[] = [],
): LearningQuestionInput {
  const id =
    existingIds.length > 0 ? nextUniquePrefixedId('q', existingIds) : `q-${index + 1}`;
  return {
    id,
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
          skillCode: DEFAULT_LISTENING_QUESTION_SKILLS[index % DEFAULT_LISTENING_QUESTION_SKILLS.length],
          evidenceSegmentIds: [defaultSegmentId],
        }
      : { evidence: '' }),
  };
}

export const DEFAULT_LISTENING_QUESTION_SKILLS = [
  'listening.gist',
  'listening.detail',
  'listening.specific_information',
  'listening.speaker_attitude',
  'listening.implied_meaning',
] as const;

export function renderNonListeningVocabAndSteps({
  code,
  kind,
  keyVocabulary,
  setKeyVocabulary,
  steps,
  setSteps,
}: {
  code: string;
  kind: LearningKind;
  keyVocabulary: LearningKeyVocabInput[];
  setKeyVocabulary: React.Dispatch<React.SetStateAction<LearningKeyVocabInput[]>>;
  steps: LearningStepInput[];
  setSteps: React.Dispatch<React.SetStateAction<LearningStepInput[]>>;
}): React.ReactElement {
  return (
    <>
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
                  id: nextUniquePrefixedId('kv', prev.map((item) => item.id)),
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
              <span className="text-xs font-bold text-slateDark-700">Từ vựng #{vIdx + 1}</span>
              <button
                type="button"
                onClick={() => setKeyVocabulary((prev) => prev.filter((_, idx) => idx !== vIdx))}
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
                    prev.map((item, idx) => (idx === vIdx ? { ...item, word: e.target.value } : item)),
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
                    prev.map((item, idx) => (idx === vIdx ? { ...item, phonetic: e.target.value } : item)),
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
                    prev.map((item, idx) => (idx === vIdx ? { ...item, meaning: e.target.value } : item)),
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
                    prev.map((item, idx) => (idx === vIdx ? { ...item, example: e.target.value } : item)),
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
                    prev.map((item, idx) => (idx === vIdx ? { ...item, translation: e.target.value } : item)),
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
                  prev.map((item, idx) => (idx === vIdx ? { ...item, imageUrl: url } : item)),
                )
              }
            />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slateDark-900">Các bước hướng dẫn ({steps.length})</h3>
          <button
            type="button"
            onClick={() =>
              setSteps((prev) => [
                ...prev,
                { id: nextUniquePrefixedId('step', prev.map((item) => item.id)), title: '', body: '' },
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
              <span className="text-xs font-bold text-slateDark-700">Bước học #{sIdx + 1}</span>
              {steps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== sIdx))}
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
                  prev.map((item, idx) => (idx === sIdx ? { ...item, title: e.target.value } : item)),
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
                  prev.map((item, idx) => (idx === sIdx ? { ...item, body: e.target.value } : item)),
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
                      prev.map((item, idx) => (idx === sIdx ? { ...item, word: e.target.value } : item)),
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
                      prev.map((item, idx) => (idx === sIdx ? { ...item, phonetic: e.target.value } : item)),
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
                      prev.map((item, idx) => (idx === sIdx ? { ...item, meaning: e.target.value } : item)),
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
                      prev.map((item, idx) => (idx === sIdx ? { ...item, example: e.target.value } : item)),
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
                        prev.map((item, idx) => (idx === sIdx ? { ...item, audioUrl: e.target.value } : item)),
                      )
                    }
                    placeholder="URL âm thanh phát âm từ vựng (audioUrl — tuỳ chọn, vd: https://...)"
                    className="w-full rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  />
                  {step.audioUrl?.trim() && (
                    <audio controls src={resolveAdminMediaUrl(step.audioUrl)} className="h-8 w-full" />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export function renderLessonQuestionsSection({
  kind,
  questions,
  transcriptSegments,
  setQuestions,
  onQuestionTypeChange,
}: {
  kind: LearningKind;
  questions: LearningQuestionInput[];
  transcriptSegments: ListeningSegmentInput[];
  setQuestions: React.Dispatch<React.SetStateAction<LearningQuestionInput[]>>;
  onQuestionTypeChange: (qIndex: number, nextType: LearningQuestionType) => void;
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slateDark-900">
          Ngân hàng câu hỏi ({questions.length}/
          {kind === 'LISTENING' ? '5 — chuẩn 5 câu' : '10 — tối thiểu 3 câu'})
        </h3>
        <button
          type="button"
          disabled={kind === 'LISTENING' ? questions.length >= 5 : questions.length >= 10}
          onClick={() =>
            setQuestions((prev) => [
              ...prev,
              createEmptyQuestion(
                prev.length,
                kind === 'LISTENING',
                transcriptSegments[0]?.id ?? 'seg-1',
                prev.map((q) => q.id),
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
        const qType = kind === 'LISTENING' ? 'MULTIPLE_CHOICE' : (question.type ?? 'MULTIPLE_CHOICE');
        const minQuestions = kind === 'LISTENING' ? 5 : 3;
        return (
          <div
            key={`question-row-${qIdx}`}
            className="space-y-3 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slateDark-900">Câu hỏi #{qIdx + 1}</span>
              <div className="flex flex-wrap items-center gap-2">
                {(kind === 'READING' || kind === 'LISTENING') && (
                  <select
                    value={question.skillCode ?? ''}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((item, idx) => (idx === qIdx ? { ...item, skillCode: e.target.value } : item)),
                      )
                    }
                    className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-medium text-slateDark-800 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">-- skillCode --</option>
                    {(kind === 'LISTENING' ? LISTENING_SKILL_CODES : READING_SKILL_CODES).map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={qType}
                  disabled={kind === 'LISTENING'}
                  onChange={(e) => onQuestionTypeChange(qIdx, e.target.value as LearningQuestionType)}
                  className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-medium text-slateDark-800 focus:border-brand-500 focus:outline-none disabled:opacity-60"
                >
                  <option value="MULTIPLE_CHOICE">Trắc nghiệm 4 chọn 1</option>
                  <option value="GAP_FILL">Điền vào chỗ trống</option>
                  <option value="TRUE_FALSE_NOT_GIVEN">True / False / Not Given</option>
                </select>
                {questions.length > minQuestions && (
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== qIdx))}
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
                  prev.map((item, idx) => (idx === qIdx ? { ...item, prompt: e.target.value } : item)),
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
                            idx === qIdx ? { ...item, correctOptionId: opt.id } : item,
                          ),
                        )
                      }
                      aria-label={`Chọn ${opt.id} là đáp án đúng`}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className="w-5 text-xs font-bold text-slateDark-700">{opt.id}.</span>
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
                                    oIdx === optIdx ? { ...o, text: e.target.value } : o,
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
                                  options: item.options.map((o, oIdx) =>
                                    oIdx === optIdx ? { ...o, imageUrl: e.target.value } : o,
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
                  prev.map((item, idx) => (idx === qIdx ? { ...item, explanation: e.target.value } : item)),
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
                    prev.map((item, idx) => (idx === qIdx ? { ...item, evidence: e.target.value } : item)),
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
                    const checked = (question.evidenceSegmentIds ?? []).includes(seg.id);
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
                                const current = item.evidenceSegmentIds ?? [];
                                const rawNext = e.target.checked
                                  ? [...current, seg.id]
                                  : current.filter((id) => id !== seg.id);
                                return {
                                  ...item,
                                  evidenceSegmentIds: orderEvidenceSegmentIds(rawNext, transcriptSegments),
                                };
                              }),
                            );
                          }}
                          className="h-3.5 w-3.5 accent-brand-600"
                        />
                        <span className="font-mono font-semibold">{seg.id}</span>
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
