import { SpeakingMode, SpeakingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminVoiceConversationsQueryDto {
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
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  assessmentStatus?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  stuckOnly?: 'true' | 'false';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class AdminSpeakingSubmissionsQueryDto {
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
  @IsEnum(SpeakingStatus)
  status?: SpeakingStatus;

  @IsOptional()
  @IsEnum(SpeakingMode)
  mode?: SpeakingMode;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  errorCode?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
