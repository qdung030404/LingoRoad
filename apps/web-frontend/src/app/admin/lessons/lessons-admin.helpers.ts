import {
  parseEnumParam,
  parsePositiveIntParam,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import type { CefrLevel, LearningKind } from '@/types/admin';

export const LEARNING_KINDS: readonly LearningKind[] = [
  'GRAMMAR',
  'VOCABULARY',
  'READING',
  'LISTENING',
];
export const CEFR_LEVELS: readonly CefrLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
];
export const PUBLISHED_OPTIONS = ['true', 'false'] as const;
export const PAGE_LIMITS = [10, 20, 50] as const;
export const MAX_BULK_SELECTION = 100;
export const LESSONS_QUERY_DEFAULTS: Record<string, QueryParamValue> = {
  page: 1,
  limit: 10,
};

export function readInitialLessonsFilters(): {
  page: number;
  limit: number;
  search: string;
  published: '' | 'true' | 'false';
  kind: LearningKind | '';
  cefr: CefrLevel | '';
} {
  const sp =
    typeof window !== 'undefined' && typeof window.location?.search === 'string'
      ? new URLSearchParams(window.location.search)
      : null;
  const parsedLimit = parsePositiveIntParam(sp?.get('limit'), 10);
  const limit = (PAGE_LIMITS as readonly number[]).includes(parsedLimit)
    ? parsedLimit
    : 10;
  return {
    page: parsePositiveIntParam(sp?.get('page'), 1),
    limit,
    search: sp?.get('search')?.trim() ?? '',
    published: parseEnumParam(sp?.get('published'), PUBLISHED_OPTIONS),
    kind: parseEnumParam(sp?.get('kind'), LEARNING_KINDS),
    cefr: parseEnumParam(sp?.get('cefr'), CEFR_LEVELS),
  };
}
