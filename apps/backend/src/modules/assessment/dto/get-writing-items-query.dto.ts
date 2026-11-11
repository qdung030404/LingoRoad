import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { CefrLevel } from "@prisma/client";

export class GetWritingItemsQueryDto {
  @IsOptional()
  @IsEnum(CefrLevel)
  cefrLevel?: CefrLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}

