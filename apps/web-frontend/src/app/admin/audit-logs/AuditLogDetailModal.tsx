import React from 'react';
import { X } from 'lucide-react';
import type { AdminAuditLog } from '@/types/admin';
import { formatAuditDateTime } from './audit-logs.helpers';

interface AuditLogDetailModalProps {
  log: AdminAuditLog | null;
  onClose: () => void;
}

export function AuditLogDetailModal({
  log,
  onClose,
}: AuditLogDetailModalProps): React.ReactElement | null {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slateDark-900">
              {log.action}
            </h2>
            <p className="font-mono text-xs text-slateDark-700">
              {log.method} {log.path} · HTTP {log.statusCode}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-6 text-xs">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slateDark-25 p-3">
            <div>
              <span className="text-slateDark-600">Quản trị viên:</span>{' '}
              <strong>{log.adminEmail}</strong>
            </div>
            <div>
              <span className="text-slateDark-600">Thời gian:</span>{' '}
              <strong>{formatAuditDateTime(log.createdAt)}</strong>
            </div>
            <div>
              <span className="text-slateDark-600">Tài nguyên:</span>{' '}
              <strong>{log.resourceType}</strong>
            </div>
            <div>
              <span className="text-slateDark-600">ID:</span>{' '}
              <code className="font-mono">{log.resourceId ?? '—'}</code>
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-bold text-slateDark-800">
              Payload Snapshot (đã ẩn trường nhạy cảm):
            </p>
            <pre className="max-h-96 overflow-auto rounded-xl bg-[#141A23] p-4 font-mono text-[11px] leading-relaxed text-emerald-100">
              {JSON.stringify(log.payloadSnapshot ?? null, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
