'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, GitBranch, Link2, Plus, RotateCcw, Search } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { NOOP_ADMIN_TOAST, useAdminToast, type AdminToastApi } from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { GrammarTopicModal } from '@/components/admin/GrammarTopicModal';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import {
  addAdminGrammarPrerequisite,
  deleteAdminGrammarTopic,
  downloadAdminExport,
  listAdminGrammarTopics,
  removeAdminGrammarPrerequisite,
  updateAdminGrammarTopic,
} from '@/lib/admin-api';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { AdminGrammarTopic, CefrLevel } from '@/types/admin';
import { GrammarPrereqModal } from './GrammarPrereqModal';
import { GrammarTopicsTable } from './GrammarTopicsTable';

const LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

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

export default function AdminGrammarPage(): React.ReactElement {
  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [authReady, setAuthReady] = useState(false);
  const [topics, setTopics] = useState<AdminGrammarTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [cefrFilter, setCefrFilter] = useState<CefrLevel | ''>('');
  const [leafFilter, setLeafFilter] = useState<'' | 'true' | 'false'>('');
  const [publishedFilter, setPublishedFilter] = useState<'' | 'true' | 'false'>('');
  const [bannerError, setBannerError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<AdminGrammarTopic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminGrammarTopic | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [prereqTarget, setPrereqTarget] = useState<AdminGrammarTopic | null>(null);
  const [selectedPrereqId, setSelectedPrereqId] = useState('');
  const [prereqError, setPrereqError] = useState<string | null>(null);
  const [prereqSaving, setPrereqSaving] = useState(false);

  const loadTopics = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setBannerError(null);
    try {
      const rows = await listAdminGrammarTopics({
        cefrLevel: cefrFilter,
        search: debouncedSearch,
        published: publishedFilter,
        isLeaf: leafFilter,
      });
      if (requestId !== requestIdRef.current) return;
      setTopics(rows);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setBannerError(
        err instanceof Error ? err.message : 'Không thể tải đồ thị ngữ pháp.',
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [cefrFilter, debouncedSearch, publishedFilter, leafFilter]);

  useEffect(() => {
    if (!authReady) return;
    void loadTopics();
  }, [authReady, loadTopics]);

  const leafTopics = useMemo(() => topics.filter((t) => t.isLeaf), [topics]);
  const groupCount = topics.length - leafTopics.length;
  const edgeCount = useMemo(
    () => topics.reduce((sum, t) => sum + t.prerequisiteIds.length, 0),
    [topics],
  );
  const hasActiveFilters = Boolean(
    search.trim() || cefrFilter || leafFilter || publishedFilter,
  );

  const handleResetFilters = (): void => {
    setSearch('');
    setCefrFilter('');
    setLeafFilter('');
    setPublishedFilter('');
  };

  const handleTogglePublish = async (topic: AdminGrammarTopic): Promise<void> => {
    setBannerError(null);
    try {
      await updateAdminGrammarTopic(topic.id, { published: !topic.published });
      toastRef.current.success(
        !topic.published
          ? `Đã xuất bản "${topic.titleVi}".`
          : `Đã ẩn "${topic.titleVi}" (Bản nháp).`,
      );
      await loadTopics();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cập nhật thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setBannerError(null);
    try {
      await deleteAdminGrammarTopic(deleteTarget.id);
      toastRef.current.success(`Đã xoá chủ điểm "${deleteTarget.titleVi}".`);
      setDeleteTarget(null);
      await loadTopics();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Xoá chủ điểm thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const refreshPrereqTarget = async (targetId: string): Promise<void> => {
    const requestId = ++requestIdRef.current;
    const refreshed = await listAdminGrammarTopics({
      cefrLevel: cefrFilter,
      search: debouncedSearch,
      published: publishedFilter,
      isLeaf: leafFilter,
    });
    if (requestId === requestIdRef.current) {
      setTopics(refreshed);
      setPrereqTarget(refreshed.find((t) => t.id === targetId) ?? null);
    }
  };

  const handleAddPrerequisite = async (): Promise<void> => {
    if (!prereqTarget || !selectedPrereqId) return;
    setPrereqError(null);
    setPrereqSaving(true);
    try {
      await addAdminGrammarPrerequisite(selectedPrereqId, prereqTarget.id);
      setSelectedPrereqId('');
      await refreshPrereqTarget(prereqTarget.id);
      toastRef.current.success('Đã thêm liên kết tiên quyết (DAG) hợp lệ.');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể thêm cạnh tiên quyết.';
      setPrereqError(msg);
      toastRef.current.error(msg);
    } finally {
      setPrereqSaving(false);
    }
  };

  const handleRemovePrerequisite = async (prereqId: string): Promise<void> => {
    if (!prereqTarget) return;
    setPrereqError(null);
    setPrereqSaving(true);
    try {
      await removeAdminGrammarPrerequisite(prereqId, prereqTarget.id);
      await refreshPrereqTarget(prereqTarget.id);
      toastRef.current.success('Đã gỡ liên kết tiên quyết.');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể gỡ cạnh tiên quyết.';
      setPrereqError(msg);
      toastRef.current.error(msg);
    } finally {
      setPrereqSaving(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    setBannerError(null);
    try {
      await downloadAdminExport('grammar', 'json');
      toastRef.current.success('Đã xuất dữ liệu ngữ pháp (JSON).');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Xuất dữ liệu ngữ pháp thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminShell
      breadcrumbTitle="Ngữ pháp"
      title="Grammar Knowledge Graph (DAG)"
      subtitle="Quản lý cây chuyên đề ngữ pháp A1–C2, công thức, ví dụ và đồ thị tiên quyết không chu trình."
      onAuthenticated={() => setAuthReady(true)}
      actions={
        <>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? 'Đang xuất...' : 'JSON'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingTopic(null);
              setShowModal(true);
            }}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo chủ điểm</span>
          </button>
        </>
      }
    >
      {() => (
        <div className="space-y-5">
          <AdminToastBridge toastRef={toastRef} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <LegacyStatCard
              label="Tổng nút ngữ pháp"
              value={topics.length}
              subtitle={`${groupCount} nhóm · ${leafTopics.length} cấu trúc lá`}
              icon={<GitBranch className="h-4 w-4" />}
              tone="green"
            />
            <LegacyStatCard
              label="Cạnh tiên quyết (DAG)"
              value={edgeCount}
              subtitle="Kiểm tra chu trình tự động"
              icon={<Link2 className="h-4 w-4" />}
              tone="emerald"
            />
            <LegacyStatCard
              label="Bài học đã liên kết"
              value={topics.reduce((s, t) => s + t.lessonsCount, 0)}
              subtitle="Gắn với bài học lộ trình"
              icon={<GitBranch className="h-4 w-4" />}
              tone="amber"
            />
          </div>

          {bannerError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
              {bannerError}
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="relative sm:col-span-5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo mã grammar.*, tên tiếng Việt hoặc tiếng Anh..."
                  className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
              <select
                value={cefrFilter}
                onChange={(e) => setCefrFilter(e.target.value as CefrLevel | '')}
                className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-2"
              >
                <option value="">Tất cả CEFR</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                value={leafFilter}
                onChange={(e) =>
                  setLeafFilter(e.target.value as '' | 'true' | 'false')
                }
                className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-2"
              >
                <option value="">Nhóm & Lá</option>
                <option value="false">Chỉ Nhóm (Group)</option>
                <option value="true">Chỉ Cấu trúc (Leaf)</option>
              </select>
              <select
                value={publishedFilter}
                onChange={(e) =>
                  setPublishedFilter(e.target.value as '' | 'true' | 'false')
                }
                className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-3"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="true">Published</option>
                <option value="false">Bản nháp</option>
              </select>
            </div>
            {hasActiveFilters && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Đặt lại bộ lọc</span>
                </button>
              </div>
            )}
          </div>

          <GrammarTopicsTable
            topics={topics}
            loading={loading}
            onTogglePublish={handleTogglePublish}
            onOpenPrereq={(topic) => {
              setPrereqError(null);
              setSelectedPrereqId('');
              setPrereqTarget(topic);
            }}
            onEdit={(topic) => {
              setEditingTopic(topic);
              setShowModal(true);
            }}
            onDelete={(topic) => setDeleteTarget(topic)}
          />

          {showModal && (
            <GrammarTopicModal
              allTopics={topics}
              editingTopic={editingTopic}
              onClose={() => {
                setShowModal(false);
                setEditingTopic(null);
              }}
              onSaved={() => {
                setShowModal(false);
                toastRef.current.success(
                  editingTopic
                    ? 'Đã cập nhật chủ điểm ngữ pháp.'
                    : 'Đã tạo chủ điểm ngữ pháp mới.',
                );
                setEditingTopic(null);
                void loadTopics();
              }}
            />
          )}

          <GrammarPrereqModal
            prereqTarget={prereqTarget}
            topics={topics}
            leafTopics={leafTopics}
            selectedPrereqId={selectedPrereqId}
            setSelectedPrereqId={setSelectedPrereqId}
            prereqError={prereqError}
            prereqSaving={prereqSaving}
            onClose={() => setPrereqTarget(null)}
            onAdd={handleAddPrerequisite}
            onRemove={handleRemovePrerequisite}
          />

          <ConfirmDialog
            open={Boolean(deleteTarget)}
            title="Xoá chủ điểm ngữ pháp"
            description={
              deleteTarget ? (
                <>
                  Bạn có chắc muốn xoá chủ điểm ngữ pháp{' '}
                  <strong>{deleteTarget.titleVi}</strong> (
                  <code className="font-mono text-xs">{deleteTarget.code}</code>
                  )? Hành động này không thể hoàn tác.
                </>
              ) : null
            }
            confirmLabel="Xoá chủ điểm"
            tone="danger"
            busy={deleting}
            onConfirm={handleConfirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        </div>
      )}
    </AdminShell>
  );
}
