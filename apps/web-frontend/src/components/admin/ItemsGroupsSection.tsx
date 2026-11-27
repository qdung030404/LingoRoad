import React from 'react';
import { Copy, Search, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { MediaUploadField } from '@/components/admin/MediaUploadField';
import type {
  AdminAssessmentGroup,
  AdminAssessmentItem,
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  PaginationMeta,
} from '@/types/admin';

export interface SelectedGroupItem {
  id: string;
  externalId: string | null;
  skillCode: string;
  type: ItemType;
  prompt: string;
  fromOtherGroupLabel?: string | null;
  responsesCount?: number;
}

export function formatShortType(type: ItemType): string {
  if (type === 'MULTIPLE_CHOICE') return 'mcq';
  if (type === 'SENTENCE_REORDER') return 'reorder';
  return type.toLowerCase();
}

export function renderItemsTable({
  items,
  loading,
  pagination,
  setPage,
  setLimit,
  onClone,
  onEdit,
  onDelete,
}: {
  items: AdminAssessmentItem[];
  loading: boolean;
  pagination: PaginationMeta;
  setPage: (next: number) => void;
  setLimit: (nextLimit: number) => void;
  onClone: (item: AdminAssessmentItem) => void;
  onEdit: (item: AdminAssessmentItem) => void;
  onDelete: (item: AdminAssessmentItem) => void;
}): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
            <tr>
              <th className="px-6 py-3.5">Stable ID</th>
              <th className="px-4 py-3.5">Câu hỏi</th>
              <th className="px-4 py-3.5">Skill</th>
              <th className="px-4 py-3.5">CEFR</th>
              <th className="px-4 py-3.5">Loại</th>
              <th className="px-6 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slateDark-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slateDark-700">
                  Đang tải ngân hàng câu hỏi...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slateDark-700">
                  Chưa có câu hỏi nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slateDark-25">
                  <td className="px-6 py-4 font-mono text-xs font-medium text-brand-700">
                    {item.externalId || item.id.slice(0, 12)}
                  </td>
                  <td className="max-w-md px-4 py-4">
                    <p className="line-clamp-2 font-semibold text-slateDark-900">{item.prompt}</p>
                    <p className="mt-0.5 truncate text-xs text-slateDark-700">
                      {item.correctOption
                        ? `Đáp án: ${item.correctOption}`
                        : 'Chấm rubric / tự luận'}{' '}
                      · {item.usageScope} · IRT(b={item.irtB})
                      {item.group ? ` · Nhóm P${item.group.partNumber}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-slateDark-900">{item.skillCode}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex h-6 items-center justify-center rounded-full bg-amber-50 px-2.5 text-xs font-semibold text-amber-800">
                      {item.cefrLevel}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center rounded-full bg-slateDark-50 px-2.5 py-1 text-xs font-medium text-slateDark-800">
                      {formatShortType(item.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onClone(item)}
                        title="Tạo bản sao mới từ câu hỏi này"
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Nhân bản</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <GlobalPagination
        page={pagination.page}
        limit={pagination.limit}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={(next) => setPage(next)}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        }}
      />
    </div>
  );
}

export function renderGroupsTable({
  groups,
  groupsLoading,
  groupsPagination,
  groupsLimit,
  setGroupsPage,
  setGroupsLimit,
  onEditGroup,
  onDeleteGroup,
}: {
  groups: AdminAssessmentGroup[];
  groupsLoading: boolean;
  groupsPagination: PaginationMeta;
  groupsLimit: number;
  setGroupsPage: (next: number) => void;
  setGroupsLimit: (nextLimit: number) => void;
  onEditGroup: (group: AdminAssessmentGroup) => void;
  onDeleteGroup: (group: AdminAssessmentGroup) => void;
}): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
            <tr>
              <th className="px-6 py-3.5">Nhóm / Part</th>
              <th className="px-4 py-3.5">Kỹ năng & CEFR</th>
              <th className="px-4 py-3.5">Phạm vi</th>
              <th className="px-4 py-3.5">Câu hỏi con</th>
              <th className="px-6 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slateDark-100">
            {groupsLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-slateDark-700">
                  Đang tải danh sách nhóm đề...
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-slateDark-700">
                  Chưa có nhóm câu hỏi nào.
                </td>
              </tr>
            ) : (
              groups.map((grp) => (
                <tr key={grp.id} className="hover:bg-slateDark-25">
                  <td className="max-w-md px-6 py-4">
                    <p className="font-semibold text-slateDark-900">
                      Part {grp.partNumber}: {grp.title || '(Chưa đặt tên)'}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slateDark-700">
                      {grp.passage || grp.audioUrl || 'Chưa có passage/audio'}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-800">
                      {grp.skill} · {grp.cefrLevel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold text-slateDark-800">{grp.usageScope}</td>
                  <td className="px-4 py-4 text-xs font-semibold text-slateDark-900">
                    {grp.itemsCount} câu hỏi
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEditGroup(grp)}
                        className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteGroup(grp)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <GlobalPagination
        page={groupsPagination.page}
        limit={groupsLimit}
        total={groupsPagination.total}
        totalPages={groupsPagination.totalPages}
        onPageChange={(next) => setGroupsPage(next)}
        onLimitChange={(nextLimit) => {
          setGroupsLimit(nextLimit);
          setGroupsPage(1);
        }}
      />
    </div>
  );
}

export interface GroupModalParams {
  editingGroup: AdminAssessmentGroup | null;
  groupError: string | null;
  savingGroup: boolean;
  gSkill: AssessmentSkill;
  setGSkill: (value: AssessmentSkill) => void;
  gCefr: CefrLevel;
  setGCefr: (value: CefrLevel) => void;
  gPartNumber: number;
  setGPartNumber: (value: number) => void;
  gScope: ItemUsageScope;
  setGScope: (value: ItemUsageScope) => void;
  gTitle: string;
  setGTitle: (value: string) => void;
  gAudioUrl: string;
  setGAudioUrl: (value: string) => void;
  gPassage: string;
  setGPassage: (value: string) => void;
  gTranscript: string;
  setGTranscript: (value: string) => void;
  gSelectedItems: SelectedGroupItem[];
  gItemSearch: string;
  setGItemSearch: (value: string) => void;
  gPickerError: string | null;
  gPickerLoading: boolean;
  availablePickerItems: AdminAssessmentItem[];
  onClose: () => void;
  onSaveGroup: (event: React.FormEvent) => Promise<void>;
  onMoveSelectedItem: (index: number, direction: -1 | 1) => void;
  onRemoveSelectedItem: (itemId: string) => void;
  onAddSelectedItem: (candidate: AdminAssessmentItem) => void;
}

export function renderGroupFormModal(p: GroupModalParams): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slateDark-900">
            {p.editingGroup ? 'Cập nhật nhóm đề' : 'Tạo nhóm câu hỏi mới'}
          </h2>
          <button
            type="button"
            onClick={p.onClose}
            className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void p.onSaveGroup(e)} className="flex-1 space-y-4 overflow-y-auto p-6">
          {p.groupError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {p.groupError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">Kỹ năng</label>
              <select
                value={p.gSkill}
                onChange={(e) => p.setGSkill(e.target.value as AssessmentSkill)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
              >
                <option value="READING">READING</option>
                <option value="LISTENING">LISTENING</option>
                <option value="WRITING">WRITING</option>
                <option value="SPEAKING">SPEAKING</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">CEFR</label>
              <select
                value={p.gCefr}
                onChange={(e) => p.setGCefr(e.target.value as CefrLevel)}
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
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">Part #</label>
              <input
                type="number"
                min={1}
                max={20}
                value={p.gPartNumber}
                onChange={(e) => p.setGPartNumber(Number(e.target.value))}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">Phạm vi</label>
              <select
                value={p.gScope}
                onChange={(e) => p.setGScope(e.target.value as ItemUsageScope)}
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
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">Tiêu đề nhóm</label>
            <input
              type="text"
              value={p.gTitle}
              onChange={(e) => p.setGTitle(e.target.value)}
              placeholder="VD: Reading Part 5 - Business Email"
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm"
            />
          </div>

          {p.gSkill === 'LISTENING' && (
            <MediaUploadField
              kind="audio"
              audioScope="placement"
              slug={`group-p${p.gPartNumber}`}
              label="Audio chung của nhóm (WAV)"
              value={p.gAudioUrl}
              onChange={(url) => p.setGAudioUrl(url)}
            />
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">Đoạn văn chung (Passage)</label>
            <textarea
              rows={4}
              value={p.gPassage}
              onChange={(e) => p.setGPassage(e.target.value)}
              className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-sm"
            />
          </div>

          {p.gSkill === 'LISTENING' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">Transcript chung</label>
              <textarea
                rows={3}
                value={p.gTranscript}
                onChange={(e) => p.setGTranscript(e.target.value)}
                className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-sm"
              />
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-slateDark-800">
                Câu hỏi thuộc nhóm ({p.gSelectedItems.length})
              </h3>
              <span className="text-[11px] text-slateDark-600">Thứ tự lưu theo danh sách bên dưới</span>
            </div>

            {p.gSelectedItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slateDark-200 bg-white px-3 py-3 text-center text-xs text-slateDark-600">
                Chưa có câu hỏi nào trong nhóm. Tìm và bấm &ldquo;+ Thêm&rdquo; ở khung bên dưới.
              </p>
            ) : (
              <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                {p.gSelectedItems.map((item, idx) => (
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
                      <p className="mt-0.5 line-clamp-1 text-slateDark-800">{item.prompt}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => p.onMoveSelectedItem(idx, -1)}
                        aria-label="Di chuyển lên"
                        className="rounded-lg border border-slateDark-200 bg-white px-2 py-1 text-xs font-bold text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === p.gSelectedItems.length - 1}
                        onClick={() => p.onMoveSelectedItem(idx, 1)}
                        aria-label="Di chuyển xuống"
                        className="rounded-lg border border-slateDark-200 bg-white px-2 py-1 text-xs font-bold text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => p.onRemoveSelectedItem(item.id)}
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
                Tìm câu hỏi ({p.gSkill} · {p.gCefr}) để thêm vào nhóm
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slateDark-600" />
                <input
                  type="text"
                  value={p.gItemSearch}
                  onChange={(e) => p.setGItemSearch(e.target.value)}
                  placeholder="Tìm theo mã, đề bài hoặc skillCode..."
                  className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-8 pr-3 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>

              {p.gPickerError && <p className="text-xs font-medium text-red-700">{p.gPickerError}</p>}

              <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                {p.gPickerLoading ? (
                  <p className="py-3 text-center text-xs text-slateDark-600">Đang tìm câu hỏi phù hợp...</p>
                ) : p.availablePickerItems.length === 0 ? (
                  <p className="py-3 text-center text-xs text-slateDark-600">
                    Không còn câu hỏi phù hợp ({p.gSkill} · {p.gCefr}).
                  </p>
                ) : (
                  p.availablePickerItems.map((candidate) => {
                    const inAnotherGroup = Boolean(
                      candidate.groupId && candidate.groupId !== p.editingGroup?.id,
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
                                Thuộc nhóm khác{candidate.group ? ` (P${candidate.group.partNumber})` : ''}
                              </span>
                            )}
                            {candidate.responsesCount > 0 && (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                {candidate.responsesCount} lượt trả lời
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-slateDark-800">{candidate.prompt}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => p.onAddSelectedItem(candidate)}
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
              onClick={p.onClose}
              className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={p.savingGroup}
              className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {p.savingGroup ? 'Đang lưu...' : 'Lưu nhóm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function renderItemsDeleteDialogs({
  deleteTarget,
  needsForceDelete,
  forceDelete,
  setForceDelete,
  deleting,
  onCancelDelete,
  onConfirmDelete,
  deleteGroupTarget,
  deletingGroup,
  onConfirmDeleteGroup,
  onCancelDeleteGroup,
}: {
  deleteTarget: AdminAssessmentItem | null;
  needsForceDelete: boolean;
  forceDelete: boolean;
  setForceDelete: (value: boolean) => void;
  deleting: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  deleteGroupTarget: AdminAssessmentGroup | null;
  deletingGroup: boolean;
  onConfirmDeleteGroup: () => Promise<void>;
  onCancelDeleteGroup: () => void;
}): React.ReactElement {
  return (
    <>
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slateDark-900">Xác nhận xoá câu hỏi CEFR</h2>
            <p className="line-clamp-3 text-sm text-slateDark-800">{deleteTarget.prompt}</p>

            {needsForceDelete && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
                <input
                  type="checkbox"
                  checked={forceDelete}
                  onChange={(e) => setForceDelete(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-red-600"
                />
                <span>
                  Câu hỏi đang gắn với <strong>{deleteTarget.responsesCount} lượt trả lời</strong>
                  {(deleteTarget.activeSessionsCount ?? 0) > 0
                    ? ` và ${deleteTarget.activeSessionsCount} phiên placement đang chạy`
                    : ''}
                  . Tích chọn để xoá cưỡng bức (Force Delete).
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCancelDelete}
                className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting || (needsForceDelete && !forceDelete)}
                onClick={() => void onConfirmDelete()}
                className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {deleting ? 'Đang xoá...' : 'Xoá câu hỏi'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleteGroupTarget)}
        title="Xoá nhóm câu hỏi"
        description={
          deleteGroupTarget ? (
            <>
              Bạn có chắc muốn xoá nhóm{' '}
              <strong>{deleteGroupTarget.title || `Part ${deleteGroupTarget.partNumber}`}</strong>? Các
              câu hỏi con ({deleteGroupTarget.itemsCount}) sẽ được gỡ liên kết an toàn và giữ nguyên
              trong Item Bank.
            </>
          ) : null
        }
        confirmLabel="Xoá nhóm"
        tone="danger"
        busy={deletingGroup}
        onConfirm={onConfirmDeleteGroup}
        onCancel={onCancelDeleteGroup}
      />
    </>
  );
}
