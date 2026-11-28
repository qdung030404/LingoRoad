import React from 'react';
import { HardDrive, Loader2, Search, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { formatBytesCompact } from '@/lib/admin-validation';
import type { AdminOrphanMediaScanResult } from '@/types/admin';
import {
  ORPHAN_GRACE_OPTIONS,
  formatDateTime,
} from './system-readiness.helpers';

interface SystemOrphanMediaSectionProps {
  mediaMode: string;
  minAgeHours: number;
  setMinAgeHours: (hours: number) => void;
  orphanScan: AdminOrphanMediaScanResult | null;
  scanningOrphans: boolean;
  cleaningOrphans: boolean;
  confirmCleanupOpen: boolean;
  setConfirmCleanupOpen: (open: boolean) => void;
  orphanError: string | null;
  onScanOrphans: () => Promise<void>;
  onConfirmCleanup: () => Promise<void>;
}

export function SystemOrphanMediaSection({
  mediaMode,
  minAgeHours,
  setMinAgeHours,
  orphanScan,
  scanningOrphans,
  cleaningOrphans,
  confirmCleanupOpen,
  setConfirmCleanupOpen,
  orphanError,
  onScanOrphans,
  onConfirmCleanup,
}: SystemOrphanMediaSectionProps): React.ReactElement {
  return (
    <>
      <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slateDark-900">
                Quét & Dọn dẹp Media mồ côi ({mediaMode.toUpperCase()})
              </h2>
              <p className="text-xs text-slateDark-700">
                Đối chiếu toàn bộ tệp trong{' '}
                <code className="font-mono">learning/v1/</code> và{' '}
                <code className="font-mono">placement/</code> với mọi bảng dữ
                liệu và lịch sử nộp bài trước khi dọn.
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
              onClick={() => void onScanOrphans()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-4 py-2 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50 disabled:opacity-50"
            >
              {scanningOrphans ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              <span>
                {scanningOrphans ? 'Đang quét...' : 'Quét thử (Dry-run)'}
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
            ảnh/audio không còn gắn với bất kỳ bài học, câu hỏi, từ vựng, đề nói
            hay lịch sử bài làm nào.
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
        onConfirm={() => void onConfirmCleanup()}
      />
    </>
  );
}
