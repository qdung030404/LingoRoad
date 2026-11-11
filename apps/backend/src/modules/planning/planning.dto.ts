import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { LearningKind } from '@prisma/client';

export class LearningPreferencesDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsInt() @Min(5) @Max(120) dailyGoalMinutes!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) @ArrayUnique() @IsEnum(LearningKind, { each: true }) preferredKinds!: LearningKind[];
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
