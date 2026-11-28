'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Cpu,
  Database,
  HardDrive,
  Loader2,
  Mic,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
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
  cleanupAdminOrphanMedia,
  getAdminSystemReadiness,
  scanAdminOrphanMedia,
} from '@/lib/admin-api';
import {
  formatAppVersion,
  formatBytesCompact,
  parseMlSubsystemStatus,
  type ParsedMlSubsystemStatus,
} from '@/lib/admin-validation';
import type {
  AdminOrphanMediaScanResult,
  AdminSystemReadinessView,
  SpeakingMode,
} from '@/types/admin';

const CANONICAL_ML_SUBSYSTEMS: ReadonlyArray<{
  key: string;
  label: string;
  description: string;
  optional?: boolean;
}> = [
  {
    key: 'cat',
    label: 'CAT (Kiểm tra thích ứng)',
    description: 'Chọn câu hỏi IRT & ước lượng năng lực đầu vào',
  },
  {
    key: 'llm',
    label: 'LLM (Phản hồi AI)',
    description: 'Giải thích bài học, đánh giá viết và tư vấn học tập',
  },
  {
    key: 'rag',
    label: 'RAG (Truy xuất tri thức)',
    description: 'Chỉ mục vector học liệu tùy chọn cho gia sư AI',
    optional: true,
  },
  {
    key: 'speech',
    label: 'Speech (ASR cơ bản)',
    description: 'Nhận diện giọng nói và chấm đọc cơ bản (lazy-load)',
  },
  {
    key: 'speech_azure',
    label: 'Speech Azure',
    description: 'Chấm điểm phát âm Read Aloud / Tongue Twister',
  },
  {
    key: 'speech_topic',
    label: 'Speech Topic',
    description: 'Chấm phát âm nói tự do (Topic & Picture)',
  },
  {
    key: 'speaking_content',
    label: 'Speaking Content',
    description: 'Chấm nội dung từ vựng, ngữ pháp và bám sát đề',
  },
  {
    key: 'kt',
    label: 'Knowledge Tracing (KT)',
    description: 'Theo dõi mức độ nắm vững kỹ năng theo thời gian',
  },
];

const SPEAKING_MODE_LABELS: Record<
  SpeakingMode,
  { label: string; description: string }
> = {
  READ_ALOUD: {
    label: 'Read Aloud (Đọc to)',
    description: 'Chấm phát âm theo văn bản mẫu',
  },
  TOPIC: {
    label: 'Topic Speaking (Chủ đề)',
    description: 'Nói tự do theo gợi ý & chấm nội dung AI',
  },
  PICTURE_DESCRIPTION: {
    label: 'Picture Description (Mô tả tranh)',
    description: 'Mô tả hình ảnh & chấm ngữ cảnh trực quan',
  },
  TONGUE_TWISTER: {
    label: 'Tongue Twister (Xoắn lưỡi)',
    description: 'Trò chơi luyện phát âm tính sao',
  },
};

const ORPHAN_GRACE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 24, label: 'Ân hạn 24 giờ (Khuyên dùng)' },
  { value: 72, label: 'Ân hạn 72 giờ (3 ngày)' },
  { value: 168, label: 'Ân hạn 168 giờ (7 ngày)' },
];

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

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function badgeClassForTone(tone: ParsedMlSubsystemStatus['tone']): string {
  switch (tone) {
    case 'ready':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'warn':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'error':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slateDark-50 text-slateDark-700 border-slateDark-200';
  }
}

