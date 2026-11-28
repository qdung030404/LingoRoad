'use client';

import React from 'react';
import { AlertTriangle, Clock, Eye, Info, RefreshCw, RotateCcw, Search, XCircle } from 'lucide-react';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import type { SpeakingMode, SpeakingStatus } from '@/types/admin';
import {
  formatDateTime,
  formatScore,
  MODE_TABS,
  PAGE_LIMITS,
  SPEAKING_MODES,
  SPEAKING_STATUSES,
  submissionStatusBadgeClass,
} from './speaking-admin.helpers';
import type { SpeakingAdminState } from './useSpeakingAdminState';

export function SpeakingSubmissionsTab({
  state,
}: {
  state: SpeakingAdminState;
}): React.ReactElement | null {
  const {
    subSummary,
    subStatusFilter,
    setSubStatusFilter,
    subModeFilter,
    setSubModeFilter,
    subErrorCodeInput,
    setSubErrorCodeInput,
    setSubErrorCodeQuery,
    subSearchInput,
    setSubSearchInput,
    setSubSearchQuery,
    setSubPage,
    handleResetSubFilters,
    loadSubmissions,
    subsLoading,
    submissions,
    openSubmissionDrawer,
    subPagination,
    subPage,
    subLimit,
    setSubLimit,
    hasActiveSubFilters,
  } = state;
  return (
    <>
    {/* Summary Badges */}
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => {
          setSubStatusFilter(
            subStatusFilter === 'FAILED' ? '' : 'FAILED',
          );
          setSubPage(1);
        }}
        className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
          subStatusFilter === 'FAILED'
            ? 'border-red-400 bg-red-100 text-red-900 shadow-sm'
            : 'border-red-200 bg-red-50/70 text-red-800 hover:bg-red-50'
        }`}
      >
        <XCircle className="h-3.5 w-3.5 text-red-600" />
        <span>Thất bại (FAILED):</span>
        <strong className="font-mono">{subSummary.failed}</strong>
      </button>
      <button
        type="button"
        onClick={() => {
          setSubStatusFilter(
            subStatusFilter === 'UNKNOWN' ? '' : 'UNKNOWN',
          );
          setSubPage(1);
        }}
        className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
          subStatusFilter === 'UNKNOWN'
            ? 'border-amber-400 bg-amber-100 text-amber-950 shadow-sm'
            : 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-50'
        }`}
      >
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        <span>Không rõ (UNKNOWN):</span>
        <strong className="font-mono">{subSummary.unknown}</strong>
      </button>
      <button
        type="button"
        onClick={() => {
          setSubStatusFilter(
            subStatusFilter === 'PROCESSING' ? '' : 'PROCESSING',
          );
          setSubPage(1);
        }}
        className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
          subStatusFilter === 'PROCESSING'
            ? 'border-blue-400 bg-blue-100 text-blue-950 shadow-sm'
            : 'border-blue-200 bg-blue-50/70 text-blue-900 hover:bg-blue-50'
        }`}
      >
        <Clock className="h-3.5 w-3.5 text-blue-600" />
        <span>Treo xử lý (&gt;3p):</span>
        <strong className="font-mono">
          {subSummary.stuckProcessing}
        </strong>
      </button>
      <div className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2 text-xs font-semibold text-slateDark-800">
        <Info className="h-3.5 w-3.5 text-slateDark-600" />
        <span>Thiếu chấm nội dung:</span>
        <strong className="font-mono text-slateDark-900">
          {subSummary.contentUnavailable}
        </strong>
      </div>
    </div>

    {/* Bộ lọc Submissions */}
    <div className="rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubPage(1);
          setSubSearchQuery(subSearchInput.trim());
          setSubErrorCodeQuery(subErrorCodeInput.trim());
        }}
        className="grid grid-cols-1 gap-3 lg:grid-cols-12"
      >
        <div className="relative lg:col-span-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
          <input
            type="text"
            value={subSearchInput}
            onChange={(e) => setSubSearchInput(e.target.value)}
            placeholder="Email, tên, mã đề hoặc UUID..."
            className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-brand-500 focus:outline-none"
          />
        </div>
        <select
          value={subStatusFilter}
          onChange={(e) => {
            setSubPage(1);
            setSubStatusFilter(e.target.value as SpeakingStatus | '');
          }}
          className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs lg:col-span-2"
        >
          <option value="">Tất cả trạng thái</option>
          {SPEAKING_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
        <select
          value={subModeFilter}
          onChange={(e) => {
            setSubPage(1);
            setSubModeFilter(e.target.value as SpeakingMode | '');
          }}
          className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs lg:col-span-2"
        >
          <option value="">Tất cả chế độ</option>
          {SPEAKING_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={subErrorCodeInput}
          onChange={(e) => setSubErrorCodeInput(e.target.value)}
          placeholder="Mã lỗi (errorCode)..."
          className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none lg:col-span-2"
        />
        <div className="flex flex-wrap items-center justify-end gap-1.5 lg:col-span-3">
          <button
            type="submit"
            className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
          >
            Lọc
          </button>
          <button
            type="button"
            disabled={!hasActiveSubFilters}
            onClick={handleResetSubFilters}
            className="inline-flex items-center gap-1 rounded-xl border border-slateDark-200 bg-white px-2.5 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Đặt lại bộ lọc</span>
          </button>
          <button
            type="button"
            disabled={subsLoading}
            onClick={() => void loadSubmissions()}
            aria-label="Làm mới bài nộp Speaking"
            className="rounded-xl border border-slateDark-200 bg-white p-2 text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${subsLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </form>
    </div>

    {/* Bảng Bài nộp Speaking */}
    <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
            <tr>
              <th className="px-5 py-3.5">Học viên</th>
              <th className="px-4 py-3.5">Đề luyện nói</th>
              <th className="px-4 py-3.5">Trạng thái</th>
              <th className="px-4 py-3.5">Điểm / Lỗi</th>
              <th className="px-4 py-3.5">Thời gian</th>
              <th className="px-5 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slateDark-100">
            {subsLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center text-slateDark-700"
                >
                  Đang tải danh sách bài nộp Speaking...
                </td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center text-slateDark-700"
                >
                  Không có bài nộp Speaking nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              submissions.map((sub) => (
                <tr
                  key={sub.id}
                  onClick={() => void openSubmissionDrawer(sub.id)}
                  className="cursor-pointer transition hover:bg-slateDark-25"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-slateDark-900">
                      {sub.user.name}
                    </p>
                    <p className="text-[11px] text-slateDark-600">
                      {sub.user.email}
                    </p>
                  </td>
                  <td className="max-w-xs px-4 py-3.5">
                    <p className="truncate font-semibold text-slateDark-900">
                      {sub.promptTitle}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-slateDark-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slateDark-700">
                        {sub.mode}
                      </span>
                      {sub.promptCode && (
                        <span className="truncate font-mono text-[10px] text-brand-700">
                          {sub.promptCode}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${submissionStatusBadgeClass(sub.status)}`}
                      >
                        {sub.status}
                      </span>
                      {sub.isStuckProcessing && (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          Job kẹt
                        </span>
                      )}
                      {sub.contentStatus && (
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            sub.contentStatus === 'succeeded'
                              ? 'bg-emerald-50 text-emerald-700'
                              : sub.contentStatus === 'unavailable'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-slateDark-50 text-slateDark-700'
                          }`}
                        >
                          content:{sub.contentStatus}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-mono font-bold text-slateDark-900">
                      {sub.overallScore !== null
                        ? `${formatScore(sub.overallScore)} / 100`
                        : '—'}
                    </p>
                    {sub.errorCode && (
                      <p className="mt-0.5 font-mono text-[11px] font-semibold text-red-600">
                        {sub.errorCode}
                      </p>
                    )}
                    {sub.adapterVersion && (
                      <p className="font-mono text-[10px] text-slateDark-600">
                        {sub.adapterVersion}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[11px] text-slateDark-700">
                    <p>{formatDateTime(sub.createdAt)}</p>
                    {sub.completedAt && (
                      <p className="text-[10px] text-slateDark-600">
                        Xong: {formatDateTime(sub.completedAt)}
                      </p>
                    )}
                  </td>
                  <td
                    className="px-5 py-3.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void openSubmissionDrawer(sub.id)
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1 font-semibold text-brand-800 hover:bg-brand-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
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
        page={subPagination.page}
        limit={subPagination.limit}
        total={subPagination.total}
        totalPages={subPagination.totalPages}
        onPageChange={(next) => setSubPage(next)}
        onLimitChange={(nextLimit) => {
          setSubLimit(nextLimit);
          setSubPage(1);
        }}
      />
    </div>
    </>
  );
}
