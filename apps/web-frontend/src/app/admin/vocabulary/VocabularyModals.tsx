import React from 'react';
import { X } from 'lucide-react';
import { MediaUploadField } from '@/components/admin/MediaUploadField';
import type { VocabularyAdminState } from './useVocabularyAdminState';

interface VocabularyModalsProps {
  state: VocabularyAdminState;
}

export function VocabularyTopicModal({
  state,
}: VocabularyModalsProps): React.ReactElement | null {
  const {
    showTopicModal,
    setShowTopicModal,
    editingTopic,
    handleSaveTopic,
    topicError,
    tSlug,
    setTSlug,
    tOrder,
    setTOrder,
    tTitleVi,
    setTTitleVi,
    tTitleEn,
    setTTitleEn,
    tIcon,
    setTIcon,
    tDesc,
    setTDesc,
    savingTopic,
  } = state;

  if (!showTopicModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slateDark-900">
            {editingTopic ? 'Sửa chủ đề từ vựng' : 'Tạo chủ đề từ vựng'}
          </h2>
          <button
            type="button"
            onClick={() => setShowTopicModal(false)}
            className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSaveTopic(e)} className="space-y-3.5">
          {topicError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {topicError}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold">Slug *</label>
              <input
                type="text"
                required
                value={tSlug}
                onChange={(e) => setTSlug(e.target.value)}
                placeholder="office-basics"
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Thứ tự</label>
              <input
                type="number"
                min={0}
                value={tOrder}
                onChange={(e) => setTOrder(Number(e.target.value))}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold">
                Tên tiếng Việt *
              </label>
              <input
                type="text"
                required
                value={tTitleVi}
                onChange={(e) => setTTitleVi(e.target.value)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">
                Tên tiếng Anh *
              </label>
              <input
                type="text"
                required
                value={tTitleEn}
                onChange={(e) => setTTitleEn(e.target.value)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">
              Icon (tuỳ chọn)
            </label>
            <input
              type="text"
              value={tIcon}
              onChange={(e) => setTIcon(e.target.value)}
              placeholder="briefcase / plane / book"
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Mô tả</label>
            <textarea
              rows={2}
              value={tDesc}
              onChange={(e) => setTDesc(e.target.value)}
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowTopicModal(false)}
              className="rounded-xl border border-slateDark-200 px-4 py-2 text-xs font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingTopic}
              className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {savingTopic ? 'Đang lưu...' : 'Lưu chủ đề'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function VocabularyWordModal({
  state,
}: VocabularyModalsProps): React.ReactElement | null {
  const {
    showWordModal,
    setShowWordModal,
    editingWord,
    handleSaveWord,
    wordError,
    wWord,
    setWWord,
    wPhonetic,
    setWPhonetic,
    wPos,
    setWPos,
    wMeaning,
    setWMeaning,
    wExampleEn,
    setWExampleEn,
    wExampleVi,
    setWExampleVi,
    wImageUrl,
    setWImageUrl,
    wAudioUrl,
    setWAudioUrl,
    savingWord,
  } = state;

  if (!showWordModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slateDark-900">
            {editingWord ? 'Sửa từ vựng' : 'Thêm từ vựng mới'}
          </h2>
          <button
            type="button"
            onClick={() => setShowWordModal(false)}
            className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => void handleSaveWord(e)}
          className="flex-1 space-y-3.5 overflow-y-auto p-6"
        >
          {wordError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {wordError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">
                Từ tiếng Anh *
              </label>
              <input
                type="text"
                required
                value={wWord}
                onChange={(e) => setWWord(e.target.value)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">
                Phiên âm IPA
              </label>
              <input
                type="text"
                value={wPhonetic}
                onChange={(e) => setWPhonetic(e.target.value)}
                placeholder="/ˈkɒliːɡ/"
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">
                Từ loại
              </label>
              <input
                type="text"
                value={wPos}
                onChange={(e) => setWPos(e.target.value)}
                placeholder="Danh từ / n."
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">
              Nghĩa tiếng Việt *
            </label>
            <input
              type="text"
              required
              value={wMeaning}
              onChange={(e) => setWMeaning(e.target.value)}
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">
              Ví dụ tiếng Anh
            </label>
            <textarea
              rows={2}
              value={wExampleEn}
              onChange={(e) => setWExampleEn(e.target.value)}
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">
              Dịch ví dụ tiếng Việt
            </label>
            <textarea
              rows={2}
              value={wExampleVi}
              onChange={(e) => setWExampleVi(e.target.value)}
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-xs"
            />
          </div>

          <MediaUploadField
            kind="image"
            slug={`vocab-${wWord || 'word'}`}
            label="Ảnh minh họa từ vựng (tuỳ chọn)"
            value={wImageUrl}
            onChange={(url) => setWImageUrl(url)}
          />

          <div>
            <label className="mb-1 block text-xs font-semibold">
              URL Audio phát âm (tuỳ chọn)
            </label>
            <input
              type="text"
              value={wAudioUrl}
              onChange={(e) => setWAudioUrl(e.target.value)}
              placeholder="https://... hoặc /media/..."
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slateDark-100 pt-4">
            <button
              type="button"
              onClick={() => setShowWordModal(false)}
              className="rounded-xl border border-slateDark-200 px-4 py-2 text-xs font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingWord}
              className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {savingWord ? 'Đang lưu...' : 'Lưu từ vựng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
