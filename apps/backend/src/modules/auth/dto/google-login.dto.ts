import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString({ message: 'Firebase ID Token phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Firebase ID Token không được để trống' })
  @MaxLength(4096, { message: 'Firebase ID Token không được vượt quá 4096 ký tự' })
  readonly idToken!: string;
}
