'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Plus,
  Search,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from '@/lib/admin-api';
import type {
  AdminUserListItem,
  CefrLevel,
  PaginationMeta,
  UserRole,
  UserStatus,
  UsersListSummary,
} from '@/types/admin';

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
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [summary, setSummary] = useState<UsersListSummary>({
    total: 0,
    activeLearners30d: 0,
    learners: 0,
    admins: 0,
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
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [loading, setLoading] = useState(true);
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
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('LEARNER');
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal xác nhận xoá
  const [deleteTarget, setDeleteTarget] = useState<AdminUserListItem | null>(
    null,
  );
  const [hardDelete, setHardDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    void loadUsers();
  }, [loadUsers]);

  const handleSearchSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput);
  };

  const openEditModal = (user: AdminUserListItem): void => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPassword('');
    setEditError(null);
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
      setBannerSuccess('Đã tạo tài khoản người dùng mới thành công.');
      await loadUsers();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Không thể tạo người dùng.',
      );
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
        ...(editPassword.trim() ? { password: editPassword } : {}),
      });
      setBannerSuccess(`Đã cập nhật thông tin cho ${editingUser.email}.`);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Không thể cập nhật người dùng.',
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleQuickToggleLock = async (
    user: AdminUserListItem,
  ): Promise<void> => {
    setBannerError(null);
    setBannerSuccess(null);
    const nextStatus: UserStatus =
      user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await updateAdminUser(user.id, { status: nextStatus });
      setBannerSuccess(
        nextStatus === 'SUSPENDED'
          ? `Đã tạm khóa tài khoản ${user.email}.`
          : `Đã mở khóa tài khoản ${user.email}.`,
      );
      await loadUsers();
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại.',
      );
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await deleteAdminUser(deleteTarget.id, hardDelete);
      setBannerSuccess(
        res.action === 'HARD_DELETED'
          ? `Đã xoá vĩnh viễn tài khoản ${deleteTarget.email}.`
          : `Đã vô hiệu hóa (DELETED) tài khoản ${deleteTarget.email}.`,
      );
      setDeleteTarget(null);
      setHardDelete(false);
      await loadUsers();
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể xoá người dùng.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminShell
      breadcrumbTitle="Người dùng"
      title="User Management"
      subtitle="Tra cứu, tạo mới, phân quyền, khóa/mở khóa và xoá tài khoản người dùng LingoRoad."
      actions={
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
      }
    >
      {(currentAdmin) => (
        <div className="space-y-5">
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

              <div className="flex items-center justify-between gap-3 lg:col-span-3">
                <button
                  type="submit"
                  className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
                >
                  Tìm kiếm
                </button>
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
                            <div className="flex items-center justify-end gap-2">
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
                                onClick={() => void handleQuickToggleLock(user)}
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
              <div className="w-full max-w-lg rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slateDark-900">
                      Chi tiết & Cập nhật người dùng
                    </h2>
                    <p className="text-xs text-slateDark-700">
                      {editingUser.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
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

          {/* Modal xác nhận xoá user */}
          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="w-full max-w-md space-y-4 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-slateDark-900">
                  Xác nhận xoá người dùng
                </h2>
                <p className="text-sm text-slateDark-800">
                  Bạn muốn xử lý tài khoản{' '}
                  <strong className="text-slateDark-900">
                    {deleteTarget.email}
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
                    <strong>Xoá vĩnh viễn khỏi PostgreSQL (Hard Delete)</strong>
                    <br />
                    Xoá sạch user cùng toàn bộ lịch sử học tập, từ vựng và bài
                    làm liên quan (không thể hoàn tác). Nếu bỏ chọn, hệ thống sẽ
                    chỉ đánh dấu <code>DELETED</code> và thu hồi phiên đăng
                    nhập.
                  </span>
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900 hover:bg-slateDark-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleConfirmDelete()}
                    className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting
                      ? 'Đang xử lý...'
                      : hardDelete
                        ? 'Xoá vĩnh viễn'
                        : 'Vô hiệu hóa tài khoản'}
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
