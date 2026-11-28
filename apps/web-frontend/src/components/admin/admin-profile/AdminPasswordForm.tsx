import React from 'react';
import { Eye, EyeOff, KeyRound, Loader2, LogOut } from 'lucide-react';

interface AdminPasswordFormProps {
  busy: boolean;
  savingPassword: boolean;
  loggingOutAll: boolean;
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showCurrent: boolean;
  setShowCurrent: React.Dispatch<React.SetStateAction<boolean>>;
  showNew: boolean;
  setShowNew: React.Dispatch<React.SetStateAction<boolean>>;
  showConfirm: boolean;
  setShowConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onLogoutAll: () => Promise<void>;
}

export function AdminPasswordForm({
  busy,
  savingPassword,
  loggingOutAll,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  showCurrent,
  setShowCurrent,
  showNew,
  setShowNew,
  showConfirm,
  setShowConfirm,
  onSubmit,
  onLogoutAll,
}: AdminPasswordFormProps): React.ReactElement {
  return (
    <>
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-5 space-y-3.5"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-bold text-slateDark-900">Đổi mật khẩu</h3>
        </div>

        <div>
          <label
            htmlFor="admin-current-password"
            className="mb-1 block text-xs font-semibold text-slateDark-800"
          >
            Mật khẩu hiện tại
          </label>
          <div className="relative">
            <input
              id="admin-current-password"
              type={showCurrent ? 'text' : 'password'}
              required
              maxLength={128}
              autoComplete="current-password"
              disabled={busy}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại"
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 py-2.5 pl-3.5 pr-10 text-sm text-slateDark-900 focus:border-brand-500 focus:bg-white focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((prev) => !prev)}
              aria-label={
                showCurrent ? 'Ẩn mật khẩu hiện tại' : 'Hiện mật khẩu hiện tại'
              }
              aria-pressed={showCurrent}
              className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slateDark-600 transition hover:text-slateDark-900"
            >
              {showCurrent ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-new-password"
            className="mb-1 block text-xs font-semibold text-slateDark-800"
          >
            Mật khẩu mới
          </label>
          <div className="relative">
            <input
              id="admin-new-password"
              type={showNew ? 'text' : 'password'}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              disabled={busy}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự (hoa, thường, số)"
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 py-2.5 pl-3.5 pr-10 text-sm text-slateDark-900 focus:border-brand-500 focus:bg-white focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowNew((prev) => !prev)}
              aria-label={showNew ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
              aria-pressed={showNew}
              className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slateDark-600 transition hover:text-slateDark-900"
            >
              {showNew ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slateDark-700">
            Yêu cầu tối thiểu 8 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ thường và 1
            chữ số.
          </p>
        </div>

        <div>
          <label
            htmlFor="admin-confirm-password"
            className="mb-1 block text-xs font-semibold text-slateDark-800"
          >
            Xác nhận mật khẩu mới
          </label>
          <div className="relative">
            <input
              id="admin-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              disabled={busy}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 py-2.5 pl-3.5 pr-10 text-sm text-slateDark-900 focus:border-brand-500 focus:bg-white focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={
                showConfirm
                  ? 'Ẩn xác nhận mật khẩu mới'
                  : 'Hiện xác nhận mật khẩu mới'
              }
              aria-pressed={showConfirm}
              className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slateDark-600 transition hover:text-slateDark-900"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={busy}
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingPassword && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            <span>
              {savingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </span>
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-slateDark-100 pt-4">
        <div className="flex flex-col gap-3 rounded-xl border border-red-100 bg-red-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-red-900">
              Thu hồi toàn bộ phiên đăng nhập
            </p>
            <p className="mt-0.5 text-[11px] text-red-800/80">
              Đăng xuất khỏi tất cả trình duyệt và thiết bị đang dùng tài khoản
              này.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onLogoutAll()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOutAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {loggingOutAll
                ? 'Đang đăng xuất...'
                : 'Đăng xuất tất cả thiết bị'}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
