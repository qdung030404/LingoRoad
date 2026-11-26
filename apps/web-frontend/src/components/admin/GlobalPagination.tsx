'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { computePaginationRange } from '@/lib/admin-validation';

interface GlobalPaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  onLimitChange?: (nextLimit: number) => void;
}

export function GlobalPagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
}: GlobalPaginationProps): React.ReactElement {
  const safeTotalPages = Math.max(totalPages, total > 0 ? 1 : 0);
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);
  const tokens = computePaginationRange(page, safeTotalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-slateDark-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slateDark-700">
        {onLimitChange && (
          <label className="inline-flex items-center gap-2">
            <span>Mỗi trang:</span>
            <select
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slateDark-900 focus:border-brand-500 focus:outline-none"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
        <span>
          Hiển thị{' '}
          <strong className="font-semibold text-slateDark-900">
            {startItem}–{endItem}
          </strong>{' '}
          / {total}
        </span>
      </div>

      {safeTotalPages > 0 && (
        <nav
          aria-label="Phân trang danh sách"
          className="flex items-center gap-1.5"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            aria-label="Trang đầu"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slateDark-200 bg-white text-slateDark-800 transition hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Trang trước"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slateDark-200 bg-white text-slateDark-800 transition hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {tokens.map((token, idx) =>
            token === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="inline-flex h-8 min-w-[28px] items-center justify-center text-xs text-slateDark-600"
              >
                ...
              </span>
            ) : (
              <button
                key={token}
                type="button"
                onClick={() => onPageChange(token)}
                aria-current={token === page ? 'page' : undefined}
                className={
                  token === page
                    ? 'btn-primary inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2.5 text-xs font-semibold'
                    : 'inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg border border-slateDark-200 bg-white px-2.5 text-xs font-medium text-slateDark-800 transition hover:bg-slateDark-50'
                }
              >
                {token}
              </button>
            ),
          )}

          <button
            type="button"
            disabled={page >= safeTotalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Trang tiếp theo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slateDark-200 bg-white text-slateDark-800 transition hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={page >= safeTotalPages}
            onClick={() => onPageChange(safeTotalPages)}
            aria-label="Trang cuối"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slateDark-200 bg-white text-slateDark-800 transition hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
}
