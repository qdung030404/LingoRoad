'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type AdminToastTone = 'success' | 'error' | 'info';

export interface AdminToastItem {
  id: string;
  tone: AdminToastTone;
  message: string;
}

export interface AdminToastApi {
  success: (message: string) => string;
  error: (message: string) => string;
  info: (message: string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const ADMIN_TOAST_AUTO_DISMISS_MS = 4000;
export const MAX_VISIBLE_TOASTS = 5;

export const NOOP_ADMIN_TOAST: AdminToastApi = Object.freeze({
  success: () => '',
  error: () => '',
  info: () => '',
  dismiss: () => undefined,
  clear: () => undefined,
});

export function getToastAutoDismissMs(tone: AdminToastTone): number | null {
  return tone === 'error' ? null : ADMIN_TOAST_AUTO_DISMISS_MS;
}

export function appendToastItem(
  current: readonly AdminToastItem[],
  next: AdminToastItem,
  maxVisible = MAX_VISIBLE_TOASTS,
): { items: AdminToastItem[]; evictedIds: string[] } {
  const combined = [...current, next];
  const limit = Math.max(1, maxVisible);
  if (combined.length <= limit) {
    return { items: combined, evictedIds: [] };
  }
  const overflow = combined.length - limit;
  const evictedIds = combined.slice(0, overflow).map((item) => item.id);
  return {
    items: combined.slice(overflow),
    evictedIds,
  };
}

export function removeToastItem(
  current: readonly AdminToastItem[],
  id: string,
): AdminToastItem[] {
  return current.filter((item) => item.id !== id);
}

const AdminToastContext = createContext<AdminToastApi>(NOOP_ADMIN_TOAST);

export function useAdminToast(): AdminToastApi {
  return useContext(AdminToastContext) ?? NOOP_ADMIN_TOAST;
}

interface ToastVisualConfig {
  containerClass: string;
  iconClass: string;
  closeButtonClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const TOAST_VISUALS: Record<AdminToastTone, ToastVisualConfig> = {
  success: {
    containerClass:
      'border-brand-200 bg-brand-25 text-brand-900 shadow-lg shadow-slateDark-900/5',
    iconClass: 'text-brand-600',
    closeButtonClass: 'text-brand-800 hover:bg-brand-100',
    Icon: CheckCircle2,
  },
  error: {
    containerClass:
      'border-red-200 bg-red-50 text-red-900 shadow-lg shadow-slateDark-900/5',
    iconClass: 'text-red-600',
    closeButtonClass: 'text-red-700 hover:bg-red-100',
    Icon: AlertCircle,
  },
  info: {
    containerClass:
      'border-slateDark-200 bg-white text-slateDark-900 shadow-lg shadow-slateDark-900/5',
    iconClass: 'text-brand-600',
    closeButtonClass: 'text-slateDark-700 hover:bg-slateDark-50',
    Icon: Info,
  },
};

export interface AdminToastProviderProps {
  children: React.ReactNode;
}

export function AdminToastProvider({
  children,
}: AdminToastProviderProps): React.ReactElement {
  const [items, setItems] = useState<AdminToastItem[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const clearTimer = useCallback((id: string): void => {
    const existing = timersRef.current[id];
    if (existing !== undefined) {
      clearTimeout(existing);
      delete timersRef.current[id];
    }
  }, []);

  const dismiss = useCallback(
    (id: string): void => {
      clearTimer(id);
      setItems((prev) => removeToastItem(prev, id));
    },
    [clearTimer],
  );

  const clear = useCallback((): void => {
    Object.keys(timersRef.current).forEach((id) => {
      clearTimeout(timersRef.current[id]);
    });
    timersRef.current = {};
    setItems([]);
  }, []);

  const push = useCallback(
    (tone: AdminToastTone, rawMessage: string): string => {
      const message = rawMessage.trim();
      if (!message) return '';

      counterRef.current += 1;
      const id = `admin-toast-${counterRef.current}`;
      const nextItem: AdminToastItem = { id, tone, message };

      setItems((prev) => {
        const { items: nextItems, evictedIds } = appendToastItem(prev, nextItem);
        evictedIds.forEach((evictedId) => {
          clearTimer(evictedId);
        });
        return nextItems;
      });

      const autoDismissMs = getToastAutoDismissMs(tone);
      if (autoDismissMs !== null) {
        timersRef.current[id] = setTimeout(() => {
          dismiss(id);
        }, autoDismissMs);
      }

      return id;
    },
    [clearTimer, dismiss],
  );

  useEffect(() => {
    return () => {
      Object.keys(timersRef.current).forEach((id) => {
        clearTimeout(timersRef.current[id]);
      });
      timersRef.current = {};
    };
  }, []);

  const api = useMemo<AdminToastApi>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      info: (message: string) => push('info', message),
      dismiss,
      clear,
    }),
    [clear, dismiss, push],
  );

  return (
    <AdminToastContext.Provider value={api}>
      {children}
      {items.length > 0 && (
        <div
          aria-live="polite"
          aria-atomic="false"
          aria-label="Thông báo quản trị"
          className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5"
        >
          {items.map((item) => {
            const visual = TOAST_VISUALS[item.tone];
            const Icon = visual.Icon;
            return (
              <div
                key={item.id}
                role="status"
                aria-live="polite"
                className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium ${visual.containerClass}`}
              >
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${visual.iconClass}`}
                />
                <p className="min-w-0 flex-1 break-words leading-snug">
                  {item.message}
                </p>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Đóng thông báo"
                  className={`-mr-1 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition ${visual.closeButtonClass}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AdminToastContext.Provider>
  );
}
