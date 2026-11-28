import React from 'react';
import { Search, X } from 'lucide-react';
import type { MediaUploadField as MediaUploadFieldType } from '@/components/admin/MediaUploadField';
import type {
  AssessmentSkill,
  CefrLevel,
  ItemUsageScope,
} from '@/types/admin';
import { formatShortType } from './items-admin.helpers';
import type { ItemsAdminState } from './useItemsAdminState';

export function renderItemsGroupModal(
  state: ItemsAdminState,
  MediaUploadFieldComponent: typeof MediaUploadFieldType,
): React.ReactElement | null {
  const {
    showGroupModal,
    setShowGroupModal,
    editingGroup,
    handleSaveGroup,
    groupError,
    gSkill,
    setGSkill,
    gCefr,
    setGCefr,
    gPartNumber,
    setGPartNumber,
    gScope,
    setGScope,
    gTitle,
    setGTitle,
    gAudioUrl,
    setGAudioUrl,
    gPassage,
    setGPassage,
    gTranscript,
    setGTranscript,
    gSelectedItems,
    handleMoveSelectedItem,
    handleRemoveSelectedItem,
    gItemSearch,
    setGItemSearch,
    gPickerError,
    gPickerLoading,
    availablePickerItems,
    handleAddSelectedItem,
    savingGroup,
  } = state;

  if (!showGroupModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slateDark-900">
            {editingGroup ? 'Cập nhật nhóm đề' : 'Tạo nhóm câu hỏi mới'}
          </h2>
          <button
            type="button"
            onClick={() => setShowGroupModal(false)}
            className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSaveGroup(e)}
          className="flex-1 space-y-4 overflow-y-auto p-6"
        >
          {groupError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {groupError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Kỹ năng
              </label>
              <select
                value={gSkill}
                onChange={(e) => setGSkill(e.target.value as AssessmentSkill)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
              >
                <option value="READING">READING</option>
                <option value="LISTENING">LISTENING</option>
                <option value="WRITING">WRITING</option>
                <option value="SPEAKING">SPEAKING</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                CEFR
              </label>
              <select
                value={gCefr}
                onChange={(e) => setGCefr(e.target.value as CefrLevel)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
              >
                {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Part #
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={gPartNumber}
                onChange={(e) => setGPartNumber(Number(e.target.value))}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Phạm vi
              </label>
              <select
                value={gScope}
                onChange={(e) => setGScope(e.target.value as ItemUsageScope)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
              >
                <option value="ALL">ALL</option>
                <option value="MOCK_EXAM">MOCK_EXAM</option>
                <option value="PRACTICE">PRACTICE</option>
                <option value="PLACEMENT">PLACEMENT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Tiêu đề nhóm
            </label>
            <input
              type="text"
              value={gTitle}
              onChange={(e) => setGTitle(e.target.value)}
              placeholder="VD: Reading Part 5 - Business Email"
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm"
            />
          </div>

          {gSkill === 'LISTENING' && (
            <MediaUploadFieldComponent
              kind="audio"
              audioScope="placement"
              slug={`group-p${gPartNumber}`}
              label="Audio chung của nhóm (WAV)"
              value={gAudioUrl}
              onChange={(url) => setGAudioUrl(url)}
            />
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Đoạn văn chung (Passage)
            </label>
            <textarea
              rows={4}
              value={gPassage}
              onChange={(e) => setGPassage(e.target.value)}
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-sm"
            />
          </div>

          {gSkill === 'LISTENING' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Transcript chung
              </label>
              <textarea
                rows={3}
                value={gTranscript}
                onChange={(e) => setGTranscript(e.target.value)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-sm"
              />
            </div>
          )}

          {/* Group itemIds Picker */}
          <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slateDark-800">
                Câu hỏi thuộc nhóm ({gSelectedItems.length})
              </h3>
              <span className="text-[11px] text-slateDark-600">
                Thứ tự lưu theo danh sách bên dưới
              </span>
            </div>

            {gSelectedItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slateDark-200 bg-white px-3 py-3 text-center text-xs text-slateDark-600">
                Chưa có câu hỏi nào trong nhóm. Tìm và bấm &ldquo;+ Thêm&rdquo; ở
                khung bên dưới.
              </p>
            ) : (
              <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                {gSelectedItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slateDark-100 bg-white px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-800">
                          #{idx + 1}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-brand-700">
                          {item.externalId || item.id.slice(0, 8)}
                        </span>
                        <span className="rounded bg-slateDark-50 px-1.5 py-0.5 text-[10px] font-medium text-slateDark-700">
                          {formatShortType(item.type)}
                        </span>
                        {item.fromOtherGroupLabel && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            Chuyển từ {item.fromOtherGroupLabel}
                          </span>
                        )}
                        {(item.responsesCount ?? 0) > 0 && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            {item.responsesCount} lượt trả lời
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-slateDark-800">
                        {item.prompt}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveSelectedItem(idx, -1)}
                        aria-label="Di chuyển lên"
                        className="rounded-lg border border-slateDark-200 bg-white px-2 py-1 text-xs font-bold text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === gSelectedItems.length - 1}
                        onClick={() => handleMoveSelectedItem(idx, 1)}
                        aria-label="Di chuyển xuống"
                        className="rounded-lg border border-slateDark-200 bg-white px-2 py-1 text-xs font-bold text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedItem(item.id)}
                        aria-label="Gỡ câu hỏi khỏi nhóm"
                        className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t border-slateDark-100 pt-3">
              <label className="block text-xs font-semibold text-slateDark-800">
                Tìm câu hỏi ({gSkill} · {gCefr}) để thêm vào nhóm
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slateDark-600" />
                <input
                  type="text"
                  value={gItemSearch}
                  onChange={(e) => setGItemSearch(e.target.value)}
                  placeholder="Tìm theo mã, đề bài hoặc skillCode..."
                  className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-8 pr-3 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>

              {gPickerError && (
                <p className="text-xs font-medium text-red-700">
                  {gPickerError}
                </p>
              )}

              <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                {gPickerLoading ? (
                  <p className="py-3 text-center text-xs text-slateDark-600">
                    Đang tìm câu hỏi phù hợp...
                  </p>
                ) : availablePickerItems.length === 0 ? (
                  <p className="py-3 text-center text-xs text-slateDark-600">
                    Không còn câu hỏi phù hợp ({gSkill} · {gCefr}).
                  </p>
                ) : (
                  availablePickerItems.map((candidate) => {
                    const inAnotherGroup = Boolean(
                      candidate.groupId &&
                        candidate.groupId !== editingGroup?.id,
                    );
                    return (
                      <div
                        key={candidate.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slateDark-100 bg-white px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-semibold text-brand-700">
                              {candidate.externalId || candidate.id.slice(0, 8)}
                            </span>
                            <span className="font-mono text-[10px] text-slateDark-600">
                              {candidate.skillCode}
                            </span>
                            {inAnotherGroup && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                Thuộc nhóm khác
                                {candidate.group
                                  ? ` (P${candidate.group.partNumber})`
                                  : ''}
                              </span>
                            )}
                            {candidate.responsesCount > 0 && (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                {candidate.responsesCount} lượt trả lời
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-slateDark-800">
                            {candidate.prompt}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddSelectedItem(candidate)}
                          className="shrink-0 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-50"
                        >
                          + Thêm
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slateDark-100 pt-4">
            <button
              type="button"
              onClick={() => setShowGroupModal(false)}
              className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingGroup}
              className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {savingGroup ? 'Đang lưu...' : 'Lưu nhóm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
