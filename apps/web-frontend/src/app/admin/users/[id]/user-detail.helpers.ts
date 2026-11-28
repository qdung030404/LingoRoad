import type { AdminUserDetail, CefrLevel, LearningKind } from '@/types/admin';

export type TabKey = 'profile' | 'skills' | 'sessions' | 'activity';

export const CEFR_LEVELS: readonly CefrLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
];

export const LEARNING_KINDS: ReadonlyArray<{
  key: LearningKind;
  label: string;
}> = [
  { key: 'GRAMMAR', label: 'Ngữ pháp (Grammar)' },
  { key: 'VOCABULARY', label: 'Từ vựng (Vocabulary)' },
  { key: 'READING', label: 'Đọc hiểu (Reading)' },
  { key: 'LISTENING', label: 'Nghe hiểu (Listening)' },
];

export const REMINDER_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface SkillDraftState {
  cefrLevel: CefrLevel;
  resetExposures: boolean;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function kindLabel(kind: LearningKind): string {
  return LEARNING_KINDS.find((item) => item.key === kind)?.label ?? kind;
}

export function buildInitialSkillDrafts(
  detail: AdminUserDetail,
): Record<LearningKind, SkillDraftState> {
  const map = new Map(detail.skillLevels.map((s) => [s.kind, s.cefrLevel]));
  return {
    GRAMMAR: { cefrLevel: map.get('GRAMMAR') ?? 'A1', resetExposures: false },
    VOCABULARY: {
      cefrLevel: map.get('VOCABULARY') ?? 'A1',
      resetExposures: false,
    },
    READING: { cefrLevel: map.get('READING') ?? 'A1', resetExposures: false },
    LISTENING: {
      cefrLevel: map.get('LISTENING') ?? 'A1',
      resetExposures: false,
    },
  };
}
