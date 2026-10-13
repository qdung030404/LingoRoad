import { AssessmentItem } from '@prisma/client';
import { AssessmentItemResponseDto } from '../dto/assessment-item-response.dto';

export function toSafeItemResponse(item: AssessmentItem, index: number): AssessmentItemResponseDto {
  let optionsArray: string[] = [];
  if (Array.isArray(item.options)) {
    optionsArray = item.options.map(String);
  } else if (typeof item.options === 'string') {
    try {
      const parsed = JSON.parse(item.options);
      optionsArray = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      optionsArray = [];
    }
  }

  return {
    id: item.id,
    index,
    type: item.type,
    prompt: item.prompt,
    options: optionsArray,
    audioUrl: item.audioUrl,
  };
}
