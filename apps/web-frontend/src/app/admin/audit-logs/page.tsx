'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download, Eye, Search, ShieldCheck, X } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { downloadAdminExport, listAdminAuditLogs } from '@/lib/admin-api';
import type { AdminAuditLog, PaginationMeta } from '@/types/admin';

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

const RESOURCE_OPTIONS = [
  'UNITS',
  'LESSONS',
  'ASSESSMENT_ITEMS',
  'ASSESSMENT_GROUPS',
  'VOCABULARY_TOPIC',
  'VOCABULARY_WORD',
  'SPEAKING_PROMPTS',
  'GRAMMAR_TOPICS',
  'GRAMMAR_PREREQUISITES',
  'USERS',
  'IMPORTS',
  'MEDIA',
  'AUTH',
];

export default function AdminAuditLogsPage(): React.ReactElement {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [actionInput, setActionInput] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAdminAuditLogs({
        page,
        limit,
        adminEmail,
        resourceType,
        action: actionFilter,
        from: fromDate || undefined,
        to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
      });
      setLogs(res.items);
      setPagination(res.pagination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể tải nhật ký kiểm toán.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, adminEmail, resourceType, actionFilter, fromDate, toDate]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <AdminShell
      breadcrumbTitle="Nhật ký hệ thống"
      title="Audit Logs (Chỉ đọc)"
      subtitle="Theo dõi bất biến mọi thao tác tạo, sửa, xoá và import của Quản trị viên (đã tự động ẩn mật khẩu & token)."
      actions={
        <>
          <button
            type="button"
            onClick={() => void downloadAdminExport('audit-logs', 'csv')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => void downloadAdminExport('audit-logs', 'json')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>JSON</span>
          </button>
        </>
      }
    >
      {() => (
        <div className="space-y-5">
          <div className="flex items-center gap-2.5 rounded-2xl border border-brand-100 bg-brand-25 px-4 py-3 text-xs text-brand-900">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-700" />
            <span>
              Nhật ký kiểm toán là dữ liệu bất biến (append-only): không hỗ trợ
              chỉnh sửa hoặc xoá qua giao diện quản trị.
            </span>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Bộ lọc */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setAdminEmail(adminEmailInput);
              setActionFilter(actionInput);
            }}
            className="grid grid-cols-1 gap-3 rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm sm:grid-cols-12"
          >
            <div className="relative sm:col-span-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slateDark-600" />
              <input
                type="text"
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                placeholder="Email admin..."
                className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-8 pr-3 text-xs"
              />
            </div>

            <select
              value={resourceType}
              onChange={(e) => {
                setPage(1);
                setResourceType(e.target.value);
              }}
              className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-2"
            >
              <option value="">Tất cả tài nguyên</option>
              {RESOURCE_OPTIONS.map((res) => (
                <option key={res} value={res}>
                  {res}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              placeholder="Hành động (CREATE_, DELETE_)..."
              className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-2"
            />

            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setPage(1);
                setFromDate(e.target.value);
              }}
              aria-label="Từ ngày"
              className="rounded-xl border border-slateDark-200 bg-white px-2.5 py-2 text-xs sm:col-span-2"
            />

            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setPage(1);
                setToDate(e.target.value);
              }}
              aria-label="Đến ngày"
              className="rounded-xl border border-slateDark-200 bg-white px-2.5 py-2 text-xs sm:col-span-2"
            />

            <button
              type="submit"
              className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100 sm:col-span-1"
            >
              Lọc
            </button>
          </form>

          {/* Bảng */}
          <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                  <tr>
                    <th className="px-5 py-3.5">Thời gian</th>
                    <th className="px-4 py-3.5">Quản trị viên</th>
                    <th className="px-4 py-3.5">Hành động & Endpoint</th>
                    <th className="px-4 py-3.5">Tài nguyên</th>
                    <th className="px-4 py-3.5">HTTP</th>
                    <th className="px-5 py-3.5 text-right">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slateDark-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slateDark-700">
                        Đang tải nhật ký hệ thống...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slateDark-700">
                        Chưa có bản ghi nhật ký nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slateDark-25">
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[11px] text-slateDark-700">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slateDark-900">
                            {log.adminEmail}
                          </p>
                          {log.ipAddress && (
                            <p className="font-mono text-[10px] text-slateDark-600">
                              {log.ipAddress}
                            </p>
                          )}
                        </td>
                        <td className="max-w-sm px-4 py-3.5">
                          <p className="font-mono font-bold text-slateDark-900">
                            {log.action}
                          </p>
                          <p className="truncate font-mono text-[11px] text-slateDark-600">
                            {log.method} {log.path}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-full bg-slateDark-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slateDark-800">
                            {log.resourceType}
                          </span>
                          {log.resourceId && (
                            <p className="mt-0.5 font-mono text-[10px] text-slateDark-600">
                              {log.resourceId.slice(0, 12)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={
                              log.statusCode >= 200 && log.statusCode < 300
                                ? 'rounded-full bg-emerald-50 px-2 py-0.5 font-mono font-bold text-emerald-700'
                                : 'rounded-full bg-red-50 px-2 py-0.5 font-mono font-bold text-red-700'
                            }
                          >
                            {log.statusCode}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 font-semibold text-slateDark-900 hover:bg-slateDark-50"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Chi tiết</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <GlobalPagination
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={(next) => setPage(next)}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              }}
            />
          </div>

          {selectedLog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
                  <div>
                    <h2 className="text-base font-bold text-slateDark-900">
                      {selectedLog.action}
                    </h2>
                    <p className="font-mono text-xs text-slateDark-700">
                      {selectedLog.method} {selectedLog.path} · HTTP{' '}
                      {selectedLog.statusCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLog(null)}
                    className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-6 text-xs">
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slateDark-25 p-3">
                    <div>
                      <span className="text-slateDark-600">Quản trị viên:</span>{' '}
                      <strong>{selectedLog.adminEmail}</strong>
                    </div>
                    <div>
                      <span className="text-slateDark-600">Thời gian:</span>{' '}
                      <strong>{formatDateTime(selectedLog.createdAt)}</strong>
                    </div>
                    <div>
                      <span className="text-slateDark-600">Tài nguyên:</span>{' '}
                      <strong>{selectedLog.resourceType}</strong>
                    </div>
                    <div>
                      <span className="text-slateDark-600">ID:</span>{' '}
                      <code className="font-mono">
                        {selectedLog.resourceId ?? '—'}
                      </code>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 font-bold text-slateDark-800">
                      Payload Snapshot (đã ẩn trường nhạy cảm):
                    </p>
                    <pre className="max-h-96 overflow-auto rounded-xl bg-[#141A23] p-4 font-mono text-[11px] leading-relaxed text-emerald-100">
                      {JSON.stringify(selectedLog.payloadSnapshot ?? null, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
