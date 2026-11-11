import { LearningKind } from '@prisma/client';

export interface LearningOption { id: string; text: string }
export interface LearningQuestion {
  id: string;
  prompt: string;
  options: LearningOption[];
  correctOptionId: string;
  explanation: string;
}
export interface LearningStep {
  id: string;
  title: string;
  body: string;
  word?: string;
  phonetic?: string;
  meaning?: string;
  example?: string;
  audioUrl?: string;
}
export interface LearningContent {
  steps: LearningStep[];
  questions: LearningQuestion[];
  passage?: string;
  audioUrl?: string;
  transcript?: string;
}
export interface LessonSnapshot {
  id: string;
  code: string;
  kind: LearningKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  contentVersion: number;
}

export function validateLearningContent(value: unknown): asserts value is LearningContent {
  const content = value as LearningContent;
  if (!content || !Array.isArray(content.steps) || !Array.isArray(content.questions) || content.questions.length !== 5) {
    throw new Error('Learning content must contain steps and exactly five questions.');
  }
  const ids = new Set<string>();
  for (const question of content.questions) {
    if (!question.id || ids.has(question.id) || !question.prompt?.trim() || !question.explanation?.trim()
      || !Array.isArray(question.options) || question.options.length !== 4
      || question.options.some((option) => !option.id || !option.text?.trim())
      || new Set(question.options.map((option) => option.id)).size !== 4
      || !question.options.some((option) => option.id === question.correctOptionId)) {
      throw new Error('Invalid learning question.');
    }
    ids.add(question.id);
  }
  const stepIds = new Set<string>();
  for (const step of content.steps) {
    if (!step.id || stepIds.has(step.id) || !step.title?.trim() || !step.body?.trim()) throw new Error('Invalid learning step.');
    stepIds.add(step.id);
  }
}
