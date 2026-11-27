'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Mic,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  NOOP_ADMIN_TOAST,
  useAdminToast,
  type AdminToastApi,
} from '@/components/admin/AdminToast';
import {
  SystemDatabaseSection,
  SystemMlReadinessSection,
  SystemVoiceAndSpeakingSection,
} from '@/components/admin/SystemReadinessCards';
import { getAdminSystemReadiness } from '@/lib/admin-api';
import type { AdminSystemReadinessView } from '@/types/admin';

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
      timeZone: 'Asia/Ho_Chi_Minh',
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

export default function AdminSystemReadinessPage(): React.ReactElement {
  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<AdminSystemReadinessView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <AdminShell
      breadcrumbTitle="Hệ thống & AI"
      title="Trạng thái Hệ thống & ML"
      subtitle="Theo dõi độ trễ cơ sở dữ liệu, trạng thái 8 thành phần ML Service, cấu hình Voice Live, các chế độ Speaking và cảnh báo sự cố."
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
                  <span className="rounded-full bg-slateDark-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slateDark-800">
                    v{data.appVersion}
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

              <SystemDatabaseSection data={data} />
              <SystemMlReadinessSection data={data} />
              <SystemVoiceAndSpeakingSection data={data} />
            </>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
