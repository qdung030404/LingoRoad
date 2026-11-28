import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LearningPurpose } from '@prisma/client';

export const PREFERRED_SKILL_VALUES = [
  'GRAMMAR',
  'VOCABULARY',
  'READING',
  'LISTENING',
  'SPEAKING',
  'WRITING',
] as const;
export type PreferredSkill = (typeof PREFERRED_SKILL_VALUES)[number];

export class LearningPreferencesDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsOptional() @IsEnum(LearningPurpose) learningPurpose?: LearningPurpose;
  @IsOptional() @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) targetCefr?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  @IsInt() @Min(5) @Max(120) dailyGoalMinutes!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @ArrayUnique() @IsIn(PREFERRED_SKILL_VALUES, { each: true }) preferredKinds!: PreferredSkill[];
}
export class OpenActivityDto {
  @IsUUID() clientRunId!: string;
}
export class ActivitySegmentDto {
  @IsInt() @Min(0) @Max(2147483647) seq!: number;
  @IsInt() @Min(0) @Max(86400000) startOffsetMs!: number;
  @IsInt() @Min(1) @Max(86400000) endOffsetMs!: number;
}
export class ActivityBatchDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ActivitySegmentDto)
  segments!: ActivitySegmentDto[];
}
