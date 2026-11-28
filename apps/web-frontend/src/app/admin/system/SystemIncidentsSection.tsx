import React from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Database,
  HardDrive,
  Mic,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import type { FormattedAppVersion } from '@/lib/admin-validation';
import type { AdminSystemReadinessView } from '@/types/admin';
import { formatDateTime } from './system-readiness.helpers';

interface SystemIncidentsSectionProps {
  data: AdminSystemReadinessView;
  versionInfo: FormattedAppVersion | null;
  onCopyVersion: () => Promise<void>;
}

export function SystemIncidentsSection({
  data,
  versionInfo,
  onCopyVersion,
}: SystemIncidentsSectionProps): React.ReactElement {
  return (
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
                Kiểm tra kết nối PostgreSQL, phiên bản máy chủ, xác thực và lưu
                trữ media.
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
                onClick={() => void onCopyVersion()}
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
    </>
  );
}
