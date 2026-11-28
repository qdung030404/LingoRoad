import type React from 'react';
import {
  useCallback as reactUseCallback,
  useEffect as reactUseEffect,
  useMemo as reactUseMemo,
  useRef as reactUseRef,
  useState as reactUseState,
} from 'react';
import { NOOP_ADMIN_TOAST, type AdminToastApi } from '@/components/admin/AdminToast';
import type * as AdminApi from '@/lib/admin-api';
import type { QueryParamValue } from '@/lib/use-admin-query-params';
import type {
  AdminAssessmentGroup,
  AdminAssessmentItem,
  AssessmentItemsSummary,
  AssessmentSkill,
  CefrDescriptorItem,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  PaginationMeta,
} from '@/types/admin';
import {
  readInitialItemsFilters,
  type SelectedGroupItem,
} from './items-admin.helpers';

export interface ItemsAdminStateDeps {
  useState: typeof reactUseState;
  useEffect: typeof reactUseEffect;
  useCallback: typeof reactUseCallback;
  useMemo: typeof reactUseMemo;
  useRef: typeof reactUseRef;
  useDebouncedValue: <T>(value: T, delay?: number) => T;
  listDescriptors: typeof AdminApi.listDescriptors;
  listAdminAssessmentGroups: typeof AdminApi.listAdminAssessmentGroups;
  listAdminAssessmentItems: typeof AdminApi.listAdminAssessmentItems;
  createAdminAssessmentGroup: typeof AdminApi.createAdminAssessmentGroup;
  updateAdminAssessmentGroup: typeof AdminApi.updateAdminAssessmentGroup;
  deleteAdminAssessmentGroup: typeof AdminApi.deleteAdminAssessmentGroup;
  deleteAdminAssessmentItem: typeof AdminApi.deleteAdminAssessmentItem;
  downloadAdminExport: typeof AdminApi.downloadAdminExport;
}

