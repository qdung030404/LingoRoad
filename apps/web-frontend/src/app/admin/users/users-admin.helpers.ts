import {
  parseEnumParam,
  parsePositiveIntParam,
  type QueryParamValue,
} from '@/lib/use-admin-query-params';
import type { UserRole, UserStatus } from '@/types/admin';

export const USER_ROLES: readonly UserRole[] = ['LEARNER', 'ADMIN'];
export const USER_STATUSES: readonly UserStatus[] = [
  'ACTIVE',
  'SUSPENDED',
  'DELETED',
];
export const PAGE_LIMITS = [10, 20, 50] as const;
export const USER_QUERY_DEFAULTS: Record<string, QueryParamValue> = {
  page: 1,
  limit: 10,
};

export function readInitialUserFilters(): {
  page: number;
  limit: number;
  search: string;
  role: UserRole | '';
  status: UserStatus | '';
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
    role: parseEnumParam(sp?.get('role'), USER_ROLES),
    status: parseEnumParam(sp?.get('status'), USER_STATUSES),
  };
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function getAvatarLetters(name: string, email: string): string {
  const clean = name.trim();
  if (clean) {
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (email[0] ?? 'U').toUpperCase();
}
