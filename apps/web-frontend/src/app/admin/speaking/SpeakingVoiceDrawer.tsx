'use client';

import React from 'react';
import { AlertTriangle, AudioLines, CheckCircle2, Lock, MessageSquare, RefreshCw, RotateCcw, Unlock, X } from 'lucide-react';
import {
  formatDateTime,
  formatScore,
  parseVoiceAssessment,
  voiceAssessmentBadgeClass,
  voiceSessionBadgeClass,
} from './speaking-admin.helpers';
import type { SpeakingAdminState } from './useSpeakingAdminState';

export function SpeakingVoiceDrawer({
  state,
}: {
  state: SpeakingAdminState;
}): React.ReactElement | null {
  const {
    selectedVoiceId,
    setSelectedVoiceId,
    voiceDetail,
    setVoiceDetail,
    voiceDetailLoading,
    voiceDetailError,
    openVoiceDrawer,
    setReleaseLockTarget,
    retryingVoiceContent,
    handleRetryVoiceContent,
    canRetryVoiceContent,
    sortedVoiceTurns,
    parsedVoiceAssessment,
  } = state;
  return (
    <>
  <div
    role="presentation"
    onClick={(e) => {
      if (e.target === e.currentTarget) {
        setSelectedVoiceId(null);
        setVoiceDetail(null);
      }
    }}
    className="fixed inset-0 z-50 flex justify-end bg-slateDark-900/50 backdrop-blur-[1px]"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết hội thoại Voice AI"
      className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slateDark-100 px-6 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-slateDark-900">
              {voiceDetail?.topicTitle ?? 'Chi tiết hội thoại Voice AI'}
            </h2>
            {voiceDetail && (
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${voiceSessionBadgeClass(voiceDetail.status)}`}
              >
                {voiceDetail.status}
              </span>
            )}
            {voiceDetail && (
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${voiceAssessmentBadgeClass(voiceDetail.assessmentStatus)}`}
              >
                {voiceDetail.assessmentStatus}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-slateDark-600">
            ID: {selectedVoiceId}
          </p>
        </div>
        <button
          type="button"
          aria-label="Đóng chi tiết hội thoại"
          onClick={() => {
            setSelectedVoiceId(null);
            setVoiceDetail(null);
          }}
          className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-6 text-xs">
        {voiceDetailLoading ? (
          <div className="py-16 text-center text-slateDark-700">
            Đang tải chi tiết phiên hội thoại Voice AI...
          </div>
        ) : voiceDetailError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {voiceDetailError}
          </div>
        ) : voiceDetail ? (
          <>
            {/* Thanh hành động Voice Ops */}
            {(voiceDetail.hasActiveLock || canRetryVoiceContent) && (
              <div className="flex flex-wrap items-center gap-2">
                {voiceDetail.hasActiveLock && (
                  <button
                    type="button"
                    onClick={() => setReleaseLockTarget(voiceDetail)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Giải phóng khóa</span>
                  </button>
                )}
                {canRetryVoiceContent && (
                  <button
                    type="button"
                    disabled={retryingVoiceContent}
                    onClick={() => void handleRetryVoiceContent()}
                    className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${retryingVoiceContent ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {retryingVoiceContent
                        ? 'Đang chấm lại...'
                        : 'Chấm lại nội dung'}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-slateDark-100 bg-slateDark-25 p-4 sm:grid-cols-2">
              <div>
                <span className="text-[11px] text-slateDark-600">
                  Học viên
                </span>
                <p className="font-semibold text-slateDark-900">
                  {voiceDetail.user.name} ({voiceDetail.user.email})
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slateDark-600">
                  Khóa phiên (activeLock) / Lý do kết thúc
                </span>
                <p className="font-mono font-semibold text-slateDark-900">
                  {voiceDetail.hasActiveLock
                    ? 'ĐANG KHÓA'
                    : 'Đã giải phóng'}
                  {voiceDetail.endReason
                    ? ` · ${voiceDetail.endReason}`
                    : ''}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slateDark-600">
                  Số lượt / Lịch sử
                </span>
                <p className="font-semibold text-slateDark-900">
                  {voiceDetail.turnsCount} lượt ·{' '}
                  {voiceDetail.historyStatus}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slateDark-600">
                  Bắt đầu / Kết thúc
                </span>
                <p className="text-slateDark-800">
                  {formatDateTime(voiceDetail.startedAt)} ·{' '}
                  {formatDateTime(voiceDetail.endedAt)}
                </p>
              </div>
            </div>

            {/* Ordered Conversation Turns */}
            <section className="space-y-2.5 rounded-xl border border-slateDark-100 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                Lịch sử hội thoại ({sortedVoiceTurns.length} lượt)
              </h3>
              {sortedVoiceTurns.length === 0 ? (
                <p className="rounded-lg bg-slateDark-25 p-4 text-center text-slateDark-600">
                  Chưa ghi nhận lượt hội thoại nào.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {sortedVoiceTurns.map((turn) => {
                    const isUser =
                      turn.role.toUpperCase() === 'USER';
                    return (
                      <div
                        key={turn.id}
                        className={`rounded-xl border p-3 ${
                          isUser
                            ? 'ml-6 border-brand-200 bg-brand-25/60'
                            : 'mr-6 border-slateDark-100 bg-slateDark-25'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slateDark-700">
                              #{turn.sequence}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isUser
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-slateDark-800 text-white'
                              }`}
                            >
                              {turn.role}
                            </span>
                            {turn.interrupted && (
                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                Bị ngắt (interrupted)
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-slateDark-600">
                            {formatDateTime(turn.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-slateDark-900">
                          {turn.transcript || '(Trống)'}
                        </p>
                        {turn.translationVi && (
                          <p className="mt-1 text-[11px] italic text-slateDark-700">
                            Dịch VI: {turn.translationVi}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Assessment JSON Summary */}
            <section className="space-y-3 rounded-xl border border-slateDark-100 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                Tóm tắt chấm điểm (assessment JSON)
              </h3>

              {parsedVoiceAssessment ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {parsedVoiceAssessment.pronunciation && (
                    <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                      <p className="text-[11px] font-bold text-slateDark-700">
                        Phát âm (
                        {parsedVoiceAssessment.pronunciationScope ??
                          'auto'}
                        )
                      </p>
                      <p className="mt-1 font-mono text-xs text-slateDark-900">
                        Overall:{' '}
                        <strong>
                          {formatScore(
                            parsedVoiceAssessment.pronunciation
                              .overall,
                          )}
                        </strong>{' '}
                        · Acc:{' '}
                        {formatScore(
                          parsedVoiceAssessment.pronunciation
                            .accuracy,
                        )}{' '}
                        · Flu:{' '}
                        {formatScore(
                          parsedVoiceAssessment.pronunciation.fluency,
                        )}{' '}
                        · Pro:{' '}
                        {formatScore(
                          parsedVoiceAssessment.pronunciation.prosody,
                        )}
                      </p>
                    </div>
                  )}
                  {parsedVoiceAssessment.content && (
                    <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                      <p className="text-[11px] font-bold text-slateDark-700">
                        Nội dung (
                        {parsedVoiceAssessment.content.status ??
                          'unknown'}
                        )
                      </p>
                      <p className="mt-1 font-mono text-xs text-slateDark-900">
                        Overall:{' '}
                        <strong>
                          {formatScore(
                            parsedVoiceAssessment.content.overall,
                          )}
                        </strong>{' '}
                        · Vocab:{' '}
                        {formatScore(
                          parsedVoiceAssessment.content.vocabulary,
                        )}{' '}
                        · Gram:{' '}
                        {formatScore(
                          parsedVoiceAssessment.content.grammar,
                        )}{' '}
                        · Topic:{' '}
                        {formatScore(
                          parsedVoiceAssessment.content.topic,
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {voiceDetail.assessment ? (
                <pre className="max-h-72 overflow-auto rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5 font-mono text-[11px] text-slateDark-800">
                  {JSON.stringify(voiceDetail.assessment, null, 2)}
                </pre>
              ) : (
                <p className="rounded-xl bg-slateDark-25 p-3 text-slateDark-600">
                  Chưa có dữ liệu chấm điểm (assessment === null).
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  </div>
    </>
  );
}
