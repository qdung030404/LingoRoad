import {
  parseEnumParam,
  parsePositiveIntParam,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import type { SpeakingMode, SpeakingStatus } from '@/types/admin';

export type SpeakingAdminTab = 'prompts' | 'submissions' | 'voice';
export const SPEAKING_TABS: readonly SpeakingAdminTab[] = [
  'prompts',
  'submissions',
  'voice',
];
export const SPEAKING_MODES: readonly SpeakingMode[] = [
  'READ_ALOUD',
  'TOPIC',
  'PICTURE_DESCRIPTION',
  'TONGUE_TWISTER',
];
export const SPEAKING_STATUSES: readonly SpeakingStatus[] = [
  'CREATED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'UNKNOWN',
];
export const VOICE_STATUSES = [
  'CREATED',
  'ACTIVE',
  'ENDED',
  'INTERRUPTED',
] as const;
export type VoiceSessionStatus = (typeof VOICE_STATUSES)[number];
export const VOICE_ASSESSMENT_STATUSES = [
  'UNASSESSED',
  'PROCESSING',
  'READY',
  'PARTIAL',
  'FAILED',
  'UNKNOWN',
] as const;
export type VoiceAssessmentStatus = (typeof VOICE_ASSESSMENT_STATUSES)[number];
export const PUBLISHED_OPTIONS = ['true', 'false'] as const;
export const PAGE_LIMITS = [10, 20, 50] as const;
export const MAX_BULK_SELECTION = 100;

export const SPEAKING_QUERY_DEFAULTS: Record<string, QueryParamValue> = {
  tab: 'prompts',
  page: 1,
  limit: 10,
};

export const MODE_TABS: Array<{ value: SpeakingMode | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'READ_ALOUD', label: 'Đọc to' },
  { value: 'TOPIC', label: 'Chủ đề / Voice AI' },
  { value: 'PICTURE_DESCRIPTION', label: 'Mô tả tranh' },
  { value: 'TONGUE_TWISTER', label: 'Xoắn lưỡi' },
];

export interface ParsedInitialSpeakingState {
  tab: SpeakingAdminTab;
  page: number;
  limit: number;
  search: string;
  mode: SpeakingMode | '';
  published: '' | 'true' | 'false';
  subStatus: SpeakingStatus | '';
  errorCode: string;
  voiceStatus: VoiceSessionStatus | '';
  assessmentStatus: VoiceAssessmentStatus | '';
  stuckOnly: boolean;
}

export function parseLimitParam(raw: string | null | undefined): number {
  const parsed = parsePositiveIntParam(raw, 10);
  return (PAGE_LIMITS as readonly number[]).includes(parsed) ? parsed : 10;
}

export function parseSpeakingFilters(
  getRaw: (key: string) => string | null | undefined,
): ParsedInitialSpeakingState {
  const tab =
    parseEnumParam(getRaw('tab'), SPEAKING_TABS, 'prompts') || 'prompts';
  const page = parsePositiveIntParam(getRaw('page'), 1);
  const limit = parseLimitParam(getRaw('limit'));
  const search = getRaw('search')?.trim() ?? '';
  const mode = parseEnumParam(getRaw('mode'), SPEAKING_MODES);
  const published = parseEnumParam(getRaw('published'), PUBLISHED_OPTIONS);
  const subStatus =
    tab === 'submissions'
      ? parseEnumParam(getRaw('status'), SPEAKING_STATUSES)
      : '';
  const errorCode =
    tab === 'submissions' ? (getRaw('errorCode')?.trim() ?? '') : '';
  const voiceStatus =
    tab === 'voice' ? parseEnumParam(getRaw('status'), VOICE_STATUSES) : '';
  const assessmentStatus =
    tab === 'voice'
      ? parseEnumParam(getRaw('assessmentStatus'), VOICE_ASSESSMENT_STATUSES)
      : '';
  const stuckOnly = tab === 'voice' && getRaw('stuckOnly')?.trim() === 'true';

  return {
    tab,
    page,
    limit,
    search,
    mode,
    published,
    subStatus,
    errorCode,
    voiceStatus,
    assessmentStatus,
    stuckOnly,
  };
}

