export interface CatHistoryEntry {
  a: number;
  b: number;
  c: number;
  correct: boolean;
}

export interface CatCandidate {
  item_id: string;
  a: number;
  b: number;
  c: number;
}

export interface CatSelectRequest {
  history: CatHistoryEntry[];
  candidates: CatCandidate[];
}

export interface CatSelectResponse {
  theta: number;
  se: number;
  next_item_id: string | null;
}

export interface SpeechScoreResponse {
  transcript: string;
  accuracy: number;
  completeness: number;
  fluency: number;
  total: number;
  duration_seconds: number;
  model_version: string;
  feedback_vi: string;
}

export interface AdvisorPathEntry {
  code: string;
  name: string;
  mastery: number;
  reason: string;
}

export interface AdvisorRequest {
  question: string;
  path: AdvisorPathEntry[];
  locale?: string;
}

export interface AdvisorResponse {
  answer: string;
}

export interface ExerciseItem {
  stem: string;
  options: string[];
  correct_answer: string;
  explanation_vi: string;
}

export interface ExerciseResponse {
  exercises: ExerciseItem[];
  model_version: string;
}

export interface AweCriteriaScores {
  task_achievement: number;
  coherence_cohesion: number;
  lexical_resource: number;
  grammatical_accuracy: number;
}

export interface AweFeedbackItem {
  sentence: string;
  issue: string;
  suggestion: string;
}

export interface AweResponse {
  scores: AweCriteriaScores;
  feedback: AweFeedbackItem[];
  overall_vi: string;
}

export interface KtEvent {
  q_idx: number;
  part: number;
  correct: number;
  elapsed: number;
  lag: number;
}

export interface KtPredictRequest {
  sequence: KtEvent[];
}

export interface KtPredictResponse {
  p_next: number[];
}
