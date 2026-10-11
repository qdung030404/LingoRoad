import { IsString } from 'class-validator';
import {
  AweCriteriaScores,
  AweFeedbackItem,
} from '../interfaces/ml-client.interface';

export class EvaluateWritingDto {
  @IsString()
  task_prompt: string;

  @IsString()
  essay: string;
}

export class EvaluateWritingResponseDto {
  scores: AweCriteriaScores;
  feedback: AweFeedbackItem[];
  overall_vi: string;
}
