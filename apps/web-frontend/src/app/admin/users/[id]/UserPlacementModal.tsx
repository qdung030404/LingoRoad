import React from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import type { AdminPlacementSessionDetail } from '@/types/admin';

interface UserPlacementModalProps {
  sessionId: string | null;
  detail: AdminPlacementSessionDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export function UserPlacementModal({
  sessionId,
  detail,
  loading,
  error,
  onClose,
}: UserPlacementModalProps): React.ReactElement | null {
  if (!sessionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slateDark-900">
              Chi tiết phiên kiểm tra đầu vào (Placement)
            </h2>
            <p className="font-mono text-xs text-slateDark-600">
              Session ID: {sessionId}
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng chi tiết Placement"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
          {loading ? (
            <p className="py-10 text-center text-slateDark-700">
              Đang tải chi tiết câu trả lời Placement...
            </p>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-700">
              {error}
            </div>
          ) : detail ? (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slateDark-100 bg-slateDark-25 p-4 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] text-slateDark-600">Trạng thái</p>
                  <p className="mt-0.5 font-mono font-bold text-slateDark-900">
                    {detail.status}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slateDark-600">
                    CEFR ước lượng
                  </p>
                  <p className="mt-0.5 font-mono font-bold text-brand-800">
                    {detail.estimatedCefr ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slateDark-600">Số câu đúng</p>
                  <p className="mt-0.5 font-mono font-bold text-slateDark-900">
                    {detail.correctCount}/{detail.totalItems}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slateDark-600">
                    Phiên bản đề
                  </p>
                  <p className="mt-0.5 truncate font-mono font-semibold text-slateDark-900">
                    {detail.testVersion}
                  </p>
                </div>
              </div>

              {detail.responses.length === 0 ? (
                <p className="py-6 text-center text-slateDark-600">
                  Phiên này chưa có câu trả lời nào được ghi nhận.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {detail.responses.map((resp) => (
                    <div
                      key={resp.id}
                      className="rounded-xl border border-slateDark-100 bg-white p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-slateDark-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slateDark-900">
                            #{resp.itemIndex + 1}
                          </span>
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-800">
                            {resp.item.cefrLevel}
                          </span>
                          <span className="rounded-full bg-slateDark-50 px-2 py-0.5 font-mono text-[10px] text-slateDark-700">
                            {resp.item.skillCode}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {resp.responseTimeMs !== null && (
                            <span className="font-mono text-[10px] text-slateDark-600">
                              {(resp.responseTimeMs / 1000).toFixed(1)}s
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              resp.isCorrect
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {resp.isCorrect ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            <span>{resp.isCorrect ? 'Đúng' : 'Sai'}</span>
                          </span>
                        </div>
                      </div>

                      <p className="mt-2 text-xs font-medium text-slateDark-900">
                        {resp.item.prompt}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-4 text-[11px] text-slateDark-700">
                        <span>
                          Đã chọn:{' '}
                          <strong className="font-mono text-slateDark-900">
                            {resp.selectedOption}
                          </strong>
                        </span>
                        <span>
                          Đáp án đúng:{' '}
                          <strong className="font-mono text-emerald-700">
                            {resp.item.correctOption ?? '—'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
