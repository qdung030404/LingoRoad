'use client';

import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  createAdminSpeakingPrompt,
  updateAdminSpeakingPrompt,
} from '@/lib/admin-api';
import type {
  AdminSpeakingPrompt,
  SpeakingMode,
  SpeakingPreparationPayload,
} from '@/types/admin';
import { MediaUploadField } from './MediaUploadField';

interface SpeakingPromptModalProps {
  editingPrompt: AdminSpeakingPrompt | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SpeakingPromptModal({
  editingPrompt,
  onClose,
  onSaved,
}: SpeakingPromptModalProps): React.ReactElement {
  const isEditing = Boolean(editingPrompt);

  const [code, setCode] = useState(editingPrompt?.code ?? '');
  const [mode, setMode] = useState<SpeakingMode>(
    editingPrompt?.mode ?? 'READ_ALOUD',
  );
  const [title, setTitle] = useState(editingPrompt?.title ?? '');
  const [text, setText] = useState(editingPrompt?.text ?? '');
  const [difficulty, setDifficulty] = useState(editingPrompt?.difficulty ?? 1);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(
    editingPrompt?.maxDurationSeconds ?? 30,
  );
  const [sortOrder, setSortOrder] = useState<string>(
    editingPrompt?.sortOrder !== undefined ? String(editingPrompt.sortOrder) : '',
  );
  const [published, setPublished] = useState(editingPrompt?.published ?? true);
  const [hintsText, setHintsText] = useState(
    (editingPrompt?.hints ?? []).join('\n'),
  );
  const [sampleAsset, setSampleAsset] = useState(
    editingPrompt?.sampleAsset ?? '',
  );
  const [imageUrl, setImageUrl] = useState(editingPrompt?.imageUrl ?? '');
  const [visualContext, setVisualContext] = useState(
    editingPrompt?.visualContext ?? '',
  );
  const [linkedCodesText, setLinkedCodesText] = useState(
    (editingPrompt?.linkedReadAloudCodes ?? []).join(', '),
  );

  // Voice Conversation Preparation (dùng cho TOPIC)
  const initialPrep = editingPrompt?.preparation ?? {};
  const [prepGoal, setPrepGoal] = useState(initialPrep.goal ?? '');
  const [prepSceneImage, setPrepSceneImage] = useState(
    initialPrep.sceneImageUrl ?? '',
  );
  const [prepVocab, setPrepVocab] = useState<
    Array<{ word: string; meaningVi: string; example: string }>
  >(
    initialPrep.vocabulary?.map((v) => ({
      word: v.word,
      meaningVi: v.meaningVi,
      example: v.example,
    })) ?? [],
  );
  const [prepPhrases, setPrepPhrases] = useState<
    Array<{ text: string; meaningVi: string }>
  >(initialPrep.phrases ?? []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    const cleanCode = code.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(cleanCode)) {
      setError('Mã đề luyện nói chỉ gồm chữ thường, số và dấu gạch ngang.');
      return;
    }
    if (mode === 'PICTURE_DESCRIPTION' && !imageUrl.trim()) {
      setError('Chế độ Mô tả tranh (PICTURE_DESCRIPTION) bắt buộc có ảnh minh họa.');
      return;
    }

    const hints = hintsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const linkedReadAloudCodes = linkedCodesText
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);

    let preparation: SpeakingPreparationPayload | null = null;
    if (
      mode === 'TOPIC' &&
      (prepGoal.trim() ||
        prepSceneImage.trim() ||
        prepVocab.some((v) => v.word.trim()) ||
        prepPhrases.some((p) => p.text.trim()))
    ) {
      preparation = {
        ...(prepGoal.trim() ? { goal: prepGoal.trim() } : {}),
        ...(prepSceneImage.trim() ? { sceneImageUrl: prepSceneImage.trim() } : {}),
        vocabulary: prepVocab
          .filter((v) => v.word.trim() && v.meaningVi.trim())
          .map((v) => ({
            word: v.word.trim(),
            meaningVi: v.meaningVi.trim(),
            example: v.example.trim(),
          })),
        phrases: prepPhrases
          .filter((p) => p.text.trim() && p.meaningVi.trim())
          .map((p) => ({
            text: p.text.trim(),
            meaningVi: p.meaningVi.trim(),
          })),
      };
    }

    const parsedOrder =
      sortOrder.trim() !== '' && Number.isInteger(Number(sortOrder))
        ? Number(sortOrder)
        : undefined;

