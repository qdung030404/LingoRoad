import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

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
