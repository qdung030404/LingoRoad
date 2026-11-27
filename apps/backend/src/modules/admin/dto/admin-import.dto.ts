import { IsDefined, IsIn, IsOptional } from 'class-validator';

export class ContentImportRequestDto {
  @IsDefined({ message: 'Vui lòng cung cấp dữ liệu bundle JSON.' })
  bundle!: unknown;

  @IsOptional()
  @IsIn(['replace', 'merge'])
  topicWordsMode?: 'replace' | 'merge';
}
