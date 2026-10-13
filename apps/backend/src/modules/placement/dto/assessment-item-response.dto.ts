import { ItemType } from '@prisma/client';

export class AssessmentItemResponseDto {
  id: string;
  index: number;
  type: ItemType;
  prompt: string;
  options: string[];
  audioUrl?: string | null;
}
