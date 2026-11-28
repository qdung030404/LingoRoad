import React from 'react';
import Link from 'next/link';
import { ExternalLink, X } from 'lucide-react';
import type {
  CefrLevel,
  LearningPurpose,
  UserRole,
  UserStatus,
} from '@/types/admin';
import type { UsersAdminState } from './useUsersAdminState';

export function renderCreateUserModal(
  state: UsersAdminState,
): React.ReactElement | null {
  const {
    showCreateModal,
    setShowCreateModal,
    handleCreateUser,
    createError,
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
    creating,
  } = state;

  if (!showCreateModal) return null;

  return (
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

        <form onSubmit={(e) => void handleCreateUser(e)} className="space-y-4">
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
                onChange={(e) => setNewTargetCefr(e.target.value as CefrLevel)}
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
  );
}

export function renderEditUserModal(
  state: UsersAdminState,
  currentAdminId: string,
): React.ReactElement | null {
  const {
    editingUser,
    setEditingUser,
    handleSaveUserEdit,
    editError,
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
    userDetailLoading,
    userDetailError,
    userDetail,
    savingEdit,
  } = state;

  if (!editingUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slateDark-900">
              Chi tiết & Cập nhật người dùng
            </h2>
            <p className="text-xs text-slateDark-700">{editingUser.email}</p>
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
                disabled={editingUser.id === currentAdminId}
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
                disabled={editingUser.id === currentAdminId}
                onChange={(e) => setEditStatus(e.target.value as UserStatus)}
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
                onChange={(e) => setEditTargetCefr(e.target.value as CefrLevel)}
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
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Mục tiêu ngày (phút)
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={editDailyGoal}
                onChange={(e) => setEditDailyGoal(Number(e.target.value))}
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
                  setEditLearningPurpose(e.target.value as LearningPurpose | '')
                }
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
                      {a.correctCount ?? 0}/{a.totalQuestions} · {a.status}
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
  );
}
