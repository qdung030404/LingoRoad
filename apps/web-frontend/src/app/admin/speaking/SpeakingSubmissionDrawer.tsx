'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileAudio, Image as ImageIcon, Info, RefreshCw, RotateCcw, X, XCircle } from 'lucide-react';
import { resolveAdminMediaUrl } from '@/lib/admin-api';
import { SubmissionContentFeedbackCard } from './SubmissionContentFeedbackCard';
import {
  formatDateTime,
  formatScore,
  parsePromptSnapshot,
  parseSpeakingSubmissionResult,
  submissionStatusBadgeClass,
} from './speaking-admin.helpers';
import type { SpeakingAdminState } from './useSpeakingAdminState';

export function SpeakingSubmissionDrawer({
  state,
}: {
  state: SpeakingAdminState;
}): React.ReactElement | null {
  const {
    selectedSubId,
    setSelectedSubId,
    subDetail,
    setSubDetail,
    subDetailLoading,
    subDetailError,
    openSubmissionDrawer,
    retryingSubContent,
    handleRetrySubmissionContent,
    setExpireSubTarget,
    parsedSubSnapshot,
    parsedSubResult,
  } = state;
  return (
    <>
  <div
    role="presentation"
    onClick={(e) => {
      if (e.target === e.currentTarget) {
        setSelectedSubId(null);
        setSubDetail(null);
      }
    }}
    className="fixed inset-0 z-50 flex justify-end bg-slateDark-900/50 backdrop-blur-[1px]"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết bài nộp Speaking"
      className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slateDark-100 px-6 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-slateDark-900">
              {subDetail?.promptTitle ?? 'Chi tiết bài nộp Speaking'}
            </h2>
            {subDetail && (
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${submissionStatusBadgeClass(subDetail.status)}`}
              >
                {subDetail.status}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-slateDark-600">
            ID: {selectedSubId}
          </p>
        </div>
        <button
          type="button"
          aria-label="Đóng chi tiết bài nộp"
          onClick={() => {
            setSelectedSubId(null);
            setSubDetail(null);
          }}
          className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-6 text-xs">
        {subDetailLoading ? (
          <div className="py-16 text-center text-slateDark-700">
            Đang tải chi tiết bài nộp Speaking...
          </div>
        ) : subDetailError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {subDetailError}
          </div>
        ) : subDetail ? (
          <>
            {/* Lưu ý kỹ thuật không lưu raw audio */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="leading-relaxed">
                <strong>Lưu ý vận hành:</strong> Hệ thống không lưu
                trữ bản thu âm gốc (raw audio). Do đó các bài lỗi ở
                bước chấm giọng nói Azure Speech (
                <code className="font-mono">result === null</code>)
                không thể chấm lại từ phía máy chủ — học viên cần thu
                âm và nộp lại. Chỉ có thể{' '}
                <strong>chấm lại nội dung</strong> đối với bài{' '}
                <code className="font-mono">TOPIC</code> /{' '}
                <code className="font-mono">PICTURE_DESCRIPTION</code>{' '}
                đã có lời thoại (transcript) hợp lệ.
              </p>
            </div>

            {/* Thanh hành động xử lý sự cố */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={
                  !subDetail.canRetryContent || retryingSubContent
                }
                title={
                  subDetail.canRetryContent
                    ? 'Chạy lại bước chấm nội dung AI dựa trên transcript đã lưu'
                    : 'Chỉ khả dụng với bài TOPIC / PICTURE_DESCRIPTION đã có transcript và không đang PROCESSING'
                }
                onClick={() => void handleRetrySubmissionContent()}
                className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${retryingSubContent ? 'animate-spin' : ''}`}
                />
                <span>
                  {retryingSubContent
                    ? 'Đang chấm lại...'
                    : 'Chấm lại nội dung'}
                </span>
              </button>

              {subDetail.isStuckProcessing && (
                <button
                  type="button"
                  onClick={() => setExpireSubTarget(subDetail)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Đóng job kẹt</span>
                </button>
              )}
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-slateDark-100 bg-slateDark-25 p-4 sm:grid-cols-2">
              <div>
                <span className="text-[11px] text-slateDark-600">
                  Học viên
                </span>
                <p className="font-semibold text-slateDark-900">
                  {subDetail.user.name} ({subDetail.user.email})
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slateDark-600">
                  Chế độ / Mã đề
                </span>
                <p className="font-mono font-semibold text-slateDark-900">
                  {subDetail.mode}
                  {subDetail.promptCode
                    ? ` · ${subDetail.promptCode}`
                    : ''}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slateDark-600">
                  Mã lỗi (errorCode)
                </span>
                <p
                  className={`font-mono font-semibold ${subDetail.errorCode ? 'text-red-700' : 'text-slateDark-700'}`}
                >
                  {subDetail.errorCode ?? '—'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slateDark-600">
                  Adapter Version
                </span>
                <p className="font-mono font-semibold text-slateDark-900">
                  {subDetail.adapterVersion ?? '—'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[11px] text-slateDark-600">
                  Audio Hash (SHA-256)
                </span>
                <p className="break-all font-mono text-[11px] text-slateDark-800">
                  {subDetail.audioHash ?? '—'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slateDark-600">
                  Tạo lúc / Xử lý lúc
                </span>
                <p className="text-slateDark-800">
                  {formatDateTime(subDetail.createdAt)} ·{' '}
                  {formatDateTime(subDetail.processingAt)}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slateDark-600">
                  Hoàn tất lúc
                </span>
                <p className="text-slateDark-800">
                  {formatDateTime(subDetail.completedAt)}
                </p>
              </div>
            </div>

            {/* Prompt Snapshot */}
            <section className="space-y-2 rounded-xl border border-slateDark-100 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                Ngữ cảnh đề bài (promptSnapshot)
              </h3>
              {parsedSubSnapshot ? (
                <div className="space-y-2">
                  {parsedSubSnapshot.text && (
                    <p className="rounded-lg bg-slateDark-25 p-3 text-sm text-slateDark-900">
                      {parsedSubSnapshot.text}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-[11px] text-slateDark-700">
                    {parsedSubSnapshot.difficulty !== null && (
                      <span className="rounded bg-slateDark-50 px-2 py-0.5 font-semibold">
                        Lv.{parsedSubSnapshot.difficulty}
                      </span>
                    )}
                    {parsedSubSnapshot.maxDurationSeconds !== null && (
                      <span className="rounded bg-slateDark-50 px-2 py-0.5 font-semibold">
                        Tối đa {parsedSubSnapshot.maxDurationSeconds}s
                      </span>
                    )}
                    {parsedSubSnapshot.assessmentProfile && (
                      <span className="rounded bg-brand-50 px-2 py-0.5 font-mono font-semibold text-brand-800">
                        {parsedSubSnapshot.assessmentProfile}
                      </span>
                    )}
                    {parsedSubSnapshot.contentVersion !== null && (
                      <span className="rounded bg-slateDark-50 px-2 py-0.5 font-mono">
                        v{parsedSubSnapshot.contentVersion}
                      </span>
                    )}
                  </div>
                  {parsedSubSnapshot.hints.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-slateDark-700">
                        Gợi ý:
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slateDark-800">
                        {parsedSubSnapshot.hints.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {parsedSubSnapshot.visualContext && (
                    <p className="text-[11px] text-slateDark-700">
                      <strong>visualContext:</strong>{' '}
                      {parsedSubSnapshot.visualContext}
                    </p>
                  )}
                  {parsedSubSnapshot.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveAdminMediaUrl(
                        parsedSubSnapshot.imageUrl,
                      )}
                      alt={parsedSubSnapshot.title ?? 'Prompt image'}
                      className="max-h-40 rounded-lg border border-slateDark-100 object-cover"
                    />
                  )}
                </div>
              ) : (
                <pre className="overflow-x-auto rounded-lg bg-slateDark-25 p-3 font-mono text-[11px] text-slateDark-800">
                  {JSON.stringify(subDetail.promptSnapshot, null, 2)}
                </pre>
              )}
            </section>

            {/* Result Breakdown */}
            <section className="space-y-3 rounded-xl border border-slateDark-100 bg-white p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                Kết quả chấm điểm (result)
              </h3>

              {subDetail.result === null || !parsedSubResult ? (
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-red-800">
                  <p className="font-semibold">
                    Không có dữ liệu kết quả (
                    <code className="font-mono">result === null</code>
                    ).
                  </p>
                  <p className="mt-1 text-[11px]">
                    Bài nộp thất bại hoặc hết hạn trước khi Azure
                    Speech trả về transcript. Vì âm thanh gốc không
                    được lưu, không thể chấm lại từ máy chủ.
                  </p>
                </div>
              ) : (
                <>
                  {/* Transcript */}
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slateDark-700">
                      Lời thoại nhận diện (Transcript)
                    </p>
                    <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3 text-sm text-slateDark-900">
                      {parsedSubResult.transcript ?? '—'}
                    </div>
                  </div>

                  {/* Scores Grid */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      {
                        label: 'Overall',
                        value:
                          parsedSubResult.overall ??
                          subDetail.overallScore,
                      },
                      {
                        label: 'Accuracy',
                        value: parsedSubResult.accuracy,
                      },
                      {
                        label: 'Fluency',
                        value: parsedSubResult.fluency,
                      },
                      {
                        label: 'Prosody',
                        value: parsedSubResult.prosody,
                      },
                      {
                        label: 'Completeness',
                        value: parsedSubResult.completeness,
                      },
                      {
                        label: 'Pronunciation',
                        value: parsedSubResult.pronunciation,
                      },
                    ]
                      .filter((metric) => metric.value !== null)
                      .map((metric) => (
                        <div
                          key={metric.label}
                          className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-2.5"
                        >
                          <p className="text-[10px] font-semibold uppercase text-slateDark-600">
                            {metric.label}
                          </p>
                          <p className="mt-0.5 font-mono text-base font-extrabold text-slateDark-900">
                            {formatScore(metric.value)}
                          </p>
                        </div>
                      ))}
                  </div>

                  {parsedSubResult.feedbackVi && (
                    <p className="rounded-xl border border-brand-100 bg-brand-25/50 p-3 text-xs text-slateDark-800">
                      <strong>Nhận xét:</strong>{' '}
                      {parsedSubResult.feedbackVi}
                    </p>
                  )}

                  {/* Words / Phonemes Breakdown */}
                  {parsedSubResult.words.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slateDark-700">
                        Phân tích từ & âm vị ({parsedSubResult.words.length}{' '}
                        từ)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedSubResult.words.map((w, idx) => {
                          const isClean = w.errorType === 'None';
                          const isSevere =
                            w.errorType === 'Mispronunciation' ||
                            w.errorType === 'Omission' ||
                            w.errorType === 'Insertion';
                          const pillClass = isClean
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : isSevere
                              ? 'border-red-200 bg-red-50 text-red-900'
                              : 'border-amber-200 bg-amber-50 text-amber-900';
                          return (
                            <div
                              key={`${w.word}-${idx}`}
                              className={`rounded-lg border px-2 py-1 text-[11px] ${pillClass}`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold">
                                  {w.word}
                                </span>
                                <span className="font-mono text-[10px]">
                                  {formatScore(w.accuracy)}
                                </span>
                                {!isClean && (
                                  <span className="rounded bg-white/80 px-1 text-[9px] font-semibold">
                                    {w.errorType}
                                  </span>
                                )}
                              </div>
                              {w.phonemes.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1 border-t border-black/5 pt-1 font-mono text-[10px]">
                                  {w.phonemes.map((ph, pIdx) => (
                                    <span
                                      key={`${ph.phoneme}-${pIdx}`}
                                      className="rounded bg-white/75 px-1"
                                    >
                                      /{ph.phoneme}/{' '}
                                      {formatScore(ph.accuracy)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Content Feedback */}
                  {parsedSubResult.content && (
                    <SubmissionContentFeedbackCard content={parsedSubResult.content} />
                  )}

                  <details className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                    <summary className="cursor-pointer font-semibold text-slateDark-800">
                      Xem JSON đầy đủ (result)
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] text-slateDark-800">
                      {JSON.stringify(subDetail.result, null, 2)}
                    </pre>
                  </details>
                </>
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
