import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Award,
  KeyRound,
  User as UserIcon,
} from 'lucide-react';
import {
  NOOP_ADMIN_TOAST,
  type AdminToastApi,
} from '@/components/admin/AdminToast';
import {
  downloadAdminUserExport,
  getAdminUserDetail,
  getAdminUserPlacementDetail,
  listAdminUserSessions,
  overrideAdminUserSkillLevel,
  resetAdminUserPlacementRetake,
  revokeAdminUserSession,
  revokeAllAdminUserSessions,
  updateAdminUser,
} from '@/lib/admin-api';
import type {
  AdminPlacementSessionDetail,
  AdminUserDetail,
  AdminUserSessionView,
  CefrLevel,
  LearningKind,
  LearningPurpose,
  UserRole,
  UserStatus,
} from '@/types/admin';
import {
  buildInitialSkillDrafts,
  kindLabel,
  REMINDER_TIME_REGEX,
  type SkillDraftState,
  type TabKey,
} from './user-detail.helpers';

export function useUserDetailState(userId: string) {
  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Tab 1: Profile form
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('LEARNER');
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [editPassword, setEditPassword] = useState('');
  const [targetCefr, setTargetCefr] = useState<CefrLevel>('B1');
  const [selfAssessedCefr, setSelfAssessedCefr] = useState<CefrLevel | ''>('');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(10);
  const [learningPurpose, setLearningPurpose] = useState<LearningPurpose | ''>(
    '',
  );
  const [preferredKinds, setPreferredKinds] = useState<LearningKind[]>([
    'GRAMMAR',
    'VOCABULARY',
    'READING',
    'LISTENING',
  ]);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('19:30');
  const [savingProfile, setSavingProfile] = useState(false);

  // Tab 2: Skills & Placement
  const [skillDrafts, setSkillDrafts] = useState<
    Record<LearningKind, SkillDraftState>
  >({
    GRAMMAR: { cefrLevel: 'A1', resetExposures: false },
    VOCABULARY: { cefrLevel: 'A1', resetExposures: false },
    READING: { cefrLevel: 'A1', resetExposures: false },
    LISTENING: { cefrLevel: 'A1', resetExposures: false },
  });
  const [savingSkillKind, setSavingSkillKind] = useState<LearningKind | null>(
    null,
  );
  const [placementModalSessionId, setPlacementModalSessionId] = useState<
    string | null
  >(null);
  const [placementDetail, setPlacementDetail] =
    useState<AdminPlacementSessionDetail | null>(null);
  const [placementDetailLoading, setPlacementDetailLoading] = useState(false);
  const [placementDetailError, setPlacementDetailError] = useState<
    string | null
  >(null);
  const [confirmResetRetakeOpen, setConfirmResetRetakeOpen] = useState(false);
  const [resetPlacementSkillLevels, setResetPlacementSkillLevels] =
    useState(false);
  const [resettingRetake, setResettingRetake] = useState(false);

  // Tab 3: Sessions
  const [sessions, setSessions] = useState<AdminUserSessionView[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AdminUserSessionView | null>(
    null,
  );
  const [revokingOne, setRevokingOne] = useState(false);
  const [confirmRevokeAllOpen, setConfirmRevokeAllOpen] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  const hydrateProfileForm = useCallback((user: AdminUserDetail) => {
    setEditName(user.name);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPassword('');
    setTargetCefr(user.profile?.targetCefr ?? 'B1');
    setSelfAssessedCefr(user.profile?.selfAssessedCefr ?? '');
    setDailyGoalMinutes(user.profile?.dailyGoalMinutes ?? 10);
    setLearningPurpose(user.profile?.learningPurpose ?? '');
    setPreferredKinds(
      user.profile?.preferredKinds && user.profile.preferredKinds.length > 0
        ? user.profile.preferredKinds
        : ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'],
    );
    setReminderEnabled(user.profile?.reminderEnabled ?? true);
    setReminderTime(user.profile?.reminderTime ?? '19:30');
    setSkillDrafts(buildInitialSkillDrafts(user));
  }, []);

  const loadDetail = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminUserDetail(userId);
      setDetail(res);
      hydrateProfileForm(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải hồ sơ 360° của người dùng.',
      );
    } finally {
      setLoading(false);
    }
  }, [hydrateProfileForm, userId]);

  const loadSessions = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const list = await listAdminUserSessions(userId);
      setSessions(list);
    } catch (err) {
      setSessionsError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách phiên đăng nhập.',
      );
    } finally {
      setSessionsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!authReady || !userId) return;
    void loadDetail();
    void loadSessions();
  }, [authReady, loadDetail, loadSessions, userId]);

  const togglePreferredKind = (kind: LearningKind): void => {
    setPreferredKinds((prev) => {
      if (prev.includes(kind)) {
        if (prev.length <= 1) {
          toastRef.current.error('Phải chọn ít nhất 1 kỹ năng ưu tiên.');
          return prev;
        }
        return prev.filter((item) => item !== kind);
      }
      return [...prev, kind];
    });
  };

  const handleSaveProfile = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!detail || savingProfile) return;
    if (preferredKinds.length === 0) {
      toastRef.current.error('Vui lòng chọn ít nhất 1 kỹ năng ưu tiên.');
      return;
    }
    if (!REMINDER_TIME_REGEX.test(reminderTime.trim())) {
      toastRef.current.error(
        'Giờ nhắc học phải có định dạng HH:mm (00:00 - 23:59).',
      );
      return;
    }

    setSavingProfile(true);
    try {
      await updateAdminUser(detail.id, {
        name: editName.trim(),
        role: editRole,
        status: editStatus,
        targetCefr,
        dailyGoalMinutes,
        learningPurpose: learningPurpose || null,
        preferredKinds,
        selfAssessedCefr: selfAssessedCefr || null,
        reminderEnabled,
        reminderTime: reminderTime.trim(),
        ...(editPassword.trim() ? { password: editPassword } : {}),
      });
      toastRef.current.success('Đã lưu hồ sơ & cài đặt người học.');
      await loadDetail();
      await loadSessions();
    } catch (err) {
      toastRef.current.error(
        err instanceof Error ? err.message : 'Cập nhật hồ sơ thất bại.',
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleExportGdpr = async (): Promise<void> => {
    if (!userId || exporting) return;
    setExporting(true);
    try {
      await downloadAdminUserExport(userId);
      toastRef.current.success('Đã tải xuống gói dữ liệu GDPR (JSON).');
    } catch (err) {
      toastRef.current.error(
        err instanceof Error ? err.message : 'Xuất dữ liệu GDPR thất bại.',
      );
    } finally {
      setExporting(false);
    }
  };

  const handleOverrideSkill = async (kind: LearningKind): Promise<void> => {
    if (!userId || savingSkillKind) return;
    const draft = skillDrafts[kind];
    setSavingSkillKind(kind);
    try {
      const res = await overrideAdminUserSkillLevel(userId, kind, {
        cefrLevel: draft.cefrLevel,
        resetExposures: draft.resetExposures,
      });
      const extra =
        res.resetExposuresCount > 0
          ? ` (đã xóa ${res.resetExposuresCount} lịch sử lộ đáp án)`
          : '';
      toastRef.current.success(
        `Đã cập nhật ${kindLabel(kind)} sang ${draft.cefrLevel}${extra}.`,
      );
      await loadDetail();
    } catch (err) {
      toastRef.current.error(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật trình độ kỹ năng.',
      );
    } finally {
      setSavingSkillKind(null);
    }
  };

  const openPlacementModal = async (sessionId: string): Promise<void> => {
    if (!userId) return;
    setPlacementModalSessionId(sessionId);
    setPlacementDetail(null);
    setPlacementDetailError(null);
    setPlacementDetailLoading(true);
    try {
      const res = await getAdminUserPlacementDetail(userId, sessionId);
      setPlacementDetail(res);
    } catch (err) {
      setPlacementDetailError(
        err instanceof Error
          ? err.message
          : 'Không thể tải chi tiết bài kiểm tra đầu vào.',
      );
    } finally {
      setPlacementDetailLoading(false);
    }
  };

  const handleConfirmResetRetake = async (): Promise<void> => {
    if (!userId || resettingRetake) return;
    setResettingRetake(true);
    try {
      const res = await resetAdminUserPlacementRetake(userId, {
        resetSkillLevels: resetPlacementSkillLevels,
      });
      toastRef.current.success(
        `Đã mở quyền thi lại Placement (hủy ${res.abandonedSessionsCount} phiên, reset ${res.resetSkillLevelsCount} trình độ).`,
      );
      setConfirmResetRetakeOpen(false);
      setResetPlacementSkillLevels(false);
      await loadDetail();
    } catch (err) {
      toastRef.current.error(
        err instanceof Error
          ? err.message
          : 'Không thể reset quyền thi lại Placement.',
      );
    } finally {
      setResettingRetake(false);
    }
  };

  const handleConfirmRevokeOne = async (): Promise<void> => {
    if (!userId || !revokeTarget || revokingOne) return;
    setRevokingOne(true);
    try {
      await revokeAdminUserSession(userId, revokeTarget.id);
      toastRef.current.success('Đã thu hồi phiên đăng nhập.');
      setRevokeTarget(null);
      await loadSessions();
    } catch (err) {
      toastRef.current.error(
        err instanceof Error ? err.message : 'Thu hồi phiên thất bại.',
      );
    } finally {
      setRevokingOne(false);
    }
  };

  const handleConfirmRevokeAll = async (): Promise<void> => {
    if (!userId || revokingAll) return;
    setRevokingAll(true);
    try {
      const res = await revokeAllAdminUserSessions(userId);
      toastRef.current.success(
        `Đã thu hồi ${res.revokedSessionsCount} phiên đăng nhập đang hoạt động.`,
      );
      setConfirmRevokeAllOpen(false);
      await loadSessions();
    } catch (err) {
      toastRef.current.error(
        err instanceof Error
          ? err.message
          : 'Không thể thu hồi tất cả phiên đăng nhập.',
      );
    } finally {
      setRevokingAll(false);
    }
  };

  const tabs: ReadonlyArray<{
    key: TabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'profile', label: 'Hồ sơ & Cài đặt', icon: UserIcon },
    { key: 'skills', label: 'Kỹ năng & Placement', icon: Award },
    { key: 'sessions', label: 'Phiên đăng nhập', icon: KeyRound },
    { key: 'activity', label: 'Hoạt động & Speaking/Voice', icon: Activity },
  ];

  return {
    toastRef,
    setAuthReady,
    activeTab,
    setActiveTab,
    detail,
    loading,
    error,
    exporting,
    editName,
    setEditName,
    editRole,
    setEditRole,
    editStatus,
    setEditStatus,
    editPassword,
    setEditPassword,
    targetCefr,
    setTargetCefr,
    selfAssessedCefr,
    setSelfAssessedCefr,
    dailyGoalMinutes,
    setDailyGoalMinutes,
    learningPurpose,
    setLearningPurpose,
    preferredKinds,
    reminderEnabled,
    setReminderEnabled,
    reminderTime,
    setReminderTime,
    savingProfile,
    skillDrafts,
    setSkillDrafts,
    savingSkillKind,
    placementModalSessionId,
    setPlacementModalSessionId,
    placementDetail,
    placementDetailLoading,
    placementDetailError,
    confirmResetRetakeOpen,
    setConfirmResetRetakeOpen,
    resetPlacementSkillLevels,
    setResetPlacementSkillLevels,
    resettingRetake,
    sessions,
    sessionsLoading,
    sessionsError,
    revokeTarget,
    setRevokeTarget,
    revokingOne,
    confirmRevokeAllOpen,
    setConfirmRevokeAllOpen,
    revokingAll,
    tabs,
    loadDetail,
    loadSessions,
    togglePreferredKind,
    handleSaveProfile,
    handleExportGdpr,
    handleOverrideSkill,
    openPlacementModal,
    handleConfirmResetRetake,
    handleConfirmRevokeOne,
    handleConfirmRevokeAll,
  };
}

export type UserDetailState = ReturnType<typeof useUserDetailState>;
