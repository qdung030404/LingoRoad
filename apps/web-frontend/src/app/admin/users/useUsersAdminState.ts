import type React from 'react';
import {
  useCallback as reactUseCallback,
  useEffect as reactUseEffect,
  useMemo as reactUseMemo,
  useRef as reactUseRef,
  useState as reactUseState,
} from 'react';
import { NOOP_ADMIN_TOAST, type AdminToastApi } from '@/components/admin/AdminToast';
import type * as AdminApi from '@/lib/admin-api';
import type { QueryParamValue } from '@/lib/use-admin-query-params';
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
import { readInitialUserFilters } from './users-admin.helpers';

export interface UsersAdminStateDeps {
  useState: typeof reactUseState;
  useEffect: typeof reactUseEffect;
  useCallback: typeof reactUseCallback;
  useMemo: typeof reactUseMemo;
  useRef: typeof reactUseRef;
  createAdminUser: typeof AdminApi.createAdminUser;
  deleteAdminUser: typeof AdminApi.deleteAdminUser;
  downloadAdminExport: typeof AdminApi.downloadAdminExport;
  getAdminUserDetail: typeof AdminApi.getAdminUserDetail;
  listAdminUsers: typeof AdminApi.listAdminUsers;
  updateAdminUser: typeof AdminApi.updateAdminUser;
}

export function useUsersAdminState(deps: UsersAdminStateDeps) {
  const {
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
  } = deps;

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
  }, [listAdminUsers, page, limit, searchQuery, roleFilter, statusFilter]);

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

  return {
    toastRef,
    setAuthReady,
    users,
    summary,
    pagination,
    setPage,
    setLimit,
    searchInput,
    setSearchInput,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    loading,
    exporting,
    bannerError,
    bannerSuccess,
    showCreateModal,
    setShowCreateModal,
    newEmail,
    setNewEmail,
    newName,
    setNewName,
    newPassword,
    setNewPassword,
    newRole,
    setNewRole,
    newTargetCefr,
    setNewTargetCefr,
    createError,
    setCreateError,
    creating,
    editingUser,
    setEditingUser,
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
    openEditModal,
    handleCreateUser,
    handleSaveUserEdit,
    handleConfirmToggleLock,
    handleConfirmDelete,
    handleExport,
  };
}

export type UsersAdminState = ReturnType<typeof useUsersAdminState>;
