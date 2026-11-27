'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  KeyRound,
  Mic,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  User as UserIcon,
  X,
  XCircle,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  NOOP_ADMIN_TOAST,
  useAdminToast,
  type AdminToastApi,
} from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
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

const CEFR_LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEARNING_KINDS: ReadonlyArray<{ key: LearningKind; label: string }> = [
  { key: 'GRAMMAR', label: 'Ngữ pháp (Grammar)' },
  { key: 'VOCABULARY', label: 'Từ vựng (Vocabulary)' },
  { key: 'READING', label: 'Đọc hiểu (Reading)' },
  { key: 'LISTENING', label: 'Nghe hiểu (Listening)' },
];
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

function kindLabel(kind: LearningKind): string {
  return LEARNING_KINDS.find((item) => item.key === kind)?.label ?? kind;
}

interface SkillDraftState {
  cefrLevel: CefrLevel;
  resetExposures: boolean;
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

function renderDayPlanItems(items: unknown): React.ReactNode {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <p className="text-xs text-slateDark-600">
        Không có mục bài học nào trong kế hoạch hôm nay.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((raw, idx) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          return (
            <div
              key={`plan-item-${idx}`}
              className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-3 py-2 font-mono text-xs text-slateDark-800"
            >
              {String(raw)}
            </div>
          );
        }
        const obj = raw as Record<string, unknown>;
        const title =
          typeof obj.title === 'string'
            ? obj.title
            : typeof obj.lessonTitle === 'string'
              ? obj.lessonTitle
              : typeof obj.lessonCode === 'string'
                ? obj.lessonCode
                : `Mục #${idx + 1}`;
        const kind = typeof obj.kind === 'string' ? obj.kind : null;
        const status = typeof obj.status === 'string' ? obj.status : null;
        const minutes =
          typeof obj.estimatedMinutes === 'number'
            ? obj.estimatedMinutes
            : typeof obj.minutes === 'number'
              ? obj.minutes
              : null;
        return (
          <div
            key={typeof obj.id === 'string' ? obj.id : `plan-item-${idx}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slateDark-100 bg-slateDark-25 px-3.5 py-2.5 text-xs"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slateDark-900">{title}</p>
              {kind && (
                <p className="font-mono text-[10px] text-slateDark-600">
                  {kind}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {minutes !== null && (
                <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[11px] text-slateDark-700">
                  {minutes} phút
                </span>
              )}
              {status && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-800">
                  {status}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
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
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Cột trái: Thông tin định danh & GDPR */}
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm">
                        <h2 className="mb-3 text-sm font-bold text-slateDark-900">
                          Định danh & Bảo mật
                        </h2>
                        <dl className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-slateDark-600">Trạng thái</dt>
                            <dd>
                              <span
                                className={
                                  detail.status === 'ACTIVE'
                                    ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700'
                                    : detail.status === 'SUSPENDED'
                                      ? 'rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800'
                                      : 'rounded-full bg-red-50 px-2.5 py-0.5 font-semibold text-red-700'
                                }
                              >
                                {detail.status}
                              </span>
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-slateDark-600">Vai trò</dt>
                            <dd className="font-semibold text-slateDark-900">
                              {detail.role}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-slateDark-600">
                              Nhà cung cấp (Provider)
                            </dt>
                            <dd className="font-mono font-semibold text-slateDark-900">
                              {detail.provider}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-slateDark-600">
                              Danh tính Firebase
                            </dt>
                            <dd>
                              <span
                                className={
                                  detail.hasFirebaseIdentity
                                    ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700'
                                    : 'inline-flex items-center gap-1 rounded-full bg-slateDark-50 px-2.5 py-0.5 font-semibold text-slateDark-700'
                                }
                              >
                                <ShieldCheck className="h-3 w-3" />
                                <span>
                                  {detail.hasFirebaseIdentity
                                    ? 'Đã liên kết'
                                    : 'Chưa liên kết'}
                                </span>
                              </span>
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-slateDark-600">Ngày tạo</dt>
                            <dd className="font-mono text-[11px] text-slateDark-800">
                              {formatDateTime(detail.createdAt)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-slateDark-600">
                              Cập nhật gần nhất
                            </dt>
                            <dd className="font-mono text-[11px] text-slateDark-800">
                              {formatDateTime(detail.updatedAt)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-slateDark-600">
                              Hoàn tất Onboarding
                            </dt>
                            <dd className="font-mono text-[11px] text-slateDark-800">
                              {formatDateTime(
                                detail.profile?.onboardingCompletedAt,
                              )}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-slateDark-600">
                              Phiên bản cài đặt
                            </dt>
                            <dd className="font-mono text-[11px] text-slateDark-800">
                              pref v{detail.profile?.preferencesVersion ?? 0} ·
                              rem v{detail.profile?.reminderVersion ?? 0}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-2xl border border-brand-100 bg-brand-25 p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-brand-900">
                          Tuân thủ quyền riêng tư (GDPR)
                        </h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-brand-800">
                          Xuất toàn bộ dữ liệu học tập, hồ sơ, từ vựng, bài nộp
                          nói và hội thoại dưới dạng JSON (đã tự động lọc bỏ mật
                          khẩu và token hash).
                        </p>
                        <button
                          type="button"
                          disabled={exporting}
                          onClick={() => void handleExportGdpr()}
                          className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                          <span>
                            {exporting
                              ? 'Đang tạo gói JSON...'
                              : 'Xuất dữ liệu GDPR (JSON)'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Cột phải: Form chỉnh sửa User & UserProfile đầy đủ */}
                    <form
                      onSubmit={(e) => void handleSaveProfile(e)}
                      className="space-y-5 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm lg:col-span-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-bold text-slateDark-900">
                            Chỉnh sửa Hồ sơ & Cài đặt học tập
                          </h2>
                          <p className="text-xs text-slateDark-700">
                            Thay đổi mục tiêu học sẽ tự động đồng bộ lại kế
                            hoạch học hôm nay (LearningDayPlan).
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="sm:col-span-1">
                          <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                            Họ tên *
                          </label>
                          <input
                            type="text"
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                            Vai trò
                          </label>
                          <select
                            value={editRole}
                            disabled={isSelf}
                            onChange={(e) =>
                              setEditRole(e.target.value as UserRole)
                            }
                            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
                          >
                            <option value="LEARNER">Learner</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                            Trạng thái tài khoản
                          </label>
                          <select
                            value={editStatus}
                            disabled={isSelf}
                            onChange={(e) =>
                              setEditStatus(e.target.value as UserStatus)
                            }
                            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                            <option value="DELETED">DELETED</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                            CEFR mục tiêu
                          </label>
                          <select
                            value={targetCefr}
                            onChange={(e) =>
                              setTargetCefr(e.target.value as CefrLevel)
                            }
                            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                          >
                            {CEFR_LEVELS.map((lvl) => (
                              <option key={lvl} value={lvl}>
                                {lvl}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                            Tự đánh giá CEFR
                          </label>
                          <select
                            value={selfAssessedCefr}
                            onChange={(e) =>
                              setSelfAssessedCefr(
                                e.target.value as CefrLevel | '',
                              )
                            }
                            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                          >
                            <option value="">-- Chưa chọn --</option>
                            {CEFR_LEVELS.map((lvl) => (
                              <option key={lvl} value={lvl}>
                                {lvl}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                            Mục tiêu ngày (phút)
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={120}
                            required
                            value={dailyGoalMinutes}
                            onChange={(e) =>
                              setDailyGoalMinutes(Number(e.target.value))
                            }
                            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                            Mục đích học
                          </label>
                          <select
                            value={learningPurpose}
                            onChange={(e) =>
                              setLearningPurpose(
                                e.target.value as LearningPurpose | '',
                              )
                            }
                            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                          >
                            <option value="">-- Chưa chọn --</option>
                            <option value="EXAM">Thi chứng chỉ (EXAM)</option>
                            <option value="WORK">Công việc (WORK)</option>
                            <option value="DAILY_COMMUNICATION">
                              Giao tiếp hàng ngày
                            </option>
                            <option value="STUDY">Học tập (STUDY)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold text-slateDark-800">
                          Kỹ năng ưu tiên trong lộ trình (chọn ít nhất 1)
                        </p>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {LEARNING_KINDS.map((item) => {
                            const checked = preferredKinds.includes(item.key);
                            return (
                              <label
                                key={item.key}
                                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition ${
                                  checked
                                    ? 'border-brand-300 bg-brand-25 text-brand-900'
                                    : 'border-slateDark-200 bg-white text-slateDark-800 hover:bg-slateDark-25'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePreferredKind(item.key)}
                                  className="h-4 w-4 accent-brand-600"
                                />
                                <span>{item.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slateDark-100 bg-slateDark-25 p-4 sm:grid-cols-2">
                        <label className="flex cursor-pointer items-center gap-3 text-xs font-semibold text-slateDark-900">
                          <input
                            type="checkbox"
                            checked={reminderEnabled}
                            onChange={(e) =>
                              setReminderEnabled(e.target.checked)
                            }
                            className="h-4 w-4 accent-brand-600"
                          />
                          <span>Bật thông báo nhắc học hàng ngày</span>
                        </label>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                            Giờ nhắc học (HH:mm)
                          </label>
                          <input
                            type="time"
                            value={reminderTime}
                            onChange={(e) => setReminderTime(e.target.value)}
                            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                          Đặt lại mật khẩu mới (bỏ trống nếu giữ nguyên)
                        </label>
                        <input
                          type="password"
                          minLength={8}
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Nhập tối thiểu 8 ký tự để đổi mật khẩu và thu hồi phiên cũ"
                          className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex justify-end border-t border-slateDark-100 pt-4">
                        <button
                          type="submit"
                          disabled={savingProfile}
                          className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          <span>
                            {savingProfile
                              ? 'Đang lưu...'
                              : 'Lưu hồ sơ & cài đặt'}
                          </span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* TAB 2: KỸ NĂNG & PLACEMENT */}
                {activeTab === 'skills' && (
                  <div className="space-y-6">
                    {/* Bảng trình độ từng kỹ năng */}
                    <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h2 className="text-base font-bold text-slateDark-900">
                            Trình độ theo kỹ năng (Skill Levels)
                          </h2>
                          <p className="text-xs text-slateDark-700">
                            Điều chỉnh thủ công trình độ CEFR theo từng kỹ năng
                            (nguồn ADAPTIVE) và tùy chọn đặt lại lịch sử lộ đáp
                            án.
                          </p>
                        </div>
                        <span className="rounded-full bg-slateDark-50 px-3 py-1 text-xs font-semibold text-slateDark-800">
                          Tổng đáp án đã lộ: {detail.answerExposuresCount}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {LEARNING_KINDS.map((item) => {
                          const existing = detail.skillLevels.find(
                            (s) => s.kind === item.key,
                          );
                          const draft = skillDrafts[item.key];
                          const isSaving = savingSkillKind === item.key;

                          return (
                            <div
                              key={item.key}
                              className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-4"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-bold text-slateDark-900">
                                    {item.label}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-slateDark-700">
                                    {existing ? (
                                      <>
                                        Hiện tại:{' '}
                                        <strong className="text-brand-800">
                                          {existing.cefrLevel}
                                        </strong>{' '}
                                        · Nguồn:{' '}
                                        <span className="font-mono">
                                          {existing.source}
                                        </span>
                                        {existing.previousCefr
                                          ? ` (trước: ${existing.previousCefr})`
                                          : ''}
                                      </>
                                    ) : (
                                      'Chưa có bản ghi trình độ (mặc định A1)'
                                    )}
                                  </p>
                                </div>
                                {existing && (
                                  <span className="font-mono text-[10px] text-slateDark-600">
                                    {formatDateTime(existing.updatedAt)}
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <select
                                  value={draft.cefrLevel}
                                  onChange={(e) =>
                                    setSkillDrafts((prev) => ({
                                      ...prev,
                                      [item.key]: {
                                        ...prev[item.key],
                                        cefrLevel: e.target.value as CefrLevel,
                                      },
                                    }))
                                  }
                                  aria-label={`Chọn mức CEFR cho ${item.label}`}
                                  className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900"
                                >
                                  {CEFR_LEVELS.map((lvl) => (
                                    <option key={lvl} value={lvl}>
                                      {lvl}
                                    </option>
                                  ))}
                                </select>

                                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slateDark-800">
                                  <input
                                    type="checkbox"
                                    checked={draft.resetExposures}
                                    onChange={(e) =>
                                      setSkillDrafts((prev) => ({
                                        ...prev,
                                        [item.key]: {
                                          ...prev[item.key],
                                          resetExposures: e.target.checked,
                                        },
                                      }))
                                    }
                                    className="h-3.5 w-3.5 accent-brand-600"
                                  />
                                  <span>Xóa lộ đáp án</span>
                                </label>

                                <button
                                  type="button"
                                  disabled={savingSkillKind !== null}
                                  onClick={() =>
                                    void handleOverrideSkill(item.key)
                                  }
                                  className="ml-auto rounded-xl border border-brand-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50"
                                >
                                  {isSaving ? 'Đang lưu...' : 'Lưu trình độ'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {/* Kế hoạch hôm nay & Biến động trình độ */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-brand-600" />
                            <h2 className="text-sm font-bold text-slateDark-900">
                              Kế hoạch học hôm nay (Today Day Plan)
                            </h2>
                          </div>
                          {detail.todayDayPlan && (
                            <span className="font-mono text-[11px] font-semibold text-slateDark-700">
                              {detail.todayDayPlan.date} · v
                              {detail.todayDayPlan.version}
                            </span>
                          )}
                        </div>

                        {detail.todayDayPlan ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2 text-[11px] text-slateDark-700">
                              <span className="rounded-full bg-slateDark-50 px-2.5 py-0.5 font-semibold">
                                Mục tiêu: {detail.todayDayPlan.dailyGoalMinutes}{' '}
                                phút
                              </span>
                              <span className="rounded-full bg-slateDark-50 px-2.5 py-0.5 font-mono">
                                policy: {detail.todayDayPlan.policyVersion}
                              </span>
                              <span className="rounded-full bg-slateDark-50 px-2.5 py-0.5 font-mono">
                                pref v{detail.todayDayPlan.preferencesVersion}
                              </span>
                            </div>
                            {renderDayPlanItems(detail.todayDayPlan.items)}
                          </div>
                        ) : (
                          <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-6 text-center text-xs text-slateDark-600">
                            Người học chưa khởi tạo kế hoạch học cho ngày hôm
                            nay.
                          </p>
                        )}
                      </section>

                      <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-sm font-bold text-slateDark-900">
                          Lịch sử biến động trình độ (20 sự kiện gần nhất)
                        </h2>
                        {detail.skillLevelEvents.length === 0 ? (
                          <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-6 text-center text-xs text-slateDark-600">
                            Chưa có sự kiện tăng/giảm trình độ nào.
                          </p>
                        ) : (
                          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                            {detail.skillLevelEvents.map((ev) => (
                              <div
                                key={ev.id}
                                className="flex items-center justify-between gap-2 rounded-xl border border-slateDark-100 bg-slateDark-25 px-3.5 py-2.5 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="font-semibold text-slateDark-900">
                                    {kindLabel(ev.kind)}:{' '}
                                    <span className="font-mono text-brand-800">
                                      {ev.fromCefr} → {ev.toCefr}
                                    </span>
                                  </p>
                                  <p className="font-mono text-[10px] text-slateDark-600">
                                    Attempt: {ev.attemptId.slice(0, 12)} ·{' '}
                                    {formatDateTime(ev.createdAt)}
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                                    ev.direction.toUpperCase() === 'UP'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-amber-50 text-amber-800'
                                  }`}
                                >
                                  {ev.direction}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>

                    {/* Danh sách Placement Sessions */}
                    <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-bold text-slateDark-900">
                            Lịch sử kiểm tra đầu vào (Placement Sessions)
                          </h2>
                          <p className="text-xs text-slateDark-700">
                            Xem chi tiết từng câu trả lời hoặc mở lại quyền thi
                            đầu vào cho người học.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setResetPlacementSkillLevels(false);
                            setConfirmResetRetakeOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Reset cho thi lại</span>
                        </button>
                      </div>

                      {detail.recentPlacements.length === 0 ? (
                        <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-8 text-center text-xs text-slateDark-600">
                          Người học chưa có bài kiểm tra đầu vào nào.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                              <tr>
                                <th className="px-4 py-3">Trạng thái</th>
                                <th className="px-4 py-3">CEFR ước lượng</th>
                                <th className="px-4 py-3">Đúng / Tổng</th>
                                <th className="px-4 py-3">Bắt đầu</th>
                                <th className="px-4 py-3">Hoàn tất</th>
                                <th className="px-4 py-3 text-right">
                                  Thao tác
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slateDark-100">
                              {detail.recentPlacements.map((p) => (
                                <tr
                                  key={p.id}
                                  className="hover:bg-slateDark-25"
                                >
                                  <td className="px-4 py-3 font-mono font-semibold text-slateDark-900">
                                    {p.status}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-mono font-bold text-brand-800">
                                      {p.estimatedCefr ?? '—'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-mono">
                                    {p.correctCount}/{p.totalItems}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                                    {formatDateTime(p.startedAt)}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                                    {formatDateTime(p.completedAt)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void openPlacementModal(p.id)
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 font-semibold text-slateDark-900 hover:bg-slateDark-50"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      <span>Xem câu trả lời</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* TAB 3: PHIÊN ĐĂNG NHẬP */}
                {activeTab === 'sessions' && (
                  <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-slateDark-900">
                          Phiên đăng nhập đang hoạt động (Refresh Sessions)
                        </h2>
                        <p className="text-xs text-slateDark-700">
                          Danh sách phiên còn hiệu lực (không hiển thị token
                          hash). Thu hồi tất cả sẽ đồng thời nâng tokenVersion
                          và vô hiệu hóa phiên Firebase.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={sessionsLoading}
                          onClick={() => void loadSessions()}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`}
                          />
                          <span>Tải lại</span>
                        </button>
                        <button
                          type="button"
                          disabled={revokingAll}
                          onClick={() => setConfirmRevokeAllOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Thu hồi tất cả phiên</span>
                        </button>
                      </div>
                    </div>

                    {sessionsError && (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
                        {sessionsError}
                      </div>
                    )}

                    {sessionsLoading ? (
                      <p className="py-10 text-center text-xs text-slateDark-600">
                        Đang tải danh sách phiên đăng nhập...
                      </p>
                    ) : sessions.length === 0 ? (
                      <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-8 text-center text-xs text-slateDark-600">
                        Không có phiên đăng nhập nào đang hoạt động.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                            <tr>
                              <th className="px-4 py-3">Thiết bị</th>
                              <th className="px-4 py-3">Địa chỉ IP</th>
                              <th className="px-4 py-3">Tạo lúc</th>
                              <th className="px-4 py-3">Hết hạn</th>
                              <th className="px-4 py-3 text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slateDark-100">
                            {sessions.map((session) => (
                              <tr
                                key={session.id}
                                className="hover:bg-slateDark-25"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Smartphone className="h-4 w-4 shrink-0 text-slateDark-500" />
                                    <div>
                                      <p className="font-semibold text-slateDark-900">
                                        {session.deviceIdentifier ||
                                          'Thiết bị không xác định'}
                                      </p>
                                      <p className="font-mono text-[10px] text-slateDark-600">
                                        {session.id.slice(0, 12)}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-slateDark-800">
                                  {session.ipAddress || '—'}
                                </td>
                                <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                                  {formatDateTime(session.createdAt)}
                                </td>
                                <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                                  {formatDateTime(session.expiresAt)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setRevokeTarget(session)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Thu hồi</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {/* TAB 4: HOẠT ĐỘNG & SPEAKING / VOICE */}
                {activeTab === 'activity' && (
                  <div className="space-y-6">
                    {/* Lượt học gần đây */}
                    <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-brand-600" />
                        <h2 className="text-sm font-bold text-slateDark-900">
                          Lượt học bài tập gần đây (tối đa 10)
                        </h2>
                      </div>
                      {detail.recentAttempts.length === 0 ? (
                        <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-6 text-center text-xs text-slateDark-600">
                          Chưa có lượt làm bài tập nào.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                              <tr>
                                <th className="px-4 py-3">Bài học</th>
                                <th className="px-4 py-3">Trạng thái</th>
                                <th className="px-4 py-3">Kết quả</th>
                                <th className="px-4 py-3">Bắt đầu</th>
                                <th className="px-4 py-3">Nộp bài</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slateDark-100">
                              {detail.recentAttempts.map((a) => (
                                <tr
                                  key={a.id}
                                  className="hover:bg-slateDark-25"
                                >
                                  <td className="px-4 py-3 font-semibold text-slateDark-900">
                                    {a.lessonTitle}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[11px]">
                                    {a.status}
                                  </td>
                                  <td className="px-4 py-3 font-mono">
                                    {a.correctCount ?? 0}/{a.totalQuestions}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                                    {formatDateTime(a.startedAt)}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                                    {formatDateTime(a.submittedAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>

                    {/* Bài nộp Luyện nói */}
                    <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Mic className="h-4 w-4 text-brand-600" />
                          <h2 className="text-sm font-bold text-slateDark-900">
                            Bài nộp Luyện nói gần đây (tối đa 10)
                          </h2>
                        </div>
                        <Link
                          href={`/admin/speaking?tab=submissions&search=${encodeURIComponent(detail.email)}`}
                          className="text-xs font-semibold text-brand-700 hover:underline"
                        >
                          Xem trong Vận hành Speaking →
                        </Link>
                      </div>
                      {detail.recentSpeaking.length === 0 ? (
                        <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-6 text-center text-xs text-slateDark-600">
                          Chưa có bài nộp luyện nói nào.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                              <tr>
                                <th className="px-4 py-3">Đề luyện nói</th>
                                <th className="px-4 py-3">Trạng thái</th>
                                <th className="px-4 py-3">Điểm tổng</th>
                                <th className="px-4 py-3">Thời gian nộp</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slateDark-100">
                              {detail.recentSpeaking.map((s) => (
                                <tr
                                  key={s.id}
                                  className="hover:bg-slateDark-25"
                                >
                                  <td className="px-4 py-3 font-semibold text-slateDark-900">
                                    {s.promptTitle}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                                        s.status === 'SUCCEEDED'
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : s.status === 'FAILED' ||
                                              s.status === 'UNKNOWN'
                                            ? 'bg-red-50 text-red-700'
                                            : 'bg-amber-50 text-amber-800'
                                      }`}
                                    >
                                      {s.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-mono font-bold text-slateDark-900">
                                    {s.overallScore !== null
                                      ? `${Math.round(s.overallScore)}đ`
                                      : '—'}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                                    {formatDateTime(s.createdAt)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>

                    {/* Phiên hội thoại Voice Live */}
                    <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Radio className="h-4 w-4 text-brand-600" />
                          <h2 className="text-sm font-bold text-slateDark-900">
                            Phiên Hội thoại Voice Live gần đây (tối đa 10)
                          </h2>
                        </div>
                        <Link
                          href={`/admin/speaking?tab=voice&search=${encodeURIComponent(detail.email)}`}
                          className="text-xs font-semibold text-brand-700 hover:underline"
                        >
                          Xem trong Vận hành Voice →
                        </Link>
                      </div>
                      {detail.recentVoiceConversations.length === 0 ? (
                        <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-6 text-center text-xs text-slateDark-600">
                          Chưa có phiên hội thoại AI Voice Live nào.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                              <tr>
                                <th className="px-4 py-3">Chủ đề</th>
                                <th className="px-4 py-3">Trạng thái phiên</th>
                                <th className="px-4 py-3">Chấm điểm</th>
                                <th className="px-4 py-3">Lượt nói</th>
                                <th className="px-4 py-3">Thời gian</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slateDark-100">
                              {detail.recentVoiceConversations.map((vc) => (
                                <tr
                                  key={vc.id}
                                  className="hover:bg-slateDark-25"
                                >
                                  <td className="px-4 py-3">
                                    <p className="font-semibold text-slateDark-900">
                                      {vc.topicTitle}
                                    </p>
                                    {vc.endReason && (
                                      <p className="font-mono text-[10px] text-slateDark-600">
                                        Lý do kết thúc: {vc.endReason}
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="rounded-full bg-slateDark-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slateDark-800">
                                        {vc.status}
                                      </span>
                                      {vc.hasActiveLock && (
                                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                          Đang giữ khóa
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-800">
                                    {vc.assessmentStatus}
                                  </td>
                                  <td className="px-4 py-3 font-mono">
                                    {vc.turnsCount} lượt
                                  </td>
                                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3 text-slateDark-400" />
                                      {formatDateTime(vc.createdAt)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </>
            ) : null}

            {/* Modal chi tiết câu trả lời Placement */}
            {placementModalSessionId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
                <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
                    <div>
                      <h2 className="text-base font-bold text-slateDark-900">
                        Chi tiết phiên kiểm tra đầu vào (Placement)
                      </h2>
                      <p className="font-mono text-xs text-slateDark-600">
                        Session ID: {placementModalSessionId}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Đóng chi tiết Placement"
                      onClick={() => setPlacementModalSessionId(null)}
                      className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
                    {placementDetailLoading ? (
                      <p className="py-10 text-center text-slateDark-700">
                        Đang tải chi tiết câu trả lời Placement...
                      </p>
                    ) : placementDetailError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-700">
                        {placementDetailError}
                      </div>
                    ) : placementDetail ? (
                      <>
                        <div className="grid grid-cols-2 gap-3 rounded-xl border border-slateDark-100 bg-slateDark-25 p-4 sm:grid-cols-4">
                          <div>
                            <p className="text-[11px] text-slateDark-600">
                              Trạng thái
                            </p>
                            <p className="mt-0.5 font-mono font-bold text-slateDark-900">
                              {placementDetail.status}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slateDark-600">
                              CEFR ước lượng
                            </p>
                            <p className="mt-0.5 font-mono font-bold text-brand-800">
                              {placementDetail.estimatedCefr ?? '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slateDark-600">
                              Số câu đúng
                            </p>
                            <p className="mt-0.5 font-mono font-bold text-slateDark-900">
                              {placementDetail.correctCount}/
                              {placementDetail.totalItems}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slateDark-600">
                              Phiên bản đề
                            </p>
                            <p className="mt-0.5 truncate font-mono font-semibold text-slateDark-900">
                              {placementDetail.testVersion}
                            </p>
                          </div>
                        </div>

                        {placementDetail.responses.length === 0 ? (
                          <p className="py-6 text-center text-slateDark-600">
                            Phiên này chưa có câu trả lời nào được ghi nhận.
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {placementDetail.responses.map((resp) => (
                              <div
                                key={resp.id}
                                className="rounded-xl border border-slateDark-100 bg-white p-3.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="rounded bg-slateDark-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slateDark-900">
                                      #{resp.itemIndex + 1}
                                    </span>
                                    <span className="rounded-full bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-800">
                                      {resp.item.cefrLevel}
                                    </span>
                                    <span className="rounded-full bg-slateDark-50 px-2 py-0.5 font-mono text-[10px] text-slateDark-700">
                                      {resp.item.skillCode}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {resp.responseTimeMs !== null && (
                                      <span className="font-mono text-[10px] text-slateDark-600">
                                        {(resp.responseTimeMs / 1000).toFixed(
                                          1,
                                        )}
                                        s
                                      </span>
                                    )}
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        resp.isCorrect
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-red-50 text-red-700'
                                      }`}
                                    >
                                      {resp.isCorrect ? (
                                        <CheckCircle2 className="h-3 w-3" />
                                      ) : (
                                        <XCircle className="h-3 w-3" />
                                      )}
                                      <span>
                                        {resp.isCorrect ? 'Đúng' : 'Sai'}
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                <p className="mt-2 text-xs font-medium text-slateDark-900">
                                  {resp.item.prompt}
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-4 text-[11px] text-slateDark-700">
                                  <span>
                                    Đã chọn:{' '}
                                    <strong className="font-mono text-slateDark-900">
                                      {resp.selectedOption}
                                    </strong>
                                  </span>
                                  <span>
                                    Đáp án đúng:{' '}
                                    <strong className="font-mono text-emerald-700">
                                      {resp.item.correctOption ?? '—'}
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
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
