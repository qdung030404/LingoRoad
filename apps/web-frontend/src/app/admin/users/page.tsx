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
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  NOOP_ADMIN_TOAST,
  useAdminToast,
  type AdminToastApi,
} from '@/components/admin/AdminToast';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import {
  USER_QUERY_DEFAULTS,
  formatDate,
  getAvatarLetters,
  readInitialUserFilters,
  renderCreateUserModal,
  renderEditUserModal,
  renderUsersConfirmDialogs,
} from '@/components/admin/UsersPageModals';
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
    if (!deleteTarget || deleting) return;
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

          {showCreateModal &&
            renderCreateUserModal({
              newName,
              setNewName,
              newEmail,
              setNewEmail,
              newPassword,
              setNewPassword,
              newRole,
              setNewRole,
              newTargetCefr,
              setNewTargetCefr,
              createError,
              creating,
              onClose: () => setShowCreateModal(false),
              onSubmit: handleCreateUser,
            })}

          {editingUser &&
            renderEditUserModal({
              editingUser,
              currentAdminId: currentAdmin.id,
              userDetail,
              userDetailLoading,
              userDetailError,
              editName,
              setEditName,
              editRole,
              setEditRole,
              editStatus,
              setEditStatus,
              editTargetCefr,
              setEditTargetCefr,
              editDailyGoal,
              setEditDailyGoal,
              editLearningPurpose,
              setEditLearningPurpose,
              editPassword,
              setEditPassword,
              editError,
              savingEdit,
              onClose: () => setEditingUser(null),
              onSubmit: handleSaveUserEdit,
            })}

          {renderUsersConfirmDialogs({
            toggleLockTarget,
            togglingLock,
            onCancelLock: () => setToggleLockTarget(null),
            onConfirmLock: handleConfirmToggleLock,
            deleteTarget,
            hardDelete,
            setHardDelete,
            deleting,
            onCancelDelete: () => setDeleteTarget(null),
            onConfirmDelete: handleConfirmDelete,
          })}
        </div>
      )}
    </AdminShell>
  );
}
