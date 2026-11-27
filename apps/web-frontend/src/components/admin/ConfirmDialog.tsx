'use client';

import React, { useEffect, useId } from 'react';
import { AlertTriangle, HelpCircle, Loader2, X } from 'lucide-react';

export type ConfirmDialogTone = 'danger' | 'warning' | 'primary';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const DEFAULT_CONFIRM_DIALOG_LABELS = {
  confirm: 'Xác nhận',
  cancel: 'Hủy',
  busy: 'Đang xử lý...',
  closeAria: 'Đóng hộp thoại',
} as const;

export interface ConfirmDialogToneConfig {
  iconBadgeClass: string;
  confirmButtonClass: string;
  iconType: 'alert' | 'help';
}

export function canDismissConfirmDialog(open: boolean, busy = false): boolean {
  return open && !busy;
}

export function getConfirmDialogToneConfig(
  tone: ConfirmDialogTone = 'primary',
): ConfirmDialogToneConfig {
  if (tone === 'danger') {
    return {
      iconBadgeClass: 'border-red-200 bg-red-50 text-red-600',
      confirmButtonClass:
        'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
      iconType: 'alert',
    };
  }
  if (tone === 'warning') {
    return {
      iconBadgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
      confirmButtonClass:
        'bg-amber-600 text-white hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
      iconType: 'alert',
    };
  }
  return {
    iconBadgeClass: 'border-brand-200 bg-brand-50 text-brand-700',
    confirmButtonClass:
      'btn-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
    iconType: 'help',
  };
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = DEFAULT_CONFIRM_DIALOG_LABELS.confirm,
  cancelLabel = DEFAULT_CONFIRM_DIALOG_LABELS.cancel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement | null {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && canDismissConfirmDialog(open, busy)) {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, busy, onCancel]);

  if (!open) {
    return null;
  }

  const toneConfig = getConfirmDialogToneConfig(tone);
  const Icon = toneConfig.iconType === 'alert' ? AlertTriangle : HelpCircle;

  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ): void => {
    if (
      event.target === event.currentTarget &&
      canDismissConfirmDialog(open, busy)
    ) {
      onCancel();
    }
  };

  const handleConfirmClick = (): void => {
    if (busy) return;
    void onConfirm();
  };

  return (
    <div
      role="presentation"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4 backdrop-blur-[1px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy || undefined}
        className="w-full max-w-md rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneConfig.iconBadgeClass}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2
                id={titleId}
                className="text-base font-bold leading-snug text-slateDark-900"
              >
                {title}
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (canDismissConfirmDialog(open, busy)) {
                    onCancel();
                  }
                }}
                aria-label={DEFAULT_CONFIRM_DIALOG_LABELS.closeAria}
                className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slateDark-600 transition hover:bg-slateDark-50 hover:text-slateDark-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              id={descriptionId}
              className="mt-2 text-sm leading-relaxed text-slateDark-800"
            >
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slateDark-100 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (canDismissConfirmDialog(open, busy)) {
                onCancel();
              }
            }}
            className="rounded-xl border border-slateDark-200 bg-white px-4 py-2 text-sm font-semibold text-slateDark-900 transition hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirmClick}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneConfig.confirmButtonClass}`}
          >
            {busy && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            <span>
              {busy ? DEFAULT_CONFIRM_DIALOG_LABELS.busy : confirmLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
