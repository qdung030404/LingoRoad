import { Transform } from 'class-transformer';
import { LearningPurpose } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEnum(LearningPurpose)
  learningPurpose?: LearningPurpose;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(5)
  @Max(120)
  dailyGoalMinutes?: number;

  @IsOptional()
  @IsIn(['A1', 'A2', 'B1', 'B2'])
  selfAssessedCefr?: 'A1' | 'A2' | 'B1' | 'B2' | null;
}
