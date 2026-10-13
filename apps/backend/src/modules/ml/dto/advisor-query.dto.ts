import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AdvisorPathEntryDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber()
  mastery: number;

  @IsString()
  reason: string;
}

export class AdvisorQueryDto {
  @IsString()
  question: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdvisorPathEntryDto)
  path: AdvisorPathEntryDto[];

  @IsOptional()
  @IsString()
  locale?: string = 'vi';
}

export class AdvisorResponseDto {
  @IsString()
  answer: string;
}
