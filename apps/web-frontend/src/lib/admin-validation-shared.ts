import type { GrammarFormulaForm, SpeakingMode } from '../types/admin';

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

export const LISTENING_SKILL_CODES = [
  'listening.basic_dialogues',
  'listening.gist',
  'listening.detail',
  'listening.numbers_dates_times',
  'listening.directions',
  'listening.specific_information',
  'listening.speaker_attitude',
  'listening.note_taking',
  'listening.implied_meaning',
  'listening.accents',
  'listening.discussions',
  'listening.lectures',
] as const;

export const LISTENING_DETAIL_SKILL_CODES = [
  'listening.specific_information',
  'listening.detail',
  'listening.numbers_dates_times',
] as const;

export const LISTENING_AUDIO_URL_REGEX =
  /^\/media\/learning\/v1\/([a-z0-9]+(?:-[a-z0-9]+)*\.wav)$/;

export const GRAMMAR_FORMULA_FORMS: readonly GrammarFormulaForm[] = [
  'AFFIRMATIVE',
  'NEGATIVE',
  'QUESTION',
  'NOTE',
] as const;

export const GRAMMAR_CODE_REGEX = /^grammar(\.[a-z_]+)*$/;

export const SPEAKING_MAX_HINTS = 3;

export function maxSpeakingDurationForMode(mode: SpeakingMode): number {
  return mode === 'TOPIC' || mode === 'PICTURE_DESCRIPTION' ? 60 : 30;
}

export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || trimmed !== value) return false;
  if (trimmed.includes('..') || /[\s\u0000-\u001f]/.test(trimmed)) return false;
  return (
    /^\/media\/learning\/v1\/images\/[a-z0-9-]+(?:\.(?:svg|png|webp|jpg|jpeg))$/i.test(
      trimmed,
    ) ||
    /^assets\/illustrations\/[a-z0-9-]+(?:\.(?:svg|png|webp|jpg|jpeg))$/i.test(
      trimmed,
    ) ||
    /^https:\/\/[^\s]+$/i.test(trimmed)
  );
}
