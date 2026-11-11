import { SpeakingMode } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
export class CreateSpeakingDto {
  @IsUUID() promptId!: string;
  @IsUUID() clientRequestId!: string;
}
export class SpeakingPromptsQuery { @IsOptional() @IsEnum(SpeakingMode) mode?: SpeakingMode; }
export class SpeakingHistoryQuery extends SpeakingPromptsQuery { @IsOptional() @IsUUID() cursor?: string; }

export interface ReadAloudResult {
  overall?: number | null;
  scoringPolicy?: { version: string; weights: { accuracy: number; fluency: number; prosody: number; completeness: number } };
  schemaVersion?: 2;
  assessmentProfile?: 'read-aloud-v2';
  prosody?: number | null;
  assessmentCompleteness?: 'full' | 'partial';
  referenceText?: string;
  audioHash?: string;
  assessedAt?: string;
  serviceRegion?: string | null;
  serviceVersion?: string | null;
  assessmentConfig?: Record<string, unknown>;
  transcript: string;
  accuracy: number;
  fluency: number;
  completeness: number;
  pronunciation: number;
  words: ReadAloudWord[];
  durationSeconds: number;
  provider: 'azure';
  adapterVersion: string;
  feedbackVi: string;
}

export interface ReadAloudSegment {
  phoneme?: string;
  syllable?: string;
  accuracy: number | null;
  offsetMs: number | null;
  durationMs: number | null;
}
export interface ReadAloudWord {
  word: string;
  accuracy: number | null;
  errorType: string;
  offsetMs?: number | null;
  durationMs?: number | null;
  phonemes?: ReadAloudSegment[];
  syllables?: ReadAloudSegment[];
  prosody?: { unexpectedBreakConfidence: number | null; missingBreakConfidence: number | null; monotone: boolean | null };
}
