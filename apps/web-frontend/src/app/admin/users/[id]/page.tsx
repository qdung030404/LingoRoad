'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Award,
  Download,
  KeyRound,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  NOOP_ADMIN_TOAST,
  useAdminToast,
  type AdminToastApi,
} from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { User360ProfileTab } from '@/components/admin/User360ProfileTab';
import {
  User360SkillsTab,
  kindLabel,
  type SkillDraftState,
} from '@/components/admin/User360SkillsTab';
import {
  User360ActivityTab,
  User360PlacementModal,
  User360SessionsTab,
} from '@/components/admin/User360SessionsAndActivityTabs';
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

type TabKey = 'profile' | 'skills' | 'sessions' | 'activity';

const REMINDER_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function buildInitialSkillDrafts(
  detail: AdminUserDetail,
): Record<LearningKind, SkillDraftState> {
  const map = new Map(detail.skillLevels.map((s) => [s.kind, s.cefrLevel]));
  return {
    GRAMMAR: { cefrLevel: map.get('GRAMMAR') ?? 'A1', resetExposures: false },
    VOCABULARY: {
      cefrLevel: map.get('VOCABULARY') ?? 'A1',
      resetExposures: false,
    },
    READING: { cefrLevel: map.get('READING') ?? 'A1', resetExposures: false },
    LISTENING: {
      cefrLevel: map.get('LISTENING') ?? 'A1',
      resetExposures: false,
    },
  };
}

