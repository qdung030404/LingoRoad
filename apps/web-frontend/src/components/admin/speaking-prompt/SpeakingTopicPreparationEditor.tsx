import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { MediaUploadField as MediaUploadFieldType } from '../MediaUploadField';
import type { SpeakingPromptState } from './useSpeakingPromptState';

export function renderSpeakingTopicPreparation(
  state: SpeakingPromptState,
  MediaUploadFieldComponent: typeof MediaUploadFieldType,
): React.ReactNode {
  const {
    code,
    mode,
    prepGoal,
    setPrepGoal,
    prepSceneImage,
    setPrepSceneImage,
    prepVocab,
    setPrepVocab,
    prepPhrases,
    setPrepPhrases,
  } = state;

  if (mode !== 'TOPIC') return null;

  return (
    <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-25/50 p-4">
      <p className="text-xs font-bold text-slateDark-900">
        Nội dung chuẩn bị hội thoại Voice AI (preparation — lưu DB)
      </p>
      <div>
        <label className="mb-1 block text-xs font-semibold">
          Mục tiêu giao tiếp (goal)
        </label>
        <input
          type="text"
          value={prepGoal}
          onChange={(e) => setPrepGoal(e.target.value)}
          placeholder="VD: Gọi đồ uống và hỏi giá tự nhiên tại quán cà phê."
          className="w-full rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs"
        />
      </div>
      <MediaUploadFieldComponent
        kind="image"
        slug={`voice-scene-${code || 'topic'}`}
        label="Ảnh bối cảnh hội thoại (sceneImageUrl)"
        value={prepSceneImage}
        onChange={(url) => setPrepSceneImage(url)}
      />

      {/* Vocab */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">
            Từ vựng gợi ý ({prepVocab.length})
          </span>
          <button
            type="button"
            onClick={() =>
              setPrepVocab((prev) => [
                ...prev,
                { word: '', meaningVi: '', example: '', imageUrl: '' },
              ])
            }
            className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-[11px] font-semibold"
          >
            <Plus className="h-3 w-3" /> Thêm từ
          </button>
        </div>
        {prepVocab.map((v, idx) => (
          <div
            key={idx}
            className="space-y-2 rounded-xl border border-slateDark-100 bg-white p-3"
          >
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-12">
              <input
                type="text"
                value={v.word}
                onChange={(e) =>
                  setPrepVocab((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, word: e.target.value } : item,
                    ),
                  )
                }
                placeholder="Từ"
                className="rounded-lg border border-slateDark-200 bg-slateDark-25 px-2 py-1.5 text-xs sm:col-span-3"
              />
              <input
                type="text"
                value={v.meaningVi}
                onChange={(e) =>
                  setPrepVocab((prev) =>
                    prev.map((item, i) =>
                      i === idx
                        ? { ...item, meaningVi: e.target.value }
                        : item,
                    ),
                  )
                }
                placeholder="Nghĩa tiếng Việt"
                className="rounded-lg border border-slateDark-200 bg-slateDark-25 px-2 py-1.5 text-xs sm:col-span-4"
              />
              <input
                type="text"
                value={v.example}
                onChange={(e) =>
                  setPrepVocab((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { ...item, example: e.target.value } : item,
                    ),
                  )
                }
                placeholder="Ví dụ"
                className="rounded-lg border border-slateDark-200 bg-slateDark-25 px-2 py-1.5 text-xs sm:col-span-4"
              />
              <button
                type="button"
                onClick={() =>
                  setPrepVocab((prev) => prev.filter((_, i) => i !== idx))
                }
                aria-label="Xoá từ vựng gợi ý"
                className="flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 sm:col-span-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <MediaUploadFieldComponent
              kind="image"
              slug={`voice-vocab-${code || 'topic'}-${idx + 1}`}
              label="Ảnh minh họa từ vựng (tuỳ chọn)"
              value={v.imageUrl ?? ''}
              onChange={(url) =>
                setPrepVocab((prev) =>
                  prev.map((item, i) =>
                    i === idx ? { ...item, imageUrl: url } : item,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>

      {/* Phrases */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">
            Mẫu câu giao tiếp ({prepPhrases.length})
          </span>
          <button
            type="button"
            onClick={() =>
              setPrepPhrases((prev) => [...prev, { text: '', meaningVi: '' }])
            }
            className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-[11px] font-semibold"
          >
            <Plus className="h-3 w-3" /> Thêm mẫu câu
          </button>
        </div>
        {prepPhrases.map((p, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-1.5 sm:grid-cols-12">
            <input
              type="text"
              value={p.text}
              onChange={(e) =>
                setPrepPhrases((prev) =>
                  prev.map((item, i) =>
                    i === idx ? { ...item, text: e.target.value } : item,
                  ),
                )
              }
              placeholder="Mẫu câu tiếng Anh"
              className="rounded-lg border border-slateDark-200 bg-white px-2 py-1.5 text-xs sm:col-span-6"
            />
            <input
              type="text"
              value={p.meaningVi}
              onChange={(e) =>
                setPrepPhrases((prev) =>
                  prev.map((item, i) =>
                    i === idx ? { ...item, meaningVi: e.target.value } : item,
                  ),
                )
              }
              placeholder="Nghĩa tiếng Việt"
              className="rounded-lg border border-slateDark-200 bg-white px-2 py-1.5 text-xs sm:col-span-5"
            />
            <button
              type="button"
              onClick={() =>
                setPrepPhrases((prev) => prev.filter((_, i) => i !== idx))
              }
              className="flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 sm:col-span-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
