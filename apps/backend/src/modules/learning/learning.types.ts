import { CefrLevel, LearningKind } from '@prisma/client';

export const READING_SKILL_CODES = [
  'reading.skimming',
  'reading.main_idea',
  'reading.inference',
  'reading.scanning',
  'reading.context_clues',
  'reading.text_structure',
  'reading.fact_opinion',
  'reading.author_purpose',
  'reading.critical_reading',
  'reading.text_types',
  'reading.text_types.short_stories',
  'reading.text_types.news_articles',
  'reading.text_types.informal_letters',
  'reading.text_types.formal_letters',
  'reading.text_types.reports',
  'reading.text_types.academic_texts',
  'reading.text_types.literary_texts',
] as const;
export type ReadingSkillCode = (typeof READING_SKILL_CODES)[number];

export const LEARNING_QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'GAP_FILL',
  'TRUE_FALSE_NOT_GIVEN',
] as const;
export type LearningQuestionType = (typeof LEARNING_QUESTION_TYPES)[number];

export interface LearningOption { id: string; text: string }
export interface LearningQuestion {
  id: string;
  type?: LearningQuestionType;
  prompt: string;
  options: LearningOption[];
  correctOptionId: string;
  explanation: string;
  evidence?: string;
  skillCode?: ReadingSkillCode;
}
export interface LearningVocabularyItem {
  id: string;
  word: string;
  phonetic?: string;
  meaning: string;
  example?: string;
  translation?: string;
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
  keyVocabulary?: LearningVocabularyItem[];
}
export interface LessonSnapshot {
  id: string;
  code: string;
  kind: LearningKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  contentVersion: number;
  cefrLevel?: CefrLevel;
  questionCount?: number;
}

function hasUniquePassageMatch(passage: unknown, evidence: unknown): boolean {
  if (typeof evidence !== 'string' || typeof passage !== 'string') return false;
  const needle = evidence.trim().toLowerCase();
  const haystack = passage.toLowerCase();
  if (!needle || !haystack.trim()) return false;
  const first = haystack.indexOf(needle);
  return first !== -1 && haystack.indexOf(needle, first + 1) === -1;
}

const TFNG_OPTIONS = ['True', 'False', 'Not Given'] as const;

export function validateLearningContent(value: unknown): asserts value is LearningContent {
  const content = value as LearningContent;
  if (!content || !Array.isArray(content.steps) || !Array.isArray(content.questions) || content.questions.length < 3 || content.questions.length > 10) {
    throw new Error('Learning content must contain steps and between three and ten questions.');
  }
  const ids = new Set<string>();
  for (const question of content.questions) {
    if (question.type !== undefined && !(LEARNING_QUESTION_TYPES as readonly string[]).includes(question.type)) {
      throw new Error('Invalid learning question.');
    }
    const questionType = question.type ?? 'MULTIPLE_CHOICE';
    if (!question.id || ids.has(question.id) || !question.prompt?.trim() || !question.explanation?.trim()
      || !Array.isArray(question.options) || question.options.length === 0
      || question.options.some((option) => !option.id || !option.text?.trim())
      || new Set(question.options.map((option) => option.id)).size !== question.options.length
      || !question.options.some((option) => option.id === question.correctOptionId)) {
      throw new Error('Invalid learning question.');
    }
    if (questionType === 'MULTIPLE_CHOICE' && question.options.length !== 4) {
      throw new Error('Invalid learning question.');
    }
    if (questionType === 'GAP_FILL' && (question.options.length !== 4 || !/_{3,}|…/.test(question.prompt))) {
      throw new Error('Invalid learning question.');
    }
    if (
      questionType === 'TRUE_FALSE_NOT_GIVEN' &&
      (question.options.length !== 3 || question.options.some((option, idx) => option.text !== TFNG_OPTIONS[idx]))
    ) {
      throw new Error('Invalid learning question.');
    }
    if (question.skillCode !== undefined && !(READING_SKILL_CODES as readonly string[]).includes(question.skillCode)) {
      throw new Error('Invalid learning question.');
    }
    if (question.evidence !== undefined && !hasUniquePassageMatch(content.passage, question.evidence)) {
      throw new Error('Invalid learning question.');
    }
    ids.add(question.id);
  }
  if (content.keyVocabulary !== undefined) {
    if (!Array.isArray(content.keyVocabulary)) {
      throw new Error('Invalid learning keyVocabulary.');
    }
    const vocabIds = new Set<string>();
    const vocabPairs = new Set<string>();
    for (const item of content.keyVocabulary) {
      const word = item?.word?.trim();
      const meaning = item?.meaning?.trim();
      if (!item?.id?.trim() || vocabIds.has(item.id) || !word || word.length > 100 || !meaning || meaning.length > 500) {
        throw new Error('Invalid learning keyVocabulary item.');
      }
      if (item.phonetic !== undefined && (typeof item.phonetic !== 'string' || item.phonetic.length > 100)) {
        throw new Error('Invalid learning keyVocabulary item.');
      }
      if (item.example !== undefined && (typeof item.example !== 'string' || item.example.length > 1000)) {
        throw new Error('Invalid learning keyVocabulary item.');
      }
      if (item.translation !== undefined && (typeof item.translation !== 'string' || item.translation.length > 1000)) {
        throw new Error('Invalid learning keyVocabulary item.');
      }
      const pairKey = `${word.toLowerCase()}||${meaning.toLowerCase()}`;
      if (vocabPairs.has(pairKey)) {
        throw new Error('Duplicate learning keyVocabulary item.');
      }
      vocabIds.add(item.id);
      vocabPairs.add(pairKey);
    }
  }
  const stepIds = new Set<string>();
  for (const step of content.steps) {
    if (!step.id || stepIds.has(step.id) || !step.title?.trim() || !step.body?.trim()) throw new Error('Invalid learning step.');
    stepIds.add(step.id);
  }
}
