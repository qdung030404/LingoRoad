'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  NOOP_ADMIN_TOAST,
  useAdminToast,
  type AdminToastApi,
} from '@/components/admin/AdminToast';
import {
  cleanupAdminOrphanMedia,
  getAdminSystemReadiness,
  scanAdminOrphanMedia,
} from '@/lib/admin-api';
import { formatAppVersion, formatBytesCompact } from '@/lib/admin-validation';
import type {
  AdminOrphanMediaScanResult,
  AdminSystemReadinessView,
} from '@/types/admin';
import { SystemIncidentsSection } from './SystemIncidentsSection';
import { SystemMlSection } from './SystemMlSection';
import { SystemOrphanMediaSection } from './SystemOrphanMediaSection';
import { CANONICAL_ML_SUBSYSTEMS } from './system-readiness.helpers';

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

export default function AdminSystemReadinessPage(): React.ReactElement {
  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<AdminSystemReadinessView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              <SystemIncidentsSection
                data={data}
                versionInfo={versionInfo}
                onCopyVersion={handleCopyVersion}
              />
              <SystemMlSection
                data={data}
                mlServiceReady={mlServiceReady}
                extraMlKeys={extraMlKeys}
              />
              <SystemOrphanMediaSection
                mediaMode={data.mediaStorage.mode}
                minAgeHours={minAgeHours}
                setMinAgeHours={setMinAgeHours}
                orphanScan={orphanScan}
                scanningOrphans={scanningOrphans}
                cleaningOrphans={cleaningOrphans}
                confirmCleanupOpen={confirmCleanupOpen}
                setConfirmCleanupOpen={setConfirmCleanupOpen}
                orphanError={orphanError}
                onScanOrphans={handleScanOrphans}
                onConfirmCleanup={handleConfirmCleanup}
              />
            </>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
