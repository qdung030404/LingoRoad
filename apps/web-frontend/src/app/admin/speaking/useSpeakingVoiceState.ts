import { useCallback, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { AdminToastApi } from '@/components/admin/AdminToast';
import {
  getAdminVoiceConversation,
  listAdminVoiceConversations,
  releaseAdminVoiceConversationLock,
  retryAdminVoiceConversationContent,
} from '@/lib/admin-api';
import type {
  AdminVoiceConversationDetail,
  AdminVoiceConversationItem,
  AdminVoiceConversationsSummary,
  PaginationMeta,
} from '@/types/admin';
import {
  parseSpeakingFilters,
  parseVoiceAssessment,
  type VoiceAssessmentStatus,
  type VoiceSessionStatus,
} from './speaking-admin.helpers';

type SpeakingFilters = ReturnType<typeof parseSpeakingFilters>;

interface UseSpeakingVoiceStateParams {
  initialFilters: SpeakingFilters;
  toastRef: MutableRefObject<AdminToastApi>;
  setBannerError: (message: string | null) => void;
}

export function useSpeakingVoiceState({
  initialFilters,
  toastRef,
  setBannerError,
}: UseSpeakingVoiceStateParams) {
  const [voiceRows, setVoiceRows] = useState<AdminVoiceConversationItem[]>([]);
  const [voiceSummary, setVoiceSummary] =
    useState<AdminVoiceConversationsSummary>({
      activeLocks: 0,
      failedAssessments: 0,
      stuckProcessing: 0,
    });
  const [voicePagination, setVoicePagination] = useState<PaginationMeta>({
    page: initialFilters.tab === 'voice' ? initialFilters.page : 1,
    limit: initialFilters.tab === 'voice' ? initialFilters.limit : 10,
    total: 0,
    totalPages: 0,
  });
  const [voicePage, setVoicePage] = useState(
    initialFilters.tab === 'voice' ? initialFilters.page : 1,
  );
  const [voiceLimit, setVoiceLimit] = useState(
    initialFilters.tab === 'voice' ? initialFilters.limit : 10,
  );
  const [voiceStatusFilter, setVoiceStatusFilter] = useState<
    VoiceSessionStatus | ''
  >(initialFilters.voiceStatus);
  const [voiceAssessmentFilter, setVoiceAssessmentFilter] = useState<
    VoiceAssessmentStatus | ''
  >(initialFilters.assessmentStatus);
  const [voiceStuckOnly, setVoiceStuckOnly] = useState<boolean>(
    initialFilters.stuckOnly,
  );
  const [voiceSearchInput, setVoiceSearchInput] = useState(
    initialFilters.tab === 'voice' ? initialFilters.search : '',
  );
  const [voiceSearchQuery, setVoiceSearchQuery] = useState(
    initialFilters.tab === 'voice' ? initialFilters.search : '',
  );
  const [voiceLoading, setVoiceLoading] = useState(false);
  const voiceReqRef = useRef(0);

  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [voiceDetail, setVoiceDetail] =
    useState<AdminVoiceConversationDetail | null>(null);
  const [voiceDetailLoading, setVoiceDetailLoading] = useState(false);
  const [voiceDetailError, setVoiceDetailError] = useState<string | null>(null);
  const voiceDetailReqRef = useRef(0);
  const [releaseLockTarget, setReleaseLockTarget] =
    useState<AdminVoiceConversationDetail | null>(null);
  const [releasingLock, setReleasingLock] = useState(false);
  const [retryingVoiceContent, setRetryingVoiceContent] = useState(false);

  const loadVoiceConversations = useCallback(async () => {
    const reqId = ++voiceReqRef.current;
    setVoiceLoading(true);
    setBannerError(null);
    try {
      const res = await listAdminVoiceConversations({
        page: voicePage,
        limit: voiceLimit,
        status: voiceStatusFilter,
        assessmentStatus: voiceAssessmentFilter,
        stuckOnly: voiceStuckOnly ? 'true' : '',
        search: voiceSearchQuery,
      });
      if (reqId !== voiceReqRef.current) return;
      setVoiceRows(res.items);
      setVoicePagination(res.pagination);
      if (res.summary) setVoiceSummary(res.summary);
    } catch (err) {
      if (reqId !== voiceReqRef.current) return;
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách hội thoại Voice AI.',
      );
    } finally {
      if (reqId === voiceReqRef.current) {
        setVoiceLoading(false);
      }
    }
  }, [
    voicePage,
    voiceLimit,
    voiceStatusFilter,
    voiceAssessmentFilter,
    voiceStuckOnly,
    voiceSearchQuery,
    setBannerError,
  ]);

  const hasActiveVoiceFilters = Boolean(
    voiceStatusFilter ||
      voiceAssessmentFilter ||
      voiceStuckOnly ||
      voiceSearchInput.trim() ||
      voiceSearchQuery.trim(),
  );

  const handleResetVoiceFilters = (): void => {
    setVoicePage(1);
    setVoiceStatusFilter('');
    setVoiceAssessmentFilter('');
    setVoiceStuckOnly(false);
    setVoiceSearchInput('');
    setVoiceSearchQuery('');
  };

  const openVoiceDrawer = useCallback(
    async (id: string): Promise<void> => {
      const reqId = ++voiceDetailReqRef.current;
      setSelectedVoiceId(id);
      setVoiceDetail(null);
      setVoiceDetailError(null);
      setVoiceDetailLoading(true);
      try {
        const detail = await getAdminVoiceConversation(id);
        if (reqId !== voiceDetailReqRef.current) return;
        setVoiceDetail(detail);
      } catch (err) {
        if (reqId !== voiceDetailReqRef.current) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Không thể tải chi tiết phiên hội thoại Voice AI.';
        setVoiceDetailError(msg);
        toastRef.current.error(msg);
      } finally {
        if (reqId === voiceDetailReqRef.current) {
          setVoiceDetailLoading(false);
        }
      }
    },
    [toastRef],
  );

  const handleConfirmReleaseVoiceLock = async (): Promise<void> => {
    if (!releaseLockTarget || releasingLock) return;
    setReleasingLock(true);
    try {
      const res = await releaseAdminVoiceConversationLock(releaseLockTarget.id);
      toastRef.current.success(
        res.hadLiveCall
          ? 'Đã ngắt kết nối phiên live và giải phóng khóa thành công.'
          : 'Đã giải phóng khóa phiên hội thoại thành công.',
      );
      const targetId = releaseLockTarget.id;
      setReleaseLockTarget(null);
      await Promise.all([
        openVoiceDrawer(targetId),
        loadVoiceConversations(),
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể giải phóng khóa.';
      toastRef.current.error(msg);
    } finally {
      setReleasingLock(false);
    }
  };

  const canRetryVoiceContent = Boolean(
    voiceDetail &&
      ['FAILED', 'PARTIAL', 'UNKNOWN'].includes(voiceDetail.assessmentStatus) &&
      voiceDetail.turnsCount > 0,
  );

  const handleRetryVoiceContent = async (): Promise<void> => {
    if (!voiceDetail || !canRetryVoiceContent || retryingVoiceContent) return;
    setRetryingVoiceContent(true);
    try {
      await retryAdminVoiceConversationContent(voiceDetail.id);
      toastRef.current.success(
        'Đã gửi yêu cầu chấm lại nội dung hội thoại Voice AI.',
      );
      await Promise.all([
        openVoiceDrawer(voiceDetail.id),
        loadVoiceConversations(),
      ]);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể chấm lại nội dung hội thoại.';
      toastRef.current.error(msg);
    } finally {
      setRetryingVoiceContent(false);
    }
  };

  const sortedVoiceTurns = useMemo(
    () =>
      voiceDetail
        ? [...voiceDetail.turns].sort((a, b) => a.sequence - b.sequence)
        : [],
    [voiceDetail],
  );
  const parsedVoiceAssessment = useMemo(
    () => (voiceDetail ? parseVoiceAssessment(voiceDetail.assessment) : null),
    [voiceDetail],
  );

  return {
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
  };
}
