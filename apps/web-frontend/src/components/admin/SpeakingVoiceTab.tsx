'use client';

import React from 'react';
import {
  Clock,
  Eye,
  Lock,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import {
  VOICE_ASSESSMENT_STATUSES,
  VOICE_STATUSES,
  formatSpeakingDateTime,
  voiceAssessmentBadgeClass,
  voiceSessionBadgeClass,
  type VoiceAssessmentStatus,
  type VoiceSessionStatus,
} from '@/lib/admin-speaking-helpers';
import type {
  AdminVoiceConversationItem,
  AdminVoiceConversationsSummary,
  PaginationMeta,
} from '@/types/admin';

export interface SpeakingVoiceTabProps {
  voiceRows: AdminVoiceConversationItem[];
  voiceLoading: boolean;
  voiceSummary: AdminVoiceConversationsSummary;
  voicePagination: PaginationMeta;
  voiceSearchInput: string;
  setVoiceSearchInput: (value: string) => void;
  setVoiceSearchQuery: (value: string) => void;
  voiceStatusFilter: VoiceSessionStatus | '';
  setVoiceStatusFilter: (value: VoiceSessionStatus | '') => void;
  voiceAssessmentFilter: VoiceAssessmentStatus | '';
  setVoiceAssessmentFilter: (value: VoiceAssessmentStatus | '') => void;
  voiceStuckOnly: boolean;
  setVoiceStuckOnly: React.Dispatch<React.SetStateAction<boolean>>;
  setVoicePage: (page: number) => void;
  setVoiceLimit: (limit: number) => void;
  hasActiveVoiceFilters: boolean;
  handleResetVoiceFilters: () => void;
  loadVoiceConversations: () => Promise<void>;
  openVoiceDrawer: (id: string) => Promise<void>;
}

export function SpeakingVoiceTab({
  voiceRows,
  voiceLoading,
  voiceSummary,
  voicePagination,
  voiceSearchInput,
  setVoiceSearchInput,
  setVoiceSearchQuery,
  voiceStatusFilter,
  setVoiceStatusFilter,
  voiceAssessmentFilter,
  setVoiceAssessmentFilter,
  voiceStuckOnly,
  setVoiceStuckOnly,
  setVoicePage,
  setVoiceLimit,
  hasActiveVoiceFilters,
  handleResetVoiceFilters,
  loadVoiceConversations,
  openVoiceDrawer,
}: SpeakingVoiceTabProps): React.ReactElement {
  return (
    <>
      {/* Summary Badges */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            setVoiceStuckOnly((prev) => !prev);
            setVoicePage(1);
          }}
          className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
            voiceStuckOnly
              ? 'border-red-400 bg-red-100 text-red-900 shadow-sm'
              : 'border-red-200 bg-red-50/70 text-red-800 hover:bg-red-50'
          }`}
        >
          <Lock className="h-3.5 w-3.5 text-red-600" />
          <span>Khóa đang hoạt động (activeLocks):</span>
          <strong className="font-mono">{voiceSummary.activeLocks}</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setVoiceAssessmentFilter(
              voiceAssessmentFilter === 'FAILED' ? '' : 'FAILED',
            );
            setVoicePage(1);
          }}
          className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
            voiceAssessmentFilter === 'FAILED'
              ? 'border-amber-400 bg-amber-100 text-amber-950 shadow-sm'
              : 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-50'
          }`}
        >
          <XCircle className="h-3.5 w-3.5 text-amber-700" />
          <span>Chấm điểm lỗi (failedAssessments):</span>
          <strong className="font-mono">
            {voiceSummary.failedAssessments}
          </strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setVoiceStuckOnly(true);
            setVoicePage(1);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-50"
        >
          <Clock className="h-3.5 w-3.5 text-blue-600" />
          <span>Chấm điểm treo (stuckProcessing):</span>
          <strong className="font-mono">{voiceSummary.stuckProcessing}</strong>
        </button>
      </div>

      {/* Bộ lọc Voice AI */}
      <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setVoicePage(1);
            setVoiceSearchQuery(voiceSearchInput.trim());
          }}
          className="grid grid-cols-1 items-center gap-3 lg:grid-cols-12"
        >
          <div className="relative lg:col-span-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
            <input
              type="text"
              value={voiceSearchInput}
              onChange={(e) => setVoiceSearchInput(e.target.value)}
              placeholder="Email, tên học viên hoặc UUID..."
              className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-brand-500 focus:outline-none"
            />
          </div>
          <select
            value={voiceStatusFilter}
            onChange={(e) => {
              setVoicePage(1);
              setVoiceStatusFilter(
                e.target.value as VoiceSessionStatus | '',
              );
            }}
            className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs lg:col-span-2"
          >
            <option value="">Tất cả trạng thái phiên</option>
            {VOICE_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <select
            value={voiceAssessmentFilter}
            onChange={(e) => {
              setVoicePage(1);
              setVoiceAssessmentFilter(
                e.target.value as VoiceAssessmentStatus | '',
              );
            }}
            className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs lg:col-span-2"
          >
            <option value="">Tất cả trạng thái chấm</option>
            {VOICE_ASSESSMENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slateDark-200 bg-slateDark-25 px-3 py-2 text-xs font-semibold text-slateDark-800 lg:col-span-2">
            <input
              type="checkbox"
              checked={voiceStuckOnly}
              onChange={(e) => {
                setVoicePage(1);
                setVoiceStuckOnly(e.target.checked);
              }}
              className="h-4 w-4 accent-brand-600"
            />
            <span>Chỉ phiên treo / khóa</span>
          </label>
          <div className="flex flex-wrap items-center justify-end gap-1.5 lg:col-span-3">
            <button
              type="submit"
              className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
            >
              Lọc
            </button>
            <button
              type="button"
              disabled={!hasActiveVoiceFilters}
              onClick={handleResetVoiceFilters}
              className="inline-flex items-center gap-1 rounded-xl border border-slateDark-200 bg-white px-2.5 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Đặt lại bộ lọc</span>
            </button>
            <button
              type="button"
              disabled={voiceLoading}
              onClick={() => void loadVoiceConversations()}
              aria-label="Làm mới hội thoại Voice AI"
              className="rounded-xl border border-slateDark-200 bg-white p-2 text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${voiceLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </form>
      </div>

      {/* Bảng Hội thoại Voice AI */}
      <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
              <tr>
                <th className="px-5 py-3.5">Học viên</th>
                <th className="px-4 py-3.5">Chủ đề & Số lượt</th>
                <th className="px-4 py-3.5">Trạng thái phiên</th>
                <th className="px-4 py-3.5">Trạng thái chấm</th>
                <th className="px-4 py-3.5">Thời gian</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slateDark-100">
              {voiceLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-slateDark-700"
                  >
                    Đang tải danh sách hội thoại Voice AI...
                  </td>
                </tr>
              ) : voiceRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-slateDark-700"
                  >
                    Không có phiên hội thoại nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                voiceRows.map((vc) => (
                  <tr
                    key={vc.id}
                    onClick={() => void openVoiceDrawer(vc.id)}
                    className="cursor-pointer transition hover:bg-slateDark-25"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slateDark-900">
                        {vc.user.name}
                      </p>
                      <p className="text-[11px] text-slateDark-600">
                        {vc.user.email}
                      </p>
                    </td>
                    <td className="max-w-xs px-4 py-3.5">
                      <p className="truncate font-semibold text-slateDark-900">
                        {vc.topicTitle}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slateDark-600">
                        {vc.turnsCount} lượt nói · {vc.historyStatus}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${voiceSessionBadgeClass(vc.status)}`}
                        >
                          {vc.status}
                        </span>
                        {vc.hasActiveLock && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            <Lock className="h-3 w-3" />
                            <span>Đang khóa</span>
                          </span>
                        )}
                      </div>
                      {vc.endReason && (
                        <p className="mt-0.5 font-mono text-[10px] text-slateDark-600">
                          {vc.endReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${voiceAssessmentBadgeClass(vc.assessmentStatus)}`}
                      >
                        {vc.assessmentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-slateDark-700">
                      <p>{formatSpeakingDateTime(vc.createdAt)}</p>
                      {vc.endedAt && (
                        <p className="text-[10px] text-slateDark-600">
                          Kết thúc: {formatSpeakingDateTime(vc.endedAt)}
                        </p>
                      )}
                    </td>
                    <td
                      className="px-5 py-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => void openVoiceDrawer(vc.id)}
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
          page={voicePagination.page}
          limit={voicePagination.limit}
          total={voicePagination.total}
          totalPages={voicePagination.totalPages}
          onPageChange={(next) => setVoicePage(next)}
          onLimitChange={(nextLimit) => {
            setVoiceLimit(nextLimit);
            setVoicePage(1);
          }}
        />
      </div>
    </>
  );
}