export function readInitialSpeakingFilters(): ParsedInitialSpeakingState {
  const sp =
    typeof window !== 'undefined' && typeof window.location?.search === 'string'
      ? new URLSearchParams(window.location.search)
      : null;
  return parseSpeakingFilters((key) => sp?.get(key));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatSpeakingDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function submissionStatusBadgeClass(
  status: SpeakingStatus | string,
): string {
  switch (status) {
    case 'SUCCEEDED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'FAILED':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'UNKNOWN':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'PROCESSING':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-slateDark-50 text-slateDark-700 border-slateDark-200';
  }
}

export function voiceAssessmentBadgeClass(status: string): string {
  switch (status) {
    case 'READY':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PARTIAL':
    case 'UNKNOWN':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'FAILED':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'PROCESSING':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-slateDark-50 text-slateDark-700 border-slateDark-200';
  }
}

export function voiceSessionBadgeClass(status: string): string {
  switch (status) {
    case 'ENDED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ACTIVE':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'INTERRUPTED':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    default:
      return 'bg-slateDark-50 text-slateDark-700 border-slateDark-200';
  }
}

export interface ParsedSubmissionWord {
  word: string;
  accuracy: number | null;
  errorType: string;
  phonemes: Array<{ phoneme: string; accuracy: number | null }>;
}

export interface ParsedSubmissionContentFeedback {
  status: string | null;
  errorCode: string | null;
  rubricVersion: string | null;
  vocabulary: number | null;
  grammar: number | null;
  topic: number | null;
  overall: number | null;
  strengths: string[];
  improvements: Array<{
    quote: string;
    explanationVi: string;
    suggestion: string;
  }>;
}

export interface ParsedSubmissionResult {
  transcript: string | null;
  overall: number | null;
  accuracy: number | null;
  fluency: number | null;
  prosody: number | null;
  completeness: number | null;
  pronunciation: number | null;
  durationSeconds: number | null;
  feedbackVi: string | null;
  words: ParsedSubmissionWord[];
  content: ParsedSubmissionContentFeedback | null;
}

export function parseSpeakingSubmissionResult(
  raw: unknown,
): ParsedSubmissionResult | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const rawWords = Array.isArray(rec.words) ? rec.words : [];
  const words: ParsedSubmissionWord[] = rawWords
    .map((entry) => {
      const w = asRecord(entry);
      if (!w) return null;
      const word = asNonEmptyString(w.word);
      if (!word) return null;
      const rawPhonemes = Array.isArray(w.phonemes) ? w.phonemes : [];
      const phonemes = rawPhonemes
        .map((p) => {
          const pr = asRecord(p);
          if (!pr) return null;
          const phoneme = asNonEmptyString(pr.phoneme);
          if (!phoneme) return null;
          return { phoneme, accuracy: asFiniteNumber(pr.accuracy) };
        })
        .filter(
          (item): item is { phoneme: string; accuracy: number | null } =>
            item !== null,
        );
      return {
        word,
        accuracy: asFiniteNumber(w.accuracy),
        errorType: asNonEmptyString(w.errorType) ?? 'None',
        phonemes,
      };
    })
    .filter((item): item is ParsedSubmissionWord => item !== null);

  const rawContent = asRecord(rec.content);
  let content: ParsedSubmissionContentFeedback | null = null;
  if (rawContent) {
    const strengths = Array.isArray(rawContent.strengths)
      ? rawContent.strengths.filter(
          (s): s is string => typeof s === 'string' && s.trim().length > 0,
        )
      : [];
    const improvements = Array.isArray(rawContent.improvements)
      ? rawContent.improvements
          .map((item) => {
            const ir = asRecord(item);
            if (!ir) return null;
            const quote = asNonEmptyString(ir.quote) ?? '';
            const explanationVi = asNonEmptyString(ir.explanationVi) ?? '';
            const suggestion = asNonEmptyString(ir.suggestion) ?? '';
            if (!quote && !explanationVi && !suggestion) return null;
            return { quote, explanationVi, suggestion };
          })
          .filter(
            (
              item,
            ): item is {
              quote: string;
              explanationVi: string;
              suggestion: string;
            } => item !== null,
          )
      : [];

    content = {
      status: asNonEmptyString(rawContent.status),
      errorCode: asNonEmptyString(rawContent.errorCode),
      rubricVersion: asNonEmptyString(rawContent.rubricVersion),
      vocabulary: asFiniteNumber(rawContent.vocabulary),
      grammar: asFiniteNumber(rawContent.grammar),
      topic: asFiniteNumber(rawContent.topic),
      overall: asFiniteNumber(rawContent.overall),
      strengths,
      improvements,
    };
  }

  return {
    transcript: asNonEmptyString(rec.transcript),
    overall: asFiniteNumber(rec.overall),
    accuracy: asFiniteNumber(rec.accuracy),
    fluency: asFiniteNumber(rec.fluency),
    prosody: asFiniteNumber(rec.prosody),
    completeness: asFiniteNumber(rec.completeness),
    pronunciation: asFiniteNumber(rec.pronunciation),
    durationSeconds: asFiniteNumber(rec.durationSeconds),
    feedbackVi: asNonEmptyString(rec.feedbackVi),
    words,
    content,
  };
}

