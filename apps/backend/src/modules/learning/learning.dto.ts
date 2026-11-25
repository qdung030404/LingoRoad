import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class VersionDto {
  @IsInt() @Min(0) expectedVersion!: number;
}
export class LearningProgressDto extends VersionDto {
  @IsIn(['STUDY', 'QUIZ']) phase!: 'STUDY' | 'QUIZ';
  @IsInt() @Min(0) index!: number;
  @IsOptional() @IsString() @MaxLength(100) questionId?: string;
  @IsOptional() @IsString() @MaxLength(100) optionId?: string | null;
}
export class CheckLearningAnswerDto extends VersionDto {
  @IsString() @MaxLength(100) optionId!: string;
}
export class LearningCatalogueQuery {
  @IsOptional() @IsIn(['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING']) kind?: 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING';
}
export class LearningLessonsCatalogueQuery extends LearningCatalogueQuery {
  @IsOptional() @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) cefrLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  @IsOptional() @IsString() @MaxLength(100) grammarTopicCode?: string;
}
export class LearningHistoryQuery extends LearningCatalogueQuery {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) limit: number = 20;
}

export class HideLearningHistoryDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100) @ArrayUnique()
  @IsUUID(undefined, { each: true })
  attemptIds!: string[];
}
