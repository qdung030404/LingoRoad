import {
  CefrLevel,
  ItemType,
  SessionStatus,
} from '@prisma/client';

export { CefrLevel, ItemType, SessionStatus };

// ─── Assessment Item ───────────────────────────────────────────────────────────

export interface AssessmentItem {
  id: string;
  skillCode: string;
  prompt: string;
  type: ItemType;
  options: string[];
  correctOption: string;
  explanation: string | null;
  cefrLevel: CefrLevel;
  /** IRT parameters for CAT */
  irtA: number; // discrimination
  irtB: number; // difficulty
  irtC: number; // guessing
  createdAt: Date;
}

/** Versão sem resposta correta — enviada ao cliente */
export interface AssessmentItemPublic {
  id: string;
  index: number;
  type: ItemType;
  prompt: string;
  options: string[];
  mediaUrl: string | null;
}


// ─── Placement Session ────────────────────────────────────────────────────────

export interface PlacementSession {
  id: string;
  userId: string;
  status: SessionStatus;
  currentItemIndex: number;
  totalItems: number;
  correctCount: number;
  estimatedCefr: CefrLevel | null;
  confidenceScore: number | null;
  startedAt: Date;
  completedAt: Date | null;
}

export type PlacementSessionWithResponses = PlacementSession & {
  responses: AssessmentResponse[];
};

// ─── Assessment Response ──────────────────────────────────────────────────────

export interface AssessmentResponse {
  id: string;
  sessionId: string;
  itemId: string;
  itemIndex: number;
  selectedOption: string;
  isCorrect: boolean;
  responseTimeMs: number | null;
  createdAt: Date;
}

// ─── Submit Answer DTO ────────────────────────────────────────────────────────
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  itemId!: string;

  @IsInt()
  @Min(0)
  itemIndex!: number;

  @IsString()
  @MaxLength(500)
  selectedOption!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  responseTimeMs?: number;
}

// ─── Use-case Result ──────────────────────────────────────────────────────────

export interface SubmitAnswerResult {
  isFinished: boolean;
  nextItem: AssessmentItemPublic | null;
  result: PlacementResult | null;
}

export interface PlacementResult {
  sessionId: string;
  estimatedCefr: CefrLevel;
  confidenceScore: number;
  correctCount: number;
  totalItems: number;
  completedAt: Date;
}

export interface StartPlacementResult {
  sessionId: string;
  totalItems: number;
  firstItem: AssessmentItemPublic;
}

export interface PlacementStatusResult {
  hasCompleted: boolean;
  currentSessionId: string | null;
  status: SessionStatus | null;
  currentIndex: number;
  totalItems: number;
}
