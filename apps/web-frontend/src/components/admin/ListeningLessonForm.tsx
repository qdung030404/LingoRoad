'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MediaUploadField } from './MediaUploadField';
import type {
  LearningKeyVocabInput,
  ListeningSegmentInput,
} from '@/types/admin';

interface ListeningLessonFormProps {
  lessonCode: string;
  audioUrl: string;
  audioDurationMs: number;
  preparation: { situation: string; objective: string };
  keyVocabulary: LearningKeyVocabInput[];
  transcriptSegments: ListeningSegmentInput[];
  onAudioChange: (url: string, durationMs?: number) => void;
  onDurationChange: (ms: number) => void;
  onPreparationChange: (next: { situation: string; objective: string }) => void;
  onKeyVocabularyChange: (next: LearningKeyVocabInput[]) => void;
  onSegmentsChange: (next: ListeningSegmentInput[]) => void;
}

function nextUniqueId(prefix: string, existingIds: string[]): string {
  const used = new Set(existingIds);
  let num = existingIds.length + 1;
  while (used.has(`${prefix}-${num}`)) {
    num += 1;
  }
  return `${prefix}-${num}`;
}

export function ListeningLessonForm({
  lessonCode,
  audioUrl,
  audioDurationMs,
  preparation,
  keyVocabulary,
  transcriptSegments,
  onAudioChange,
  onDurationChange,
  onPreparationChange,
  onKeyVocabularyChange,
  onSegmentsChange,
}: ListeningLessonFormProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Audio & Duration */}
      <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-25/50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slateDark-900">
            1. Tệp âm thanh bài Nghe hiểu (Listening v1)
          </h3>
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-800">
            WAV Mono 16-bit PCM · 30–90s
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="sm:col-span-9">
            <MediaUploadField
              kind="audio"
              audioScope="learning"
              slug={lessonCode || 'listening-v1'}
              label="Đường dẫn tệp âm thanh *"
              value={audioUrl}
              onChange={(url, meta) => onAudioChange(url, meta?.durationMs)}
              placeholder="/media/learning/v1/..."
            />
          </div>
          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
              Thời lượng (ms) *
            </label>
            <input
              type="number"
              min={30000}
              max={90000}
              value={audioDurationMs}
              onChange={(e) => onDurationChange(Number(e.target.value))}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slateDark-700">
              {(audioDurationMs / 1000).toFixed(1)} giây (tự điền khi tải WAV)
            </p>
          </div>
        </div>
      </div>

      {/* Preparation */}
      <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-4">
        <h3 className="text-sm font-bold text-slateDark-900">
          2. Bối cảnh chuẩn bị (Preparation)
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Tình huống hội thoại (situation) *
            </label>
            <textarea
              rows={2}
              value={preparation.situation}
              onChange={(e) =>
                onPreparationChange({ ...preparation, situation: e.target.value })
              }
              placeholder="VD: Hai đồng nghiệp trao đổi lịch họp buổi sáng tại văn phòng..."
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white p-3 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Mục tiêu nghe hiểu (objective) *
            </label>
            <textarea
              rows={2}
              value={preparation.objective}
              onChange={(e) =>
                onPreparationChange({ ...preparation, objective: e.target.value })
              }
              placeholder="VD: Nghe bắt ý chính, giờ họp và địa điểm cụ thể..."
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white p-3 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Key Vocabulary (3-5 items) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slateDark-900">
              3. Từ vựng trọng tâm ({keyVocabulary.length}/5 — cần 3 đến 5 từ)
            </h3>
            <p className="text-xs text-slateDark-700">
              Hiển thị trong màn hình chuẩn bị trước khi học viên nghe audio.
            </p>
          </div>
          <button
            type="button"
            disabled={keyVocabulary.length >= 5}
            onClick={() =>
              onKeyVocabularyChange([
                ...keyVocabulary,
                {
                  id: nextUniqueId(
                    'kv',
                    keyVocabulary.map((v) => v.id),
                  ),
                  word: '',
                  meaning: '',
                  phonetic: '',
                  example: '',
                  translation: '',
                  imageUrl: '',
                },
              ])
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm từ</span>
          </button>
        </div>

        <div className="space-y-3">
          {keyVocabulary.map((vocab, idx) => (
            <div
              key={vocab.id || `kv-${idx}`}
              className="space-y-2.5 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slateDark-700">
                  Từ #{idx + 1}
                </span>
                {keyVocabulary.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onKeyVocabularyChange(
                        keyVocabulary.filter((_, i) => i !== idx),
                      )
                    }
                    className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <input
                  type="text"
                  value={vocab.word}
                  onChange={(e) =>
                    onKeyVocabularyChange(
                      keyVocabulary.map((v, i) =>
                        i === idx ? { ...v, word: e.target.value } : v,
                      ),
                    )
                  }
                  placeholder="Từ tiếng Anh *"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={vocab.phonetic ?? ''}
                  onChange={(e) =>
                    onKeyVocabularyChange(
                      keyVocabulary.map((v, i) =>
                        i === idx ? { ...v, phonetic: e.target.value } : v,
                      ),
                    )
                  }
                  placeholder="Phiên âm (/.../)"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={vocab.meaning}
                  onChange={(e) =>
                    onKeyVocabularyChange(
                      keyVocabulary.map((v, i) =>
                        i === idx ? { ...v, meaning: e.target.value } : v,
                      ),
                    )
                  }
                  placeholder="Nghĩa tiếng Việt *"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="text"
                  value={vocab.example ?? ''}
                  onChange={(e) =>
                    onKeyVocabularyChange(
                      keyVocabulary.map((v, i) =>
                        i === idx ? { ...v, example: e.target.value } : v,
                      ),
                    )
                  }
                  placeholder="Câu ví dụ tiếng Anh"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={vocab.translation ?? ''}
                  onChange={(e) =>
                    onKeyVocabularyChange(
                      keyVocabulary.map((v, i) =>
                        i === idx ? { ...v, translation: e.target.value } : v,
                      ),
                    )
                  }
                  placeholder="Dịch ví dụ tiếng Việt"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
              <MediaUploadField
                kind="image"
                slug={`${lessonCode || 'listening'}-vocab-${idx + 1}`}
                label="Ảnh minh họa từ vựng (tuỳ chọn)"
                value={vocab.imageUrl ?? ''}
                onChange={(url) =>
                  onKeyVocabularyChange(
                    keyVocabulary.map((v, i) =>
                      i === idx ? { ...v, imageUrl: url } : v,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* Transcript Segments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slateDark-900">
              4. Phân đoạn lời thoại — Transcript Segments ({transcriptSegments.length})
            </h3>
            <p className="text-xs text-slateDark-700">
              Mốc thời gian (ms) tăng dần, không chồng lấn, dùng để đồng bộ karaoke & highlight dẫn chứng.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const lastEnd =
                transcriptSegments[transcriptSegments.length - 1]?.endMs ?? 0;
              onSegmentsChange([
                ...transcriptSegments,
                {
                  id: nextUniqueId(
                    'seg',
                    transcriptSegments.map((s) => s.id),
                  ),
                  speaker:
                    transcriptSegments.length % 2 === 0 ? 'Speaker A' : 'Speaker B',
                  startMs: lastEnd,
                  endMs: Math.min(audioDurationMs, lastEnd + 5000),
                  text: '',
                  translationVi: '',
                  speakerAvatar: '',
                },
              ]);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm đoạn</span>
          </button>
        </div>

        <div className="space-y-3">
          {transcriptSegments.map((seg, idx) => (
            <div
              key={seg.id || `seg-${idx}`}
              className="space-y-2.5 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-800">
                    {seg.id}
                  </span>
                  <input
                    type="text"
                    value={seg.speaker}
                    onChange={(e) =>
                      onSegmentsChange(
                        transcriptSegments.map((s, i) =>
                          i === idx ? { ...s, speaker: e.target.value } : s,
                        ),
                      )
                    }
                    placeholder="Người nói"
                    className="w-32 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs focus:border-brand-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-1 text-xs text-slateDark-700">
                    <input
                      type="number"
                      min={0}
                      value={seg.startMs}
                      onChange={(e) =>
                        onSegmentsChange(
                          transcriptSegments.map((s, i) =>
                            i === idx ? { ...s, startMs: Number(e.target.value) } : s,
                          ),
                        )
                      }
                      aria-label="Start ms"
                      className="w-20 rounded-lg border border-slateDark-200 bg-white px-2 py-1 text-xs"
                    />
                    <span>–</span>
                    <input
                      type="number"
                      min={0}
                      value={seg.endMs}
                      onChange={(e) =>
                        onSegmentsChange(
                          transcriptSegments.map((s, i) =>
                            i === idx ? { ...s, endMs: Number(e.target.value) } : s,
                          ),
                        )
                      }
                      aria-label="End ms"
                      className="w-20 rounded-lg border border-slateDark-200 bg-white px-2 py-1 text-xs"
                    />
                    <span>ms</span>
                  </div>
                </div>
                {transcriptSegments.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      onSegmentsChange(
                        transcriptSegments.filter((_, i) => i !== idx),
                      )
                    }
                    className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <textarea
                  rows={2}
                  value={seg.text}
                  onChange={(e) =>
                    onSegmentsChange(
                      transcriptSegments.map((s, i) =>
                        i === idx ? { ...s, text: e.target.value } : s,
                      ),
                    )
                  }
                  placeholder="Lời thoại tiếng Anh *"
                  className="w-full rounded-xl border border-slateDark-200 bg-white p-2.5 text-xs focus:border-brand-500 focus:outline-none"
                />
                <textarea
                  rows={2}
                  value={seg.translationVi}
                  onChange={(e) =>
                    onSegmentsChange(
                      transcriptSegments.map((s, i) =>
                        i === idx
                          ? { ...s, translationVi: e.target.value }
                          : s,
                      ),
                    )
                  }
                  placeholder="Bản dịch tiếng Việt *"
                  className="w-full rounded-xl border border-slateDark-200 bg-white p-2.5 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>

              <MediaUploadField
                kind="image"
                slug={`${lessonCode || 'listening'}-speaker-${idx + 1}`}
                label="Ảnh đại diện người nói (speakerAvatar — tuỳ chọn)"
                value={seg.speakerAvatar ?? ''}
                onChange={(url) =>
                  onSegmentsChange(
                    transcriptSegments.map((s, i) =>
                      i === idx ? { ...s, speakerAvatar: url } : s,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
