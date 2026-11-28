import { CefrLevel, LearningKind } from '@prisma/client';
import { LearningContent, LearningQuestion } from '../src/modules/learning/learning.types';

export interface LearningUnitSeed {
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
}

export interface LearningSeed {
  code: string;
  kind: LearningKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  sortOrder: number;
  contentVersion: number;
  unitCode: string;
  content: LearningContent;
}

const transcript = 'Hello! My name is Anna. I am twenty years old. I am from Hanoi. I am a student. I like reading books with my friends.';
const question = (
  id: string,
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation: string,
  extra?: Pick<LearningQuestion, 'evidence' | 'skillCode' | 'type'>,
): LearningQuestion => ({
  id, prompt, options: options.map((text, index) => ({ id: String.fromCharCode(65 + index), text })),
  correctOptionId: String.fromCharCode(65 + correctIndex), explanation, ...extra,
});
export { transcript, question };
