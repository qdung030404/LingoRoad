'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  ClipboardList,
  Compass,
  Download,
  FileEdit,
  FileUp,
  FolderKanban,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { AssessmentItemModal } from '@/components/admin/AssessmentItemModal';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import { MediaUploadField } from '@/components/admin/MediaUploadField';
import {
  createAdminAssessmentGroup,
  deleteAdminAssessmentGroup,
  deleteAdminAssessmentItem,
  downloadAdminExport,
  listAdminAssessmentGroups,
  listAdminAssessmentItems,
  listDescriptors,
  updateAdminAssessmentGroup,
} from '@/lib/admin-api';
import type {
  AdminAssessmentGroup,
  AdminAssessmentItem,
  AssessmentItemsSummary,
  AssessmentSkill,
  CefrDescriptorItem,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  PaginationMeta,
} from '@/types/admin';

function formatShortType(type: ItemType): string {
  if (type === 'MULTIPLE_CHOICE') return 'mcq';
  if (type === 'SENTENCE_REORDER') return 'reorder';
  return type.toLowerCase();
}

export default function AdminItemsPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'items' | 'groups'>('items');
  const [descriptors, setDescriptors] = useState<CefrDescriptorItem[]>([]);
  const [allGroupsForSelect, setAllGroupsForSelect] = useState<
    AdminAssessmentGroup[]
  >([]);

  // Items state
  const [items, setItems] = useState<AdminAssessmentItem[]>([]);
  const [summary, setSummary] = useState<AssessmentItemsSummary>({
    total: 0,
    mcqCount: 0,
    clozeAndOtherCount: 0,
    coveredSkillsCount: 0,
  });
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemType | ''>('');
  const [skillFilter, setSkillFilter] = useState<AssessmentSkill | ''>('');
  const [cefrFilter, setCefrFilter] = useState<CefrLevel | ''>('');
  const [usageScopeFilter, setUsageScopeFilter] = useState<ItemUsageScope | ''>('');
  const [loading, setLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminAssessmentItem | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] =
    useState<AdminAssessmentItem | null>(null);
  const [forceDelete, setForceDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Groups tab state
  const [groups, setGroups] = useState<AdminAssessmentGroup[]>([]);
  const [groupsPagination, setGroupsPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [groupsPage, setGroupsPage] = useState(1);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminAssessmentGroup | null>(
    null,
  );
  const [gSkill, setGSkill] = useState<AssessmentSkill>('READING');
  const [gCefr, setGCefr] = useState<CefrLevel>('B1');
  const [gScope, setGScope] = useState<ItemUsageScope>('MOCK_EXAM');
  const [gPartNumber, setGPartNumber] = useState(1);
  const [gTitle, setGTitle] = useState('');
  const [gPassage, setGPassage] = useState('');
  const [gAudioUrl, setGAudioUrl] = useState('');
  const [gTranscript, setGTranscript] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const loadDescriptors = useCallback(async () => {
    try {
      const [descRows, grpRes] = await Promise.all([
        listDescriptors(),
        listAdminAssessmentGroups({ page: 1, limit: 100 }),
      ]);
      setDescriptors(descRows);
      setAllGroupsForSelect(grpRes.items);
    } catch {
      // Bỏ qua lỗi phụ
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setBannerError(null);
    try {
      const result = await listAdminAssessmentItems({
        page,
        limit,
        search: searchQuery,
        type: typeFilter,
        skill: skillFilter,
        cefrLevel: cefrFilter,
        usageScope: usageScopeFilter,
      });
      setItems(result.items);
      setPagination(result.pagination);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (err) {
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách câu hỏi.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, typeFilter, skillFilter, cefrFilter, usageScopeFilter]);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    setBannerError(null);
    try {
      const result = await listAdminAssessmentGroups({
        page: groupsPage,
        limit: 10,
        skill: skillFilter,
        cefrLevel: cefrFilter,
        usageScope: usageScopeFilter,
        search: searchQuery,
      });
      setGroups(result.items);
      setGroupsPagination(result.pagination);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể tải danh sách nhóm đề.',
      );
    } finally {
      setGroupsLoading(false);
    }
  }, [groupsPage, skillFilter, cefrFilter, usageScopeFilter, searchQuery]);

  useEffect(() => {
    void loadDescriptors();
  }, [loadDescriptors]);

  useEffect(() => {
    if (activeTab === 'items') {
      void loadItems();
    } else {
      void loadGroups();
    }
  }, [activeTab, loadItems, loadGroups]);

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      await deleteAdminAssessmentItem(deleteTarget.id, forceDelete);
      setBannerSuccess('Đã xoá câu hỏi khỏi Item Bank.');
      setDeleteTarget(null);
      setForceDelete(false);
      await loadItems();
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể xoá câu hỏi.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const openGroupModal = (group: AdminAssessmentGroup | null): void => {
    setEditingGroup(group);
    setGSkill(group?.skill ?? 'READING');
    setGCefr(group?.cefrLevel ?? 'B1');
    setGScope(group?.usageScope ?? 'MOCK_EXAM');
    setGPartNumber(group?.partNumber ?? 1);
    setGTitle(group?.title ?? '');
    setGPassage(group?.passage ?? '');
    setGAudioUrl(group?.audioUrl ?? '');
    setGTranscript(group?.transcript ?? '');
    setGroupError(null);
    setShowGroupModal(true);
  };

  const handleSaveGroup = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setGroupError(null);
    setSavingGroup(true);
    try {
      const payload = {
        skill: gSkill,
        cefrLevel: gCefr,
        usageScope: gScope,
        partNumber: gPartNumber,
        title: gTitle.trim() || undefined,
        passage: gPassage.trim() || undefined,
        audioUrl: gAudioUrl.trim() || undefined,
        transcript: gTranscript.trim() || undefined,
      };
      if (editingGroup) {
        await updateAdminAssessmentGroup(editingGroup.id, payload);
        setBannerSuccess('Đã cập nhật nhóm câu hỏi.');
      } else {
        await createAdminAssessmentGroup(payload);
        setBannerSuccess('Đã tạo nhóm câu hỏi mới.');
      }
      setShowGroupModal(false);
      await Promise.all([loadGroups(), loadDescriptors()]);
    } catch (err) {
      setGroupError(
        err instanceof Error ? err.message : 'Không thể lưu nhóm câu hỏi.',
      );
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (group: AdminAssessmentGroup): Promise<void> => {
    if (
      !window.confirm(
        `Xoá nhóm "${group.title || `Part ${group.partNumber}`}"? Các câu hỏi con (${group.itemsCount}) sẽ được gỡ liên kết an toàn.`,
      )
    ) {
      return;
    }
    try {
      const res = await deleteAdminAssessmentGroup(group.id);
      setBannerSuccess(
        `Đã xoá nhóm câu hỏi (gỡ liên kết ${res.detachedItemsCount} câu hỏi).`,
      );
      await Promise.all([loadGroups(), loadDescriptors()]);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Xoá nhóm thất bại.');
    }
  };

  const needsForceDelete = Boolean(
    deleteTarget &&
      (deleteTarget.responsesCount > 0 ||
        (deleteTarget.activeSessionsCount ?? 0) > 0),
  );

  return (
    <AdminShell
      breadcrumbTitle="Ngân hàng đề"
      title="Item Bank & Nhóm đề"
      subtitle="Quản lý câu hỏi IRT, phạm vi Placement/Mock Exam và nhóm ngữ cảnh chung (AssessmentItemGroup)."
      actions={
        <>
          <button
            type="button"
            onClick={() => void downloadAdminExport('items', 'csv')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
          <Link
            href="/admin/import"
            className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-4 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <FileUp className="h-4 w-4" />
            <span>Import JSON</span>
          </Link>
          {activeTab === 'items' ? (
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setShowModal(true);
              }}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo item</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openGroupModal(null)}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo nhóm đề</span>
            </button>
          )}
        </>
      }
    >
      {() => (
        <div className="space-y-5">
          {/* Tabs Items / Groups */}
          <div className="inline-flex rounded-xl border border-slateDark-100 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={
                activeTab === 'items'
                  ? 'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm'
                  : 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50'
              }
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Câu hỏi (Items)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={
                activeTab === 'groups'
                  ? 'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm'
                  : 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50'
              }
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Nhóm đề (Groups · {allGroupsForSelect.length})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LegacyStatCard
              label="Tổng Items"
              value={summary.total}
              subtitle="Ngân hàng đề hiện có"
              icon={<ClipboardList className="h-4 w-4" />}
              tone="green"
            />
            <LegacyStatCard
              label="MCQ"
              value={summary.mcqCount}
              subtitle="Trắc nghiệm nhiều lựa chọn"
              icon={<CheckSquare className="h-4 w-4" />}
              tone="emerald"
            />
            <LegacyStatCard
              label="Cloze & Khác"
              value={summary.clozeAndOtherCount}
              subtitle="Cloze, viết & nói"
              icon={<FileEdit className="h-4 w-4" />}
              tone="amber"
            />
            <LegacyStatCard
              label="Kỹ năng phủ"
              value={summary.coveredSkillsCount}
              subtitle="Số skillCode đang có"
              icon={<Compass className="h-4 w-4" />}
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

          {/* Thanh lọc */}
          <div className="rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setGroupsPage(1);
                setSearchQuery(searchInput);
              }}
              className="grid grid-cols-1 items-end gap-3 lg:grid-cols-12"
            >
              <div className="lg:col-span-3">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Tìm kiếm
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="ID, đề bài hoặc skill..."
                    className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {activeTab === 'items' && (
                <div className="lg:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                    Loại
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setPage(1);
                      setTypeFilter(e.target.value as ItemType | '');
                    }}
                    className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Tất cả loại</option>
                    <option value="MULTIPLE_CHOICE">MCQ</option>
                    <option value="CLOZE">Cloze</option>
                    <option value="GAP_FILL">Gap Fill</option>
                    <option value="SENTENCE_REORDER">Reorder</option>
                    <option value="MATCHING">Matching</option>
                    <option value="ESSAY">Essay</option>
                    <option value="SPEAKING_PROMPT">Speaking</option>
                  </select>
                </div>
              )}

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Phạm vi
                </label>
                <select
                  value={usageScopeFilter}
                  onChange={(e) => {
                    setPage(1);
                    setGroupsPage(1);
                    setUsageScopeFilter(e.target.value as ItemUsageScope | '');
                  }}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Tất cả phạm vi</option>
                  <option value="ALL">ALL</option>
                  <option value="PLACEMENT">PLACEMENT</option>
                  <option value="MOCK_EXAM">MOCK_EXAM</option>
                  <option value="PRACTICE">PRACTICE</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Kỹ năng
                </label>
                <select
                  value={skillFilter}
                  onChange={(e) => {
                    setPage(1);
                    setGroupsPage(1);
                    setSkillFilter(e.target.value as AssessmentSkill | '');
                  }}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Tất cả skill</option>
                  <option value="READING">Reading</option>
                  <option value="LISTENING">Listening</option>
                  <option value="WRITING">Writing</option>
                  <option value="SPEAKING">Speaking</option>
                </select>
              </div>

              <div className="lg:col-span-1">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  CEFR
                </label>
                <select
                  value={cefrFilter}
                  onChange={(e) => {
                    setPage(1);
                    setGroupsPage(1);
                    setCefrFilter(e.target.value as CefrLevel | '');
                  }}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-2.5 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Tất cả</option>
                  {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 lg:col-span-2">
                <button
                  type="submit"
                  className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
                >
                  Lọc
                </button>
              </div>
            </form>
          </div>

          {activeTab === 'items' ? (
            <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
                    <tr>
                      <th className="px-6 py-3.5">Stable ID</th>
                      <th className="px-4 py-3.5">Câu hỏi</th>
                      <th className="px-4 py-3.5">Skill</th>
                      <th className="px-4 py-3.5">CEFR</th>
                      <th className="px-4 py-3.5">Loại</th>
                      <th className="px-6 py-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slateDark-100">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-sm text-slateDark-700"
                        >
                          Đang tải ngân hàng câu hỏi...
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-sm text-slateDark-700"
                        >
                          Chưa có câu hỏi nào khớp bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="hover:bg-slateDark-25">
                          <td className="px-6 py-4 font-mono text-xs font-medium text-brand-700">
                            {item.externalId || item.id.slice(0, 12)}
                          </td>

                          <td className="max-w-md px-4 py-4">
                            <p className="line-clamp-2 font-semibold text-slateDark-900">
                              {item.prompt}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slateDark-700">
                              {item.correctOption
                                ? `Đáp án: ${item.correctOption}`
                                : 'Chấm rubric / tự luận'}{' '}
                              · {item.usageScope} · IRT(b={item.irtB})
                              {item.group
                                ? ` · Nhóm P${item.group.partNumber}`
                                : ''}
                            </p>
                          </td>

                          <td className="px-4 py-4 font-mono text-xs text-slateDark-900">
                            {item.skillCode}
                          </td>

                          <td className="px-4 py-4">
                            <span className="inline-flex h-6 items-center justify-center rounded-full bg-amber-50 px-2.5 text-xs font-semibold text-amber-800">
                              {item.cefrLevel}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span className="inline-flex items-center rounded-full bg-slateDark-50 px-2.5 py-1 text-xs font-medium text-slateDark-800">
                              {formatShortType(item.type)}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setShowModal(true);
                                }}
                                className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setForceDelete(false);
                                  setDeleteTarget(item);
                                }}
                                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
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
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
                    <tr>
                      <th className="px-6 py-3.5">Nhóm / Part</th>
                      <th className="px-4 py-3.5">Kỹ năng & CEFR</th>
                      <th className="px-4 py-3.5">Phạm vi</th>
                      <th className="px-4 py-3.5">Câu hỏi con</th>
                      <th className="px-6 py-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slateDark-100">
                    {groupsLoading ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-sm text-slateDark-700"
                        >
                          Đang tải danh sách nhóm đề...
                        </td>
                      </tr>
                    ) : groups.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-sm text-slateDark-700"
                        >
                          Chưa có nhóm câu hỏi nào.
                        </td>
                      </tr>
                    ) : (
                      groups.map((grp) => (
                        <tr key={grp.id} className="hover:bg-slateDark-25">
                          <td className="max-w-md px-6 py-4">
                            <p className="font-semibold text-slateDark-900">
                              Part {grp.partNumber}: {grp.title || '(Chưa đặt tên)'}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-slateDark-700">
                              {grp.passage || grp.audioUrl || 'Chưa có passage/audio'}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-800">
                              {grp.skill} · {grp.cefrLevel}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs font-semibold text-slateDark-800">
                            {grp.usageScope}
                          </td>
                          <td className="px-4 py-4 text-xs font-semibold text-slateDark-900">
                            {grp.itemsCount} câu hỏi
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openGroupModal(grp)}
                                className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteGroup(grp)}
                                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
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
                page={groupsPagination.page}
                limit={groupsPagination.limit}
                total={groupsPagination.total}
                totalPages={groupsPagination.totalPages}
                onPageChange={(next) => setGroupsPage(next)}
                onLimitChange={() => undefined}
              />
            </div>
          )}

          {showModal && (
            <AssessmentItemModal
              descriptors={descriptors}
              groups={allGroupsForSelect}
              editingItem={editingItem}
              onClose={() => {
                setShowModal(false);
                setEditingItem(null);
              }}
              onSaved={() => {
                setShowModal(false);
                setBannerSuccess(
                  editingItem
                    ? 'Đã cập nhật câu hỏi thành công.'
                    : 'Đã thêm câu hỏi mới vào Item Bank.',
                );
                setEditingItem(null);
                void loadItems();
              }}
            />
          )}

          {showGroupModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
                  <h2 className="text-lg font-bold text-slateDark-900">
                    {editingGroup ? 'Cập nhật nhóm đề' : 'Tạo nhóm câu hỏi mới'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowGroupModal(false)}
                    className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => void handleSaveGroup(e)}
                  className="flex-1 space-y-4 overflow-y-auto p-6"
                >
                  {groupError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                      {groupError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Kỹ năng
                      </label>
                      <select
                        value={gSkill}
                        onChange={(e) => setGSkill(e.target.value as AssessmentSkill)}
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
                      >
                        <option value="READING">READING</option>
                        <option value="LISTENING">LISTENING</option>
                        <option value="WRITING">WRITING</option>
                        <option value="SPEAKING">SPEAKING</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        CEFR
                      </label>
                      <select
                        value={gCefr}
                        onChange={(e) => setGCefr(e.target.value as CefrLevel)}
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
                      >
                        {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map(
                          (l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Part #
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={gPartNumber}
                        onChange={(e) => setGPartNumber(Number(e.target.value))}
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Phạm vi
                      </label>
                      <select
                        value={gScope}
                        onChange={(e) => setGScope(e.target.value as ItemUsageScope)}
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
                      >
                        <option value="ALL">ALL</option>
                        <option value="MOCK_EXAM">MOCK_EXAM</option>
                        <option value="PRACTICE">PRACTICE</option>
                        <option value="PLACEMENT">PLACEMENT</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                      Tiêu đề nhóm
                    </label>
                    <input
                      type="text"
                      value={gTitle}
                      onChange={(e) => setGTitle(e.target.value)}
                      placeholder="VD: Reading Part 5 - Business Email"
                      className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm"
                    />
                  </div>

                  {gSkill === 'LISTENING' && (
                    <MediaUploadField
                      kind="audio"
                      audioScope="placement"
                      slug={`group-p${gPartNumber}`}
                      label="Audio chung của nhóm (WAV)"
                      value={gAudioUrl}
                      onChange={(url) => setGAudioUrl(url)}
                    />
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                      Đoạn văn chung (Passage)
                    </label>
                    <textarea
                      rows={4}
                      value={gPassage}
                      onChange={(e) => setGPassage(e.target.value)}
                      className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-sm"
                    />
                  </div>

                  {gSkill === 'LISTENING' && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Transcript chung
                      </label>
                      <textarea
                        rows={3}
                        value={gTranscript}
                        onChange={(e) => setGTranscript(e.target.value)}
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-sm"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 border-t border-slateDark-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowGroupModal(false)}
                      className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingGroup}
                      className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {savingGroup ? 'Đang lưu...' : 'Lưu nhóm'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="w-full max-w-md space-y-4 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-slateDark-900">
                  Xác nhận xoá câu hỏi CEFR
                </h2>
                <p className="line-clamp-3 text-sm text-slateDark-800">
                  {deleteTarget.prompt}
                </p>

                {needsForceDelete && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
                    <input
                      type="checkbox"
                      checked={forceDelete}
                      onChange={(e) => setForceDelete(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-red-600"
                    />
                    <span>
                      Câu hỏi đang gắn với{' '}
                      <strong>{deleteTarget.responsesCount} lượt trả lời</strong>
                      {(deleteTarget.activeSessionsCount ?? 0) > 0
                        ? ` và ${deleteTarget.activeSessionsCount} phiên placement đang chạy`
                        : ''}
                      . Tích chọn để xoá cưỡng bức (Force Delete).
                    </span>
                  </label>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={deleting || (needsForceDelete && !forceDelete)}
                    onClick={() => void handleConfirmDelete()}
                    className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                  >
                    {deleting ? 'Đang xoá...' : 'Xoá câu hỏi'}
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
