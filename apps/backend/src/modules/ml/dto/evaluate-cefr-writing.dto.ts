import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum CefrWritingTaskType {
  TASK_1 = 'TASK_1',
  TASK_2 = 'TASK_2',
}

export enum EvaluationLevelStatus {
  EXCEEDS_EXPECTATIONS = 'EXCEEDS_EXPECTATIONS',
  MEETS_EXPECTATIONS = 'MEETS_EXPECTATIONS',
  NEEDS_IMPROVEMENT = 'NEEDS_IMPROVEMENT',
}

export enum GrammarChecklistStatus {
  MASTERED = 'MASTERED',
  ATTEMPTED_WITH_ERRORS = 'ATTEMPTED_WITH_ERRORS',
  NOT_USED = 'NOT_USED',
}

export class EvaluateCefrWritingDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  itemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  taskType?: string = 'TASK_2';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  taskPrompt?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(12000)
  essay: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  targetCefr?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetGrammars?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  learnerLevel?: string;
}

export class LevelEvaluationDto {
  @IsEnum(EvaluationLevelStatus)
  status: EvaluationLevelStatus;

  @IsString()
  summaryVi: string;

  @IsString()
  encouragementVi: string;
}

export class GrammarChecklistItemDto {
  @IsString()
  grammarPoint: string;

  @IsEnum(GrammarChecklistStatus)
  status: GrammarChecklistStatus;

  @IsOptional()
  @IsString()
  evidenceSentence?: string;

  @IsString()
  feedbackVi: string;
}

export class CefrWritingFeedbackItemDto {
  @IsString()
  originalSentence: string;

  @IsString()
  issueVi: string;

  @IsString()
  suggestion: string;

  @IsOptional()
  @IsString()
  explanationVi?: string;
}

export class CefrWritingEvaluationResultDto {
  levelEvaluation: LevelEvaluationDto;
  grammarChecklist: GrammarChecklistItemDto[];
  improvementSteps: string[];
  feedback: CefrWritingFeedbackItemDto[];
  overallCommentVi: string;
}
