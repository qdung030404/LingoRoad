import { CefrLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { GRAMMAR_FORMULA_FORMS, GrammarFormulaForm } from '../grammar.types';

export class GrammarFormulaDto {
  @IsIn(GRAMMAR_FORMULA_FORMS)
  form!: GrammarFormulaForm;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  labelVi!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  structure!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  noteVi?: string;
}

export class GrammarUsageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  useCaseVi!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  signalWords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  commonMistakeVi?: string;
}

export class GrammarExampleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  sentenceEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  translationVi!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  highlight?: string;
}

export class CreateGrammarTopicDto {
  @IsString()
  @Matches(/^grammar(\.[a-z_]+)*$/, {
    message: 'Mã cấu trúc ngữ pháp phải bắt đầu bằng "grammar" và phân tách bằng dấu chấm.',
  })
  @MaxLength(100)
  code!: string;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  cefrLevel!: CefrLevel;

  @IsBoolean()
  isLeaf!: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  titleEn!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  titleVi!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summaryVi?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GrammarFormulaDto)
  formulas?: GrammarFormulaDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GrammarUsageDto)
  usageNotes?: GrammarUsageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GrammarExampleDto)
  examples?: GrammarExampleDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateGrammarTopicDto {
  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  cefrLevel?: CefrLevel;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  titleEn?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  titleVi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summaryVi?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GrammarFormulaDto)
  formulas?: GrammarFormulaDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GrammarUsageDto)
  usageNotes?: GrammarUsageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GrammarExampleDto)
  examples?: GrammarExampleDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class GrammarPrerequisiteEdgeDto {
  @IsUUID()
  prerequisiteId!: string;

  @IsUUID()
  targetId!: string;
}
