import { CefrLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class GrammarTreeQueryDto {
  @IsOptional()
  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  cefrLevel?: CefrLevel;

  @IsOptional()
  @IsIn(['hierarchy', 'cefr'])
  groupBy: 'hierarchy' | 'cefr' = 'hierarchy';
}

export class GrammarTopicsQueryDto {
  @IsOptional()
  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  cefrLevel?: CefrLevel;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  parentCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  leafOnly?: 'true' | 'false';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class GrammarPracticeItemsQueryDto {
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
