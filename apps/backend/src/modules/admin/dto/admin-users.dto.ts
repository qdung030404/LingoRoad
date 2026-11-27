import {
  CefrLevel,
  LearningKind,
  LearningPurpose,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
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

export class AdminUsersQueryDto {
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
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class CreateAdminUserDto {
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Tên không được để trống.' })
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự.' })
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(CefrLevel)
  targetCefr?: CefrLevel;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Tên không được để trống.' })
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự.' })
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsEnum(CefrLevel)
  targetCefr?: CefrLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  dailyGoalMinutes?: number;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsEnum(LearningPurpose)
  learningPurpose?: LearningPurpose | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsEnum(LearningKind, { each: true })
  preferredKinds?: LearningKind[];

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsEnum(CefrLevel)
  selfAssessedCefr?: CefrLevel | null;

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'reminderTime phải có định dạng HH:mm (00:00 - 23:59).',
  })
  reminderTime?: string;
}

export class OverrideUserSkillLevelDto {
  @IsEnum(CefrLevel)
  cefrLevel!: CefrLevel;

  @IsOptional()
  @IsBoolean()
  resetExposures?: boolean;
}

export class ResetPlacementRetakeDto {
  @IsOptional()
  @IsBoolean()
  resetSkillLevels?: boolean;
}
