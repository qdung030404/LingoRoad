import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
