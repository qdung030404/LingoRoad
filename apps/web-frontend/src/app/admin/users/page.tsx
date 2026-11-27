'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Download,
  ExternalLink,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  NOOP_ADMIN_TOAST,
  useAdminToast,
  type AdminToastApi,
} from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
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
  parseEnumParam,
  parsePositiveIntParam,
  useSyncAdminQueryParams,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import type {
  AdminUserDetail,
  AdminUserListItem,
  CefrLevel,
  LearningPurpose,
  PaginationMeta,
  UserRole,
  UserStatus,
  UsersListSummary,
} from '@/types/admin';

const USER_ROLES: readonly UserRole[] = ['LEARNER', 'ADMIN'];
const USER_STATUSES: readonly UserStatus[] = ['ACTIVE', 'SUSPENDED', 'DELETED'];
const PAGE_LIMITS = [10, 20, 50] as const;
const USER_QUERY_DEFAULTS: Record<string, QueryParamValue> = {
  page: 1,
  limit: 10,
};

function readInitialUserFilters(): {
  page: number;
  limit: number;
  search: string;
  role: UserRole | '';
  status: UserStatus | '';
} {
  const sp =
    typeof window !== 'undefined' && typeof window.location?.search === 'string'
      ? new URLSearchParams(window.location.search)
      : null;
  const parsedLimit = parsePositiveIntParam(sp?.get('limit'), 10);
  const limit = (PAGE_LIMITS as readonly number[]).includes(parsedLimit)
    ? parsedLimit
    : 10;
  return {
    page: parsePositiveIntParam(sp?.get('page'), 1),
    limit,
    search: sp?.get('search')?.trim() ?? '',
    role: parseEnumParam(sp?.get('role'), USER_ROLES),
    status: parseEnumParam(sp?.get('status'), USER_STATUSES),
  };
}

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

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getAvatarLetters(name: string, email: string): string {
  const clean = name.trim();
  if (clean) {
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (email[0] ?? 'U').toUpperCase();
}

export default function AdminUsersPage(): React.ReactElement {
  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [initialFilters] = useState(readInitialUserFilters);
  const [authReady, setAuthReady] = useState(false);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [summary, setSummary] = useState<UsersListSummary>({
    total: 0,
    activeLearners30d: 0,
    learners: 0,
    admins: 0,
  });
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: initialFilters.page,
    limit: initialFilters.limit,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(initialFilters.page);
  const [limit, setLimit] = useState(initialFilters.limit);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>(
    initialFilters.role,
  );
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>(
    initialFilters.status,
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Modal tạo user
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('LEARNER');
  const [newTargetCefr, setNewTargetCefr] = useState<CefrLevel>('B1');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Modal chi tiết / sửa user
  const [editingUser, setEditingUser] = useState<AdminUserListItem | null>(
    null,
  );
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userDetailError, setUserDetailError] = useState<string | null>(null);
  const detailRequestIdRef = useRef(0);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('LEARNER');
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [editTargetCefr, setEditTargetCefr] = useState<CefrLevel>('B1');
  const [editDailyGoal, setEditDailyGoal] = useState<number>(10);
  const [editLearningPurpose, setEditLearningPurpose] = useState<
    LearningPurpose | ''
  >('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // ConfirmDialog khóa/mở khóa và xoá
  const [toggleLockTarget, setToggleLockTarget] =
    useState<AdminUserListItem | null>(null);
  const [togglingLock, setTogglingLock] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserListItem | null>(
    null,
  );
  const [hardDelete, setHardDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const userQueryParams = useMemo<Record<string, QueryParamValue>>(
    () => ({
      page,
      limit,
      search: searchQuery,
      role: roleFilter,
      status: statusFilter,
    }),
    [page, limit, searchQuery, roleFilter, statusFilter],
  );

  const hasActiveFilters = Boolean(
    searchInput.trim() || searchQuery.trim() || roleFilter || statusFilter,
  );

  const handleResetFilters = (): void => {
    setPage(1);
    setSearchInput('');
    setSearchQuery('');
    setRoleFilter('');
    setStatusFilter('');
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setBannerError(null);
    try {
      const result = await listAdminUsers({
        page,
        limit,
        search: searchQuery,
        role: roleFilter,
        status: statusFilter,
      });
      setUsers(result.items);
      setPagination(result.pagination);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (err) {
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách người dùng.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    if (!authReady) return;
    void loadUsers();
  }, [authReady, loadUsers]);

  const handleSearchSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const openEditModal = (user: AdminUserListItem): void => {
    const requestId = ++detailRequestIdRef.current;
    setEditingUser(user);
    setUserDetail(null);
    setUserDetailError(null);
    setUserDetailLoading(true);
    setEditName(user.name);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditTargetCefr(user.profile?.targetCefr ?? 'B1');
    setEditDailyGoal(user.profile?.dailyGoalMinutes ?? 10);
    setEditLearningPurpose(user.profile?.learningPurpose ?? '');
    setEditPassword('');
    setEditError(null);
    void getAdminUserDetail(user.id)
      .then((detail) => {
        if (requestId !== detailRequestIdRef.current) return;
        setUserDetail(detail);
        if (detail.profile) {
          setEditTargetCefr(detail.profile.targetCefr);
          setEditDailyGoal(detail.profile.dailyGoalMinutes);
          setEditLearningPurpose(detail.profile.learningPurpose ?? '');
        }
      })
      .catch((err) => {
        if (requestId !== detailRequestIdRef.current) return;
        setUserDetailError(
          err instanceof Error
            ? err.message
            : 'Không thể tải lịch sử hoạt động chi tiết của người dùng.',
        );
      })
      .finally(() => {
        if (requestId === detailRequestIdRef.current) {
          setUserDetailLoading(false);
        }
      });
  };

  const handleCreateUser = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createAdminUser({
        email: newEmail.trim(),
        name: newName.trim(),
        password: newPassword,
        role: newRole,
        targetCefr: newTargetCefr,
      });
      setShowCreateModal(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      const msg = 'Đã tạo tài khoản người dùng mới thành công.';
      setBannerSuccess(msg);
      toastRef.current.success(msg);
      await loadUsers();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể tạo người dùng.';
      setCreateError(msg);
      toastRef.current.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveUserEdit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setSavingEdit(true);
    try {
      await updateAdminUser(editingUser.id, {
        name: editName.trim(),
        role: editRole,
        status: editStatus,
        targetCefr: editTargetCefr,
        dailyGoalMinutes: editDailyGoal,
        learningPurpose: editLearningPurpose || null,
        ...(editPassword.trim() ? { password: editPassword } : {}),
      });
      const msg = `Đã cập nhật thông tin cho ${editingUser.email}.`;
      setBannerSuccess(msg);
      toastRef.current.success(msg);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể cập nhật người dùng.';
      setEditError(msg);
      toastRef.current.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmToggleLock = async (): Promise<void> => {
    if (!toggleLockTarget || togglingLock) return;
    setTogglingLock(true);
    setBannerError(null);
    setBannerSuccess(null);
    const nextStatus: UserStatus =
      toggleLockTarget.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await updateAdminUser(toggleLockTarget.id, { status: nextStatus });
      const msg =
        nextStatus === 'SUSPENDED'
          ? `Đã tạm khóa tài khoản ${toggleLockTarget.email}.`
          : `Đã mở khóa tài khoản ${toggleLockTarget.email}.`;
      setBannerSuccess(msg);
      toastRef.current.success(msg);
      setToggleLockTarget(null);
      await loadUsers();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setTogglingLock(false);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await deleteAdminUser(deleteTarget.id, hardDelete);
      const msg =
        res.action === 'HARD_DELETED'
          ? `Đã xoá vĩnh viễn tài khoản ${deleteTarget.email}.`
          : `Đã vô hiệu hóa (DELETED) tài khoản ${deleteTarget.email}.`;
      setBannerSuccess(msg);
      toastRef.current.success(msg);
      setDeleteTarget(null);
      setHardDelete(false);
      await loadUsers();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể xoá người dùng.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    setBannerError(null);
    try {
      await downloadAdminExport('users', 'csv');
      toastRef.current.success('Đã xuất danh sách người dùng (CSV).');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Xuất dữ liệu người dùng thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setExporting(false);
    }
  };

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

          {/* Bảng chuẩn Legacy */}
          <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
                  <tr>
                    <th className="px-6 py-3.5">Người dùng</th>
                    <th className="px-4 py-3.5">Vai trò</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-4 py-3.5">CEFR mục tiêu</th>
                    <th className="px-4 py-3.5">Ngày tạo</th>
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
                        Đang tải danh sách người dùng...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-sm text-slateDark-700"
                      >
                        Không tìm thấy người dùng nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const isSelf = user.id === currentAdmin.id;
                      return (
                        <tr key={user.id} className="hover:bg-slateDark-25">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                                {getAvatarLetters(user.name, user.email)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate font-semibold text-slateDark-900">
                                    {user.name}
                                  </p>
                                  {isSelf && (
                                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                                      Bạn
                                    </span>
                                  )}
                                </div>
                                <p className="truncate text-xs text-slateDark-700">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={
                                user.role === 'ADMIN'
                                  ? 'rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800'
                                  : 'rounded-full bg-slateDark-50 px-2.5 py-1 text-xs font-medium text-slateDark-800'
                              }
                            >
                              {user.role === 'ADMIN' ? 'Admin' : 'Learner'}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={
                                user.status === 'ACTIVE'
                                  ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'
                                  : user.status === 'SUSPENDED'
                                    ? 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800'
                                    : 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700'
                              }
                            >
                              {user.status}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-xs font-semibold text-slateDark-900">
                            {user.profile?.targetCefr ?? 'B1'}
                          </td>

                          <td className="px-4 py-4 text-xs text-slateDark-700">
                            {formatDate(user.createdAt)}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Link
                                href={`/admin/users/${user.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50"
                              >
                                <span>Xem 360°</span>
                                <ExternalLink className="h-3 w-3" />
                              </Link>

                              <button
                                type="button"
                                onClick={() => openEditModal(user)}
                                className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50"
                              >
                                Xem / Sửa
                              </button>

                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => setToggleLockTarget(user)}
                                className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
                              </button>

                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => {
                                  setHardDelete(false);
                                  setDeleteTarget(user);
                                }}
                                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
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

          {/* Modal tạo User mới */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="w-full max-w-md rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slateDark-900">
                    Thêm tài khoản người dùng
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => void handleCreateUser(e)}
                  className="space-y-4"
                >
                  {createError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                      {createError}
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                      Họ tên *
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="hocvien@example.com"
                      className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                      Mật khẩu (tối thiểu 8 ký tự) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Vai trò
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as UserRole)}
                        className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        <option value="LEARNER">Learner</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        CEFR mục tiêu
                      </label>
                      <select
                        value={newTargetCefr}
                        onChange={(e) =>
                          setNewTargetCefr(e.target.value as CefrLevel)
                        }
                        className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map(
                          (lvl) => (
                            <option key={lvl} value={lvl}>
                              {lvl}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900 hover:bg-slateDark-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal xem chi tiết & sửa User */}
          {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-slateDark-900">
                      Chi tiết & Cập nhật người dùng
                    </h2>
                    <p className="text-xs text-slateDark-700">
                      {editingUser.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/users/${editingUser.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50"
                    >
                      <span>Mở 360°</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Chỉ số hoạt động cá nhân */}
                <div className="mb-5 grid grid-cols-4 gap-2 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3 text-center">
                  <div>
                    <p className="text-base font-extrabold text-slateDark-900">
                      {editingUser.stats.learningAttempts}
                    </p>
                    <p className="text-[11px] text-slateDark-700">Lượt học</p>
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-slateDark-900">
                      {editingUser.stats.placementSessions}
                    </p>
                    <p className="text-[11px] text-slateDark-700">Placement</p>
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-slateDark-900">
                      {editingUser.stats.vocabularyDecks}
                    </p>
                    <p className="text-[11px] text-slateDark-700">Bộ từ</p>
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-slateDark-900">
                      {editingUser.stats.speakingSubmissions}
                    </p>
                    <p className="text-[11px] text-slateDark-700">Luyện nói</p>
                  </div>
                </div>

                <form
                  onSubmit={(e) => void handleSaveUserEdit(e)}
                  className="space-y-4"
                >
                  {editError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                      {editError}
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                      Họ tên
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Vai trò
                      </label>
                      <select
                        value={editRole}
                        disabled={editingUser.id === currentAdmin.id}
                        onChange={(e) => setEditRole(e.target.value as UserRole)}
                        className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
                      >
                        <option value="LEARNER">Learner</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Trạng thái
                      </label>
                      <select
                        value={editStatus}
                        disabled={editingUser.id === currentAdmin.id}
                        onChange={(e) =>
                          setEditStatus(e.target.value as UserStatus)
                        }
                        className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="DELETED">DELETED</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        CEFR mục tiêu
                      </label>
                      <select
                        value={editTargetCefr}
                        onChange={(e) =>
                          setEditTargetCefr(e.target.value as CefrLevel)
                        }
                        className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map(
                          (lvl) => (
                            <option key={lvl} value={lvl}>
                              {lvl}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Mục tiêu ngày (phút)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={editDailyGoal}
                        onChange={(e) =>
                          setEditDailyGoal(Number(e.target.value))
                        }
                        className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                        Mục đích học
                      </label>
                      <select
                        value={editLearningPurpose}
                        onChange={(e) =>
                          setEditLearningPurpose(
                            e.target.value as LearningPurpose | '',
                          )
                        }
                        className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">-- Chưa chọn --</option>
                        <option value="EXAM">Thi chứng chỉ (EXAM)</option>
                        <option value="WORK">Công việc (WORK)</option>
                        <option value="DAILY_COMMUNICATION">
                          Giao tiếp hàng ngày
                        </option>
                        <option value="STUDY">Học tập (STUDY)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                      Đặt lại mật khẩu mới (bỏ trống nếu giữ nguyên)
                    </label>
                    <input
                      type="password"
                      minLength={8}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Nhập tối thiểu 8 ký tự để đổi mật khẩu"
                      className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  {userDetailLoading && (
                    <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-3.5 py-2.5 text-xs text-slateDark-700">
                      Đang tải hoạt động học tập gần đây...
                    </div>
                  )}

                  {userDetailError && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900">
                      {userDetailError}
                    </div>
                  )}

                  {userDetail &&
                    (userDetail.recentAttempts.length > 0 ||
                      userDetail.recentPlacements.length > 0 ||
                      userDetail.recentSpeaking.length > 0) && (
                      <div className="space-y-2.5 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5 text-xs">
                        <p className="font-bold text-slateDark-900">
                          Hoạt động học tập gần đây
                        </p>
                        {userDetail.recentAttempts.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between gap-2 text-slateDark-800"
                          >
                            <span className="truncate">
                              Bài học: <strong>{a.lessonTitle}</strong>
                            </span>
                            <span className="shrink-0 font-mono text-[11px]">
                              {a.correctCount ?? 0}/{a.totalQuestions} ·{' '}
                              {a.status}
                            </span>
                          </div>
                        ))}
                        {userDetail.recentPlacements.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 text-slateDark-800"
                          >
                            <span>
                              Placement:{' '}
                              <strong>{p.estimatedCefr ?? p.status}</strong>
                            </span>
                            <span className="font-mono text-[11px]">
                              {p.correctCount}/{p.totalItems}
                            </span>
                          </div>
                        ))}
                        {userDetail.recentSpeaking.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-2 text-slateDark-800"
                          >
                            <span className="truncate">
                              Luyện nói: <strong>{s.promptTitle}</strong>
                            </span>
                            <span className="font-mono text-[11px]">
                              {s.overallScore !== null
                                ? `${Math.round(s.overallScore)}đ`
                                : s.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ConfirmDialog: Khóa / Mở khóa tài khoản */}
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

          {/* ConfirmDialog: Xác nhận xoá user */}
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