export function useItemsAdminState(deps: ItemsAdminStateDeps) {
  const {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
    useDebouncedValue,
    listDescriptors,
    listAdminAssessmentGroups,
    listAdminAssessmentItems,
    createAdminAssessmentGroup,
    updateAdminAssessmentGroup,
    deleteAdminAssessmentGroup,
    deleteAdminAssessmentItem,
    downloadAdminExport,
  } = deps;

  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [initialFilters] = useState(readInitialItemsFilters);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'groups'>('items');
  const [descriptors, setDescriptors] = useState<CefrDescriptorItem[]>([]);
  const [allGroupsForSelect, setAllGroupsForSelect] = useState<
    AdminAssessmentGroup[]
  >([]);

  // Items state
  const [items, setItems] = useState<AdminAssessmentItem[]>([]);
  const [summary, setSummary] = useState<AssessmentItemsSummary>({
    total: 0,
    mcqCount: 0,
    clozeAndOtherCount: 0,
    coveredSkillsCount: 0,
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
  const [typeFilter, setTypeFilter] = useState<ItemType | ''>(
    initialFilters.type,
  );
  const [skillFilter, setSkillFilter] = useState<AssessmentSkill | ''>(
    initialFilters.skill,
  );
  const [cefrFilter, setCefrFilter] = useState<CefrLevel | ''>(
    initialFilters.cefr,
  );
  const [usageScopeFilter, setUsageScopeFilter] = useState<ItemUsageScope | ''>(
    initialFilters.scope,
  );
  const [groupIdFilter, setGroupIdFilter] = useState(initialFilters.groupId);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminAssessmentItem | null>(
    null,
  );
  const [cloningItem, setCloningItem] = useState<AdminAssessmentItem | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    useState<AdminAssessmentItem | null>(null);
  const [forceDelete, setForceDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] =
    useState<AdminAssessmentGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Groups tab state
  const [groups, setGroups] = useState<AdminAssessmentGroup[]>([]);
  const [groupsPagination, setGroupsPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [groupsPage, setGroupsPage] = useState(1);
  const [groupsLimit, setGroupsLimit] = useState(10);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminAssessmentGroup | null>(
    null,
  );
  const [gSkill, setGSkill] = useState<AssessmentSkill>('READING');
  const [gCefr, setGCefr] = useState<CefrLevel>('B1');
  const [gScope, setGScope] = useState<ItemUsageScope>('MOCK_EXAM');
  const [gPartNumber, setGPartNumber] = useState(1);
  const [gTitle, setGTitle] = useState('');
  const [gPassage, setGPassage] = useState('');
  const [gAudioUrl, setGAudioUrl] = useState('');
  const [gTranscript, setGTranscript] = useState('');
  const [gSelectedItems, setGSelectedItems] = useState<SelectedGroupItem[]>([]);
  const [gItemSearch, setGItemSearch] = useState('');
  const debouncedGItemSearch = useDebouncedValue(gItemSearch, 300);
  const [gPickerResults, setGPickerResults] = useState<AdminAssessmentItem[]>(
    [],
  );
  const [gPickerLoading, setGPickerLoading] = useState(false);
  const [gPickerError, setGPickerError] = useState<string | null>(null);
  const gPickerRequestIdRef = useRef(0);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const loadDescriptors = useCallback(async () => {
    try {
      const [descRows, grpRes] = await Promise.all([
        listDescriptors(),
        listAdminAssessmentGroups({ page: 1, limit: 100 }),
      ]);
      setDescriptors(descRows);
      setAllGroupsForSelect(grpRes.items);
    } catch {
      // Bỏ qua lỗi phụ
    }
  }, [listDescriptors, listAdminAssessmentGroups]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setBannerError(null);
    try {
      const result = await listAdminAssessmentItems({
        page,
        limit,
        search: searchQuery,
        type: typeFilter,
        skill: skillFilter,
        cefrLevel: cefrFilter,
        usageScope: usageScopeFilter,
        groupId: groupIdFilter || undefined,
      });
      setItems(result.items);
      setPagination(result.pagination);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (err) {
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách câu hỏi.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    listAdminAssessmentItems,
    page,
    limit,
    searchQuery,
    typeFilter,
    skillFilter,
    cefrFilter,
    usageScopeFilter,
    groupIdFilter,
  ]);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    setBannerError(null);
    try {
      const result = await listAdminAssessmentGroups({
        page: groupsPage,
        limit: groupsLimit,
        skill: skillFilter,
        cefrLevel: cefrFilter,
        usageScope: usageScopeFilter,
        search: searchQuery,
      });
      setGroups(result.items);
      setGroupsPagination(result.pagination);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể tải danh sách nhóm đề.',
      );
    } finally {
      setGroupsLoading(false);
    }
  }, [
    listAdminAssessmentGroups,
    groupsPage,
    groupsLimit,
    skillFilter,
    cefrFilter,
    usageScopeFilter,
    searchQuery,
  ]);

  const itemsQueryParams = useMemo<Record<string, QueryParamValue>>(
    () => ({
      page,
      limit,
      search: searchQuery,
      skill: skillFilter,
      cefr: cefrFilter,
      type: typeFilter,
      scope: usageScopeFilter,
      groupId: groupIdFilter,
    }),
    [
      page,
      limit,
      searchQuery,
      skillFilter,
      cefrFilter,
      typeFilter,
      usageScopeFilter,
      groupIdFilter,
    ],
  );

  const hasActiveFilters = Boolean(
    searchInput.trim() ||
      searchQuery.trim() ||
      skillFilter ||
      cefrFilter ||
      usageScopeFilter ||
      (activeTab === 'items' && (typeFilter || groupIdFilter)),
  );

  const handleResetFilters = (): void => {
    setPage(1);
    setGroupsPage(1);
    setSearchInput('');
    setSearchQuery('');
    setTypeFilter('');
    setSkillFilter('');
    setCefrFilter('');
    setUsageScopeFilter('');
    setGroupIdFilter('');
  };

  useEffect(() => {
    if (!authReady) return;
    void loadDescriptors();
  }, [authReady, loadDescriptors]);

  useEffect(() => {
    if (!authReady) return;
    if (activeTab === 'items') {
      void loadItems();
    } else {
      void loadGroups();
    }
  }, [authReady, activeTab, loadItems, loadGroups]);

  useEffect(() => {
    if (!authReady || !showGroupModal) return;
    const requestId = ++gPickerRequestIdRef.current;
    setGPickerLoading(true);
    setGPickerError(null);
    void listAdminAssessmentItems({
      page: 1,
      limit: 20,
      search: debouncedGItemSearch,
      skill: gSkill,
      cefrLevel: gCefr,
    })
      .then((res) => {
        if (requestId !== gPickerRequestIdRef.current) return;
        setGPickerResults(res.items);
      })
      .catch((err) => {
        if (requestId !== gPickerRequestIdRef.current) return;
        setGPickerError(
          err instanceof Error
            ? err.message
            : 'Không thể tìm danh sách câu hỏi để gắn vào nhóm.',
        );
      })
      .finally(() => {
        if (requestId === gPickerRequestIdRef.current) {
          setGPickerLoading(false);
        }
      });
  }, [
    listAdminAssessmentItems,
    authReady,
    showGroupModal,
    debouncedGItemSearch,
    gSkill,
    gCefr,
  ]);

  const selectedGroupItemIds = useMemo(
    () => new Set(gSelectedItems.map((item) => item.id)),
    [gSelectedItems],
  );

  const availablePickerItems = useMemo(
    () => gPickerResults.filter((item) => !selectedGroupItemIds.has(item.id)),
    [gPickerResults, selectedGroupItemIds],
  );

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    setBannerError(null);
    try {
      await deleteAdminAssessmentItem(deleteTarget.id, forceDelete);
      toastRef.current.success('Đã xoá câu hỏi khỏi Item Bank.');
      setDeleteTarget(null);
      setForceDelete(false);
      await loadItems();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể xoá câu hỏi.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const openGroupModal = (group: AdminAssessmentGroup | null): void => {
    setEditingGroup(group);
    setGSkill(group?.skill ?? 'READING');
    setGCefr(group?.cefrLevel ?? 'B1');
    setGScope(group?.usageScope ?? 'MOCK_EXAM');
    setGPartNumber(group?.partNumber ?? 1);
    setGTitle(group?.title ?? '');
    setGPassage(group?.passage ?? '');
    setGAudioUrl(group?.audioUrl ?? '');
    setGTranscript(group?.transcript ?? '');
    setGSelectedItems(
      [...(group?.items ?? [])]
        .sort((a, b) => a.itemOrder - b.itemOrder)
        .map((item) => ({
          id: item.id,
          externalId: item.externalId,
          skillCode: item.skillCode,
          type: item.type,
          prompt: item.prompt,
        })),
    );
    setGItemSearch('');
    setGPickerResults([]);
    setGPickerError(null);
    setGroupError(null);
    setShowGroupModal(true);
  };

  const handleMoveSelectedItem = (index: number, direction: -1 | 1): void => {
    setGSelectedItems((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleRemoveSelectedItem = (itemId: string): void => {
    setGSelectedItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleAddSelectedItem = (candidate: AdminAssessmentItem): void => {
    setGSelectedItems((prev) => {
      if (prev.some((item) => item.id === candidate.id)) return prev;
      const belongsToOtherGroup = Boolean(
        candidate.groupId && candidate.groupId !== editingGroup?.id,
      );
      return [
        ...prev,
        {
          id: candidate.id,
          externalId: candidate.externalId,
          skillCode: candidate.skillCode,
          type: candidate.type,
          prompt: candidate.prompt,
          fromOtherGroupLabel: belongsToOtherGroup
            ? candidate.group
              ? `P${candidate.group.partNumber}`
              : 'Nhóm khác'
            : null,
          responsesCount: candidate.responsesCount,
        },
      ];
    });
  };

  const handleSaveGroup = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setGroupError(null);
    setSavingGroup(true);
    try {
      const itemIds = gSelectedItems.map((item) => item.id);
      if (editingGroup) {
        await updateAdminAssessmentGroup(editingGroup.id, {
          skill: gSkill,
          cefrLevel: gCefr,
          usageScope: gScope,
          partNumber: gPartNumber,
          title: gTitle.trim() || null,
          passage: gPassage.trim() || null,
          audioUrl: gSkill === 'LISTENING' ? gAudioUrl.trim() || null : null,
          transcript: gSkill === 'LISTENING' ? gTranscript.trim() || null : null,
          itemIds,
        });
        toastRef.current.success('Đã cập nhật nhóm câu hỏi.');
      } else {
        await createAdminAssessmentGroup({
          skill: gSkill,
          cefrLevel: gCefr,
          usageScope: gScope,
          partNumber: gPartNumber,
          title: gTitle.trim() || undefined,
          passage: gPassage.trim() || undefined,
          audioUrl:
            gSkill === 'LISTENING' ? gAudioUrl.trim() || undefined : undefined,
          transcript:
            gSkill === 'LISTENING' ? gTranscript.trim() || undefined : undefined,
          itemIds,
        });
        toastRef.current.success('Đã tạo nhóm câu hỏi mới.');
      }
      setShowGroupModal(false);
      await Promise.all([loadGroups(), loadDescriptors()]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể lưu nhóm câu hỏi.';
      setGroupError(msg);
      toastRef.current.error(msg);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleConfirmDeleteGroup = async (): Promise<void> => {
    if (!deleteGroupTarget || deletingGroup) return;
    setDeletingGroup(true);
    setBannerError(null);
    try {
      const res = await deleteAdminAssessmentGroup(deleteGroupTarget.id);
      toastRef.current.success(
        `Đã xoá nhóm câu hỏi (gỡ liên kết ${res.detachedItemsCount} câu hỏi).`,
      );
      setDeleteGroupTarget(null);
      await Promise.all([loadGroups(), loadDescriptors()]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Xoá nhóm thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setDeletingGroup(false);
    }
  };

  const needsForceDelete = Boolean(
    deleteTarget &&
      (deleteTarget.responsesCount > 0 ||
        (deleteTarget.activeSessionsCount ?? 0) > 0),
  );

  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    setBannerError(null);
    try {
      await downloadAdminExport('items', 'csv');
      toastRef.current.success('Đã xuất ngân hàng câu hỏi (CSV).');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Xuất ngân hàng đề thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setExporting(false);
    }
  };

  return {
    toastRef,
    setAuthReady,
    activeTab,
    setActiveTab,
    descriptors,
    allGroupsForSelect,
    items,
    summary,
    pagination,
    setPage,
    setLimit,
    searchInput,
    setSearchInput,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    skillFilter,
    setSkillFilter,
    cefrFilter,
    setCefrFilter,
    usageScopeFilter,
    setUsageScopeFilter,
    groupIdFilter,
    setGroupIdFilter,
    loading,
    exporting,
    bannerError,
    showModal,
    setShowModal,
    editingItem,
    setEditingItem,
    cloningItem,
    setCloningItem,
    deleteTarget,
    setDeleteTarget,
    forceDelete,
    setForceDelete,
    deleting,
    deleteGroupTarget,
    setDeleteGroupTarget,
    deletingGroup,
    groups,
    groupsPagination,
    setGroupsPage,
    groupsLimit,
    setGroupsLimit,
    groupsLoading,
    showGroupModal,
    setShowGroupModal,
    editingGroup,
    gSkill,
    setGSkill,
    gCefr,
    setGCefr,
    gScope,
    setGScope,
    gPartNumber,
    setGPartNumber,
    gTitle,
    setGTitle,
    gPassage,
    setGPassage,
    gAudioUrl,
    setGAudioUrl,
    gTranscript,
    setGTranscript,
    gSelectedItems,
    gItemSearch,
    setGItemSearch,
    gPickerLoading,
    gPickerError,
    savingGroup,
    groupError,
    itemsQueryParams,
    hasActiveFilters,
    availablePickerItems,
    needsForceDelete,
    loadItems,
    handleResetFilters,
    handleConfirmDelete,
    openGroupModal,
    handleMoveSelectedItem,
    handleRemoveSelectedItem,
    handleAddSelectedItem,
    handleSaveGroup,
    handleConfirmDeleteGroup,
    handleExport,
  };
}

export type ItemsAdminState = ReturnType<typeof useItemsAdminState>;
