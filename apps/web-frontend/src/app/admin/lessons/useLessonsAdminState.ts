import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NOOP_ADMIN_TOAST, type AdminToastApi } from '@/components/admin/AdminToast';
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
import type { QueryParamValue } from '@/lib/use-admin-query-params';
import type {
  AdminGrammarTopic,
  AdminLessonItem,
  CefrLevel,
  LearningKind,
  LearningUnitItem,
  LessonsListSummary,
  PaginationMeta,
} from '@/types/admin';
import {
  MAX_BULK_SELECTION,
  readInitialLessonsFilters,
} from './lessons-admin.helpers';

export function useLessonsAdminState() {
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

  return {
    toastRef,
    setAuthReady,
    units,
    setUnits,
    grammarTopics,
    lessons,
    summary,
    pagination,
    page,
    setPage,
    limit,
    setLimit,
    searchInput,
    setSearchInput,
    setSearchQuery,
    publishedFilter,
    setPublishedFilter,
    kindFilter,
    setKindFilter,
    cefrFilter,
    setCefrFilter,
    loading,
    exporting,
    bannerError,
    selectedIds,
    setSelectedIds,
    bulkBusy,
    showComposer,
    setShowComposer,
    editingLesson,
    setEditingLesson,
    cloningLesson,
    setCloningLesson,
    loadingDetailId,
    deleteTarget,
    setDeleteTarget,
    forceDelete,
    setForceDelete,
    deleting,
    lessonsQueryParams,
    hasActiveFilters,
    allPageSelected,
    loadLessons,
    handleResetFilters,
    handleToggleSelectAll,
    handleToggleSelectOne,
    handleBulkPublish,
    handleEditLesson,
    handleCloneLesson,
    handleTogglePublish,
    handleConfirmDelete,
    handleExport,
  };
}

export type LessonsAdminState = ReturnType<typeof useLessonsAdminState>;
