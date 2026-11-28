'use client';

import React, { useEffect, useId, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Save,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  adminChangePassword,
  adminLogoutAll,
  updateAdminMeProfile,
} from '../../lib/admin-api';
import type { AdminAuthSession, AdminUser } from '../../types/admin';
import { useAdminToast } from './AdminToast';
import { MediaUploadField } from './MediaUploadField';
import { AdminPasswordForm } from './admin-profile/AdminPasswordForm';
import {
  getProfileInitials,
  resolveSafeAvatarSrc,
  validateAdminPasswordChange,
  validateAdminProfileForm,
} from './admin-profile/admin-profile.helpers';

export { validateAdminPasswordChange, validateAdminProfileForm };

export interface AdminProfileModalProps {
  open: boolean;
  admin: AdminUser;
  onClose: () => void;
  onProfileUpdated?: (user: AdminUser) => void;
  onSessionUpdated?: (session: AdminAuthSession) => void;
  onLoggedOutAll?: () => void;
}

export function AdminProfileModal({
  open,
  admin,
  onClose,
  onProfileUpdated,
  onSessionUpdated,
  onLoggedOutAll,
}: AdminProfileModalProps): React.ReactElement | null {
  const titleId = useId();
  const toast = useAdminToast();
  const [profileName, setProfileName] = useState(admin.name);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(admin.avatarUrl ?? '');
  const [avatarPreviewFailed, setAvatarPreviewFailed] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const busy = savingProfile || savingPassword || loggingOutAll;

  useEffect(() => {
    if (!open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      return;
    }
    setProfileName(admin.name);
    setProfileAvatarUrl(admin.avatarUrl ?? '');
    setAvatarPreviewFailed(false);
  }, [open, admin.name, admin.avatarUrl]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const headerAvatarSrc = avatarPreviewFailed
    ? ''
    : resolveSafeAvatarSrc(admin.avatarUrl);

  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ): void => {
    if (event.target === event.currentTarget && !busy) {
      onClose();
    }
  };

  const handleSaveProfile = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const validationError = validateAdminProfileForm({
      name: profileName,
      avatarUrl: profileAvatarUrl,
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSavingProfile(true);
    try {
      const updatedUser = await updateAdminMeProfile({
        name: profileName.trim(),
        avatarUrl: profileAvatarUrl.trim() || null,
      });
      setAvatarPreviewFailed(false);
      onProfileUpdated?.(updatedUser);
      const message = 'Đã cập nhật hồ sơ Quản trị viên thành công.';
      setSuccessMessage(message);
      toast.success(message);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật hồ sơ lúc này. Vui lòng thử lại.',
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const validationError = validateAdminPasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSavingPassword(true);
    try {
      const updatedSession = await adminChangePassword({
        currentPassword,
        newPassword,
      });
      onSessionUpdated?.(updatedSession);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      const message =
        'Đã đổi mật khẩu thành công. Các phiên đăng nhập khác đã được thu hồi.';
      setSuccessMessage(message);
      toast.success(message);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogoutAll = async (): Promise<void> => {
    if (busy) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoggingOutAll(true);
    try {
      await adminLogoutAll();
      toast.info('Đã đăng xuất tất cả thiết bị quản trị.');
      if (onLoggedOutAll) {
        onLoggedOutAll();
      } else if (typeof window !== 'undefined') {
        window.location.assign('/admin/login');
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Không thể đăng xuất tất cả thiết bị lúc này.',
      );
      setLoggingOutAll(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4 backdrop-blur-[1px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slateDark-100 pb-4">
          <div className="flex items-center gap-3">
            {headerAvatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={headerAvatarSrc}
                alt={admin.name}
                onError={() => setAvatarPreviewFailed(true)}
                className="h-11 w-11 shrink-0 rounded-full border border-slateDark-200 object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#123820] text-sm font-bold text-white">
                {getProfileInitials(admin.name)}
              </div>
            )}
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-base font-bold text-slateDark-900"
              >
                Hồ sơ & Bảo mật Quản trị viên
              </h2>
              <p className="truncate text-xs text-slateDark-700">
                Quản lý thông tin tài khoản và phiên đăng nhập hiện tại.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!busy) onClose();
            }}
            aria-label="Đóng hộp thoại"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slateDark-600 transition hover:bg-slateDark-50 hover:text-slateDark-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slateDark-100 bg-slateDark-25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slateDark-900">
                {admin.name}
              </p>
              <p className="truncate text-xs text-slateDark-700">
                {admin.email}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-25 px-3 py-1 text-xs font-semibold text-brand-800">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
              <span>{admin.role}</span>
            </span>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-25 px-4 py-3 text-xs font-medium text-brand-900"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <form
          onSubmit={(event) => void handleSaveProfile(event)}
          className="mt-5 space-y-3.5 border-b border-slateDark-100 pb-5"
        >
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slateDark-900">
              Thông tin hiển thị
            </h3>
          </div>

          <div>
            <label
              htmlFor="admin-display-name"
              className="mb-1 block text-xs font-semibold text-slateDark-800"
            >
              Tên hiển thị
            </label>
            <input
              id="admin-display-name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              disabled={busy}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Nhập tên hiển thị của Quản trị viên"
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:bg-white focus:outline-none disabled:opacity-60"
            />
          </div>

          <MediaUploadField
            kind="image"
            slugHint="admin-avatar"
            label="Ảnh đại diện (tùy chọn)"
            value={profileAvatarUrl}
            onChange={(url) => setProfileAvatarUrl(url)}
            helperText="Tải ảnh JPG, PNG, WEBP (tối đa 5 MB) hoặc để trống để dùng chữ viết tắt."
          />

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{savingProfile ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
            </button>
          </div>
        </form>

        <AdminPasswordForm
          busy={busy}
          savingPassword={savingPassword}
          loggingOutAll={loggingOutAll}
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          showCurrent={showCurrent}
          setShowCurrent={setShowCurrent}
          showNew={showNew}
          setShowNew={setShowNew}
          showConfirm={showConfirm}
          setShowConfirm={setShowConfirm}
          onSubmit={handleChangePassword}
          onLogoutAll={handleLogoutAll}
        />
      </div>
    </div>
  );
}
