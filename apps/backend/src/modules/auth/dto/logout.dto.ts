import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LogoutDto {
  @IsString({ message: 'Refresh token phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Refresh token không được để trống' })
  @MaxLength(255, { message: 'Refresh token không hợp lệ' })
  refreshToken!: string;
}
