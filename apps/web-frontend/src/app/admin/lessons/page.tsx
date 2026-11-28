'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  ListChecks,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminToast, type AdminToastApi } from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import { LessonComposerModal } from '@/components/admin/LessonComposerModal';
import {
  useSyncAdminQueryParams,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import type { CefrLevel, LearningKind } from '@/types/admin';
import { LessonsTableSection } from './LessonsTableSection';
import { CEFR_LEVELS, LESSONS_QUERY_DEFAULTS } from './lessons-admin.helpers';
import { useLessonsAdminState } from './useLessonsAdminState';

function AdminToastBridge({
  toastRef,
}: {
  toastRef: React.MutableRefObject<AdminToastApi>;
}): null {
  const toast = useAdminToast();
  useEffect(() => {
    toastRef.current = toast;
  }, [toast, toastRef]);
  return null;
}

function LessonsQuerySync({
  params,
}: {
  params: Record<string, QueryParamValue>;
}): null {
  useSyncAdminQueryParams(params, LESSONS_QUERY_DEFAULTS);
  return null;
}

export default function AdminLessonsPage(): React.ReactElement {
  const state = useLessonsAdminState();
  const {
    toastRef,
    setAuthReady,
    units,
    setUnits,
    grammarTopics,
    lessons,
    summary,
    pagination,
    setPage,
    searchInput,
    setSearchInput,
    setSearchQuery,
    publishedFilter,
    setPublishedFilter,
    kindFilter,
    setKindFilter,
    cefrFilter,
    setCefrFilter,
    exporting,
    bannerError,
    selectedIds,
    showComposer,
    setShowComposer,
    editingLesson,
    setEditingLesson,
    cloningLesson,
    setCloningLesson,
    deleteTarget,
    setDeleteTarget,
    forceDelete,
    setForceDelete,
    deleting,
    lessonsQueryParams,
    hasActiveFilters,
    loadLessons,
    handleResetFilters,
    handleConfirmDelete,
    handleExport,
  } = state;

  return (
    <AdminShell
      breadcrumbTitle="Bài học"
      title="Lesson Management"
      subtitle="Quản lý catalog bài học, trạng thái publish, nhân bản nhanh và thao tác hàng loạt."
      onAuthenticated={() => setAuthReady(true)}
      actions={
        <>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? 'Đang xuất...' : 'Export JSON'}</span>
          </button>
          <Link
            href="/admin/import"
            className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-4 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <FileUp className="h-4 w-4" />
            <span>Import JSON</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditingLesson(null);
              setCloningLesson(null);
              setShowComposer(true);
            }}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo bài học</span>
          </button>
        </>
      }
    >
      {() => (
        <div className="space-y-5">
          <AdminToastBridge toastRef={toastRef} />
          <LessonsQuerySync params={lessonsQueryParams} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LegacyStatCard
              label="Tổng bài học"
              value={summary.total}
              subtitle="Catalog hiện có"
              icon={<BookOpen className="h-4 w-4" />}
              tone="green"
            />
            <LegacyStatCard
              label="Đã publish"
              value={summary.published}
              subtitle="Sẵn sàng cho learner"
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="emerald"
            />
            <LegacyStatCard
              label="Bản nháp"
              value={summary.drafts}
              subtitle="Chưa phát hành"
              icon={<FileText className="h-4 w-4" />}
              tone="amber"
            />
            <LegacyStatCard
              label="Item đã gắn"
              value={summary.linkedQuestions}
              subtitle="Tổng liên kết nội dung"
              icon={<ListChecks className="h-4 w-4" />}
              tone="slate"
            />
          </div>

          {bannerError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
              {bannerError}
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearchQuery(searchInput.trim());
              }}
              className="grid grid-cols-1 items-end gap-3 lg:grid-cols-12"
            >
              <div className="lg:col-span-4">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Tìm bài học
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Tiêu đề hoặc slug..."
                    className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Trạng thái
                </label>
                <select
                  value={publishedFilter}
                  onChange={(e) => {
                    setPage(1);
                    setPublishedFilter(
                      e.target.value as '' | 'true' | 'false',
                    );
                  }}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Tất cả</option>
                  <option value="true">Published</option>
                  <option value="false">Bản nháp</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Kỹ năng
                </label>
                <select
                  value={kindFilter}
                  onChange={(e) => {
                    setPage(1);
                    setKindFilter(e.target.value as LearningKind | '');
                  }}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Tất cả</option>
                  <option value="GRAMMAR">Grammar</option>
                  <option value="VOCABULARY">Vocabulary</option>
                  <option value="READING">Reading</option>
                  <option value="LISTENING">Listening</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  CEFR
                </label>
                <select
                  value={cefrFilter}
                  onChange={(e) => {
                    setPage(1);
                    setCefrFilter(e.target.value as CefrLevel | '');
                  }}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Tất cả</option>
                  {CEFR_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 lg:col-span-2">
                <button
                  type="submit"
                  className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
                >
                  Lọc
                </button>
                <button
                  type="button"
                  disabled={!hasActiveFilters}
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 rounded-xl border border-slateDark-200 bg-white px-3 py-2.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Đặt lại bộ lọc</span>
                </button>
              </div>
            </form>

            <div className="flex items-center justify-between text-xs text-slateDark-700">
              <span>
                Hiển thị {lessons.length} / {pagination.total} bài học
              </span>
              {selectedIds.length > 0 && (
                <span className="font-semibold text-brand-700">
                  Đã chọn {selectedIds.length} bài học
                </span>
              )}
            </div>
          </div>

          <LessonsTableSection state={state} />

          {showComposer && (
            <LessonComposerModal
              units={units}
              grammarTopics={grammarTopics}
              editingLesson={editingLesson}
              cloneFrom={cloningLesson}
              onClose={() => {
                setShowComposer(false);
                setEditingLesson(null);
                setCloningLesson(null);
              }}
              onUnitCreated={(newUnit) =>
                setUnits((prev) => [...prev, newUnit])
              }
              onSaved={() => {
                const wasEditing = Boolean(editingLesson);
                const wasCloning = Boolean(cloningLesson);
                setShowComposer(false);
                setEditingLesson(null);
                setCloningLesson(null);
                toastRef.current.success(
                  wasEditing
                    ? 'Đã cập nhật bài học thành công.'
                    : wasCloning
                      ? 'Đã nhân bản bài học mới thành công.'
                      : 'Đã tạo bài học mới thành công.',
                );
                void loadLessons();
              }}
            />
          )}

          <ConfirmDialog
            open={Boolean(deleteTarget)}
            title="Xác nhận xoá bài học"
            tone={
              deleteTarget && deleteTarget.attemptsCount > 0 && !forceDelete
                ? 'warning'
                : 'danger'
            }
            confirmLabel={
              deleteTarget && deleteTarget.attemptsCount > 0 && !forceDelete
                ? 'Chuyển bản nháp'
                : 'Xoá bài học'
            }
            busy={deleting}
            onConfirm={handleConfirmDelete}
            onCancel={() => {
              setDeleteTarget(null);
              setForceDelete(false);
            }}
            description={
              deleteTarget ? (
                <div className="space-y-3">
                  <p>
                    Bài học:{' '}
                    <strong className="text-slateDark-900">
                      {deleteTarget.title}
                    </strong>{' '}
                    (<code className="font-mono text-xs">{deleteTarget.code}</code>
                    )
                  </p>
                  {deleteTarget.attemptsCount > 0 ? (
                    <>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Bài học này đã có{' '}
                        <strong>
                          {deleteTarget.attemptsCount} lượt học viên làm bài
                        </strong>
                        . Mặc định hệ thống sẽ chuyển bài sang{' '}
                        <strong>Bản nháp (Ngừng xuất bản)</strong> để giữ nguyên
                        lịch sử điểm số.
                      </div>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                        <input
                          type="checkbox"
                          checked={forceDelete}
                          onChange={(e) => setForceDelete(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-red-600"
                        />
                        <span>
                          <strong>Xoá cưỡng bức (Force Delete)</strong>: Xoá
                          sạch bài học này cùng toàn bộ{' '}
                          {deleteTarget.attemptsCount} lượt làm bài liên quan.
                        </span>
                      </label>
                    </>
                  ) : (
                    <p className="text-xs text-slateDark-700">
                      Bài học chưa có lượt làm nào và sẽ được xoá vĩnh viễn khỏi
                      cơ sở dữ liệu.
                    </p>
                  )}
                </div>
              ) : null
            }
          />
        </div>
      )}
    </AdminShell>
  );
}
