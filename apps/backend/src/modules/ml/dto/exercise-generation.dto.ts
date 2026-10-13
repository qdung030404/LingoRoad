import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class GenerateExerciseDto {
  @IsString()
  skill_code: string;

  @IsString()
  skill_name: string;

  @IsString()
  cefr: string;

  @IsOptional()
  @IsIn(['mcq', 'cloze', 'listening_mcq'])
  type?: string = 'mcq';

  @IsOptional()
  @IsNumber()
  count?: number = 3;
}

export class ExerciseItemDto {
  stem: string;
  options: string[];
  correct_answer: string;
  explanation_vi: string;
}

export class GenerateExerciseResponseDto {
  exercises: ExerciseItemDto[];
  model_version: string;
}
