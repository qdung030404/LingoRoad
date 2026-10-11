import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CatHistoryEntryDto {
  @IsNumber()
  a: number;

  @IsNumber()
  b: number;

  @IsNumber()
  c: number;

  @IsBoolean()
  correct: boolean;
}

export class CatCandidateDto {
  @IsString()
  item_id: string;

  @IsNumber()
  a: number;

  @IsNumber()
  b: number;

  @IsNumber()
  c: number;
}

export class SelectCatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatHistoryEntryDto)
  history: CatHistoryEntryDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatCandidateDto)
  candidates: CatCandidateDto[];
}

export class CatSelectResponseDto {
  @IsNumber()
  theta: number;

  @IsNumber()
  se: number;

  @IsOptional()
  @IsString()
  next_item_id: string | null;
}
