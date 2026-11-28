import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export function isSafeAdminAvatarUrl(value: unknown): boolean {
  if (value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || trimmed !== value) return false;
  if (trimmed.includes('..') || /[\s\u0000-\u001f]/.test(trimmed)) return false;
  if (
    /^\/media\/learning\/v1\/images\/[a-z0-9-]+\.(?:png|webp|jpg|jpeg)$/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  if (/^https:\/\/[^\s]+$/i.test(trimmed) && !/\.svg(?:[?#]|$)/i.test(trimmed)) {
    return true;
  }
  return false;
}

export class AdminLoginDto {
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự.' })
  @MaxLength(128)
  password!: string;
}

export class AdminRefreshDto {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  refreshToken!: string;
}

export class AdminLogoutDto {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  refreshToken!: string;
}

export class AdminChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu hiện tại.' })
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự.' })
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.',
  })
  newPassword!: string;
}

export class AdminUpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;
}
