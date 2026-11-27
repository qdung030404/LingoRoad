'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from 'next/navigation';

export type QueryParamValue = string | number | boolean | null | undefined;

export interface ParsePositiveIntOptions {
  min?: number;
  max?: number;
}

export interface SyncQueryParamsOptions {
  defaults?: Record<string, QueryParamValue>;
}

export function parsePositiveIntParam(
  value: string | null | undefined,
  fallback: number,
  options?: ParsePositiveIntOptions,
): number {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;

  const minBound =
    options?.min !== undefined && Number.isFinite(options.min)
      ? Math.max(1, Math.floor(options.min))
      : 1;
  const maxBound =
    options?.max !== undefined && Number.isFinite(options.max)
      ? Math.max(minBound, Math.floor(options.max))
      : undefined;

  let clamped = Math.max(minBound, parsed);
  if (maxBound !== undefined) {
    clamped = Math.min(maxBound, clamped);
  }
  return clamped;
}

export function parseEnumParam<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T | '' = '',
): T | '' {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return (allowed as readonly string[]).includes(trimmed)
    ? (trimmed as T)
    : fallback;
}

function serializeQueryParamValue(raw: QueryParamValue): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && !Number.isFinite(raw)) return null;
  const normalized = typeof raw === 'string' ? raw.trim() : String(raw);
  return normalized.length > 0 ? normalized : null;
}

export function buildQueryString(
  params: Record<string, QueryParamValue>,
  defaults?: Record<string, QueryParamValue>,
): string {
  const searchParams = new URLSearchParams();
  const sortedKeys = Object.keys(params).sort();

  for (let i = 0; i < sortedKeys.length; i += 1) {
    const key = sortedKeys[i];
    const value = serializeQueryParamValue(params[key]);
    if (value === null) continue;

    if (defaults && Object.prototype.hasOwnProperty.call(defaults, key)) {
      const defaultValue = serializeQueryParamValue(defaults[key]);
      if (defaultValue !== null && value === defaultValue) {
        continue;
      }
    }

    searchParams.set(key, value);
  }

  return searchParams.toString();
}

export function normalizeQueryString(rawQuery: string): string {
  const stripped = rawQuery.trim().replace(/^\?/, '');
  if (!stripped) return '';

  const parsed = new URLSearchParams(stripped);
  const entries: Array<[string, string]> = [];
  parsed.forEach((value, key) => {
    const trimmed = value.trim();
    if (trimmed) {
      entries.push([key, trimmed]);
    }
  });

  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const canonical = new URLSearchParams();
  for (let i = 0; i < entries.length; i += 1) {
    canonical.set(entries[i][0], entries[i][1]);
  }
  return canonical.toString();
}

export function buildQueryUrl(pathname: string, queryString: string): string {
  const cleanQuery = queryString.replace(/^\?/, '');
  return cleanQuery ? `${pathname}?${cleanQuery}` : pathname;
}

function isThenable(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function useSafeSearchParams(): ReadonlyURLSearchParams | null {
  try {
    return useSearchParams() ?? null;
  } catch (err) {
    if (isThenable(err)) {
      throw err;
    }
    return null;
  }
}

function useSafePathname(): string {
  try {
    return usePathname() ?? '';
  } catch (err) {
    if (isThenable(err)) {
      throw err;
    }
    return '';
  }
}

function useSafeRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter() ?? null;
  } catch (err) {
    if (isThenable(err)) {
      throw err;
    }
    return null;
  }
}

export interface UseAdminQueryParamsResult {
  searchParams: ReadonlyURLSearchParams | null;
  getParam: (key: string, fallback?: string) => string;
  getPositiveIntParam: (
    key: string,
    fallback: number,
    options?: ParsePositiveIntOptions,
  ) => number;
  getEnumParam: <T extends string>(
    key: string,
    allowed: readonly T[],
    fallback?: T | '',
  ) => T | '';
  syncQueryString: (nextQuery: string) => void;
  syncParams: (
    params: Record<string, QueryParamValue>,
    options?: SyncQueryParamsOptions,
  ) => void;
  clearParams: () => void;
}

export function useAdminQueryParams(): UseAdminQueryParamsResult {
  const router = useSafeRouter();
  const pathname = useSafePathname();
  const searchParams = useSafeSearchParams();

  const initialQuery = normalizeQueryString(searchParams?.toString() ?? '');
  const lastSyncedQueryRef = useRef<string>(initialQuery);

  const getParam = useCallback(
    (key: string, fallback = ''): string => {
      const raw = searchParams?.get(key);
      if (raw === null || raw === undefined) return fallback;
      const trimmed = raw.trim();
      return trimmed.length > 0 ? trimmed : fallback;
    },
    [searchParams],
  );

  const getPositiveIntParam = useCallback(
    (
      key: string,
      fallback: number,
      options?: ParsePositiveIntOptions,
    ): number => {
      return parsePositiveIntParam(searchParams?.get(key), fallback, options);
    },
    [searchParams],
  );

  const getEnumParam = useCallback(
    <T extends string>(
      key: string,
      allowed: readonly T[],
      fallback: T | '' = '',
    ): T | '' => {
      return parseEnumParam(searchParams?.get(key), allowed, fallback);
    },
    [searchParams],
  );

  const syncQueryString = useCallback(
    (rawNextQuery: string): void => {
      if (!router || !pathname) return;
      const nextQuery = rawNextQuery.replace(/^\?/, '');
      if (nextQuery === lastSyncedQueryRef.current) {
        return;
      }

      const currentBrowserQuery =
        typeof window !== 'undefined'
          ? normalizeQueryString(window.location.search)
          : lastSyncedQueryRef.current;

      lastSyncedQueryRef.current = nextQuery;
      if (nextQuery === currentBrowserQuery) {
        return;
      }

      router.replace(buildQueryUrl(pathname, nextQuery), { scroll: false });
    },
    [pathname, router],
  );

  const syncParams = useCallback(
    (
      params: Record<string, QueryParamValue>,
      options?: SyncQueryParamsOptions,
    ): void => {
      syncQueryString(buildQueryString(params, options?.defaults));
    },
    [syncQueryString],
  );

  const clearParams = useCallback((): void => {
    syncQueryString('');
  }, [syncQueryString]);

  return {
    searchParams,
    getParam,
    getPositiveIntParam,
    getEnumParam,
    syncQueryString,
    syncParams,
    clearParams,
  };
}

export function useSyncAdminQueryParams(
  params: Record<string, QueryParamValue>,
  defaults?: Record<string, QueryParamValue>,
): void {
  const { syncQueryString } = useAdminQueryParams();
  const nextQuery = buildQueryString(params, defaults);

  useEffect(() => {
    syncQueryString(nextQuery);
  }, [nextQuery, syncQueryString]);
}
