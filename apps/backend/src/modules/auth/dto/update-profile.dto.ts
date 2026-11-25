import { Transform } from 'class-transformer';
import { LearningKind, LearningPurpose } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
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
  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1'])
  targetCefr?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(5)
  @Max(120)
  dailyGoalMinutes?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsEnum(LearningKind, { each: true })
  preferredKinds?: LearningKind[];

  @IsOptional()
  @IsIn(['A1', 'A2', 'B1', 'B2'])
  selfAssessedCefr?: 'A1' | 'A2' | 'B1' | 'B2' | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  expectedVersion?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  reminderEnabled?: boolean;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  reminderTime?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  expectedReminderVersion?: number;
}