export default function AdminUser360Page(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const userId =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? (params.id[0] ?? '')
        : '';

  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detailReqRef = useRef(0);
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
  const placementReqRef = useRef(0);
  const [confirmResetRetakeOpen, setConfirmResetRetakeOpen] = useState(false);
  const [resetPlacementSkillLevels, setResetPlacementSkillLevels] =
    useState(false);
  const [resettingRetake, setResettingRetake] = useState(false);

  // Tab 3: Sessions
  const [sessions, setSessions] = useState<AdminUserSessionView[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const sessionsReqRef = useRef(0);
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
    const reqId = ++detailReqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminUserDetail(userId);
      if (reqId !== detailReqRef.current) return;
      setDetail(res);
      hydrateProfileForm(res);
    } catch (err) {
      if (reqId !== detailReqRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải hồ sơ 360° của người dùng.',
      );
    } finally {
      if (reqId === detailReqRef.current) {
        setLoading(false);
      }
    }
  }, [hydrateProfileForm, userId]);

  const loadSessions = useCallback(async (): Promise<void> => {
    if (!userId) return;
    const reqId = ++sessionsReqRef.current;
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const list = await listAdminUserSessions(userId);
      if (reqId !== sessionsReqRef.current) return;
      setSessions(list);
    } catch (err) {
      if (reqId !== sessionsReqRef.current) return;
      setSessionsError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách phiên đăng nhập.',
      );
    } finally {
      if (reqId === sessionsReqRef.current) {
        setSessionsLoading(false);
      }
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
    if (editPassword.length > 0 && editPassword !== editPassword.trim()) {
      toastRef.current.error(
        'Mật khẩu mới không được chứa khoảng trắng ở đầu hoặc cuối.',
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
    const reqId = ++placementReqRef.current;
    setPlacementModalSessionId(sessionId);
    setPlacementDetail(null);
    setPlacementDetailError(null);
    setPlacementDetailLoading(true);
    try {
      const res = await getAdminUserPlacementDetail(userId, sessionId);
      if (reqId !== placementReqRef.current) return;
      setPlacementDetail(res);
    } catch (err) {
      if (reqId !== placementReqRef.current) return;
      setPlacementDetailError(
        err instanceof Error
          ? err.message
          : 'Không thể tải chi tiết bài kiểm tra đầu vào.',
      );
    } finally {
      if (reqId === placementReqRef.current) {
        setPlacementDetailLoading(false);
      }
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

  return (
    <AdminShell
      breadcrumbTitle="Hồ sơ người học 360°"
      title={detail ? detail.name : 'Hồ sơ người học 360°'}
      subtitle={
        detail
          ? `${detail.email} · ID: ${detail.id}`
          : 'Xem và quản lý toàn diện hồ sơ, kỹ năng, bài kiểm tra đầu vào, phiên đăng nhập và lịch sử học tập.'
      }
      onAuthenticated={() => setAuthReady(true)}
      actions={
        <>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Danh sách người dùng</span>
          </Link>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void loadDetail();
              void loadSessions();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            disabled={exporting || !detail}
            onClick={() => void handleExportGdpr()}
            className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>
              {exporting ? 'Đang xuất...' : 'Xuất dữ liệu GDPR (JSON)'}
            </span>
          </button>
        </>
      }
    >
      {(currentAdmin) => {
        const isSelf = detail?.id === currentAdmin.id;
        return (
          <div className="space-y-6">
            <AdminToastBridge toastRef={toastRef} />

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {loading && !detail ? (
              <div className="rounded-2xl border border-slateDark-100 bg-white px-6 py-16 text-center shadow-sm">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                <p className="text-sm font-medium text-slateDark-700">
                  Đang tải dữ liệu hồ sơ 360°...
                </p>
              </div>
            ) : detail ? (
              <>
                {/* Dải thống kê tổng quan */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slateDark-600">
                      Lượt học
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-slateDark-900">
                      {detail.stats.learningAttempts}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slateDark-600">
                      Placement
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-slateDark-900">
                      {detail.stats.placementSessions}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slateDark-600">
                      Bộ từ vựng
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-slateDark-900">
                      {detail.stats.vocabularyDecks}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slateDark-600">
                      Bài Luyện nói
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-slateDark-900">
                      {detail.stats.speakingSubmissions}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slateDark-600">
                      Hội thoại Voice
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-slateDark-900">
                      {detail.stats.voiceConversations ?? 0}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-slateDark-600">
                      Đáp án đã lộ
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-slateDark-900">
                      {detail.answerExposuresCount}
                    </p>
                  </div>
                </div>

                {/* Thanh điều hướng 4 tab */}
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slateDark-100 bg-white p-2 shadow-sm">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={
                          active
                            ? 'inline-flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2 text-xs font-bold text-brand-800 transition'
                            : 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-slateDark-700 transition hover:bg-slateDark-50 hover:text-slateDark-900'
                        }
                      >
                        <Icon
                          className={`h-4 w-4 ${active ? 'text-brand-600' : 'text-slateDark-500'}`}
                        />
                        <span>{tab.label}</span>
                        {tab.key === 'sessions' && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 font-mono text-[10px] text-slateDark-800">
                            {sessions.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* TAB 1: HỒ SƠ & CÀI ĐẶT */}
                {activeTab === 'profile' && (
                  <User360ProfileTab
                    detail={detail}
                    isSelf={isSelf}
                    exporting={exporting}
                    savingProfile={savingProfile}
                    editName={editName}
                    setEditName={setEditName}
                    editRole={editRole}
                    setEditRole={setEditRole}
                    editStatus={editStatus}
                    setEditStatus={setEditStatus}
                    editPassword={editPassword}
                    setEditPassword={setEditPassword}
                    targetCefr={targetCefr}
                    setTargetCefr={setTargetCefr}
                    selfAssessedCefr={selfAssessedCefr}
                    setSelfAssessedCefr={setSelfAssessedCefr}
                    dailyGoalMinutes={dailyGoalMinutes}
                    setDailyGoalMinutes={setDailyGoalMinutes}
                    learningPurpose={learningPurpose}
                    setLearningPurpose={setLearningPurpose}
                    preferredKinds={preferredKinds}
                    togglePreferredKind={togglePreferredKind}
                    reminderEnabled={reminderEnabled}
                    setReminderEnabled={setReminderEnabled}
                    reminderTime={reminderTime}
                    setReminderTime={setReminderTime}
                    handleExportGdpr={handleExportGdpr}
                    handleSaveProfile={handleSaveProfile}
                    formatDateTime={formatDateTime}
                  />
                )}

                {/* TAB 2: KỸ NĂNG & PLACEMENT */}
                {activeTab === 'skills' && (
                  <User360SkillsTab
                    detail={detail}
                    skillDrafts={skillDrafts}
                    setSkillDrafts={setSkillDrafts}
                    savingSkillKind={savingSkillKind}
                    handleOverrideSkill={handleOverrideSkill}
                    onOpenResetRetake={() => {
                      setResetPlacementSkillLevels(false);
                      setConfirmResetRetakeOpen(true);
                    }}
                    openPlacementModal={openPlacementModal}
                    formatDateTime={formatDateTime}
                  />
                )}

                {/* TAB 3: PHIÊN ĐĂNG NHẬP */}
                {activeTab === 'sessions' && (
                  <User360SessionsTab
                    sessions={sessions}
                    sessionsLoading={sessionsLoading}
                    sessionsError={sessionsError}
                    revokingAll={revokingAll}
                    loadSessions={loadSessions}
                    onConfirmRevokeAll={() => setConfirmRevokeAllOpen(true)}
                    setRevokeTarget={setRevokeTarget}
                    formatDateTime={formatDateTime}
                  />
                )}

                {/* TAB 4: HOẠT ĐỘNG & SPEAKING / VOICE */}
                {activeTab === 'activity' && (
                  <User360ActivityTab
                    detail={detail}
                    formatDateTime={formatDateTime}
                  />
                )}
              </>
            ) : null}

            {/* Modal chi tiết câu trả lời Placement */}
            {placementModalSessionId && (
              <User360PlacementModal
                placementModalSessionId={placementModalSessionId}
                placementDetailLoading={placementDetailLoading}
                placementDetailError={placementDetailError}
                placementDetail={placementDetail}
                onClose={() => setPlacementModalSessionId(null)}
              />
            )}

            {/* ConfirmDialog: Reset Placement Retake */}
            <ConfirmDialog
              open={confirmResetRetakeOpen}
              tone="warning"
              busy={resettingRetake}
              title="Reset quyền làm lại bài kiểm tra đầu vào?"
              confirmLabel="Xác nhận Reset"
              onCancel={() => setConfirmResetRetakeOpen(false)}
              onConfirm={() => void handleConfirmResetRetake()}
              description={
                <div className="space-y-3">
                  <p>
                    Tất cả phiên kiểm tra đầu vào đang thực hiện hoặc đã hoàn
                    thành của <strong>{detail?.email}</strong> sẽ được chuyển
                    sang trạng thái <code>ABANDONED</code> để người học có thể
                    thi lại.
                  </p>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <input
                      type="checkbox"
                      checked={resetPlacementSkillLevels}
                      onChange={(e) =>
                        setResetPlacementSkillLevels(e.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 accent-amber-600"
                    />
                    <span>
                      <strong>
                        Xóa các trình độ kỹ năng có nguồn PLACEMENT
                      </strong>
                      <br />
                      Các kỹ năng được gán từ bài kiểm tra đầu vào trước đó sẽ
                      được xóa để tính lại sau khi thi.
                    </span>
                  </label>
                </div>
              }
            />

            {/* ConfirmDialog: Thu hồi 1 phiên */}
            <ConfirmDialog
              open={Boolean(revokeTarget)}
              tone="danger"
              busy={revokingOne}
              title="Thu hồi phiên đăng nhập này?"
              confirmLabel="Thu hồi phiên"
              onCancel={() => setRevokeTarget(null)}
              onConfirm={() => void handleConfirmRevokeOne()}
              description={
                <p>
                  Thiết bị{' '}
                  <strong>
                    {revokeTarget?.deviceIdentifier || 'không xác định'}
                  </strong>{' '}
                  ({revokeTarget?.ipAddress || 'không rõ IP'}) sẽ không thể làm
                  mới token và buộc đăng nhập lại.
                </p>
              }
            />

            {/* ConfirmDialog: Thu hồi tất cả phiên */}
            <ConfirmDialog
              open={confirmRevokeAllOpen}
              tone="danger"
              busy={revokingAll}
              title="Thu hồi toàn bộ phiên đăng nhập?"
              confirmLabel="Thu hồi tất cả"
              onCancel={() => setConfirmRevokeAllOpen(false)}
              onConfirm={() => void handleConfirmRevokeAll()}
              description={
                <p>
                  Hành động này sẽ thu hồi tất cả Refresh Session đang hoạt
                  động, tăng <code>tokenVersion</code> và thu hồi token Firebase
                  (nếu có) của <strong>{detail?.email}</strong> trên mọi thiết
                  bị.
                </p>
              }
            />
          </div>
        );
      }}
    </AdminShell>
  );
}
