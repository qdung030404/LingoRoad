import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminLessonsQueryDto {
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
  @IsEnum(LearningKind)
  kind?: LearningKind;

  @IsOptional()
  @IsIn(['true', 'false'])
  published?: 'true' | 'false';

  @IsOptional()
  @IsEnum(CefrLevel)
  cefrLevel?: CefrLevel;
}

export class CreateLearningUnitDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Mã chương chỉ được chứa chữ thường, số và dấu gạch ngang.',
  })
  @MaxLength(100)
  code!: string;

  @IsEnum(CefrLevel)
  cefrLevel!: CefrLevel;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderIndex!: number;

  @IsString()
  @MinLength(1, { message: 'Tiêu đề chương không được để trống.' })
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1, { message: 'Mô tả chương không được để trống.' })
  description!: string;
}

export class CreateAdminLessonDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Mã bài học chỉ được chứa chữ thường, số và dấu gạch ngang.',
  })
  @MaxLength(100)
  code!: string;

  @IsEnum(LearningKind)
  kind!: LearningKind;

  @IsString()
  @MinLength(1, { message: 'Tiêu đề bài tập không được để trống.' })
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1, { message: 'Mô tả bài tập không được để trống.' })
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  estimatedMinutes!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsUUID()
  unitId?: string | null;

  @IsObject({ message: 'Nội dung bài học phải là đối tượng JSON hợp lệ.' })
  content!: Record<string, unknown>;
}

export class UpdateAdminLessonDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Mã bài học chỉ được chứa chữ thường, số và dấu gạch ngang.',
  })
  @MaxLength(100)
  code?: string;

  @IsOptional()
  @IsEnum(LearningKind)
  kind?: LearningKind;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  estimatedMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsUUID()
  unitId?: string | null;

  @IsOptional()
  @IsObject({ message: 'Nội dung bài học phải là đối tượng JSON hợp lệ.' })
  content?: Record<string, unknown>;
}

export class AdminAssessmentItemsQueryDto {
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
  @IsEnum(AssessmentSkill)
  skill?: AssessmentSkill;

  @IsOptional()
  @IsEnum(CefrLevel)
  cefrLevel?: CefrLevel;

  @IsOptional()
  @IsEnum(ItemUsageScope)
  usageScope?: ItemUsageScope;

  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;
}

export class CreateAdminAssessmentItemDto {
  @IsEnum(AssessmentSkill)
  skill!: AssessmentSkill;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  skillCode!: string;

  @IsEnum(CefrLevel)
  cefrLevel!: CefrLevel;

  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  @IsOptional()
  @IsEnum(ItemUsageScope)
  usageScope?: ItemUsageScope;

  @IsOptional()
  @IsString()
  passage?: string;

  @IsString()
  @MinLength(3, { message: 'Nội dung câu hỏi phải có ít nhất 3 ký tự.' })
  prompt!: string;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsString()
  correctOption?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  irtA?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  irtB?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  irtC?: number;
}

export class UpdateAdminAssessmentItemDto {
  @IsOptional()
  @IsEnum(AssessmentSkill)
  skill?: AssessmentSkill;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  skillCode?: string;

  @IsOptional()
  @IsEnum(CefrLevel)
  cefrLevel?: CefrLevel;

  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  @IsOptional()
  @IsEnum(ItemUsageScope)
  usageScope?: ItemUsageScope;

  @IsOptional()
  @IsString()
  passage?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Nội dung câu hỏi phải có ít nhất 3 ký tự.' })
  prompt?: string;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsString()
  correctOption?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  irtA?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  irtB?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  irtC?: number;
}
