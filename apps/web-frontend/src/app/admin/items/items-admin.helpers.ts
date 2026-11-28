import {
  parseEnumParam,
  parsePositiveIntParam,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import type {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from '@/types/admin';

export interface SelectedGroupItem {
  id: string;
  externalId: string | null;
  skillCode: string;
  type: ItemType;
  prompt: string;
  fromOtherGroupLabel?: string | null;
  responsesCount?: number;
}

export const ITEM_TYPES: readonly ItemType[] = [
  'MULTIPLE_CHOICE',
  'CLOZE',
  'GAP_FILL',
  'SENTENCE_REORDER',
  'MATCHING',
  'ESSAY',
  'SPEAKING_PROMPT',
];

export const ASSESSMENT_SKILLS: readonly AssessmentSkill[] = [
  'READING',
  'LISTENING',
  'WRITING',
  'SPEAKING',
];

export const CEFR_LEVELS: readonly CefrLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
];

export const USAGE_SCOPES: readonly ItemUsageScope[] = [
  'ALL',
  'PLACEMENT',
  'MOCK_EXAM',
  'PRACTICE',
];

export const PAGE_LIMITS = [10, 20, 50] as const;

export const ITEMS_QUERY_DEFAULTS: Record<string, QueryParamValue> = {
  page: 1,
  limit: 10,
};

export function readInitialItemsFilters(): {
  page: number;
  limit: number;
  search: string;
  skill: AssessmentSkill | '';
  cefr: CefrLevel | '';
  type: ItemType | '';
  scope: ItemUsageScope | '';
  groupId: string;
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
    skill: parseEnumParam(sp?.get('skill'), ASSESSMENT_SKILLS),
    cefr: parseEnumParam(sp?.get('cefr'), CEFR_LEVELS),
    type: parseEnumParam(sp?.get('type'), ITEM_TYPES),
    scope: parseEnumParam(sp?.get('scope'), USAGE_SCOPES),
    groupId: sp?.get('groupId')?.trim() ?? '',
  };
}

export function formatShortType(type: ItemType): string {
  if (type === 'MULTIPLE_CHOICE') return 'mcq';
  if (type === 'SENTENCE_REORDER') return 'reorder';
  return type.toLowerCase();
}
