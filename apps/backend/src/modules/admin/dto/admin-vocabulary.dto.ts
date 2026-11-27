import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class AdminVocabularyWordsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateAdminCuratedTopicDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug chủ đề chỉ gồm chữ thường, số và dấu gạch ngang.',
  })
  @MaxLength(60)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  titleEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  titleVi!: string;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(50)
  icon?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateAdminCuratedTopicDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug chủ đề chỉ gồm chữ thường, số và dấu gạch ngang.',
  })
  @MaxLength(60)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  titleEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  titleVi?: string;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(50)
  icon?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class CreateAdminCuratedWordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  word!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  phonetic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  partOfSpeech?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  meaningVi!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  exampleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  exampleVi?: string;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(500)
  audioUrl?: string | null;
}

export class UpdateAdminCuratedWordDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  word?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  phonetic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  partOfSpeech?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  meaningVi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  exampleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  exampleVi?: string;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(500)
  audioUrl?: string | null;
}
