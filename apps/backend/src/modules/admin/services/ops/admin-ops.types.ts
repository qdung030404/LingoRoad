import { Prisma, SpeakingMode, SpeakingStatus } from '@prisma/client';
import { MlReadinessResult } from '../../../ml/ml-client.service';

export const SPEAKING_STUCK_MS = 180_000;
export const VOICE_LOCK_STUCK_MS = 5 * 60 * 1000;
export const VOICE_ASSESSMENT_STUCK_MS = 15 * 60 * 1000;

export interface AdminVoiceConversationItem {
  id: string;
  userId: string;
  topicId: string;
  topicTitle: string;
  status: string;
  endReason: string | null;
  historyStatus: string;
  historyHiddenAt: Date | null;
  assessmentStatus: string;
  hasActiveLock: boolean;
  turnsCount: number;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  assessmentStartedAt: Date | null;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface AdminVoiceConversationsSummary {
  activeLocks: number;
  failedAssessments: number;
  stuckProcessing: number;
}

export interface AdminVoiceConversationDetail extends AdminVoiceConversationItem {
  topicSnapshot: Prisma.JsonValue;
  assessment: Prisma.JsonValue | null;
  assessmentAudioHash: string | null;
  turns: Array<{
    id: string;
    providerItemId: string;
    sequence: number;
    role: string;
    transcript: string;
    translationVi: string | null;
    interrupted: boolean;
    createdAt: Date;
  }>;
}

export interface AdminSpeakingSubmissionItem {
  id: string;
  userId: string;
  promptId: string;
  promptCode: string | null;
  promptTitle: string;
  mode: SpeakingMode;
  status: SpeakingStatus;
  overallScore: number | null;
  contentStatus: string | null;
  errorCode: string | null;
  adapterVersion: string | null;
  canRetryContent: boolean;
  isStuckProcessing: boolean;
  processingAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  historyHiddenAt: Date | null;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface AdminSpeakingSubmissionsSummary {
  failed: number;
  unknown: number;
  stuckProcessing: number;
  contentUnavailable: number;
}

export interface AdminSpeakingSubmissionDetail extends AdminSpeakingSubmissionItem {
  promptSnapshot: Prisma.JsonValue;
  result: Prisma.JsonValue | null;
  audioHash: string | null;
}

export interface AdminSystemReadinessView {
  checkedAt: string;
  appVersion: string;
  authProvider: string;
  database: {
    status: 'ready' | 'unavailable';
    latencyMs: number;
    error?: string;
  };
  mediaStorage: {
    mode: 'azure' | 'local';
    azureConfigured: boolean;
    azureRequired: boolean;
  };
  ml: MlReadinessResult;
  voiceLive: {
    enabled: boolean;
    status: string;
    maxDurationSeconds: number;
    model: string;
    voice: string;
    apiVersion: string;
  };
  speaking: {
    scoringProfile: string;
    modes: Record<SpeakingMode, boolean>;
  };
  incidents: {
    stuckVoiceLocks: number;
    stuckSpeakingJobs: number;
    failedSpeaking24h: number;
    activeRefreshSessions: number;
  };
}

export function canRetrySpeakingContent(
  mode: SpeakingMode,
  status: SpeakingStatus,
  result: unknown,
): boolean {
  if (
    mode !== SpeakingMode.TOPIC &&
    mode !== SpeakingMode.PICTURE_DESCRIPTION
  ) {
    return false;
  }
  if (status === SpeakingStatus.PROCESSING) {
    return false;
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return false;
  }
  const transcript = (result as { transcript?: unknown }).transcript;
  return typeof transcript === 'string' && transcript.trim().length > 0;
}

export function isSpeakingStuckProcessing(
  status: SpeakingStatus,
  processingAt: Date | null,
  createdAt: Date,
  nowMs: number,
): boolean {
  if (status !== SpeakingStatus.PROCESSING) return false;
  const ref = processingAt ?? createdAt;
  return nowMs - ref.getTime() > SPEAKING_STUCK_MS;
}

export function extractContentStatus(result: unknown): string | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null;
  }
  const content = (result as { content?: unknown }).content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return null;
  }
  const status = (content as { status?: unknown }).status;
  return typeof status === 'string' ? status : null;
}
