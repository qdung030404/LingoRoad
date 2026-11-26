import { IsDefined } from 'class-validator';

export class ContentImportRequestDto {
  @IsDefined({ message: 'Vui lòng cung cấp dữ liệu bundle JSON.' })
  bundle!: unknown;
}
