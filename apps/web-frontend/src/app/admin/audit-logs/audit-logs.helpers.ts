import {
  parseEnumParam,
  parsePositiveIntParam,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';

export function formatAuditDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
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

export const RESOURCE_OPTIONS = [
  'UNITS',
  'LESSONS',
  'ASSESSMENT_ITEMS',
  'ASSESSMENT_GROUPS',
  'VOCABULARY_TOPIC',
  'VOCABULARY_WORD',
  'SPEAKING_PROMPTS',
  'GRAMMAR_TOPICS',
  'GRAMMAR_PREREQUISITES',
  'USERS',
  'IMPORTS',
  'EXPORTS',
  'MEDIA',
  'AUTH',
] as const;

export const PAGE_LIMITS = [10, 20, 50] as const;
export const DATE_PARAM_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const AUDIT_QUERY_DEFAULTS: Record<string, QueryParamValue> = {
  page: 1,
  limit: 20,
};

export function readInitialAuditFilters(): {
  page: number;
  limit: number;
  adminEmail: string;
  resourceType: string;
  action: string;
  from: string;
  to: string;
} {
  const sp =
    typeof window !== 'undefined' && typeof window.location?.search === 'string'
      ? new URLSearchParams(window.location.search)
      : null;
  const parsedLimit = parsePositiveIntParam(sp?.get('limit'), 20);
  const limit = (PAGE_LIMITS as readonly number[]).includes(parsedLimit)
    ? parsedLimit
    : 20;
  const rawFrom = sp?.get('from')?.trim() ?? '';
  const rawTo = sp?.get('to')?.trim() ?? '';
  return {
    page: parsePositiveIntParam(sp?.get('page'), 1),
    limit,
    adminEmail: sp?.get('adminEmail')?.trim() ?? '',
    resourceType: parseEnumParam(sp?.get('resourceType'), RESOURCE_OPTIONS),
    action: sp?.get('action')?.trim() ?? '',
    from: DATE_PARAM_REGEX.test(rawFrom) ? rawFrom : '',
    to: DATE_PARAM_REGEX.test(rawTo) ? rawTo : '',
  };
}

export function toLocalDayIso(
  dateStr: string,
  boundary: 'start' | 'end',
): string | undefined {
  if (!dateStr) return undefined;
  const parsed = new Date(
    `${dateStr}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}`,
  );
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
