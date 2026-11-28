import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NOOP_ADMIN_TOAST, type AdminToastApi } from '@/components/admin/AdminToast';
import {
  bulkPublishAdminSpeakingPrompts,
  deleteAdminSpeakingPrompt,
  downloadAdminExport,
  expireAdminSpeakingSubmission,
  getAdminSpeakingSubmission,
  listAdminSpeakingPrompts,
  listAdminSpeakingSubmissions,
  retryAdminSpeakingSubmissionContent,
  updateAdminSpeakingPrompt,
} from '@/lib/admin-api';
import type {
  QueryParamValue,
  UseAdminQueryParamsResult,
} from '@/lib/use-admin-query-params';
import type {
  AdminSpeakingPrompt,
  AdminSpeakingSubmissionDetail,
  AdminSpeakingSubmissionItem,
  AdminSpeakingSubmissionsSummary,
  PaginationMeta,
  SpeakingMode,
  SpeakingPromptsSummary,
  SpeakingStatus,
} from '@/types/admin';
import {
  MAX_BULK_SELECTION,
  parsePromptSnapshot,
  parseSpeakingFilters,
  parseSpeakingSubmissionResult,
  readInitialSpeakingFilters,
  type SpeakingAdminTab,
} from './speaking-admin.helpers';
import { useSpeakingVoiceState } from './useSpeakingVoiceState';