export interface ParsedPromptSnapshot {
  title: string | null;
  mode: string | null;
  text: string | null;
  difficulty: number | null;
  maxDurationSeconds: number | null;
  hints: string[];
  imageUrl: string | null;
  visualContext: string | null;
  assessmentProfile: string | null;
  contentVersion: number | null;
}

export function parsePromptSnapshot(raw: unknown): ParsedPromptSnapshot | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const hints = Array.isArray(rec.hints)
    ? rec.hints.filter(
        (h): h is string => typeof h === 'string' && h.trim().length > 0,
      )
    : [];
  return {
    title: asNonEmptyString(rec.title),
    mode: asNonEmptyString(rec.mode),
    text: asNonEmptyString(rec.text),
    difficulty: asFiniteNumber(rec.difficulty),
    maxDurationSeconds: asFiniteNumber(rec.maxDurationSeconds),
    hints,
    imageUrl: asNonEmptyString(rec.imageUrl),
    visualContext: asNonEmptyString(rec.visualContext),
    assessmentProfile: asNonEmptyString(rec.assessmentProfile),
    contentVersion: asFiniteNumber(rec.contentVersion),
  };
}

export interface ParsedVoiceAssessmentSummary {
  pronunciationScope: string | null;
  assessedAt: string | null;
  pronunciation: {
    overall: number | null;
    accuracy: number | null;
    fluency: number | null;
    prosody: number | null;
  } | null;
  content: {
    status: string | null;
    errorCode: string | null;
    overall: number | null;
    vocabulary: number | null;
    grammar: number | null;
    topic: number | null;
  } | null;
}

export function parseVoiceAssessment(
  raw: unknown,
): ParsedVoiceAssessmentSummary | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const pron = asRecord(rec.pronunciation);
  const content = asRecord(rec.content);
  return {
    pronunciationScope: asNonEmptyString(rec.pronunciationScope),
    assessedAt: asNonEmptyString(rec.assessedAt),
    pronunciation: pron
      ? {
          overall: asFiniteNumber(pron.overall),
          accuracy: asFiniteNumber(pron.accuracy),
          fluency: asFiniteNumber(pron.fluency),
          prosody: asFiniteNumber(pron.prosody),
        }
      : null,
    content: content
      ? {
          status: asNonEmptyString(content.status),
          errorCode: asNonEmptyString(content.errorCode),
          overall: asFiniteNumber(content.overall),
          vocabulary: asFiniteNumber(content.vocabulary),
          grammar: asFiniteNumber(content.grammar),
          topic: asFiniteNumber(content.topic),
        }
      : null,
  };
}
