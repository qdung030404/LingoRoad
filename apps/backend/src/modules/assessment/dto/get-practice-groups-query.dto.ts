import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { AssessmentSkill, CefrLevel } from "@prisma/client";

export class GetPracticeGroupsQueryDto {
  @IsOptional()
  @IsEnum(AssessmentSkill)
  skill?: AssessmentSkill;

  @IsOptional()
  @IsEnum(CefrLevel)
  cefrLevel?: CefrLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  partNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