    setSaving(true);
    try {
      const payload = {
        code: cleanCode,
        mode,
        title: title.trim(),
        text: text.trim(),
        difficulty,
        maxDurationSeconds,
        hints,
        sampleAsset: sampleAsset.trim() || null,
        imageUrl: imageUrl.trim() || null,
        visualContext: visualContext.trim() || null,
        preparation,
        linkedReadAloudCodes,
        ...(parsedOrder !== undefined ? { sortOrder: parsedOrder } : {}),
        published,
      };
      if (editingPrompt) {
        await updateAdminSpeakingPrompt(editingPrompt.id, payload);
      } else {
        await createAdminSpeakingPrompt(payload);
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể lưu đề luyện nói.',
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
            {isEditing ? 'Sửa đề luyện nói' : 'Tạo đề luyện nói mới'}
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
          className="flex-1 space-y-4 overflow-y-auto p-6"
        >
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Mã đề (slug) *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="topic-daily-routine"
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">Chế độ (Mode) *</label>
              <select
                value={mode}
                onChange={(e) => {
                  const next = e.target.value as SpeakingMode;
                  setMode(next);
                  if (!isEditing) {
                    setMaxDurationSeconds(
                      next === 'TOPIC' || next === 'PICTURE_DESCRIPTION' ? 60 : 30,
                    );
                  }
                }}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
              >
                <option value="READ_ALOUD">READ_ALOUD (Đọc to)</option>
                <option value="TOPIC">TOPIC (Hội thoại / Chủ đề)</option>
                <option value="PICTURE_DESCRIPTION">PICTURE_DESCRIPTION (Mô tả tranh)</option>
                <option value="TONGUE_TWISTER">TONGUE_TWISTER (Xoắn lưỡi)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold">Độ khó (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Tối đa (s)</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={maxDurationSeconds}
                  onChange={(e) => setMaxDurationSeconds(Number(e.target.value))}
                  className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-8">
              <label className="mb-1 block text-xs font-semibold">Tiêu đề đề bài *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold">Thứ tự</label>
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="Auto"
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex items-end pb-2 sm:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
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

          <div>
            <label className="mb-1 block text-xs font-semibold">
              Nội dung câu đọc / Đề bài hội thoại (text) *
            </label>
            <textarea
              rows={3}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-sm"
            />
          </div>

          <MediaUploadField
            kind="image"
            slug={`speaking-${code || 'prompt'}`}
            label={`Ảnh minh họa ${mode === 'PICTURE_DESCRIPTION' ? '(Bắt buộc *)' : '(tuỳ chọn)'}`}
            value={imageUrl}
            onChange={(url) => setImageUrl(url)}
          />

          {mode === 'PICTURE_DESCRIPTION' && (
            <div>
              <label className="mb-1 block text-xs font-semibold">
                Ngữ cảnh chấm AI cho bức tranh (visualContext)
              </label>
              <textarea
                rows={2}
                value={visualContext}
                onChange={(e) => setVisualContext(e.target.value)}
                placeholder="Mô tả chi tiết những gì xuất hiện trong ảnh để AI chấm độ chính xác nội dung..."
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">
                Gợi ý luyện nói (mỗi dòng 1 gợi ý)
              </label>
              <textarea
                rows={3}
                value={hintsText}
                onChange={(e) => setHintsText(e.target.value)}
                placeholder="Mention where you live&#10;Describe your favorite hobby"
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-xs"
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold">
                  Sample Asset (tuỳ chọn)
                </label>
                <input
                  type="text"
                  value={sampleAsset}
                  onChange={(e) => setSampleAsset(e.target.value)}
                  className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                />
              </div>
              {mode === 'TOPIC' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold">
                    Mã Read-Aloud liên kết (cách nhau dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={linkedCodesText}
                    onChange={(e) => setLinkedCodesText(e.target.value)}
                    placeholder="daily-routine-1, daily-routine-2"
                    className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 font-mono text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {mode === 'TOPIC' && (
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
              <MediaUploadField
                kind="image"
                slug={`voice-scene-${code || 'topic'}`}
                label="Ảnh bối cảnh hội thoại (sceneImageUrl)"
                value={prepSceneImage}
                onChange={(url) => setPrepSceneImage(url)}
              />

              {/* Vocab */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Từ vựng gợi ý ({prepVocab.length})</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPrepVocab((prev) => [
                        ...prev,
                        { word: '', meaningVi: '', example: '' },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-[11px] font-semibold"
                  >
                    <Plus className="h-3 w-3" /> Thêm từ
                  </button>
                </div>
                {prepVocab.map((v, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-1.5 sm:grid-cols-12">
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
                      className="rounded-lg border border-slateDark-200 bg-white px-2 py-1.5 text-xs sm:col-span-3"
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
                      className="rounded-lg border border-slateDark-200 bg-white px-2 py-1.5 text-xs sm:col-span-4"
                    />
                    <input
                      type="text"
                      value={v.example}
                      onChange={(e) =>
                        setPrepVocab((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, example: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Ví dụ"
                      className="rounded-lg border border-slateDark-200 bg-white px-2 py-1.5 text-xs sm:col-span-4"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPrepVocab((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 sm:col-span-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Phrases */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Mẫu câu giao tiếp ({prepPhrases.length})</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPrepPhrases((prev) => [
                        ...prev,
                        { text: '', meaningVi: '' },
                      ])
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
                            i === idx
                              ? { ...item, meaningVi: e.target.value }
                              : item,
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
              {saving ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo đề nói'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
