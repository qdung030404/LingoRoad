import { AssessmentItemResponseDto } from './assessment-item-response.dto';

export class StartAssessmentResponseDto {
  sessionId: string;
  totalItems: number;
  firstItem: AssessmentItemResponseDto;
  isResumed?: boolean;
}