export function useSpeakingAdminState() {
  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [initialFilters] = useState(readInitialSpeakingFilters);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<SpeakingAdminTab>(
    initialFilters.tab,
  );
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // ================= TAB 1: SPEAKING PROMPTS =================
  const [prompts, setPrompts] = useState<AdminSpeakingPrompt[]>([]);
  const [promptsSummary, setPromptsSummary] = useState<SpeakingPromptsSummary>({
    total: 0,
    published: 0,
    readAloud: 0,
    topic: 0,
    pictureDescription: 0,
    tongueTwister: 0,
  });
  const [promptsPagination, setPromptsPagination] = useState<PaginationMeta>({
    page: initialFilters.tab === 'prompts' ? initialFilters.page : 1,
    limit: initialFilters.tab === 'prompts' ? initialFilters.limit : 10,
    total: 0,
    totalPages: 0,
  });
  const [promptsPage, setPromptsPage] = useState(
    initialFilters.tab === 'prompts' ? initialFilters.page : 1,
  );
  const [promptsLimit, setPromptsLimit] = useState(
    initialFilters.tab === 'prompts' ? initialFilters.limit : 10,
  );
  const [promptModeFilter, setPromptModeFilter] = useState<SpeakingMode | ''>(
    initialFilters.tab === 'prompts' ? initialFilters.mode : '',
  );
  const [promptPublishedFilter, setPromptPublishedFilter] = useState<
    '' | 'true' | 'false'
  >(initialFilters.tab === 'prompts' ? initialFilters.published : '');
  const [promptSearchInput, setPromptSearchInput] = useState(
    initialFilters.tab === 'prompts' ? initialFilters.search : '',
  );
  const [promptSearchQuery, setPromptSearchQuery] = useState(
    initialFilters.tab === 'prompts' ? initialFilters.search : '',
  );
  const [promptsLoading, setPromptsLoading] = useState(true);
  const promptsReqRef = useRef(0);

  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingPrompt, setEditingPrompt] =
    useState<AdminSpeakingPrompt | null>(null);
  const [cloningPrompt, setCloningPrompt] =
    useState<AdminSpeakingPrompt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminSpeakingPrompt | null>(
    null,
  );
  const [forceDelete, setForceDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ================= TAB 2: SPEAKING SUBMISSIONS =================
  const [submissions, setSubmissions] = useState<AdminSpeakingSubmissionItem[]>(
    [],
  );
  const [subSummary, setSubSummary] = useState<AdminSpeakingSubmissionsSummary>(
    {
      failed: 0,
      unknown: 0,
      stuckProcessing: 0,
      contentUnavailable: 0,
    },
  );
  const [subPagination, setSubPagination] = useState<PaginationMeta>({
    page: initialFilters.tab === 'submissions' ? initialFilters.page : 1,
    limit: initialFilters.tab === 'submissions' ? initialFilters.limit : 10,
    total: 0,
    totalPages: 0,
  });
  const [subPage, setSubPage] = useState(
    initialFilters.tab === 'submissions' ? initialFilters.page : 1,
  );
  const [subLimit, setSubLimit] = useState(
    initialFilters.tab === 'submissions' ? initialFilters.limit : 10,
  );
  const [subStatusFilter, setSubStatusFilter] = useState<SpeakingStatus | ''>(
    initialFilters.subStatus,
  );
  const [subModeFilter, setSubModeFilter] = useState<SpeakingMode | ''>(
    initialFilters.tab === 'submissions' ? initialFilters.mode : '',
  );
  const [subErrorCodeInput, setSubErrorCodeInput] = useState(
    initialFilters.errorCode,
  );
  const [subErrorCodeQuery, setSubErrorCodeQuery] = useState(
    initialFilters.errorCode,
  );
  const [subSearchInput, setSubSearchInput] = useState(
    initialFilters.tab === 'submissions' ? initialFilters.search : '',
  );
  const [subSearchQuery, setSubSearchQuery] = useState(
    initialFilters.tab === 'submissions' ? initialFilters.search : '',
  );
  const [subsLoading, setSubsLoading] = useState(false);
  const subsReqRef = useRef(0);

  // Submission Drawer
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [subDetail, setSubDetail] =
    useState<AdminSpeakingSubmissionDetail | null>(null);
  const [subDetailLoading, setSubDetailLoading] = useState(false);
  const [subDetailError, setSubDetailError] = useState<string | null>(null);
  const subDetailReqRef = useRef(0);
  const [retryingSubContent, setRetryingSubContent] = useState(false);
  const [expireSubTarget, setExpireSubTarget] =
    useState<AdminSpeakingSubmissionDetail | null>(null);
  const [expiringSub, setExpiringSub] = useState(false);

  // ================= TAB 3: VOICE CONVERSATIONS =================
  const voice = useSpeakingVoiceState({
    initialFilters,
    toastRef,
    setBannerError,
  });
  const {
    voiceRows,
    voiceSummary,
    voicePagination,
    voicePage,
    setVoicePage,
    voiceLimit,
    setVoiceLimit,
    voiceStatusFilter,
    setVoiceStatusFilter,
    voiceAssessmentFilter,
    setVoiceAssessmentFilter,
    voiceStuckOnly,
    setVoiceStuckOnly,
    voiceSearchInput,
    setVoiceSearchInput,
    voiceSearchQuery,
    setVoiceSearchQuery,
    voiceLoading,
    selectedVoiceId,
    setSelectedVoiceId,
    voiceDetail,
    setVoiceDetail,
    voiceDetailLoading,
    voiceDetailError,
    releaseLockTarget,
    setReleaseLockTarget,
    releasingLock,
    retryingVoiceContent,
    loadVoiceConversations,
    openVoiceDrawer,
    handleResetVoiceFilters,
    handleConfirmReleaseVoiceLock,
    handleRetryVoiceContent,
    canRetryVoiceContent,
    sortedVoiceTurns,
    parsedVoiceAssessment,
    hasActiveVoiceFilters,
  } = voice;

  // ================= URL QUERY SYNC =================
  const activeQueryParams = useMemo<Record<string, QueryParamValue>>(() => {
    if (activeTab === 'submissions') {
      return {
        tab: 'submissions',
        page: subPage,
        limit: subLimit,
        status: subStatusFilter,
        mode: subModeFilter,
        errorCode: subErrorCodeQuery,
        search: subSearchQuery,
      };
    }
    if (activeTab === 'voice') {
      return {
        tab: 'voice',
        page: voicePage,
        limit: voiceLimit,
        status: voiceStatusFilter,
        assessmentStatus: voiceAssessmentFilter,
        stuckOnly: voiceStuckOnly ? 'true' : '',
        search: voiceSearchQuery,
      };
    }
    return {
      tab: 'prompts',
      page: promptsPage,
      limit: promptsLimit,
      mode: promptModeFilter,
      published: promptPublishedFilter,
      search: promptSearchQuery,
    };
  }, [
    activeTab,
    subPage,
    subLimit,
    subStatusFilter,
    subModeFilter,
    subErrorCodeQuery,
    subSearchQuery,
    voicePage,
    voiceLimit,
    voiceStatusFilter,
    voiceAssessmentFilter,
    voiceStuckOnly,
    voiceSearchQuery,
    promptsPage,
    promptsLimit,
    promptModeFilter,
    promptPublishedFilter,
    promptSearchQuery,
  ]);

  const handleExternalQueryChange = useCallback(
    (api: UseAdminQueryParamsResult): void => {
      const next = parseSpeakingFilters((key) => api.getParam(key) || null);
      setActiveTab(next.tab);
      if (next.tab === 'prompts') {
        setPromptsPage(next.page);
        setPromptsLimit(next.limit);
        setPromptModeFilter(next.mode);
        setPromptPublishedFilter(next.published);
        setPromptSearchInput(next.search);
        setPromptSearchQuery(next.search);
      } else if (next.tab === 'submissions') {
        setSubPage(next.page);
        setSubLimit(next.limit);
        setSubStatusFilter(next.subStatus);
        setSubModeFilter(next.mode);
        setSubErrorCodeInput(next.errorCode);
        setSubErrorCodeQuery(next.errorCode);
        setSubSearchInput(next.search);
        setSubSearchQuery(next.search);
      } else {
        setVoicePage(next.page);
        setVoiceLimit(next.limit);
        setVoiceStatusFilter(next.voiceStatus);
        setVoiceAssessmentFilter(next.assessmentStatus);
        setVoiceStuckOnly(next.stuckOnly);
        setVoiceSearchInput(next.search);
        setVoiceSearchQuery(next.search);
      }
    },
    [
      setVoicePage,
      setVoiceLimit,
      setVoiceStatusFilter,
      setVoiceAssessmentFilter,
      setVoiceStuckOnly,
      setVoiceSearchInput,
      setVoiceSearchQuery,
    ],
  );

  // ================= LOADERS =================
  const loadPrompts = useCallback(async () => {
    const reqId = ++promptsReqRef.current;
    setPromptsLoading(true);
    setBannerError(null);
    setSelectedPromptIds([]);
    try {
      const res = await listAdminSpeakingPrompts({
        page: promptsPage,
        limit: promptsLimit,
        search: promptSearchQuery,
        mode: promptModeFilter,
        published: promptPublishedFilter,
      });
      if (reqId !== promptsReqRef.current) return;
      setPrompts(res.items);
      setPromptsPagination(res.pagination);
      if (res.summary) setPromptsSummary(res.summary);
    } catch (err) {
      if (reqId !== promptsReqRef.current) return;
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách đề luyện nói.',
      );
    } finally {
      if (reqId === promptsReqRef.current) {
        setPromptsLoading(false);
      }
    }
  }, [
    promptsPage,
    promptsLimit,
    promptSearchQuery,
    promptModeFilter,
    promptPublishedFilter,
  ]);

  const loadSubmissions = useCallback(async () => {
    const reqId = ++subsReqRef.current;
    setSubsLoading(true);
    setBannerError(null);
    try {
      const res = await listAdminSpeakingSubmissions({
        page: subPage,
        limit: subLimit,
        status: subStatusFilter,
        mode: subModeFilter,
        errorCode: subErrorCodeQuery,
        search: subSearchQuery,
      });
      if (reqId !== subsReqRef.current) return;
      setSubmissions(res.items);
      setSubPagination(res.pagination);
      if (res.summary) setSubSummary(res.summary);
    } catch (err) {
      if (reqId !== subsReqRef.current) return;
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách bài nộp Speaking.',
      );
    } finally {
      if (reqId === subsReqRef.current) {
        setSubsLoading(false);
      }
    }
  }, [
    subPage,
    subLimit,
    subStatusFilter,
    subModeFilter,
    subErrorCodeQuery,
    subSearchQuery,
  ]);

  useEffect(() => {
    if (!authReady) return;
    if (activeTab === 'prompts') {
      void loadPrompts();
    } else if (activeTab === 'submissions') {
      void loadSubmissions();
    } else {
      void loadVoiceConversations();
    }
  }, [authReady, activeTab, loadPrompts, loadSubmissions, loadVoiceConversations]);

  // Escape closes drawers when no ConfirmDialog is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedSubId && !selectedVoiceId) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (expireSubTarget || releaseLockTarget || deleteTarget) return;
      if (selectedSubId) {
        setSelectedSubId(null);
        setSubDetail(null);
      }
      if (selectedVoiceId) {
        setSelectedVoiceId(null);
        setVoiceDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedSubId,
    selectedVoiceId,
    expireSubTarget,
    releaseLockTarget,
    deleteTarget,
    setSelectedVoiceId,
    setVoiceDetail,
  ]);

  // ================= TAB 1 HANDLERS =================
  const hasActivePromptFilters = Boolean(
    promptModeFilter ||
      promptPublishedFilter ||
      promptSearchInput.trim() ||
      promptSearchQuery.trim(),
  );

  const handleResetPromptFilters = (): void => {
    setPromptsPage(1);
    setPromptModeFilter('');
    setPromptPublishedFilter('');
    setPromptSearchInput('');
    setPromptSearchQuery('');
  };

  const allPromptsSelected =
    prompts.length > 0 &&
    prompts.every((p) => selectedPromptIds.includes(p.id));

  const handleToggleSelectAllPrompts = (): void => {
    if (allPromptsSelected) {
      setSelectedPromptIds([]);
      return;
    }
    setSelectedPromptIds(prompts.slice(0, MAX_BULK_SELECTION).map((p) => p.id));
  };

  const handleToggleSelectPrompt = (id: string): void => {
    setSelectedPromptIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_BULK_SELECTION) {
        toastRef.current.error(
          `Chỉ có thể chọn tối đa ${MAX_BULK_SELECTION} đề luyện nói mỗi lần.`,
        );
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleBulkPublishPrompts = async (
    published: boolean,
  ): Promise<void> => {
    if (selectedPromptIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBannerError(null);
    try {
      const ids = selectedPromptIds.slice(0, MAX_BULK_SELECTION);
      const res = await bulkPublishAdminSpeakingPrompts(ids, published);
      toastRef.current.success(
        published
          ? `Đã xuất bản hàng loạt ${res.updatedCount} đề luyện nói.`
          : `Đã chuyển ${res.updatedCount} đề luyện nói về bản nháp.`,
      );
      setSelectedPromptIds([]);
      await loadPrompts();
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

  const handleTogglePublish = async (
    prompt: AdminSpeakingPrompt,
  ): Promise<void> => {
    setBannerError(null);
    try {
      await updateAdminSpeakingPrompt(prompt.id, {
        published: !prompt.published,
      });
      toastRef.current.success(
        !prompt.published
          ? `Đã xuất bản đề "${prompt.title}".`
          : `Đã chuyển đề "${prompt.title}" về bản nháp.`,
      );
      await loadPrompts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cập nhật thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setBannerError(null);
    try {
      const res = await deleteAdminSpeakingPrompt(deleteTarget.id, forceDelete);
      toastRef.current.success(
        res.action === 'DELETED'
          ? `Đã xoá đề luyện nói "${deleteTarget.title}".`
          : `Đề "${deleteTarget.title}" đã có ${res.submissionsCount} bài nộp nên đã chuyển sang Bản nháp.`,
      );
      setDeleteTarget(null);
      setForceDelete(false);
      await loadPrompts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Xoá đề thất bại.';
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
      await downloadAdminExport('speaking', 'json');
      toastRef.current.success('Đã xuất dữ liệu đề luyện nói (JSON).');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Xuất dữ liệu đề luyện nói thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setExporting(false);
    }
  };

  // ================= TAB 2 HANDLERS =================
  const hasActiveSubFilters = Boolean(
    subStatusFilter ||
      subModeFilter ||
      subErrorCodeInput.trim() ||
      subErrorCodeQuery.trim() ||
      subSearchInput.trim() ||
      subSearchQuery.trim(),
  );

  const handleResetSubFilters = (): void => {
    setSubPage(1);
    setSubStatusFilter('');
    setSubModeFilter('');
    setSubErrorCodeInput('');
    setSubErrorCodeQuery('');
    setSubSearchInput('');
    setSubSearchQuery('');
  };

  const openSubmissionDrawer = useCallback(async (id: string): Promise<void> => {
    const reqId = ++subDetailReqRef.current;
    setSelectedSubId(id);
    setSubDetail(null);
    setSubDetailError(null);
    setSubDetailLoading(true);
    try {
      const detail = await getAdminSpeakingSubmission(id);
      if (reqId !== subDetailReqRef.current) return;
      setSubDetail(detail);
    } catch (err) {
      if (reqId !== subDetailReqRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể tải chi tiết bài nộp Speaking.';
      setSubDetailError(msg);
      toastRef.current.error(msg);
    } finally {
      if (reqId === subDetailReqRef.current) {
        setSubDetailLoading(false);
      }
    }
  }, []);

  const handleRetrySubmissionContent = async (): Promise<void> => {
    if (!subDetail || !subDetail.canRetryContent || retryingSubContent) return;
    setRetryingSubContent(true);
    try {
      await retryAdminSpeakingSubmissionContent(subDetail.id);
      toastRef.current.success('Đã chấm lại nội dung bài nộp Speaking.');
      await Promise.all([
        openSubmissionDrawer(subDetail.id),
        loadSubmissions(),
      ]);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể chấm lại nội dung bài nộp.';
      toastRef.current.error(msg);
    } finally {
      setRetryingSubContent(false);
    }
  };

  const handleConfirmExpireSubmission = async (): Promise<void> => {
    if (!expireSubTarget || expiringSub) return;
    setExpiringSub(true);
    try {
      await expireAdminSpeakingSubmission(expireSubTarget.id);
      toastRef.current.success(
        'Đã đóng job bị kẹt và chuyển trạng thái bài nộp sang UNKNOWN.',
      );
      const targetId = expireSubTarget.id;
      setExpireSubTarget(null);
      await Promise.all([openSubmissionDrawer(targetId), loadSubmissions()]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể đóng job bị kẹt.';
      toastRef.current.error(msg);
    } finally {
      setExpiringSub(false);
    }
  };

  // Parsed drawer payloads
  const parsedSubSnapshot = useMemo(
    () => (subDetail ? parsePromptSnapshot(subDetail.promptSnapshot) : null),
    [subDetail],
  );
  const parsedSubResult = useMemo(
    () => (subDetail ? parseSpeakingSubmissionResult(subDetail.result) : null),
    [subDetail],
  );

  return {
    toastRef,
    authReady,
    setAuthReady,
    activeTab,
    setActiveTab,
    bannerError,
    setBannerError,
    exporting,
    prompts,
    promptsSummary,
    promptsPagination,
    promptsPage,
    setPromptsPage,
    promptsLimit,
    setPromptsLimit,
    promptModeFilter,
    setPromptModeFilter,
    promptPublishedFilter,
    setPromptPublishedFilter,
    promptSearchInput,
    setPromptSearchInput,
    promptSearchQuery,
    setPromptSearchQuery,
    promptsLoading,
    selectedPromptIds,
    setSelectedPromptIds,
    bulkBusy,
    showModal,
    setShowModal,
    editingPrompt,
    setEditingPrompt,
    cloningPrompt,
    setCloningPrompt,
    deleteTarget,
    setDeleteTarget,
    forceDelete,
    setForceDelete,
    deleting,
    submissions,
    subSummary,
    subPagination,
    subPage,
    setSubPage,
    subLimit,
    setSubLimit,
    subStatusFilter,
    setSubStatusFilter,
    subModeFilter,
    setSubModeFilter,
    subErrorCodeInput,
    setSubErrorCodeInput,
    subErrorCodeQuery,
    setSubErrorCodeQuery,
    subSearchInput,
    setSubSearchInput,
    subSearchQuery,
    setSubSearchQuery,
    subsLoading,
    selectedSubId,
    setSelectedSubId,
    subDetail,
    setSubDetail,
    subDetailLoading,
    subDetailError,
    retryingSubContent,
    expireSubTarget,
    setExpireSubTarget,
    expiringSub,
    voiceRows,
    voiceSummary,
    voicePagination,
    voicePage,
    setVoicePage,
    voiceLimit,
    setVoiceLimit,
    voiceStatusFilter,
    setVoiceStatusFilter,
    voiceAssessmentFilter,
    setVoiceAssessmentFilter,
    voiceStuckOnly,
    setVoiceStuckOnly,
    voiceSearchInput,
    setVoiceSearchInput,
    voiceSearchQuery,
    setVoiceSearchQuery,
    voiceLoading,
    selectedVoiceId,
    setSelectedVoiceId,
    voiceDetail,
    setVoiceDetail,
    voiceDetailLoading,
    voiceDetailError,
    releaseLockTarget,
    setReleaseLockTarget,
    releasingLock,
    retryingVoiceContent,
    activeQueryParams,
    handleExternalQueryChange,
    loadPrompts,
    loadSubmissions,
    loadVoiceConversations,
    openSubmissionDrawer,
    openVoiceDrawer,
    handleResetPromptFilters,
    handleToggleSelectAllPrompts,
    handleToggleSelectPrompt,
    handleBulkPublishPrompts,
    handleTogglePublish,
    handleConfirmDelete,
    handleExport,
    handleResetSubFilters,
    handleRetrySubmissionContent,
    handleConfirmExpireSubmission,
    handleResetVoiceFilters,
    handleConfirmReleaseVoiceLock,
    handleRetryVoiceContent,
    hasActivePromptFilters,
    allPromptsSelected,
    parsedSubSnapshot,
    parsedSubResult,
    hasActiveSubFilters,
    canRetryVoiceContent,
    sortedVoiceTurns,
    parsedVoiceAssessment,
    hasActiveVoiceFilters,
  };
}

export type SpeakingAdminState = ReturnType<typeof useSpeakingAdminState>;
