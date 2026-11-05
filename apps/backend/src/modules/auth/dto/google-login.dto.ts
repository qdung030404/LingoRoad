import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString({ message: 'Firebase ID Token phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Firebase ID Token không được để trống' })
  idToken: string;
}