function renderSpeakingProfiles(profiles: unknown): React.ReactNode {
  if (profiles === undefined || profiles === null) {
    return (
      <span className="text-xs text-slateDark-600">
        ML không trả về danh sách speakingProfiles.
      </span>
    );
  }
  if (Array.isArray(profiles)) {
    if (profiles.length === 0) {
      return (
        <span className="text-xs text-slateDark-600">
          Không có profile nào được khai báo.
        </span>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {profiles.map((entry, idx) => (
          <span
            key={typeof entry === 'string' ? entry : `profile-${idx}`}
            className="rounded-full border border-brand-200 bg-brand-25 px-3 py-1 font-mono text-xs font-semibold text-brand-800"
          >
            {typeof entry === 'string' ? entry : JSON.stringify(entry)}
          </span>
        ))}
      </div>
    );
  }
  if (typeof profiles === 'object') {
    const entries = Object.entries(profiles as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <span className="text-xs text-slateDark-600">
          Không có profile nào được khai báo.
        </span>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map(([profileKey, value]) => {
          const parsed = parseMlSubsystemStatus(value);
          return (
            <div
              key={profileKey}
              className="flex items-center justify-between gap-2 rounded-xl border border-slateDark-100 bg-slateDark-25 px-3 py-2 text-xs"
            >
              <span className="font-mono font-semibold text-slateDark-900">
                {profileKey}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold ${badgeClassForTone(parsed.tone)}`}
              >
                {parsed.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <span className="font-mono text-xs text-slateDark-800">
      {String(profiles)}
    </span>
  );
}

export default function AdminSystemReadinessPage(): React.ReactElement {
  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<AdminSystemReadinessView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Orphan media dry-run & cleanup state
  const [minAgeHours, setMinAgeHours] = useState<number>(24);
  const [orphanScan, setOrphanScan] =
    useState<AdminOrphanMediaScanResult | null>(null);
  const [scanningOrphans, setScanningOrphans] = useState(false);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [confirmCleanupOpen, setConfirmCleanupOpen] = useState(false);
  const [orphanError, setOrphanError] = useState<string | null>(null);

  const loadReadiness = useCallback(async (isManual = false): Promise<void> => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await getAdminSystemReadiness();
      setData(result);
      if (isManual) {
        toastRef.current.success('Đã làm mới trạng thái Hệ thống & AI.');
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể tải trạng thái sẵn sàng của hệ thống.';
      setError(msg);
      if (isManual) {
        toastRef.current.error(msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void loadReadiness(false);
  }, [authReady, loadReadiness]);

  const mlServiceReady = Boolean(data?.ml.reachable && data.ml.httpStatus === 200);

  const extraMlKeys = data
    ? Object.keys(data.ml.components).filter(
        (key) => !CANONICAL_ML_SUBSYSTEMS.some((sub) => sub.key === key),
      )
    : [];
  const versionInfo = data ? formatAppVersion(data.appVersion) : null;

  const handleCopyVersion = useCallback(async (): Promise<void> => {
    if (!versionInfo) return;
    try {
      await navigator.clipboard.writeText(versionInfo.fullText);
      toastRef.current.success('Đã sao chép mã phiên bản Backend.');
    } catch {
      toastRef.current.error('Không thể sao chép mã phiên bản.');
    }
  }, [versionInfo]);

  const handleScanOrphans = async (): Promise<void> => {
    if (scanningOrphans || cleaningOrphans) return;
    setScanningOrphans(true);
    setOrphanError(null);
    try {
      const res = await scanAdminOrphanMedia(minAgeHours);
      setOrphanScan(res);
      toastRef.current.info(
        res.orphanCount > 0
          ? `Phát hiện ${res.orphanCount} tệp media mồ côi (${formatBytesCompact(res.orphanBytes)}).`
          : 'Kho lưu trữ sạch: không có tệp media mồ côi nào cần dọn.',
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể quét tệp media mồ côi lúc này.';
      setOrphanError(msg);
      toastRef.current.error(msg);
    } finally {
      setScanningOrphans(false);
    }
  };

  const handleConfirmCleanup = async (): Promise<void> => {
    if (!orphanScan || orphanScan.orphanCount === 0 || cleaningOrphans) return;
    setCleaningOrphans(true);
    setOrphanError(null);
    try {
      const targetKeys = orphanScan.orphans.slice(0, 500).map((item) => item.key);
      const cleanupRes = await cleanupAdminOrphanMedia({
        keys: targetKeys,
        minAgeHours: orphanScan.minAgeHours,
      });
      setConfirmCleanupOpen(false);
      toastRef.current.success(
        `Đã xóa ${cleanupRes.deletedCount} tệp mồ côi (giải phóng ${formatBytesCompact(cleanupRes.deletedBytes)}).`,
      );
      const refreshed = await scanAdminOrphanMedia(minAgeHours);
      setOrphanScan(refreshed);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Dọn dẹp media mồ côi thất bại.';
      setOrphanError(msg);
      toastRef.current.error(msg);
    } finally {
      setCleaningOrphans(false);
    }
  };

  return (
    <AdminShell
      breadcrumbTitle="Hệ thống & AI"
      title="Trạng thái Hệ thống & ML"
      subtitle="Theo dõi độ trễ cơ sở dữ liệu, trạng thái 8 thành phần ML Service, cấu hình Voice Live, các chế độ Speaking và dọn dẹp kho lưu trữ."
      onAuthenticated={() => setAuthReady(true)}
      actions={
        <button
          type="button"
          disabled={loading || refreshing}
          onClick={() => void loadReadiness(true)}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
          />
          <span>{refreshing ? 'Đang làm mới...' : 'Làm mới trạng thái'}</span>
        </button>
      }
    >
      {() => (
        <div className="space-y-6">
          <AdminToastBridge toastRef={toastRef} />

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="rounded-2xl border border-slateDark-100 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              <p className="text-sm font-medium text-slateDark-700">
                Đang kiểm tra trạng thái Backend, PostgreSQL và ML Service...
              </p>
            </div>
          ) : data ? (
            <>
              {/* Thời điểm kiểm tra & tóm tắt nhanh */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slateDark-100 bg-white px-5 py-3.5 text-xs shadow-sm">
                <div className="flex items-center gap-2 text-slateDark-800">
                  <Activity className="h-4 w-4 text-brand-600" />
                  <span>
                    Lần kiểm tra gần nhất:{' '}
                    <strong className="font-mono text-slateDark-900">
                      {formatDateTime(data.checkedAt)}
                    </strong>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    title={versionInfo?.fullText}
                    className="max-w-[180px] truncate rounded-full bg-slateDark-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slateDark-800"
                  >
                    {versionInfo?.pillText ?? `v${data.appVersion}`}
                  </span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-brand-800">
                    Auth: {data.authProvider}
                  </span>
                  <span className="rounded-full bg-slateDark-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slateDark-800">
                    Media: {data.mediaStorage.mode}
                  </span>
                </div>
              </div>

              {/* Cảnh báo sự cố vận hành nhanh */}
              <section aria-label="Bộ đếm sự cố vận hành">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slateDark-900">
                    Cảnh báo & Sự cố vận hành nhanh
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Link
                      href="/admin/speaking?tab=voice&stuckOnly=true"
                      className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800"
                    >
                      <span>Voice bị treo</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <span className="text-slateDark-300">|</span>
                    <Link
                      href="/admin/speaking?tab=submissions&status=FAILED"
                      className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800"
                    >
                      <span>Speaking lỗi</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Link
                    href="/admin/speaking?tab=voice&stuckOnly=true"
                    className={`group rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${
                      data.incidents.stuckVoiceLocks > 0
                        ? 'border-red-200 bg-red-50/50'
                        : 'border-slateDark-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slateDark-700">
                        Khóa Voice treo (&gt;5p)
                      </span>
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          data.incidents.stuckVoiceLocks > 0
                            ? 'text-red-600'
                            : 'text-slateDark-400'
                        }`}
                      />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-slateDark-900">
                      {data.incidents.stuckVoiceLocks}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 group-hover:underline">
                      <span>Kiểm tra & giải phóng khóa</span>
                      <ArrowRight className="h-3 w-3" />
                    </p>
                  </Link>

                  <Link
                    href="/admin/speaking?tab=submissions&status=PROCESSING"
                    className={`group rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${
                      data.incidents.stuckSpeakingJobs > 0
                        ? 'border-amber-200 bg-amber-50/50'
                        : 'border-slateDark-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slateDark-700">
                        Bài nói treo (&gt;3p)
                      </span>
                      <Mic
                        className={`h-4 w-4 ${
                          data.incidents.stuckSpeakingJobs > 0
                            ? 'text-amber-600'
                            : 'text-slateDark-400'
                        }`}
                      />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-slateDark-900">
                      {data.incidents.stuckSpeakingJobs}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 group-hover:underline">
                      <span>Xem bài PROCESSING</span>
                      <ArrowRight className="h-3 w-3" />
                    </p>
                  </Link>

                  <Link
                    href="/admin/speaking?tab=submissions&status=FAILED"
                    className={`group rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${
                      data.incidents.failedSpeaking24h > 0
                        ? 'border-red-200 bg-red-50/50'
                        : 'border-slateDark-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slateDark-700">
                        Bài nói lỗi / UNKNOWN (24h)
                      </span>
                      <XCircle
                        className={`h-4 w-4 ${
                          data.incidents.failedSpeaking24h > 0
                            ? 'text-red-600'
                            : 'text-slateDark-400'
                        }`}
                      />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-slateDark-900">
                      {data.incidents.failedSpeaking24h}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 group-hover:underline">
                      <span>Xem bài nói FAILED</span>
                      <ArrowRight className="h-3 w-3" />
                    </p>
                  </Link>

                  <Link
                    href="/admin/users"
                    className="group rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slateDark-700">
                        Refresh Sessions hoạt động
                      </span>
                      <Users className="h-4 w-4 text-brand-600" />
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-slateDark-900">
                      {data.incidents.activeRefreshSessions}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 group-hover:underline">
                      <span>Quản lý phiên người dùng</span>
                      <ArrowRight className="h-3 w-3" />
                    </p>
                  </Link>
                </div>
              </section>

              {/* Backend & Database card */}
              <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Database className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slateDark-900">
                        Backend & Cơ sở dữ liệu
                      </h2>
                      <p className="text-xs text-slateDark-700">
                        Kiểm tra kết nối PostgreSQL, phiên bản máy chủ, xác thực
                        và lưu trữ media.
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                      data.database.status === 'ready'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {data.database.status === 'ready' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {data.database.status === 'ready'
                        ? `DB Sẵn sàng (${data.database.latencyMs} ms)`
                        : `DB Gián đoạn (${data.database.latencyMs} ms)`}
                    </span>
                  </span>
                </div>

                {data.database.error && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
                    Lỗi kết nối DB: {data.database.error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
                      Độ trễ DB Ping
                    </p>
                    <p className="mt-1 font-mono text-lg font-extrabold text-slateDark-900">
                      {data.database.latencyMs} ms
                    </p>
                  </div>

                  <div className="min-w-0 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
                      Phiên bản Backend
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p
                        title={versionInfo?.fullText ?? data.appVersion}
                        className="min-w-0 truncate font-mono text-lg font-extrabold text-slateDark-900"
                      >
                        {versionInfo?.shortText ?? data.appVersion}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleCopyVersion()}
                        title={`Sao chép mã đầy đủ: ${versionInfo?.fullText ?? data.appVersion}`}
                        aria-label="Sao chép mã phiên bản Backend"
                        className="shrink-0 rounded-lg border border-slateDark-200 bg-white p-1.5 text-slateDark-600 transition hover:border-brand-300 hover:text-brand-700"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
                    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
                      <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                      <span>Auth Provider</span>
                    </p>
                    <p className="mt-1 font-mono text-lg font-extrabold text-slateDark-900">
                      {data.authProvider}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
                    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
                      <HardDrive className="h-3.5 w-3.5 text-brand-600" />
                      <span>Media Storage</span>
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-mono text-lg font-extrabold uppercase text-slateDark-900">
                        {data.mediaStorage.mode}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          data.mediaStorage.azureConfigured
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slateDark-100 text-slateDark-700'
                        }`}
                      >
                        {data.mediaStorage.azureConfigured
                          ? 'Azure OK'
                          : data.mediaStorage.azureRequired
                            ? 'Thiếu Azure'
                            : 'Local'}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ML Service Readiness card */}
              <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slateDark-900">
                        ML Service Readiness (8 thành phần)
                      </h2>
                      <p className="text-xs text-slateDark-700">
                        Hiển thị chi tiết từng thành phần AI kể cả khi ML trả về
                        HTTP 503 degraded.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold ${
                        mlServiceReady
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : data.ml.reachable
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {data.ml.reachable
                        ? `HTTP ${data.ml.httpStatus ?? '—'} · ${data.ml.status}`
                        : `Unreachable · ${data.ml.status}`}
                    </span>
                  </div>
                </div>

                {!data.ml.reachable && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
                    Không thể kết nối tới ML Service
                    {data.ml.error ? `: ${data.ml.error}` : '.'}
                  </div>
                )}

                {data.ml.reachable && data.ml.httpStatus === 503 && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
                    ML Service đang ở trạng thái suy giảm (HTTP 503 —{' '}
                    <code className="font-mono">{data.ml.status}</code>). Kiểm
                    tra từng thành phần bên dưới để xác định dịch vụ thiếu cấu
                    hình hoặc artifact.
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {CANONICAL_ML_SUBSYSTEMS.map((subsystem) => {
                    const parsed = parseMlSubsystemStatus(
                      data.ml.components[subsystem.key],
                      {
                        optional: subsystem.optional,
                        serviceReady: mlServiceReady,
                      },
                    );
                    return (
                      <div
                        key={subsystem.key}
                        className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slateDark-900">
                              {subsystem.label}
                            </p>
                            <p className="font-mono text-[10px] text-slateDark-600">
                              {subsystem.key}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${badgeClassForTone(parsed.tone)}`}
                          >
                            {parsed.label}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-slateDark-700">
                          {parsed.detail ?? subsystem.description}
                        </p>
                      </div>
                    );
                  })}

                  {extraMlKeys.map((extraKey) => {
                    const parsed = parseMlSubsystemStatus(
                      data.ml.components[extraKey],
                      { serviceReady: mlServiceReady },
                    );
                    return (
                      <div
                        key={extraKey}
                        className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-mono text-xs font-bold text-slateDark-900">
                            {extraKey}
                          </p>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${badgeClassForTone(parsed.tone)}`}
                          >
                            {parsed.label}
                          </span>
                        </div>
                        {parsed.detail && (
                          <p className="mt-2 text-[11px] text-slateDark-700">
                            {parsed.detail}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 border-t border-slateDark-100 pt-4">
                  <p className="mb-2 text-xs font-bold text-slateDark-900">
                    Speaking Profiles (từ ML Service)
                  </p>
                  {renderSpeakingProfiles(data.ml.speakingProfiles)}
                </div>
              </section>

              {/* Voice Live & Speaking Modes */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Radio className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slateDark-900">
                          Voice Live (Hội thoại thời gian thực)
                        </h2>
                        <p className="text-xs text-slateDark-700">
                          Cấu hình an toàn đang kích hoạt (không hiển thị khóa
                          bí mật).
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        data.voiceLive.enabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slateDark-200 bg-slateDark-50 text-slateDark-700'
                      }`}
                    >
                      {data.voiceLive.enabled ? 'Đang bật' : 'Đang tắt'}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                      <dt className="text-[11px] text-slateDark-600">
                        Trạng thái sẵn sàng
                      </dt>
                      <dd className="mt-1 font-mono font-bold text-slateDark-900">
                        {data.voiceLive.status}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                      <dt className="text-[11px] text-slateDark-600">
                        Thời lượng tối đa
                      </dt>
                      <dd className="mt-1 font-mono font-bold text-slateDark-900">
                        {data.voiceLive.maxDurationSeconds} giây
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                      <dt className="text-[11px] text-slateDark-600">Model</dt>
                      <dd className="mt-1 truncate font-mono font-bold text-slateDark-900">
                        {data.voiceLive.model || '—'}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                      <dt className="text-[11px] text-slateDark-600">
                        Giọng đọc mặc định
                      </dt>
                      <dd className="mt-1 truncate font-mono font-bold text-slateDark-900">
                        {data.voiceLive.voice || '—'}
                      </dd>
                    </div>
                    <div className="col-span-2 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                      <dt className="text-[11px] text-slateDark-600">
                        API Version
                      </dt>
                      <dd className="mt-1 font-mono font-bold text-slateDark-900">
                        {data.voiceLive.apiVersion || '—'}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Mic className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slateDark-900">
                          Chế độ Luyện nói (Speaking Modes)
                        </h2>
                        <p className="text-xs text-slateDark-700">
                          Profile chấm điểm:{' '}
                          <code className="rounded bg-slateDark-50 px-1.5 py-0.5 font-mono font-semibold text-slateDark-900">
                            {data.speaking.scoringProfile}
                          </code>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {(
                      Object.keys(SPEAKING_MODE_LABELS) as SpeakingMode[]
                    ).map((mode) => {
                      const enabled = Boolean(data.speaking.modes[mode]);
                      const meta = SPEAKING_MODE_LABELS[mode];
                      return (
                        <div
                          key={mode}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slateDark-900">
                              {meta.label}
                            </p>
                            <p className="text-[11px] text-slateDark-700">
                              {meta.description}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                              enabled
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slateDark-200 bg-white text-slateDark-600'
                            }`}
                          >
                            {enabled ? 'Đang bật' : 'Đang tắt'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Dọn dẹp Media mồ côi */}
              <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <HardDrive className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slateDark-900">
                        Quét & Dọn dẹp Media mồ côi ({data.mediaStorage.mode.toUpperCase()})
                      </h2>
                      <p className="text-xs text-slateDark-700">
                        Đối chiếu toàn bộ tệp trong{' '}
                        <code className="font-mono">learning/v1/</code> và{' '}
                        <code className="font-mono">placement/</code> với mọi
                        bảng dữ liệu và lịch sử nộp bài trước khi dọn.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      aria-label="Thời gian bảo vệ tệp mới tải lên"
                      value={minAgeHours}
                      disabled={scanningOrphans || cleaningOrphans}
                      onChange={(e) => setMinAgeHours(Number(e.target.value))}
                      className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs font-semibold text-slateDark-800 focus:border-brand-500 focus:bg-white focus:outline-none disabled:opacity-50"
                    >
                      {ORPHAN_GRACE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={scanningOrphans || cleaningOrphans}
                      onClick={() => void handleScanOrphans()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-4 py-2 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50 disabled:opacity-50"
                    >
                      {scanningOrphans ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {scanningOrphans
                          ? 'Đang quét...'
                          : 'Quét thử (Dry-run)'}
                      </span>
                    </button>

                    {orphanScan && orphanScan.orphanCount > 0 && (
                      <button
                        type="button"
                        disabled={scanningOrphans || cleaningOrphans}
                        onClick={() => setConfirmCleanupOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>
                          Dọn dẹp {orphanScan.orphanCount} tệp (
                          {formatBytesCompact(orphanScan.orphanBytes)})
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {orphanError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                    {orphanError}
                  </div>
                )}

                {orphanScan ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
                          Tổng tệp đã quét
                        </p>
                        <p className="mt-1 font-mono text-lg font-extrabold text-slateDark-900">
                          {orphanScan.totalBlobs}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
                          Đang tham chiếu
                        </p>
                        <p className="mt-1 font-mono text-lg font-extrabold text-emerald-700">
                          {orphanScan.referencedCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
                          Đang bảo vệ (&lt;{orphanScan.minAgeHours}h)
                        </p>
                        <p className="mt-1 font-mono text-lg font-extrabold text-slateDark-900">
                          {orphanScan.protectedRecentCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
                          Mồ côi có thể xóa
                        </p>
                        <p className="mt-1 font-mono text-lg font-extrabold text-amber-800">
                          {orphanScan.orphanCount}{' '}
                          <span className="text-xs font-semibold text-slateDark-600">
                            ({formatBytesCompact(orphanScan.orphanBytes)})
                          </span>
                        </p>
                      </div>
                    </div>

                    {orphanScan.orphans.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-slateDark-100">
                        <table className="min-w-full divide-y divide-slateDark-100 text-left text-xs">
                          <thead className="bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-600">
                            <tr>
                              <th className="px-4 py-2.5">Khóa lưu trữ (Blob Key)</th>
                              <th className="px-4 py-2.5">Dung lượng</th>
                              <th className="px-4 py-2.5">Cập nhật lần cuối</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slateDark-100 bg-white">
                            {orphanScan.orphans.slice(0, 100).map((item) => (
                              <tr key={item.key}>
                                <td className="px-4 py-2 font-mono text-[11px] text-slateDark-900">
                                  {item.key}
                                </td>
                                <td className="px-4 py-2 font-mono text-[11px] text-slateDark-700">
                                  {formatBytesCompact(item.size)}
                                </td>
                                <td className="px-4 py-2 font-mono text-[11px] text-slateDark-700">
                                  {item.lastModified
                                    ? formatDateTime(item.lastModified)
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs font-medium text-emerald-800">
                        Không phát hiện tệp media mồ côi nào quá{' '}
                        {orphanScan.minAgeHours} giờ.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slateDark-600">
                    Bấm <strong>Quét thử (Dry-run)</strong> để kiểm tra các tệp
                    ảnh/audio không còn gắn với bất kỳ bài học, câu hỏi, từ
                    vựng, đề nói hay lịch sử bài làm nào.
                  </p>
                )}
              </section>

              <ConfirmDialog
                open={confirmCleanupOpen}
                tone="danger"
                busy={cleaningOrphans}
                title="Xác nhận dọn dẹp tệp media mồ côi"
                description={
                  orphanScan
                    ? `Hệ thống sẽ kiểm tra lại tham chiếu CSDL lần cuối và xóa tối đa ${Math.min(orphanScan.orphanCount, 500)} tệp không còn sử dụng (cũ hơn ${orphanScan.minAgeHours} giờ, khoảng ${formatBytesCompact(orphanScan.orphanBytes)}). Thao tác sẽ được ghi nhận vào Nhật ký hệ thống.`
                    : ''
                }
                confirmLabel="Xóa tệp mồ côi"
                onCancel={() => {
                  if (!cleaningOrphans) setConfirmCleanupOpen(false);
                }}
                onConfirm={() => void handleConfirmCleanup()}
              />
            </>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
