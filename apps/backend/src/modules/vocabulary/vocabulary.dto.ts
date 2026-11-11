import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class VocabularyCommandDto { @IsUUID() commandId!: string; }
export class VocabularyVersionDto extends VocabularyCommandDto { @IsInt() @Min(0) expectedVersion!: number; }
export class VocabularyCreateDeckDto extends VocabularyCommandDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(60) name!: string;
}
export class VocabularyUpdateDeckDto extends VocabularyCreateDeckDto { @IsInt() @Min(0) expectedVersion!: number; }
export class VocabularyCreateWordDto extends VocabularyCommandDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(100) english!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(500) meaning!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) phonetic?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) partOfSpeech?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) example?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) translation?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(11) @IsString({ each: true }) @MinLength(1, { each: true }) @MaxLength(100, { each: true }) acceptedAnswers?: string[];
}
export class VocabularyUpdateWordDto extends VocabularyCreateWordDto { @IsInt() @Min(0) expectedVersion!: number; }
export class VocabularyListQuery {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsString() @MaxLength(500) query?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit: number = 20;
  @IsOptional() @IsUUID() deckId?: string;
}
export class VocabularyStartDto extends VocabularyCommandDto {
  @IsOptional() @IsIn(['NEEDS_REVIEW', 'ALL']) scope: 'NEEDS_REVIEW' | 'ALL' = 'NEEDS_REVIEW';
}
export class VocabularyReviewCommandDto extends VocabularyVersionDto {
  @IsIn(['SAVE_PROGRESS', 'CHECK_RECALL', 'RATE', 'ADVANCE', 'SKIP', 'REQUEUE', 'SUBMIT', 'ABANDON']) action!: string;
  @IsOptional() @IsUUID() itemId?: string;
  @IsOptional() @IsIn(['FRONT', 'MEANING', 'RECALL']) phase?: string;
  @IsOptional() @IsString() @MaxLength(1000) draft?: string;
  @IsOptional() @IsString() @MaxLength(1000) answer?: string;
  @IsOptional() @IsIn(['EASY', 'MEDIUM', 'HARD']) rating?: string;
}
