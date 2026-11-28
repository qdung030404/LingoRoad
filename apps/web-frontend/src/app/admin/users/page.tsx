'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Download,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminToast, type AdminToastApi } from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import {
  createAdminUser,
  deleteAdminUser,
  downloadAdminExport,
  getAdminUserDetail,
  listAdminUsers,
  updateAdminUser,
} from '@/lib/admin-api';
import {
  useSyncAdminQueryParams,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import type { UserRole, UserStatus } from '@/types/admin';
import { renderCreateUserModal, renderEditUserModal } from './UsersModals';
import { renderUsersTable } from './UsersTable';
import { USER_QUERY_DEFAULTS } from './users-admin.helpers';
import { useUsersAdminState } from './useUsersAdminState';

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

function UsersQuerySync({
  params,
}: {
  params: Record<string, QueryParamValue>;
}): null {
  useSyncAdminQueryParams(params, USER_QUERY_DEFAULTS);
  return null;
}

export default function AdminUsersPage(): React.ReactElement {
  const state = useUsersAdminState({
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
    createAdminUser,
    deleteAdminUser,
    downloadAdminExport,
    getAdminUserDetail,
    listAdminUsers,
    updateAdminUser,
  });

  const {
    toastRef,
    setAuthReady,
    users,
    summary,
    pagination,
    setPage,
    searchInput,
    setSearchInput,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    exporting,
    bannerError,
    bannerSuccess,
    setShowCreateModal,
    setCreateError,
    toggleLockTarget,
    setToggleLockTarget,
    togglingLock,
    deleteTarget,
    setDeleteTarget,
    hardDelete,
    setHardDelete,
    deleting,
    userQueryParams,
    hasActiveFilters,
    handleResetFilters,
    handleSearchSubmit,
    handleConfirmToggleLock,
    handleConfirmDelete,
    handleExport,
  } = state;

  return (
    <AdminShell
      breadcrumbTitle="Người dùng"
      title="User Management"
      subtitle="Tra cứu, tạo mới, phân quyền, khóa/mở khóa, xem hồ sơ 360° và xoá tài khoản người dùng LingoRoad."
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
            <span>{exporting ? 'Đang xuất...' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm người dùng</span>
          </button>
        </>
      }
    >
      {(currentAdmin) => (
        <div className="space-y-5">
          <AdminToastBridge toastRef={toastRef} />
          <UsersQuerySync params={userQueryParams} />

          {/* Hàng 4 thẻ KPI kiểu Legacy */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LegacyStatCard
              label="Tổng người dùng"
              value={summary.total}
              subtitle="Mọi vai trò"
              icon={<Users className="h-4 w-4" />}
              tone="green"
            />
            <LegacyStatCard
              label="Active Learner"
              value={summary.activeLearners30d}
              subtitle="Trong 30 ngày gần nhất"
              icon={<Activity className="h-4 w-4" />}
              tone="emerald"
            />
            <LegacyStatCard
              label="Learner"
              value={summary.learners}
              subtitle="Tài khoản học tập"
              icon={<Users className="h-4 w-4" />}
              tone="slate"
            />
            <LegacyStatCard
              label="Admin"
              value={summary.admins}
              subtitle="Tài khoản quản trị"
              icon={<Shield className="h-4 w-4" />}
              tone="amber"
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

          {/* Thanh lọc kiểu Legacy */}
          <div className="rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm">
            <form
              onSubmit={handleSearchSubmit}
              className="grid grid-cols-1 items-end gap-3 lg:grid-cols-12"
            >
              <div className="lg:col-span-5">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Tìm người dùng
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Tên, email hoặc ID..."
                    className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Vai trò
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setPage(1);
                    setRoleFilter(e.target.value as UserRole | '');
                  }}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3.5 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Tất cả vai trò</option>
                  <option value="LEARNER">Learner</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Trạng thái
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setPage(1);
                    setStatusFilter(e.target.value as UserStatus | '');
                  }}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3.5 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Tất cả</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DELETED">Deleted</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 lg:col-span-3">
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
                  >
                    Tìm kiếm
                  </button>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1 rounded-xl border border-slateDark-200 bg-white px-3 py-2.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Đặt lại bộ lọc</span>
                    </button>
                  )}
                </div>
                <span className="text-xs font-medium text-slateDark-700">
                  Hiển thị {users.length} / {pagination.total}
                </span>
              </div>
            </form>
          </div>

          {renderUsersTable(state, currentAdmin.id)}
          {renderCreateUserModal(state)}
          {renderEditUserModal(state, currentAdmin.id)}

          <ConfirmDialog
            open={Boolean(toggleLockTarget)}
            tone={toggleLockTarget?.status === 'ACTIVE' ? 'warning' : 'primary'}
            busy={togglingLock}
            title={
              toggleLockTarget?.status === 'ACTIVE'
                ? 'Tạm khóa tài khoản người dùng?'
                : 'Mở khóa tài khoản người dùng?'
            }
            confirmLabel={
              toggleLockTarget?.status === 'ACTIVE'
                ? 'Tạm khóa tài khoản'
                : 'Mở khóa tài khoản'
            }
            onCancel={() => setToggleLockTarget(null)}
            onConfirm={() => void handleConfirmToggleLock()}
            description={
              toggleLockTarget?.status === 'ACTIVE' ? (
                <p>
                  Tài khoản <strong>{toggleLockTarget.email}</strong> sẽ bị
                  chuyển sang <code>SUSPENDED</code>, thu hồi toàn bộ phiên đăng
                  nhập và vô hiệu hóa đăng nhập Firebase (nếu có).
                </p>
              ) : (
                <p>
                  Khôi phục trạng thái <code>ACTIVE</code> cho tài khoản{' '}
                  <strong>{toggleLockTarget?.email}</strong> và bật lại quyền
                  đăng nhập.
                </p>
              )
            }
          />

          <ConfirmDialog
            open={Boolean(deleteTarget)}
            tone="danger"
            busy={deleting}
            title="Xác nhận xoá người dùng"
            confirmLabel={
              hardDelete ? 'Xoá vĩnh viễn' : 'Vô hiệu hóa tài khoản'
            }
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => void handleConfirmDelete()}
            description={
              <div className="space-y-3">
                <p>
                  Bạn muốn xử lý tài khoản{' '}
                  <strong className="text-slateDark-900">
                    {deleteTarget?.email}
                  </strong>{' '}
                  theo hình thức nào?
                </p>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
                  <input
                    type="checkbox"
                    checked={hardDelete}
                    onChange={(e) => setHardDelete(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-red-600"
                  />
                  <span>
                    <strong>
                      Xoá vĩnh viễn khỏi PostgreSQL & Firebase (Hard Delete)
                    </strong>
                    <br />
                    Xoá sạch user cùng toàn bộ lịch sử học tập, từ vựng và bài
                    làm liên quan (không thể hoàn tác). Nếu bỏ chọn, hệ thống sẽ
                    chỉ đánh dấu <code>DELETED</code> và thu hồi phiên đăng
                    nhập.
                  </span>
                </label>
              </div>
            }
          />
        </div>
      )}
    </AdminShell>
  );
}
