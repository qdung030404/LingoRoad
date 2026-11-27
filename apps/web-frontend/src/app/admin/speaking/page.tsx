'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  Plus,
  Search,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import { SpeakingPromptModal } from '@/components/admin/SpeakingPromptModal';
import {
  deleteAdminSpeakingPrompt,
  downloadAdminExport,
  listAdminSpeakingPrompts,
  resolveAdminMediaUrl,
  updateAdminSpeakingPrompt,
} from '@/lib/admin-api';
import type {
  AdminSpeakingPrompt,
  PaginationMeta,
  SpeakingMode,
  SpeakingPromptsSummary,
} from '@/types/admin';

const MODE_TABS: Array<{ value: SpeakingMode | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'READ_ALOUD', label: 'Đọc to' },
  { value: 'TOPIC', label: 'Chủ đề / Voice AI' },
  { value: 'PICTURE_DESCRIPTION', label: 'Mô tả tranh' },
  { value: 'TONGUE_TWISTER', label: 'Xoắn lưỡi' },
];

export default function AdminSpeakingPage(): React.ReactElement {
  const [prompts, setPrompts] = useState<AdminSpeakingPrompt[]>([]);
  const [summary, setSummary] = useState<SpeakingPromptsSummary>({
    total: 0,
    published: 0,
    readAloud: 0,
    topic: 0,
    pictureDescription: 0,
    tongueTwister: 0,
  });
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [modeFilter, setModeFilter] = useState<SpeakingMode | ''>('');
  const [publishedFilter, setPublishedFilter] = useState<'' | 'true' | 'false'>('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AdminSpeakingPrompt | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<AdminSpeakingPrompt | null>(
    null,
  );
  const [forceDelete, setForceDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    setBannerError(null);
    try {
      const res = await listAdminSpeakingPrompts({
        page,
        limit,
        search: searchQuery,
        mode: modeFilter,
        published: publishedFilter,
      });
      setPrompts(res.items);
      setPagination(res.pagination);
      if (res.summary) setSummary(res.summary);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể tải danh sách đề luyện nói.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, modeFilter, publishedFilter]);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  const handleTogglePublish = async (
    prompt: AdminSpeakingPrompt,
  ): Promise<void> => {
    try {
      await updateAdminSpeakingPrompt(prompt.id, {
        published: !prompt.published,
      });
      setBannerSuccess(
        !prompt.published
          ? `Đã xuất bản đề "${prompt.title}".`
          : `Đã chuyển đề "${prompt.title}" về bản nháp.`,
      );
      await loadPrompts();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Cập nhật thất bại.');
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteAdminSpeakingPrompt(deleteTarget.id, forceDelete);
      setBannerSuccess(
        res.action === 'DELETED'
          ? `Đã xoá đề luyện nói "${deleteTarget.title}".`
          : `Đề "${deleteTarget.title}" đã có ${res.submissionsCount} bài nộp nên đã chuyển sang Bản nháp.`,
      );
      setDeleteTarget(null);
      setForceDelete(false);
      await loadPrompts();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Xoá đề thất bại.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminShell
      breadcrumbTitle="Luyện nói"
      title="Speaking Prompts & Voice AI"
      subtitle="Quản lý 4 chế độ luyện nói, hình ảnh mô tả tranh và nội dung chuẩn bị hội thoại Voice AI."
      actions={
        <>
          <button
            type="button"
            onClick={() => void downloadAdminExport('speaking', 'json')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingPrompt(null);
              setShowModal(true);
            }}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo đề nói</span>
          </button>
        </>
      }
    >
      {() => (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LegacyStatCard
              label="Tổng đề luyện nói"
              value={summary.total}
              subtitle={`${summary.readAloud} Read Aloud · ${summary.tongueTwister} Twister`}
              icon={<Mic className="h-4 w-4" />}
              tone="green"
            />
            <LegacyStatCard
              label="Đã xuất bản"
              value={summary.published}
              subtitle="Hiển thị trên ứng dụng"
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="emerald"
            />
            <LegacyStatCard
              label="Chủ đề / Voice AI"
              value={summary.topic}
              subtitle="Hỗ trợ Preparation DB"
              icon={<MessageSquare className="h-4 w-4" />}
              tone="amber"
            />
            <LegacyStatCard
              label="Mô tả tranh"
              value={summary.pictureDescription}
              subtitle="Kèm ảnh & visualContext"
              icon={<ImageIcon className="h-4 w-4" />}
              tone="slate"
            />
          </div>

          {bannerError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
              {bannerError}
            </div>
          )}
          {bannerSuccess && (
            <div className="rounded-2xl border border-brand-200 bg-brand-25 px-5 py-3.5 text-sm font-medium text-brand-800">
              {bannerSuccess}
            </div>
          )}

          {/* Mode Tabs & Filters */}
          <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              {MODE_TABS.map((tab) => (
                <button
                  key={tab.value || 'all'}
                  type="button"
                  onClick={() => {
                    setModeFilter(tab.value);
                    setPage(1);
                  }}
                  className={
                    modeFilter === tab.value
                      ? 'rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white'
                      : 'rounded-xl bg-slateDark-50 px-3.5 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-100'
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearchQuery(searchInput);
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-12"
            >
              <div className="relative sm:col-span-7">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm mã đề, tiêu đề hoặc nội dung..."
                  className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
              <select
                value={publishedFilter}
                onChange={(e) => {
                  setPage(1);
                  setPublishedFilter(e.target.value as '' | 'true' | 'false');
                }}
                className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-3"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="true">Published</option>
                <option value="false">Bản nháp</option>
              </select>
              <button
                type="submit"
                className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-4 py-2 text-xs font-semibold text-slateDark-900 sm:col-span-2"
              >
                Lọc
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                  <tr>
                    <th className="px-5 py-3.5">Đề luyện nói</th>
                    <th className="px-4 py-3.5">Chế độ</th>
                    <th className="px-4 py-3.5">Độ khó / Thời lượng</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slateDark-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slateDark-700">
                        Đang tải danh sách đề luyện nói...
                      </td>
                    </tr>
                  ) : prompts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slateDark-700">
                        Không tìm thấy đề luyện nói nào.
                      </td>
                    </tr>
                  ) : (
                    prompts.map((p) => (
                      <tr key={p.id} className="hover:bg-slateDark-25">
                        <td className="max-w-md px-5 py-3.5">
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
                                ? 'rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700'
                                : 'rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800'
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

          {showModal && (
            <SpeakingPromptModal
              editingPrompt={editingPrompt}
              onClose={() => {
                setShowModal(false);
                setEditingPrompt(null);
              }}
              onSaved={() => {
                setShowModal(false);
                setBannerSuccess(
                  editingPrompt
                    ? 'Đã cập nhật đề luyện nói.'
                    : 'Đã tạo đề luyện nói mới.',
                );
                setEditingPrompt(null);
                void loadPrompts();
              }}
            />
          )}

          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="w-full max-w-md space-y-4 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-slateDark-900">
                  Xác nhận xoá đề luyện nói
                </h2>
                <p className="text-sm text-slateDark-800">
                  Đề: <strong>{deleteTarget.title}</strong>
                </p>

                {deleteTarget.submissionsCount > 0 ? (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      Đề này đã có{' '}
                      <strong>{deleteTarget.submissionsCount} bài nộp</strong>. Mặc
                      định sẽ chuyển về <strong>Bản nháp (Unpublish)</strong> để bảo
                      toàn lịch sử người học.
                    </div>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                      <input
                        type="checkbox"
                        checked={forceDelete}
                        onChange={(e) => setForceDelete(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-red-600"
                      />
                      <span>
                        <strong>Xoá cưỡng bức (Force Delete)</strong>: Xoá sạch đề
                        và toàn bộ {deleteTarget.submissionsCount} bài nộp liên quan.
                      </span>
                    </label>
                  </>
                ) : (
                  <p className="text-xs text-slateDark-700">
                    Đề chưa có bài nộp và sẽ được xoá vĩnh viễn.
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleConfirmDelete()}
                    className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting
                      ? 'Đang xử lý...'
                      : deleteTarget.submissionsCount > 0 && !forceDelete
                        ? 'Chuyển bản nháp'
                        : 'Xoá đề'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
