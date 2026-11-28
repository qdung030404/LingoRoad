'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  RotateCcw,
  Search,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminToast, type AdminToastApi } from '@/components/admin/AdminToast';
import { AssessmentItemModal } from '@/components/admin/AssessmentItemModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
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
import {
  useSyncAdminQueryParams,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from '@/types/admin';
import { renderItemsGroupModal } from './ItemsGroupModal';
import {
  renderDeleteItemModal,
  renderGroupsTable,
  renderItemsTable,
} from './ItemsTables';
import { ITEMS_QUERY_DEFAULTS } from './items-admin.helpers';
import { useItemsAdminState } from './useItemsAdminState';

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

function ItemsQuerySync({
  params,
}: {
  params: Record<string, QueryParamValue>;
}): null {
  useSyncAdminQueryParams(params, ITEMS_QUERY_DEFAULTS);
  return null;
}

export default function AdminItemsPage(): React.ReactElement {
  const state = useItemsAdminState({
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
    useDebouncedValue,
    listDescriptors,
    listAdminAssessmentGroups,
    listAdminAssessmentItems,
    createAdminAssessmentGroup,
    updateAdminAssessmentGroup,
    deleteAdminAssessmentGroup,
    deleteAdminAssessmentItem,
    downloadAdminExport,
  });

  const {
    toastRef,
    setAuthReady,
    activeTab,
    setActiveTab,
    descriptors,
    allGroupsForSelect,
    summary,
    setPage,
    setGroupsPage,
    searchInput,
    setSearchInput,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    skillFilter,
    setSkillFilter,
    cefrFilter,
    setCefrFilter,
    usageScopeFilter,
    setUsageScopeFilter,
    groupIdFilter,
    setGroupIdFilter,
    exporting,
    bannerError,
    showModal,
    setShowModal,
    editingItem,
    setEditingItem,
    cloningItem,
    setCloningItem,
    deleteGroupTarget,
    setDeleteGroupTarget,
    deletingGroup,
    itemsQueryParams,
    hasActiveFilters,
    loadItems,
    handleResetFilters,
    openGroupModal,
    handleConfirmDeleteGroup,
    handleExport,
  } = state;

  return (
    <AdminShell
      breadcrumbTitle="Ngân hàng đề"
      title="Item Bank & Nhóm đề"
      subtitle="Quản lý câu hỏi IRT, phạm vi Placement/Mock Exam và nhóm ngữ cảnh chung (AssessmentItemGroup)."
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
            <span>{exporting ? 'Đang xuất...' : 'CSV'}</span>
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
                setCloningItem(null);
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
          <AdminToastBridge toastRef={toastRef} />
          <ItemsQuerySync params={itemsQueryParams} />

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
              <div className="lg:col-span-4">
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

              <div className="lg:col-span-2">
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

              {activeTab === 'items' && (
                <div className="lg:col-span-8">
                  <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                    Nhóm đề (Group)
                  </label>
                  <select
                    value={groupIdFilter}
                    onChange={(e) => {
                      setPage(1);
                      setGroupIdFilter(e.target.value);
                    }}
                    className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Tất cả nhóm đề</option>
                    {allGroupsForSelect.map((grp) => (
                      <option key={grp.id} value={grp.id}>
                        [{grp.skill} {grp.cefrLevel} P{grp.partNumber}]{' '}
                        {grp.title || grp.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div
                className={`flex flex-wrap items-center justify-end gap-2 ${
                  activeTab === 'items' ? 'lg:col-span-4' : 'lg:col-span-2'
                }`}
              >
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-2.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Đặt lại bộ lọc</span>
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
                >
                  Lọc
                </button>
              </div>
            </form>
          </div>

          {activeTab === 'items'
            ? renderItemsTable(state)
            : renderGroupsTable(state)}

          {showModal && (
            <AssessmentItemModal
              descriptors={descriptors}
              groups={allGroupsForSelect}
              editingItem={editingItem}
              cloneFrom={cloningItem}
              onClose={() => {
                setShowModal(false);
                setEditingItem(null);
                setCloningItem(null);
              }}
              onSaved={() => {
                setShowModal(false);
                toastRef.current.success(
                  editingItem
                    ? 'Đã cập nhật câu hỏi thành công.'
                    : cloningItem
                      ? 'Đã nhân bản câu hỏi mới vào Item Bank.'
                      : 'Đã thêm câu hỏi mới vào Item Bank.',
                );
                setEditingItem(null);
                setCloningItem(null);
                void loadItems();
              }}
            />
          )}

          {renderItemsGroupModal(state, MediaUploadField)}
          {renderDeleteItemModal(state)}

          <ConfirmDialog
            open={Boolean(deleteGroupTarget)}
            title="Xoá nhóm câu hỏi"
            description={
              deleteGroupTarget ? (
                <>
                  Bạn có chắc muốn xoá nhóm{' '}
                  <strong>
                    {deleteGroupTarget.title ||
                      `Part ${deleteGroupTarget.partNumber}`}
                  </strong>
                  ? Các câu hỏi con ({deleteGroupTarget.itemsCount}) sẽ được gỡ
                  liên kết an toàn và giữ nguyên trong Item Bank.
                </>
              ) : null
            }
            confirmLabel="Xoá nhóm"
            tone="danger"
            busy={deletingGroup}
            onConfirm={handleConfirmDeleteGroup}
            onCancel={() => setDeleteGroupTarget(null)}
          />
        </div>
      )}
    </AdminShell>
  );
}
