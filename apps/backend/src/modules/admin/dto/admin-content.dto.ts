import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
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
  ValidateIf,
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

export class UpdateLearningUnitDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Mã chương chỉ được chứa chữ thường, số và dấu gạch ngang.',
  })
  @MaxLength(100)
  code?: string;

  @IsOptional()
  @IsEnum(CefrLevel)
  cefrLevel?: CefrLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderIndex?: number;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Tiêu đề chương không được để trống.' })
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Mô tả chương không được để trống.' })
  description?: string;
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
  @ValidateIf((_obj, value) => value !== null)
  @IsUUID()
  unitId?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsUUID()
  grammarTopicId?: string | null;

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
  @ValidateIf((_obj, value) => value !== null)
  @IsUUID()
  unitId?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsUUID()
  grammarTopicId?: string | null;

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

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class CreateAdminAssessmentItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalId?: string;

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
  @ValidateIf((_obj, value) => value !== null)
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemOrder?: number;

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
  @ValidateIf((_obj, value) => value !== null)
  @IsObject()
  rubricCriteria?: Record<string, unknown> | null;

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
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(100)
  externalId?: string | null;

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
  @ValidateIf((_obj, value) => value !== null)
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemOrder?: number;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  passage?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Nội dung câu hỏi phải có ít nhất 3 ký tự.' })
  prompt?: string;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  correctOption?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  explanation?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(500)
  audioUrl?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsObject()
  rubricCriteria?: Record<string, unknown> | null;

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

export class AdminAssessmentGroupsQueryDto {
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
}

export class CreateAssessmentItemGroupDto {
  @IsEnum(AssessmentSkill)
  skill!: AssessmentSkill;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsEnum(CefrLevel)
  cefrLevel!: CefrLevel;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  partNumber!: number;

  @IsOptional()
  @IsString()
  passage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audioUrl?: string;

  @IsOptional()
  @IsString()
  transcript?: string;

  @IsOptional()
  @IsEnum(ItemUsageScope)
  usageScope?: ItemUsageScope;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  itemIds?: string[];
}

export class UpdateAssessmentItemGroupDto {
  @IsOptional()
  @IsEnum(AssessmentSkill)
  skill?: AssessmentSkill;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsEnum(CefrLevel)
  cefrLevel?: CefrLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  partNumber?: number;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  passage?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @MaxLength(500)
  audioUrl?: string | null;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  transcript?: string | null;

  @IsOptional()
  @IsEnum(ItemUsageScope)
  usageScope?: ItemUsageScope;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  itemIds?: string[];
}

export class BulkPublishDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất 1 mục.' })
  @ArrayMaxSize(100, { message: 'Mỗi lần cập nhật hàng loạt tối đa 100 mục.' })
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  ids!: string[];

  @IsBoolean()
  published!: boolean;
}
