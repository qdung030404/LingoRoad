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

/** Kept in sync with the canonical catalog by seed validation and tests. */
export const LISTENING_SKILL_CODES = [
  'listening.basic_dialogues', 'listening.gist', 'listening.detail',
  'listening.numbers_dates_times', 'listening.directions', 'listening.specific_information',
  'listening.speaker_attitude', 'listening.note_taking', 'listening.implied_meaning',
  'listening.accents', 'listening.discussions', 'listening.lectures',
] as const;
export type ListeningSkillCode = (typeof LISTENING_SKILL_CODES)[number];

export const LEARNING_QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'GAP_FILL',
  'TRUE_FALSE_NOT_GIVEN',
] as const;
export type LearningQuestionType = (typeof LEARNING_QUESTION_TYPES)[number];

export interface LearningOption { id: string; text: string; imageUrl?: string }
export interface LearningQuestion {
  id: string;
  type?: LearningQuestionType;
  prompt: string;
  options: LearningOption[];
  correctOptionId: string;
  explanation: string;
  evidence?: string;
  skillCode?: ReadingSkillCode | ListeningSkillCode;
  evidenceSegmentIds?: string[];
}
export interface LearningVocabularyItem {
  id: string;
  word: string;
  phonetic?: string;
  meaning: string;
  example?: string;
  translation?: string;
  imageUrl?: string;
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
  coverImageUrl?: string;
  keyVocabulary?: LearningVocabularyItem[];
  listeningVersion?: 1;
  audioDurationMs?: number;
  preparation?: { situation: string; objective: string };
  transcriptSegments?: ListeningTranscriptSegment[];
}
export interface ListeningTranscriptSegment {
  id: string;
  speaker: string;
  startMs: number;
  endMs: number;
  text: string;
  translationVi: string;
  speakerAvatar?: string;
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
  audioDurationMs?: number;
  coverImageUrl?: string;
  grammarTopicCode?: string;
}

export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || trimmed !== value) return false;
  if (trimmed.includes('..') || /[\s\u0000-\u001f]/.test(trimmed)) return false;
  return (
    /^\/media\/learning\/v1\/images\/[a-z0-9-]+(?:\.(?:svg|png|webp|jpg|jpeg))$/i.test(trimmed) ||
    /^assets\/illustrations\/[a-z0-9-]+(?:\.(?:svg|png|webp|jpg|jpeg))$/i.test(trimmed) ||
    /^https:\/\/[^\s]+$/i.test(trimmed)
  );
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

export function validateLearningContent(value: unknown, kind?: LearningKind): asserts value is LearningContent {
  const content = value as LearningContent;
  if (!content || !Array.isArray(content.steps) || !Array.isArray(content.questions) || content.questions.length < 3 || content.questions.length > 10) {
    throw new Error('Learning content must contain steps and between three and ten questions.');
  }
  if (content.coverImageUrl !== undefined && !isSafeImageUrl(content.coverImageUrl)) {
    throw new Error('Invalid learning coverImageUrl.');
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
    const optionImages = question.options.map((option) => option.imageUrl);
    if (optionImages.some((url) => url !== undefined)) {
      if (optionImages.some((url) => !isSafeImageUrl(url))
        || new Set(optionImages).size !== question.options.length) {
        throw new Error('Invalid learning question option images.');
      }
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
    const allowedSkills: readonly string[] = content.listeningVersion === 1 ? LISTENING_SKILL_CODES : READING_SKILL_CODES;
    if (question.skillCode !== undefined && !allowedSkills.includes(question.skillCode)) {
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
      if (item.imageUrl !== undefined && !isSafeImageUrl(item.imageUrl)) {
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
  if (content.listeningVersion !== undefined || content.transcriptSegments !== undefined
    || content.preparation !== undefined || content.audioDurationMs !== undefined
    || content.questions.some((question) => question.evidenceSegmentIds !== undefined)) {
    validateListeningProfile(content, kind);
  }
}

const normalizeWhitespace = (text: string) => text.trim().replace(/\s+/g, ' ');
const nonEmptyString = (value: unknown, max = 5000): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;

function validateListeningProfile(content: LearningContent, kind?: LearningKind): void {
  const invalid = () => { throw new Error('Invalid Listening v1 content.'); };
  const duration = content.audioDurationMs;
  if (content.listeningVersion !== 1 || (kind !== undefined && kind !== 'LISTENING')
    || content.steps.length !== 0 || content.questions.length !== 5 || content.passage !== undefined
    || !Number.isInteger(duration) || duration! < 30000 || duration! > 90000
    || !nonEmptyString(content.audioUrl, 500) || !nonEmptyString(content.transcript, 20000)
    || !nonEmptyString(content.preparation?.situation) || !nonEmptyString(content.preparation?.objective)
    || !content.keyVocabulary || content.keyVocabulary.length < 3 || content.keyVocabulary.length > 5
    || !Array.isArray(content.transcriptSegments) || content.transcriptSegments.length === 0) invalid();

  const segments = content.transcriptSegments!;
  const indexes = new Map<string, number>();
  let previousEnd = 0;
  for (const [index, segment] of segments.entries()) {
    if (!segment || !nonEmptyString(segment.id, 100) || indexes.has(segment.id)
      || !nonEmptyString(segment.speaker, 100) || !nonEmptyString(segment.text) || !nonEmptyString(segment.translationVi)
      || (segment.speakerAvatar !== undefined && !isSafeImageUrl(segment.speakerAvatar))
      || !Number.isInteger(segment.startMs) || !Number.isInteger(segment.endMs)
      || segment.startMs < previousEnd || segment.endMs <= segment.startMs || segment.endMs > duration!) invalid();
    indexes.set(segment.id, index);
    previousEnd = segment.endMs;
  }
  if (normalizeWhitespace(content.transcript!) !== normalizeWhitespace(segments.map((segment) => segment.text).join(' '))) invalid();
  for (const question of content.questions) {
    const evidence = question.evidenceSegmentIds;
    if ((question.type ?? 'MULTIPLE_CHOICE') !== 'MULTIPLE_CHOICE' || !question.skillCode
      || !(LISTENING_SKILL_CODES as readonly string[]).includes(question.skillCode)
      || question.evidence !== undefined
      || new Set(question.options.map((option) => option.text.trim().toLowerCase())).size !== 4
      || !Array.isArray(evidence) || evidence.length === 0 || new Set(evidence).size !== evidence.length) invalid();
    let previousIndex = -1;
    for (const segmentId of evidence!) {
      const index = indexes.get(segmentId);
      if (index === undefined || index <= previousIndex) invalid();
      previousIndex = index!;
    }
  }
  if (!content.questions.some((question) => question.skillCode === 'listening.gist')
    || !content.questions.some((question) => ['listening.specific_information', 'listening.detail', 'listening.numbers_dates_times'].includes(question.skillCode!))) invalid();
}
