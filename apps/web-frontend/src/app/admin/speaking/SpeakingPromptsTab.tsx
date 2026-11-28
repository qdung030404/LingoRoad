'use client';

import React from 'react';
import { CheckCircle2, Copy, Image as ImageIcon, MessageSquare, Mic, Plus, RotateCcw, Search, X } from 'lucide-react';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import { resolveAdminMediaUrl } from '@/lib/admin-api';
import {
  MAX_BULK_SELECTION,
  MODE_TABS,
  PAGE_LIMITS,
  PUBLISHED_OPTIONS,
} from './speaking-admin.helpers';
import type { SpeakingAdminState } from './useSpeakingAdminState';

export function SpeakingPromptsTab({
  state,
}: {
  state: SpeakingAdminState;
}): React.ReactElement | null {
  const {
    promptsSummary,
    promptModeFilter,
    setPromptModeFilter,
    setPromptsPage,
    promptPublishedFilter,
    setPromptPublishedFilter,
    promptSearchInput,
    setPromptSearchInput,
    setPromptSearchQuery,
    handleResetPromptFilters,
    selectedPromptIds,
    setSelectedPromptIds,
    bulkBusy,
    handleBulkPublishPrompts,
    promptsLoading,
    prompts,
    handleToggleSelectAllPrompts,
    handleToggleSelectPrompt,
    handleTogglePublish,
    setEditingPrompt,
    setCloningPrompt,
    setShowModal,
    setDeleteTarget,
    setForceDelete,
    promptsPagination,
    promptsPage,
    promptsLimit,
    setPromptsLimit,
    hasActivePromptFilters,
    allPromptsSelected,
  } = state;
  return (
    <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <LegacyStatCard
        label="Tổng đề luyện nói"
        value={promptsSummary.total}
        subtitle={`${promptsSummary.readAloud} Read Aloud · ${promptsSummary.tongueTwister} Twister`}
        icon={<Mic className="h-4 w-4" />}
        tone="green"
      />
      <LegacyStatCard
        label="Đã xuất bản"
        value={promptsSummary.published}
        subtitle="Hiển thị trên ứng dụng"
        icon={<CheckCircle2 className="h-4 w-4" />}
        tone="emerald"
      />
      <LegacyStatCard
        label="Chủ đề / Voice AI"
        value={promptsSummary.topic}
        subtitle="Hỗ trợ Preparation DB"
        icon={<MessageSquare className="h-4 w-4" />}
        tone="amber"
      />
      <LegacyStatCard
        label="Mô tả tranh"
        value={promptsSummary.pictureDescription}
        subtitle="Kèm ảnh & visualContext"
        icon={<ImageIcon className="h-4 w-4" />}
        tone="slate"
      />
    </div>

    {/* Mode Tabs & Filters */}
    <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-1.5">
        {MODE_TABS.map((item) => (
          <button
            key={item.value || 'all'}
            type="button"
            onClick={() => {
              setPromptModeFilter(item.value);
              setPromptsPage(1);
            }}
            className={
              promptModeFilter === item.value
                ? 'rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white'
                : 'rounded-xl bg-slateDark-50 px-3.5 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-100'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPromptsPage(1);
          setPromptSearchQuery(promptSearchInput.trim());
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-12"
      >
        <div className="relative sm:col-span-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
          <input
            type="text"
            value={promptSearchInput}
            onChange={(e) => setPromptSearchInput(e.target.value)}
            placeholder="Tìm mã đề, tiêu đề hoặc nội dung..."
            className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-brand-500 focus:outline-none"
          />
        </div>
        <select
          value={promptPublishedFilter}
          onChange={(e) => {
            setPromptsPage(1);
            setPromptPublishedFilter(
              e.target.value as '' | 'true' | 'false',
            );
          }}
          className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-3"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Published</option>
          <option value="false">Bản nháp</option>
        </select>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-4">
          <button
            type="submit"
            className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-4 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
          >
            Lọc
          </button>
          <button
            type="button"
            disabled={!hasActivePromptFilters}
            onClick={handleResetPromptFilters}
            className="inline-flex items-center gap-1 rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Đặt lại bộ lọc</span>
          </button>
        </div>
      </form>
    </div>

    {/* Bulk Action Bar */}
    {selectedPromptIds.length > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-25 px-5 py-3 shadow-sm">
        <p className="text-xs font-bold text-brand-900">
          Đã chọn {selectedPromptIds.length} đề luyện nói (tối đa{' '}
          {MAX_BULK_SELECTION}/lần)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void handleBulkPublishPrompts(true)}
            className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {bulkBusy ? 'Đang xử lý...' : 'Xuất bản hàng loạt'}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void handleBulkPublishPrompts(false)}
            className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {bulkBusy ? 'Đang xử lý...' : 'Chuyển nháp hàng loạt'}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setSelectedPromptIds([])}
            className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-50"
          >
            Bỏ chọn
          </button>
        </div>
      </div>
    )}

    <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
            <tr>
              <th className="w-10 px-4 py-3.5">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả đề luyện nói trên trang này"
                  checked={allPromptsSelected}
                  disabled={prompts.length === 0}
                  onChange={handleToggleSelectAllPrompts}
                  className="h-4 w-4 accent-brand-600"
                />
              </th>
              <th className="px-4 py-3.5">Đề luyện nói</th>
              <th className="px-4 py-3.5">Chế độ</th>
              <th className="px-4 py-3.5">Độ khó / Thời lượng</th>
              <th className="px-4 py-3.5">Trạng thái</th>
              <th className="px-5 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slateDark-100">
            {promptsLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center text-slateDark-700"
                >
                  Đang tải danh sách đề luyện nói...
                </td>
              </tr>
            ) : prompts.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center text-slateDark-700"
                >
                  Không tìm thấy đề luyện nói nào.
                </td>
              </tr>
            ) : (
              prompts.map((p) => {
                const isSelected = selectedPromptIds.includes(p.id);
                return (
                  <tr
                    key={p.id}
                    className={
                      isSelected
                        ? 'bg-brand-25/40 hover:bg-brand-25/70'
                        : 'hover:bg-slateDark-25'
                    }
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        aria-label={`Chọn đề ${p.title}`}
                        checked={isSelected}
                        onChange={() => handleToggleSelectPrompt(p.id)}
                        className="h-4 w-4 accent-brand-600"
                      />
                    </td>
                    <td className="max-w-md px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {p.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveAdminMediaUrl(p.imageUrl)}
                            alt={p.title}
                            className="h-10 w-10 shrink-0 rounded-lg border border-slateDark-100 object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slateDark-900">
                            {p.title}
                          </p>
                          <p className="truncate font-mono text-[11px] text-brand-700">
                            {p.code} · {p.submissionsCount} lượt nộp
                            {p.preparation ? ' · Có Voice Prep' : ''}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-slateDark-700">
                            {p.text}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-slateDark-50 px-2.5 py-0.5 font-semibold text-slateDark-800">
                        {p.mode}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slateDark-800">
                      Lv.{p.difficulty} · {p.maxDurationSeconds}s
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => void handleTogglePublish(p)}
                        className={
                          p.published
                            ? 'rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100'
                            : 'rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100'
                        }
                      >
                        {p.published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPrompt(null);
                            setCloningPrompt(p);
                            setShowModal(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1 font-semibold text-brand-800 hover:bg-brand-50"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Nhân bản</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCloningPrompt(null);
                            setEditingPrompt(p);
                            setShowModal(true);
                          }}
                          className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 font-semibold text-slateDark-900 hover:bg-slateDark-50"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setForceDelete(false);
                            setDeleteTarget(p);
                          }}
                          className="rounded-lg border border-red-200 bg-white px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <GlobalPagination
        page={promptsPagination.page}
        limit={promptsPagination.limit}
        total={promptsPagination.total}
        totalPages={promptsPagination.totalPages}
        onPageChange={(next) => setPromptsPage(next)}
        onLimitChange={(nextLimit) => {
          setPromptsLimit(nextLimit);
          setPromptsPage(1);
        }}
      />
    </div>
    </>
  );
}
