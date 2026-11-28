import type {
  AdminAssessmentGroup,
  AdminAssessmentItem,
  CefrDescriptorItem,
  CefrLevel,
} from '@/types/admin';

export interface AssessmentItemModalProps {
  descriptors: CefrDescriptorItem[];
  groups?: AdminAssessmentGroup[];
  editingItem?: AdminAssessmentItem | null;
  cloneFrom?: AdminAssessmentItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export interface ExistingRubric {
  targetGrammars?: string[];
  wordCount?: { min?: number; max?: number };
  timeLimitSeconds?: number;
  minSpeakingSeconds?: number;
  maxSpeakingSeconds?: number;
  taskAchievement?: string;
  coherenceCohesion?: string;
  lexicalResource?: string;
  grammarAccuracy?: string;
}

export const LEVELS: readonly CefrLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
];

export function buildCloneExternalId(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';
  const suffix = '-copy';
  return `${trimmed.slice(0, Math.max(1, 100 - suffix.length))}${suffix}`;
}

export function extractMatchingPairs(
  raw: unknown,
): Array<{ left: string; right: string }> {
  if (Array.isArray(raw)) {
    const pairs = raw
      .filter((entry): entry is { left?: unknown; right?: unknown } =>
        Boolean(entry && typeof entry === 'object'),
      )
      .map((entry) => ({
        left: String(entry.left ?? ''),
        right: String(entry.right ?? ''),
      }));
    if (pairs.length >= 2) return pairs;
  }
  return [
    { left: '', right: '' },
    { left: '', right: '' },
    { left: '', right: '' },
  ];
}

export function extractReorderTokens(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((t) => (typeof t === 'string' ? t : String(t))).join(' | ');
  }
  return '';
}
