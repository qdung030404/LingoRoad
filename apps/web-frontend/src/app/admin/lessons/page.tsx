'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  FileUp,
  ListChecks,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  NOOP_ADMIN_TOAST,
  useAdminToast,
  type AdminToastApi,
} from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import { LessonComposerModal } from '@/components/admin/LessonComposerModal';
import {
  bulkPublishAdminLessons,
  deleteAdminLesson,
  downloadAdminExport,
  getAdminLesson,
  listAdminGrammarTopics,
  listAdminLessons,
  listLearningUnits,
  updateAdminLesson,
} from '@/lib/admin-api';
import {
  parseEnumParam,
  parsePositiveIntParam,
  useSyncAdminQueryParams,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import type {
  AdminGrammarTopic,
  AdminLessonItem,
  CefrLevel,
  LearningKind,
  LearningUnitItem,
  LessonsListSummary,
  PaginationMeta,
} from '@/types/admin';

const LEARNING_KINDS: readonly LearningKind[] = [
  'GRAMMAR',
  'VOCABULARY',
  'READING',
  'LISTENING',
];
const CEFR_LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const PUBLISHED_OPTIONS = ['true', 'false'] as const;
const PAGE_LIMITS = [10, 20, 50] as const;
const MAX_BULK_SELECTION = 100;
const LESSONS_QUERY_DEFAULTS: Record<string, QueryParamValue> = {
  page: 1,
  limit: 10,
};

function readInitialLessonsFilters(): {
  page: number;
  limit: number;
  search: string;
  published: '' | 'true' | 'false';
  kind: LearningKind | '';
  cefr: CefrLevel | '';
} {
  const sp =
    typeof window !== 'undefined' && typeof window.location?.search === 'string'
      ? new URLSearchParams(window.location.search)
      : null;
  const parsedLimit = parsePositiveIntParam(sp?.get('limit'), 10);
  const limit = (PAGE_LIMITS as readonly number[]).includes(parsedLimit)
    ? parsedLimit
    : 10;
  return {
    page: parsePositiveIntParam(sp?.get('page'), 1),
    limit,
    search: sp?.get('search')?.trim() ?? '',
    published: parseEnumParam(sp?.get('published'), PUBLISHED_OPTIONS),
    kind: parseEnumParam(sp?.get('kind'), LEARNING_KINDS),
    cefr: parseEnumParam(sp?.get('cefr'), CEFR_LEVELS),
  };
}

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
  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [initialFilters] = useState(readInitialLessonsFilters);
  const [authReady, setAuthReady] = useState(false);
  const [units, setUnits] = useState<LearningUnitItem[]>([]);
  const [grammarTopics, setGrammarTopics] = useState<AdminGrammarTopic[]>([]);
  const [lessons, setLessons] = useState<AdminLessonItem[]>([]);
  const [summary, setSummary] = useState<LessonsListSummary>({
    total: 0,
    published: 0,
    drafts: 0,
    linkedQuestions: 0,
  });
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: initialFilters.page,
    limit: initialFilters.limit,
    total: 0,
    totalPages: 0,
  });

  const [page, setPage] = useState(initialFilters.page);
  const [limit, setLimit] = useState(initialFilters.limit);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  const [publishedFilter, setPublishedFilter] = useState<'' | 'true' | 'false'>(
    initialFilters.published,
  );
  const [kindFilter, setKindFilter] = useState<LearningKind | ''>(
    initialFilters.kind,
  );
  const [cefrFilter, setCefrFilter] = useState<CefrLevel | ''>(
    initialFilters.cefr,
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [showComposer, setShowComposer] = useState(false);
  const [editingLesson, setEditingLesson] = useState<AdminLessonItem | null>(
    null,
  );
  const [cloningLesson, setCloningLesson] = useState<AdminLessonItem | null>(
    null,
  );
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminLessonItem | null>(
    null,
  );
  const [forceDelete, setForceDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const lessonsQueryParams = useMemo<Record<string, QueryParamValue>>(
    () => ({
      page,
      limit,
      search: searchQuery,
      published: publishedFilter,
      kind: kindFilter,
      cefr: cefrFilter,
    }),
    [page, limit, searchQuery, publishedFilter, kindFilter, cefrFilter],
  );

  const hasActiveFilters = Boolean(
    searchInput.trim() ||
      searchQuery.trim() ||
      publishedFilter ||
      kindFilter ||
      cefrFilter,
  );

  const handleResetFilters = (): void => {
    setPage(1);
    setSearchInput('');
    setSearchQuery('');
    setPublishedFilter('');
    setKindFilter('');
    setCefrFilter('');
  };

  const loadUnits = useCallback(async () => {
    try {
      const [rows, topics] = await Promise.all([
        listLearningUnits(),
        listAdminGrammarTopics({ isLeaf: 'true' }),
      ]);
      setUnits(rows);
      setGrammarTopics(topics);
    } catch {
      // Bỏ qua lỗi phụ khi tải chương học / ngữ pháp
    }
  }, []);

  const loadLessons = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setBannerError(null);
    setSelectedIds([]);
    try {
      const result = await listAdminLessons({
        page,
        limit,
        search: searchQuery,
        published: publishedFilter,
        kind: kindFilter,
        cefrLevel: cefrFilter,
      });
      if (requestId !== requestIdRef.current) return;
      setLessons(result.items);
      setPagination(result.pagination);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setBannerError(
        err instanceof Error ? err.message : 'Không thể tải danh sách bài học.',
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, limit, searchQuery, publishedFilter, kindFilter, cefrFilter]);

  useEffect(() => {
    if (!authReady) return;
    void loadUnits();
  }, [authReady, loadUnits]);

  useEffect(() => {
    if (!authReady) return;
    void loadLessons();
  }, [authReady, loadLessons]);

  const allPageSelected =
    lessons.length > 0 && lessons.every((l) => selectedIds.includes(l.id));

  const handleToggleSelectAll = (): void => {
    if (allPageSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(lessons.slice(0, MAX_BULK_SELECTION).map((l) => l.id));
  };

  const handleToggleSelectOne = (id: string): void => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_BULK_SELECTION) {
        toastRef.current.error(
          `Chỉ có thể chọn tối đa ${MAX_BULK_SELECTION} bài học mỗi lần.`,
        );
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleBulkPublish = async (published: boolean): Promise<void> => {
    if (selectedIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBannerError(null);
    try {
      const ids = selectedIds.slice(0, MAX_BULK_SELECTION);
      const res = await bulkPublishAdminLessons(ids, published);
      toastRef.current.success(
        published
          ? `Đã xuất bản hàng loạt ${res.updatedCount} bài học.`
          : `Đã chuyển ${res.updatedCount} bài học về bản nháp.`,
      );
      setSelectedIds([]);
      await loadLessons();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật trạng thái hàng loạt.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleEditLesson = async (id: string): Promise<void> => {
    if (loadingDetailId) return;
    setLoadingDetailId(id);
    setBannerError(null);
    try {
      const detail = await getAdminLesson(id);
      setCloningLesson(null);
      setEditingLesson(detail);
      setShowComposer(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể tải chi tiết bài học.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setLoadingDetailId(null);
    }
  };

  const handleCloneLesson = async (id: string): Promise<void> => {
    if (loadingDetailId) return;
    setLoadingDetailId(id);
    setBannerError(null);
    try {
      const detail = await getAdminLesson(id);
      setEditingLesson(null);
      setCloningLesson(detail);
      setShowComposer(true);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu bài học để nhân bản.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setLoadingDetailId(null);
    }
  };

  const handleTogglePublish = async (lesson: AdminLessonItem): Promise<void> => {
    setBannerError(null);
    try {
      await updateAdminLesson(lesson.id, { published: !lesson.published });
      toastRef.current.success(
        !lesson.published
          ? `Đã xuất bản bài học "${lesson.title}".`
          : `Đã chuyển "${lesson.title}" về bản nháp.`,
      );
      await loadLessons();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật trạng thái bài học.';
      setBannerError(msg);
      toastRef.current.error(msg);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setBannerError(null);
    try {
      const result = await deleteAdminLesson(deleteTarget.id, forceDelete);
      toastRef.current.success(
        result.action === 'DELETED'
          ? `Đã xoá vĩnh viễn bài học "${deleteTarget.title}".`
          : `Bài học "${deleteTarget.title}" đã có ${result.attemptsCount} lượt học nên đã chuyển sang Bản nháp.`,
      );
      setDeleteTarget(null);
      setForceDelete(false);
      await loadLessons();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể xoá bài học.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    setBannerError(null);
    try {
      await downloadAdminExport('lessons', 'json');
      toastRef.current.success('Đã xuất dữ liệu bài học (JSON).');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Xuất dữ liệu bài học thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setExporting(false);
    }
  };

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

          {/* Thanh lọc chuẩn Legacy */}
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

          {/* Thanh hành động hàng loạt */}
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

          {/* Bảng chuẩn Legacy */}
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
