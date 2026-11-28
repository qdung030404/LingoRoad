'use client';

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  createAdminSpeakingPrompt,
  updateAdminSpeakingPrompt,
} from '@/lib/admin-api';
import {
  SPEAKING_MAX_HINTS,
  maxSpeakingDurationForMode,
} from '@/lib/admin-validation';
import type { SpeakingMode } from '@/types/admin';
import { MediaUploadField } from './MediaUploadField';
import { renderSpeakingTopicPreparation } from './speaking-prompt/SpeakingTopicPreparationEditor';
import {
  MAX_TEXT_LENGTH,
  MAX_VISUAL_CONTEXT_LENGTH,
  useSpeakingPromptState,
  type SpeakingPromptModalProps,
} from './speaking-prompt/useSpeakingPromptState';

export function SpeakingPromptModal(
  props: SpeakingPromptModalProps,
): React.ReactElement {
  const { editingPrompt = null, onClose } = props;
  const state = useSpeakingPromptState(props, {
    useState,
    createAdminSpeakingPrompt,
    updateAdminSpeakingPrompt,
  });

  const {
    isEditing,
    isCloning,
    code,
    setCode,
    mode,
    setMode,
    title,
    setTitle,
    text,
    setText,
    difficulty,
    setDifficulty,
    maxDurationSeconds,
    setMaxDurationSeconds,
    sortOrder,
    setSortOrder,
    published,
    setPublished,
    hintsText,
    setHintsText,
    sampleAsset,
    setSampleAsset,
    imageUrl,
    setImageUrl,
    visualContext,
    setVisualContext,
    linkedCodesText,
    setLinkedCodesText,
    confirmVersionReset,
    setConfirmVersionReset,
    saving,
    error,
    durationLimit,
    parsedHints,
    isTongueTwisterContentChanged,
    handleSubmit,
  } = state;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slateDark-900">
            {isEditing
              ? 'Sửa đề luyện nói'
              : isCloning
                ? 'Nhân bản đề luyện nói'
                : 'Tạo đề luyện nói mới'}
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
              <label className="mb-1 block text-xs font-semibold">
                Mã đề (slug) *
              </label>
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
              <label className="mb-1 block text-xs font-semibold">
                Chế độ (Mode) *
              </label>
              <select
                value={mode}
                onChange={(e) => {
                  const next = e.target.value as SpeakingMode;
                  const nextLimit = maxSpeakingDurationForMode(next);
                  setMode(next);
                  if (!isEditing && !isCloning) {
                    setMaxDurationSeconds(nextLimit);
                  } else {
                    setMaxDurationSeconds((prev) =>
                      Math.min(nextLimit, Math.max(5, prev)),
                    );
                  }
                }}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
              >
                <option value="READ_ALOUD">READ_ALOUD (Đọc to)</option>
                <option value="TOPIC">TOPIC (Hội thoại / Chủ đề)</option>
                <option value="PICTURE_DESCRIPTION">
                  PICTURE_DESCRIPTION (Mô tả tranh)
                </option>
                <option value="TONGUE_TWISTER">
                  TONGUE_TWISTER (Xoắn lưỡi)
                </option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold">
                  Độ khó (1–5)
                </label>
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
                <label className="mb-1 block text-xs font-semibold">
                  Tối đa (5–{durationLimit}s)
                </label>
                <input
                  type="number"
                  min={5}
                  max={durationLimit}
                  value={maxDurationSeconds}
                  onChange={(e) =>
                    setMaxDurationSeconds(
                      Math.min(
                        durationLimit,
                        Math.max(1, Number(e.target.value)),
                      ),
                    )
                  }
                  className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-8">
              <label className="mb-1 block text-xs font-semibold">
                Tiêu đề đề bài *
              </label>
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
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold">
                Nội dung câu đọc / Đề bài hội thoại (text) *
              </label>
              <span className="text-[11px] text-slateDark-600">
                {text.trim().length}/{MAX_TEXT_LENGTH}
              </span>
            </div>
            <textarea
              rows={3}
              required
              maxLength={MAX_TEXT_LENGTH}
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
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold">
                  Ngữ cảnh chấm AI cho bức tranh (visualContext)
                </label>
                <span className="text-[11px] text-slateDark-600">
                  {visualContext.trim().length}/{MAX_VISUAL_CONTEXT_LENGTH}
                </span>
              </div>
              <textarea
                rows={2}
                maxLength={MAX_VISUAL_CONTEXT_LENGTH}
                value={visualContext}
                onChange={(e) => setVisualContext(e.target.value)}
                placeholder="Mô tả chi tiết những gì xuất hiện trong ảnh để AI chấm độ chính xác nội dung..."
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold">
                  Gợi ý luyện nói (mỗi dòng 1 gợi ý, tối đa {SPEAKING_MAX_HINTS})
                </label>
                <span
                  className={
                    parsedHints.length > SPEAKING_MAX_HINTS
                      ? 'text-[11px] font-semibold text-red-600'
                      : 'text-[11px] text-slateDark-600'
                  }
                >
                  {parsedHints.length}/{SPEAKING_MAX_HINTS}
                </span>
              </div>
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

          {renderSpeakingTopicPreparation(state, MediaUploadField)}

          {isTongueTwisterContentChanged && editingPrompt && (
            <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <p>
                  Thay đổi nội dung câu xoắn lưỡi (<code>text</code>, chế độ,
                  gợi ý hoặc ảnh) sẽ tăng{' '}
                  <strong>
                    contentVersion (v{editingPrompt.contentVersion} → v
                    {editingPrompt.contentVersion + 1})
                  </strong>{' '}
                  và đặt lại tiến độ vượt màn Tongue Twister của học viên.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={confirmVersionReset}
                  onChange={(e) => setConfirmVersionReset(e.target.checked)}
                  className="h-4 w-4 accent-amber-700"
                />
                <span>
                  Tôi xác nhận tăng contentVersion và đặt lại tiến độ Tongue
                  Twister cho bài này.
                </span>
              </label>
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
              disabled={
                saving ||
                (isTongueTwisterContentChanged && !confirmVersionReset)
              }
              className="btn-primary rounded-xl px-6 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving
                ? 'Đang lưu...'
                : isEditing
                  ? 'Lưu thay đổi'
                  : isCloning
                    ? 'Tạo bản sao'
                    : 'Tạo đề nói'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
