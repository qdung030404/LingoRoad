'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  FileText,
  FileUp,
  ListChecks,
  Plus,
  Search,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import { LessonComposerModal } from '@/components/admin/LessonComposerModal';
import {
  deleteAdminLesson,
  getAdminLesson,
  listAdminLessons,
  listLearningUnits,
  updateAdminLesson,
} from '@/lib/admin-api';
import type {
  AdminLessonItem,
  CefrLevel,
  LearningKind,
  LearningUnitItem,
  LessonsListSummary,
  PaginationMeta,
} from '@/types/admin';

export default function AdminLessonsPage(): React.ReactElement {
  const [units, setUnits] = useState<LearningUnitItem[]>([]);
  const [lessons, setLessons] = useState<AdminLessonItem[]>([]);
  const [summary, setSummary] = useState<LessonsListSummary>({
    total: 0,
    published: 0,
    drafts: 0,
    linkedQuestions: 0,
  });
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [publishedFilter, setPublishedFilter] = useState<'' | 'true' | 'false'>(
    '',
  );
  const [kindFilter, setKindFilter] = useState<LearningKind | ''>('');
  const [cefrFilter, setCefrFilter] = useState<CefrLevel | ''>('');
  const [loading, setLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  const [showComposer, setShowComposer] = useState(false);
  const [editingLesson, setEditingLesson] = useState<AdminLessonItem | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<AdminLessonItem | null>(
    null,
  );
  const [forceDelete, setForceDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUnits = useCallback(async () => {
    try {
      const rows = await listLearningUnits();
      setUnits(rows);
    } catch {
      // Bỏ qua lỗi phụ khi tải chương học
    }
  }, []);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    setBannerError(null);
    try {
      const result = await listAdminLessons({
        page,
        limit,
        search: searchQuery,
        published: publishedFilter,
        kind: kindFilter,
        cefrLevel: cefrFilter,
      });
      setLessons(result.items);
      setPagination(result.pagination);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể tải danh sách bài học.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, publishedFilter, kindFilter, cefrFilter]);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    void loadLessons();
  }, [loadLessons]);

  const handleEditLesson = async (id: string): Promise<void> => {
    setBannerError(null);
    try {
      const detail = await getAdminLesson(id);
      setEditingLesson(detail);
      setShowComposer(true);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể tải chi tiết bài học.',
      );
    }
  };

  const handleTogglePublish = async (lesson: AdminLessonItem): Promise<void> => {
    setBannerError(null);
    setBannerSuccess(null);
    try {
      await updateAdminLesson(lesson.id, { published: !lesson.published });
      setBannerSuccess(
        !lesson.published
          ? `Đã xuất bản bài học "${lesson.title}".`
          : `Đã chuyển "${lesson.title}" về bản nháp.`,
      );
      await loadLessons();
    } catch (err) {
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật trạng thái bài học.',
      );
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const result = await deleteAdminLesson(deleteTarget.id, forceDelete);
      setBannerSuccess(
        result.action === 'DELETED'
          ? `Đã xoá vĩnh viễn bài học "${deleteTarget.title}".`
          : `Bài học "${deleteTarget.title}" đã có ${result.attemptsCount} lượt học nên đã chuyển sang Bản nháp.`,
      );
      setDeleteTarget(null);
      setForceDelete(false);
      await loadLessons();
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể xoá bài học.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminShell
      breadcrumbTitle="Bài học"
      title="Lesson Management"
      subtitle="Quản lý catalog bài học, trạng thái publish và liên kết item."
      actions={
        <>
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
          {/* Hàng 4 thẻ KPI chuẩn Legacy */}
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
          {bannerSuccess && (
            <div className="rounded-2xl border border-brand-200 bg-brand-25 px-5 py-3.5 text-sm font-medium text-brand-800">
              {bannerSuccess}
            </div>
          )}

          {/* Thanh lọc chuẩn Legacy */}
          <div className="rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearchQuery(searchInput);
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
                  {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map(
                    (lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 lg:col-span-2">
                <button
                  type="submit"
                  className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
                >
                  Lọc
                </button>
                <span className="text-xs font-medium text-slateDark-700">
                  {lessons.length} / {pagination.total} bài học
                </span>
              </div>
            </form>
          </div>

          {/* Bảng chuẩn Legacy */}
          <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
                  <tr>
                    <th className="px-6 py-3.5">Thứ tự</th>
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
                        colSpan={6}
                        className="px-6 py-12 text-center text-sm text-slateDark-700"
                      >
                        Đang tải danh sách bài học...
                      </td>
                    </tr>
                  ) : lessons.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-sm text-slateDark-700"
                      >
                        Chưa có bài học nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    lessons.map((lesson, idx) => (
                      <tr key={lesson.id} className="hover:bg-slateDark-25">
                        <td className="px-6 py-4">
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
                                {lesson.code} · {lesson.questionsCount} items
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleEditLesson(lesson.id)}
                              className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50"
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

          {showComposer && (
            <LessonComposerModal
              units={units}
              editingLesson={editingLesson}
              onClose={() => {
                setShowComposer(false);
                setEditingLesson(null);
              }}
              onUnitCreated={(newUnit) =>
                setUnits((prev) => [...prev, newUnit])
              }
              onSaved={() => {
                setShowComposer(false);
                setEditingLesson(null);
                setBannerSuccess(
                  editingLesson
                    ? 'Đã cập nhật bài học thành công.'
                    : 'Đã tạo bài học mới thành công.',
                );
                void loadLessons();
              }}
            />
          )}

          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="w-full max-w-md space-y-4 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-slateDark-900">
                  Xác nhận xoá bài học
                </h2>
                <p className="text-sm text-slateDark-800">
                  Bài học:{' '}
                  <strong className="text-slateDark-900">
                    {deleteTarget.title}
                  </strong>
                </p>

                {deleteTarget.attemptsCount > 0 ? (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                      Bài học này đã có{' '}
                      <strong>
                        {deleteTarget.attemptsCount} lượt học viên làm bài
                      </strong>
                      . Mặc định hệ thống sẽ chuyển bài sang{' '}
                      <strong>Bản nháp (Ngừng xuất bản)</strong> để giữ nguyên
                      lịch sử điểm số.
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
                      <input
                        type="checkbox"
                        checked={forceDelete}
                        onChange={(e) => setForceDelete(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-red-600"
                      />
                      <span>
                        <strong>Xoá cưỡng bức (Force Delete)</strong>: Xoá sạch
                        bài học này cùng toàn bộ {deleteTarget.attemptsCount}{' '}
                        lượt làm bài liên quan.
                      </span>
                    </label>
                  </>
                ) : (
                  <p className="text-xs text-slateDark-700">
                    Bài học chưa có lượt làm nào và sẽ được xoá vĩnh viễn khỏi
                    cơ sở dữ liệu.
                  </p>
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
                    disabled={deleting}
                    onClick={() => void handleConfirmDelete()}
                    className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting
                      ? 'Đang xử lý...'
                      : deleteTarget.attemptsCount > 0 && !forceDelete
                        ? 'Chuyển bản nháp'
                        : 'Xoá bài học'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
