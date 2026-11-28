'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { resolveAdminMediaUrl } from '@/lib/admin-api';
import { MediaUploadField } from '../MediaUploadField';
import type { LessonComposerState } from './useLessonComposerState';

export function LessonKeyVocabAndStepsEditor({
  state,
}: {
  state: LessonComposerState;
}): React.ReactElement {
  const {
    kind,
    code,
    keyVocabulary,
    setKeyVocabulary,
    steps,
    setSteps,
  } = state;
  return (
    <>
    {/* Từ vựng trọng tâm cho READING / VOCABULARY / GRAMMAR */}
    {kind !== 'LISTENING' && (
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
                  id: `kv-${prev.length + 1}`,
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
              <span className="text-xs font-bold text-slateDark-700">
                Từ vựng #{vIdx + 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  setKeyVocabulary((prev) =>
                    prev.filter((_, idx) => idx !== vIdx),
                  )
                }
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
                    prev.map((item, idx) =>
                      idx === vIdx
                        ? { ...item, word: e.target.value }
                        : item,
                    ),
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
                    prev.map((item, idx) =>
                      idx === vIdx
                        ? { ...item, phonetic: e.target.value }
                        : item,
                    ),
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
                    prev.map((item, idx) =>
                      idx === vIdx
                        ? { ...item, meaning: e.target.value }
                        : item,
                    ),
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
                    prev.map((item, idx) =>
                      idx === vIdx
                        ? { ...item, example: e.target.value }
                        : item,
                    ),
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
                    prev.map((item, idx) =>
                      idx === vIdx
                        ? { ...item, translation: e.target.value }
                        : item,
                    ),
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
                  prev.map((item, idx) =>
                    idx === vIdx ? { ...item, imageUrl: url } : item,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
    )}

    {/* Các bước lý thuyết (ẩn hoàn toàn trên LISTENING v1) */}
    {kind !== 'LISTENING' && (
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
            {kind === 'VOCABULARY' && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="text"
                  value={step.word ?? ''}
                  onChange={(e) =>
                    setSteps((prev) =>
                      prev.map((item, idx) =>
                        idx === sIdx
                          ? { ...item, word: e.target.value }
                          : item,
                      ),
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
                      prev.map((item, idx) =>
                        idx === sIdx
                          ? { ...item, phonetic: e.target.value }
                          : item,
                      ),
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
                      prev.map((item, idx) =>
                        idx === sIdx
                          ? { ...item, meaning: e.target.value }
                          : item,
                      ),
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
                      prev.map((item, idx) =>
                        idx === sIdx
                          ? { ...item, example: e.target.value }
                          : item,
                      ),
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
                        prev.map((item, idx) =>
                          idx === sIdx
                            ? { ...item, audioUrl: e.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="URL âm thanh phát âm từ vựng (audioUrl — tuỳ chọn, vd: https://...)"
                    className="w-full rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  />
                  {step.audioUrl?.trim() && (
                    <audio
                      controls
                      src={resolveAdminMediaUrl(step.audioUrl)}
                      className="h-8 w-full"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )}

    </>
  );
}
