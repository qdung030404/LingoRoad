import { AssessmentItemResponseDto } from './assessment-item-response.dto';
import { PlacementResultDto } from './placement-result.dto';

export class SubmitAnswerResponseDto {
  isFinished: boolean;
  nextItem?: AssessmentItemResponseDto;
  result?: PlacementResultDto;
}
