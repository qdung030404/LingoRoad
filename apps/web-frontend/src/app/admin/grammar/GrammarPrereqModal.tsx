import React from 'react';
import { Trash2, X } from 'lucide-react';
import type { AdminGrammarTopic } from '@/types/admin';

interface GrammarPrereqModalProps {
  prereqTarget: AdminGrammarTopic | null;
  topics: AdminGrammarTopic[];
  leafTopics: AdminGrammarTopic[];
  selectedPrereqId: string;
  setSelectedPrereqId: (id: string) => void;
  prereqError: string | null;
  prereqSaving: boolean;
  onClose: () => void;
  onAdd: () => Promise<void>;
  onRemove: (prereqId: string) => Promise<void>;
}

export function GrammarPrereqModal({
  prereqTarget,
  topics,
  leafTopics,
  selectedPrereqId,
  setSelectedPrereqId,
  prereqError,
  prereqSaving,
  onClose,
  onAdd,
  onRemove,
}: GrammarPrereqModalProps): React.ReactElement | null {
  if (!prereqTarget) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slateDark-900">
              Quan hệ tiên quyết (DAG)
            </h2>
            <p className="text-xs text-slateDark-700">
              Đích: <strong>{prereqTarget.titleVi}</strong> (
              <code>{prereqTarget.code}</code>)
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

        {prereqError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {prereqError}
          </div>
        )}

        <div className="flex gap-2">
          <select
            value={selectedPrereqId}
            onChange={(e) => setSelectedPrereqId(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
          >
            <option value="">-- Chọn cấu trúc cần học trước --</option>
            {leafTopics
              .filter(
                (t) =>
                  t.id !== prereqTarget.id &&
                  !prereqTarget.prerequisiteIds.includes(t.id),
              )
              .map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.cefrLevel}] {t.titleVi} ({t.code})
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={!selectedPrereqId || prereqSaving}
            onClick={() => void onAdd()}
            className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Thêm cạnh
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slateDark-800">
            Đang yêu cầu hoàn thành trước ({prereqTarget.prerequisiteIds.length}
            ):
          </p>
          {prereqTarget.prerequisiteIds.length === 0 ? (
            <p className="rounded-xl bg-slateDark-25 px-3 py-4 text-center text-xs text-slateDark-600">
              Chủ điểm này chưa có điều kiện tiên quyết.
            </p>
          ) : (
            prereqTarget.prerequisiteIds.map((pid, idx) => {
              const codeLabel = prereqTarget.prerequisiteCodes[idx] ?? pid;
              const match = topics.find((t) => t.id === pid);
              return (
                <div
                  key={pid}
                  className="flex items-center justify-between rounded-xl border border-slateDark-100 bg-slateDark-25 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slateDark-900">
                      {match?.titleVi ?? codeLabel}
                    </p>
                    <p className="font-mono text-[11px] text-slateDark-600">
                      {codeLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={prereqSaving}
                    onClick={() => void onRemove(pid)}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
