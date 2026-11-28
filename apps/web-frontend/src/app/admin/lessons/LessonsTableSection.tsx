import React from 'react';
import { BookOpen, Copy } from 'lucide-react';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { MAX_BULK_SELECTION } from './lessons-admin.helpers';
import type { LessonsAdminState } from './useLessonsAdminState';

interface LessonsTableSectionProps {
  state: LessonsAdminState;
}

export function LessonsTableSection({
  state,
}: LessonsTableSectionProps): React.ReactElement {
  const {
    lessons,
    loading,
    pagination,
    page,
    limit,
    setPage,
    setLimit,
    selectedIds,
    setSelectedIds,
    bulkBusy,
    allPageSelected,
    loadingDetailId,
    handleToggleSelectAll,
    handleToggleSelectOne,
    handleBulkPublish,
    handleTogglePublish,
    handleCloneLesson,
    handleEditLesson,
    setForceDelete,
    setDeleteTarget,
  } = state;

  return (
    <>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-25 px-5 py-3 shadow-sm">
          <p className="text-xs font-bold text-brand-900">
            Đã chọn {selectedIds.length} bài học (tối đa {MAX_BULK_SELECTION}
            /lần)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void handleBulkPublish(true)}
              className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {bulkBusy ? 'Đang xử lý...' : 'Xuất bản hàng loạt'}
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void handleBulkPublish(false)}
              className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {bulkBusy ? 'Đang xử lý...' : 'Chuyển nháp hàng loạt'}
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => setSelectedIds([])}
              className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-50"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
              <tr>
                <th className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả bài học trên trang này"
                    checked={allPageSelected}
                    disabled={lessons.length === 0}
                    onChange={handleToggleSelectAll}
                    className="h-4 w-4 accent-brand-600"
                  />
                </th>
                <th className="px-4 py-3.5">Thứ tự</th>
                <th className="px-4 py-3.5">Bài học</th>
                <th className="px-4 py-3.5">Kỹ năng</th>
                <th className="px-4 py-3.5">CEFR</th>
                <th className="px-4 py-3.5">Trạng thái</th>
                <th className="px-6 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slateDark-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-slateDark-700"
                  >
                    Đang tải danh sách bài học...
                  </td>
                </tr>
              ) : lessons.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-slateDark-700"
                  >
                    Chưa có bài học nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                lessons.map((lesson, idx) => {
                  const isSelected = selectedIds.includes(lesson.id);
                  const isLoadingRow = loadingDetailId === lesson.id;
                  return (
                    <tr
                      key={lesson.id}
                      className={
                        isSelected
                          ? 'bg-brand-25/40 hover:bg-brand-25/70'
                          : 'hover:bg-slateDark-25'
                      }
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Chọn bài học ${lesson.title}`}
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(lesson.id)}
                          className="h-4 w-4 accent-brand-600"
                        />
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-25 text-xs font-bold text-brand-700">
                          {(page - 1) * limit + idx + 1}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-25 text-brand-700">
                            <BookOpen className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slateDark-900">
                              {lesson.title}
                            </p>
                            <p className="truncate font-mono text-xs text-slateDark-700">
                              {lesson.code} · {lesson.questionsCount} items · #
                              {lesson.sortOrder}
                              {lesson.grammarTopic
                                ? ` · ${lesson.grammarTopic.titleVi}`
                                : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 font-mono text-xs text-slateDark-900">
                        {lesson.primarySkillCode}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex h-6 items-center justify-center rounded-full bg-slateDark-50 px-2.5 text-xs font-semibold text-slateDark-800">
                          {lesson.unit?.cefrLevel ?? '--'}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => void handleTogglePublish(lesson)}
                          title="Bấm để chuyển đổi trạng thái Publish / Bản nháp"
                          className={
                            lesson.published
                              ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100'
                              : 'rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100'
                          }
                        >
                          {lesson.published ? 'Published' : 'Draft'}
                        </button>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={Boolean(loadingDetailId)}
                            onClick={() => void handleCloneLesson(lesson.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50 disabled:opacity-50"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>
                              {isLoadingRow ? 'Đang tải...' : 'Nhân bản'}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(loadingDetailId)}
                            onClick={() => void handleEditLesson(lesson.id)}
                            className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50 disabled:opacity-50"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setForceDelete(false);
                              setDeleteTarget(lesson);
                            }}
                            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
    </>
  );
}
