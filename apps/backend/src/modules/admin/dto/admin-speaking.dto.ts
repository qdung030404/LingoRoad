import { SpeakingMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class AdminSpeakingQueryDto {
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

  @IsOptional()
  @IsEnum(SpeakingMode)
  mode?: SpeakingMode;

  @IsOptional()
  @IsIn(['true', 'false'])
  published?: 'true' | 'false';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;
}

export class CreateAdminSpeakingPromptDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Mã đề luyện nói chỉ gồm chữ thường, số và dấu gạch ngang.',
  })
  @MaxLength(100)
  code!: string;

  @IsEnum(SpeakingMode)
  mode!: SpeakingMode;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  text!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  maxDurationSeconds?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  hints?: string[];

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(100)
  sampleAsset?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  visualContext?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsObject()
  preparation?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  linkedReadAloudCodes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateAdminSpeakingPromptDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Mã đề luyện nói chỉ gồm chữ thường, số và dấu gạch ngang.',
  })
  @MaxLength(100)
  code?: string;

  @IsOptional()
  @IsEnum(SpeakingMode)
  mode?: SpeakingMode;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  text?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  maxDurationSeconds?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  hints?: string[];

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(100)
  sampleAsset?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  visualContext?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsObject()
  preparation?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  linkedReadAloudCodes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
