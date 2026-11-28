import { resolveAdminMediaUrl } from '../../../lib/admin-api';

export function validateAdminProfileForm(input: {
  name: string;
  avatarUrl: string;
}): string | null {
  const trimmedName = input.name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return 'Tên hiển thị phải có từ 2 đến 100 ký tự.';
  }
  const trimmedAvatar = input.avatarUrl.trim();
  if (!trimmedAvatar) return null;
  if (
    trimmedAvatar.length > 500 ||
    trimmedAvatar.includes('..') ||
    /\s/.test(trimmedAvatar)
  ) {
    return 'Đường dẫn ảnh đại diện không hợp lệ.';
  }
  const isManagedImage =
    /^\/media\/learning\/v1\/images\/[a-z0-9-]+\.(?:png|webp|jpg|jpeg)$/i.test(
      trimmedAvatar,
    );
  const isHttpsImage =
    /^https:\/\/[^\s]+$/i.test(trimmedAvatar) &&
    !/\.svg(?:[?#]|$)/i.test(trimmedAvatar);
  if (!isManagedImage && !isHttpsImage) {
    return 'Ảnh đại diện chỉ hỗ trợ JPG, PNG, WEBP tải lên hoặc liên kết HTTPS an toàn (không dùng SVG).';
  }
  return null;
}

export function validateAdminPasswordChange(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): string | null {
  if (!input.currentPassword) {
    return 'Vui lòng nhập mật khẩu hiện tại.';
  }
  if (input.newPassword.length < 8) {
    return 'Mật khẩu mới phải có ít nhất 8 ký tự.';
  }
  if (
    !/[A-Z]/.test(input.newPassword) ||
    !/[a-z]/.test(input.newPassword) ||
    !/[0-9]/.test(input.newPassword)
  ) {
    return 'Mật khẩu mới phải gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.';
  }
  if (input.newPassword === input.currentPassword) {
    return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  }
  if (input.newPassword !== input.confirmPassword) {
    return 'Xác nhận mật khẩu mới không khớp.';
  }
  return null;
}

export function getProfileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function resolveSafeAvatarSrc(
  avatarUrl: string | null | undefined,
): string {
  const trimmed = avatarUrl?.trim() ?? '';
  if (!trimmed) return '';
  return typeof resolveAdminMediaUrl === 'function'
    ? resolveAdminMediaUrl(trimmed)
    : trimmed;
}
