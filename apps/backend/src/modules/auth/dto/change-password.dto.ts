import { IsNotEmpty, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Mật khẩu cũ phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu hiện tại' })
  oldPassword!: string;

  @IsString({ message: 'Mật khẩu mới phải là chuỗi ký tự' })
  @MinLength(8, { message: 'Mật khẩu mới phải có tối thiểu 8 ký tự' })
  @MaxLength(64, { message: 'Mật khẩu mới không được vượt quá 64 ký tự' })
  @Matches(/(?=.*[a-z])(?=.*\d)/, {
    message: 'Mật khẩu mới phải chứa ít nhất 1 chữ cái in thường và 1 chữ số',
  })
  newPassword!: string;
}
