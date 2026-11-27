import React from 'react';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import {
  parseEnumParam,
  parsePositiveIntParam,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import type {
  AdminUserDetail,
  AdminUserListItem,
  CefrLevel,
  LearningPurpose,
  UserRole,
  UserStatus,
} from '@/types/admin';

export const USER_ROLES: readonly UserRole[] = ['LEARNER', 'ADMIN'];
export const USER_STATUSES: readonly UserStatus[] = ['ACTIVE', 'SUSPENDED', 'DELETED'];
export const PAGE_LIMITS = [10, 20, 50] as const;
export const USER_QUERY_DEFAULTS: Record<string, QueryParamValue> = {
  page: 1,
  limit: 10,
};

export function readInitialUserFilters(): {
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

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function getAvatarLetters(name: string, email: string): string {
  const clean = name.trim();
  if (clean) {
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (email[0] ?? 'U').toUpperCase();
}

export interface CreateUserModalParams {
  newName: string;
  setNewName: (value: string) => void;
  newEmail: string;
  setNewEmail: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  newRole: UserRole;
  setNewRole: (value: UserRole) => void;
  newTargetCefr: CefrLevel;
  setNewTargetCefr: (value: CefrLevel) => void;
  createError: string | null;
  creating: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function renderCreateUserModal(p: CreateUserModalParams): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slateDark-900">Thêm tài khoản người dùng</h2>
          <button
            type="button"
            onClick={p.onClose}
            className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void p.onSubmit(e)} className="space-y-4">
          {p.createError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {p.createError}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">Họ tên *</label>
            <input
              type="text"
              required
              value={p.newName}
              onChange={(e) => p.setNewName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">Email *</label>
            <input
              type="email"
              required
              value={p.newEmail}
              onChange={(e) => p.setNewEmail(e.target.value)}
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
              value={p.newPassword}
              onChange={(e) => p.setNewPassword(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">Vai trò</label>
              <select
                value={p.newRole}
                onChange={(e) => p.setNewRole(e.target.value as UserRole)}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="LEARNER">Learner</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">CEFR mục tiêu</label>
              <select
                value={p.newTargetCefr}
                onChange={(e) => p.setNewTargetCefr(e.target.value as CefrLevel)}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
              >
                {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={p.onClose}
              className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900 hover:bg-slateDark-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={p.creating}
              className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {p.creating ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface EditUserModalParams {
  editingUser: AdminUserListItem;
  currentAdminId: string;
  userDetail: AdminUserDetail | null;
  userDetailLoading: boolean;
  userDetailError: string | null;
  editName: string;
  setEditName: (value: string) => void;
  editRole: UserRole;
  setEditRole: (value: UserRole) => void;
  editStatus: UserStatus;
  setEditStatus: (value: UserStatus) => void;
  editTargetCefr: CefrLevel;
  setEditTargetCefr: (value: CefrLevel) => void;
  editDailyGoal: number;
  setEditDailyGoal: (value: number) => void;
  editLearningPurpose: LearningPurpose | '';
  setEditLearningPurpose: (value: LearningPurpose | '') => void;
  editPassword: string;
  setEditPassword: (value: string) => void;
  editError: string | null;
  savingEdit: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function renderEditUserModal(p: EditUserModalParams): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slateDark-900">Chi tiết & Cập nhật người dùng</h2>
            <p className="text-xs text-slateDark-700">{p.editingUser.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/users/${p.editingUser.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50"
            >
              <span>Mở 360°</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={p.onClose}
              className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-4 gap-2 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3 text-center">
          <div>
            <p className="text-base font-extrabold text-slateDark-900">
              {p.editingUser.stats.learningAttempts}
            </p>
            <p className="text-[11px] text-slateDark-700">Lượt học</p>
          </div>
          <div>
            <p className="text-base font-extrabold text-slateDark-900">
              {p.editingUser.stats.placementSessions}
            </p>
            <p className="text-[11px] text-slateDark-700">Placement</p>
          </div>
          <div>
            <p className="text-base font-extrabold text-slateDark-900">
              {p.editingUser.stats.vocabularyDecks}
            </p>
            <p className="text-[11px] text-slateDark-700">Bộ từ</p>
          </div>
          <div>
            <p className="text-base font-extrabold text-slateDark-900">
              {p.editingUser.stats.speakingSubmissions}
            </p>
            <p className="text-[11px] text-slateDark-700">Luyện nói</p>
          </div>
        </div>

        <form onSubmit={(e) => void p.onSubmit(e)} className="space-y-4">
          {p.editError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {p.editError}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">Họ tên</label>
            <input
              type="text"
              required
              value={p.editName}
              onChange={(e) => p.setEditName(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">Vai trò</label>
              <select
                value={p.editRole}
                disabled={p.editingUser.id === p.currentAdminId}
                onChange={(e) => p.setEditRole(e.target.value as UserRole)}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
              >
                <option value="LEARNER">Learner</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">Trạng thái</label>
              <select
                value={p.editStatus}
                disabled={p.editingUser.id === p.currentAdminId}
                onChange={(e) => p.setEditStatus(e.target.value as UserStatus)}
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
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">CEFR mục tiêu</label>
              <select
                value={p.editTargetCefr}
                onChange={(e) => p.setEditTargetCefr(e.target.value as CefrLevel)}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">Mục tiêu ngày (phút)</label>
              <input
                type="number"
                min={5}
                max={120}
                value={p.editDailyGoal}
                onChange={(e) => p.setEditDailyGoal(Number(e.target.value))}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">Mục đích học</label>
              <select
                value={p.editLearningPurpose}
                onChange={(e) => p.setEditLearningPurpose(e.target.value as LearningPurpose | '')}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="">-- Chưa chọn --</option>
                <option value="EXAM">Thi chứng chỉ (EXAM)</option>
                <option value="WORK">Công việc (WORK)</option>
                <option value="DAILY_COMMUNICATION">Giao tiếp hàng ngày</option>
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
              value={p.editPassword}
              onChange={(e) => p.setEditPassword(e.target.value)}
              placeholder="Nhập tối thiểu 8 ký tự để đổi mật khẩu"
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          {p.userDetailLoading && (
            <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-3.5 py-2.5 text-xs text-slateDark-700">
              Đang tải hoạt động học tập gần đây...
            </div>
          )}

          {p.userDetailError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900">
              {p.userDetailError}
            </div>
          )}

          {p.userDetail &&
            (p.userDetail.recentAttempts.length > 0 ||
              p.userDetail.recentPlacements.length > 0 ||
              p.userDetail.recentSpeaking.length > 0) && (
              <div className="space-y-2.5 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5 text-xs">
                <p className="font-bold text-slateDark-900">Hoạt động học tập gần đây</p>
                {p.userDetail.recentAttempts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-slateDark-800">
                    <span className="truncate">
                      Bài học: <strong>{a.lessonTitle}</strong>
                    </span>
                    <span className="shrink-0 font-mono text-[11px]">
                      {a.correctCount ?? 0}/{a.totalQuestions} · {a.status}
                    </span>
                  </div>
                ))}
                {p.userDetail.recentPlacements.map((pl) => (
                  <div key={pl.id} className="flex items-center justify-between gap-2 text-slateDark-800">
                    <span>
                      Placement: <strong>{pl.estimatedCefr ?? pl.status}</strong>
                    </span>
                    <span className="font-mono text-[11px]">
                      {pl.correctCount}/{pl.totalItems}
                    </span>
                  </div>
                ))}
                {p.userDetail.recentSpeaking.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-slateDark-800">
                    <span className="truncate">
                      Luyện nói: <strong>{s.promptTitle}</strong>
                    </span>
                    <span className="font-mono text-[11px]">
                      {s.overallScore !== null ? `${Math.round(s.overallScore)}đ` : s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={p.onClose}
              className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={p.savingEdit}
              className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {p.savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function renderUsersConfirmDialogs({
  toggleLockTarget,
  togglingLock,
  onCancelLock,
  onConfirmLock,
  deleteTarget,
  hardDelete,
  setHardDelete,
  deleting,
  onCancelDelete,
  onConfirmDelete,
}: {
  toggleLockTarget: AdminUserListItem | null;
  togglingLock: boolean;
  onCancelLock: () => void;
  onConfirmLock: () => Promise<void>;
  deleteTarget: AdminUserListItem | null;
  hardDelete: boolean;
  setHardDelete: (checked: boolean) => void;
  deleting: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
}): React.ReactElement {
  return (
    <>
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
          toggleLockTarget?.status === 'ACTIVE' ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản'
        }
        onCancel={onCancelLock}
        onConfirm={() => void onConfirmLock()}
        description={
          toggleLockTarget?.status === 'ACTIVE' ? (
            <p>
              Tài khoản <strong>{toggleLockTarget.email}</strong> sẽ bị chuyển sang <code>SUSPENDED</code>,
              thu hồi toàn bộ phiên đăng nhập và vô hiệu hóa đăng nhập Firebase (nếu có).
            </p>
          ) : (
            <p>
              Khôi phục trạng thái <code>ACTIVE</code> cho tài khoản{' '}
              <strong>{toggleLockTarget?.email}</strong> và bật lại quyền đăng nhập.
            </p>
          )
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        tone="danger"
        busy={deleting}
        title="Xác nhận xoá người dùng"
        confirmLabel={hardDelete ? 'Xoá vĩnh viễn' : 'Vô hiệu hóa tài khoản'}
        onCancel={onCancelDelete}
        onConfirm={() => void onConfirmDelete()}
        description={
          <div className="space-y-3">
            <p>
              Bạn muốn xử lý tài khoản{' '}
              <strong className="text-slateDark-900">{deleteTarget?.email}</strong> theo hình thức nào?
            </p>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
              <input
                type="checkbox"
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-red-600"
              />
              <span>
                <strong>Xoá vĩnh viễn khỏi PostgreSQL & Firebase (Hard Delete)</strong>
                <br />
                Xoá sạch user cùng toàn bộ lịch sử học tập, từ vựng và bài làm liên quan (không thể hoàn tác).
                Nếu bỏ chọn, hệ thống sẽ chỉ đánh dấu <code>DELETED</code> và thu hồi phiên đăng nhập.
              </span>
            </label>
          </div>
        }
      />
    </>
  );
}
