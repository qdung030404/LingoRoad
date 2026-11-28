import React from 'react';
import { Copy } from 'lucide-react';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { formatShortType } from './items-admin.helpers';
import type { ItemsAdminState } from './useItemsAdminState';

export function renderItemsTable(state: ItemsAdminState): React.ReactElement {
  const {
    items,
    loading,
    pagination,
    setPage,
    setLimit,
    setEditingItem,
    setCloningItem,
    setShowModal,
    setForceDelete,
    setDeleteTarget,
  } = state;

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
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-slateDark-700"
                >
                  Đang tải ngân hàng câu hỏi...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-slateDark-700"
                >
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
                    <p className="line-clamp-2 font-semibold text-slateDark-900">
                      {item.prompt}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slateDark-700">
                      {item.correctOption
                        ? `Đáp án: ${item.correctOption}`
                        : 'Chấm rubric / tự luận'}{' '}
                      · {item.usageScope} · IRT(b={item.irtB})
                      {item.group ? ` · Nhóm P${item.group.partNumber}` : ''}
                    </p>
                  </td>

                  <td className="px-4 py-4 font-mono text-xs text-slateDark-900">
                    {item.skillCode}
                  </td>

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
                        onClick={() => {
                          setEditingItem(null);
                          setCloningItem(item);
                          setShowModal(true);
                        }}
                        title="Tạo bản sao mới từ câu hỏi này"
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Nhân bản</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCloningItem(null);
                          setEditingItem(item);
                          setShowModal(true);
                        }}
                        className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForceDelete(false);
                          setDeleteTarget(item);
                        }}
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

export function renderGroupsTable(state: ItemsAdminState): React.ReactElement {
  const {
    groups,
    groupsLoading,
    groupsPagination,
    groupsLimit,
    setGroupsPage,
    setGroupsLimit,
    openGroupModal,
    setDeleteGroupTarget,
  } = state;

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
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-sm text-slateDark-700"
                >
                  Đang tải danh sách nhóm đề...
                </td>
              </tr>
            ) : groups.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-sm text-slateDark-700"
                >
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
                  <td className="px-4 py-4 text-xs font-semibold text-slateDark-800">
                    {grp.usageScope}
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold text-slateDark-900">
                    {grp.itemsCount} câu hỏi
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openGroupModal(grp)}
                        className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteGroupTarget(grp)}
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

export function renderDeleteItemModal(
  state: ItemsAdminState,
): React.ReactElement | null {
  const {
    deleteTarget,
    setDeleteTarget,
    needsForceDelete,
    forceDelete,
    setForceDelete,
    deleting,
    handleConfirmDelete,
  } = state;

  if (!deleteTarget) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slateDark-900">
          Xác nhận xoá câu hỏi CEFR
        </h2>
        <p className="line-clamp-3 text-sm text-slateDark-800">
          {deleteTarget.prompt}
        </p>

        {needsForceDelete && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
            <input
              type="checkbox"
              checked={forceDelete}
              onChange={(e) => setForceDelete(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-red-600"
            />
            <span>
              Câu hỏi đang gắn với{' '}
              <strong>{deleteTarget.responsesCount} lượt trả lời</strong>
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
            onClick={() => setDeleteTarget(null)}
            className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={deleting || (needsForceDelete && !forceDelete)}
            onClick={() => void handleConfirmDelete()}
            className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {deleting ? 'Đang xoá...' : 'Xoá câu hỏi'}
          </button>
        </div>
      </div>
    </div>
  );
}
