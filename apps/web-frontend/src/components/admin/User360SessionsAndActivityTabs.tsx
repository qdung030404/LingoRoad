'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Mic,
  Radio,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AdminPlacementSessionDetail,
  AdminUserDetail,
  AdminUserSessionView,
} from '@/types/admin';

export interface User360SessionsTabProps {
  sessions: AdminUserSessionView[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  revokingAll: boolean;
  loadSessions: () => Promise<void>;
  onConfirmRevokeAll: () => void;
  setRevokeTarget: (session: AdminUserSessionView) => void;
  formatDateTime: (iso: string | null | undefined) => string;
}

export function User360SessionsTab({
  sessions,
  sessionsLoading,
  sessionsError,
  revokingAll,
  loadSessions,
  onConfirmRevokeAll,
  setRevokeTarget,
  formatDateTime,
}: User360SessionsTabProps): React.ReactElement {
  return (
    <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slateDark-900">
            Phiên đăng nhập đang hoạt động (Refresh Sessions)
          </h2>
          <p className="text-xs text-slateDark-700">
            Danh sách phiên còn hiệu lực (không hiển thị token hash). Thu hồi
            tất cả sẽ đồng thời nâng tokenVersion và vô hiệu hóa phiên Firebase.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={sessionsLoading}
            onClick={() => void loadSessions()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`}
            />
            <span>Tải lại</span>
          </button>
          <button
            type="button"
            disabled={revokingAll}
            onClick={onConfirmRevokeAll}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Thu hồi tất cả phiên</span>
          </button>
        </div>
      </div>

      {sessionsError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
          {sessionsError}
        </div>
      )}

      {sessionsLoading ? (
        <p className="py-10 text-center text-xs text-slateDark-600">
          Đang tải danh sách phiên đăng nhập...
        </p>
      ) : sessions.length === 0 ? (
        <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-8 text-center text-xs text-slateDark-600">
          Không có phiên đăng nhập nào đang hoạt động.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
              <tr>
                <th className="px-4 py-3">Thiết bị</th>
                <th className="px-4 py-3">Địa chỉ IP</th>
                <th className="px-4 py-3">Tạo lúc</th>
                <th className="px-4 py-3">Hết hạn</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slateDark-100">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-slateDark-25">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 shrink-0 text-slateDark-500" />
                      <div>
                        <p className="font-semibold text-slateDark-900">
                          {session.deviceIdentifier || 'Thiết bị không xác định'}
                        </p>
                        <p className="font-mono text-[10px] text-slateDark-600">
                          {session.id.slice(0, 12)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slateDark-800">
                    {session.ipAddress || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                    {formatDateTime(session.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                    {formatDateTime(session.expiresAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(session)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Thu hồi</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function User360ActivityTab({
  detail,
  formatDateTime,
}: {
  detail: AdminUserDetail;
  formatDateTime: (iso: string | null | undefined) => string;
}): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Lượt học gần đây */}
      <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-bold text-slateDark-900">
            Lượt học bài tập gần đây (tối đa 10)
          </h2>
        </div>
        {detail.recentAttempts.length === 0 ? (
          <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-6 text-center text-xs text-slateDark-600">
            Chưa có lượt làm bài tập nào.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                <tr>
                  <th className="px-4 py-3">Bài học</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Kết quả</th>
                  <th className="px-4 py-3">Bắt đầu</th>
                  <th className="px-4 py-3">Nộp bài</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slateDark-100">
                {detail.recentAttempts.map((a) => (
                  <tr key={a.id} className="hover:bg-slateDark-25">
                    <td className="px-4 py-3 font-semibold text-slateDark-900">
                      {a.lessonTitle}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {a.status}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {a.correctCount ?? 0}/{a.totalQuestions}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                      {formatDateTime(a.startedAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                      {formatDateTime(a.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bài nộp Luyện nói */}
      <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slateDark-900">
              Bài nộp Luyện nói gần đây (tối đa 10)
            </h2>
          </div>
          <Link
            href={`/admin/speaking?tab=submissions&search=${encodeURIComponent(detail.email)}`}
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            Xem trong Vận hành Speaking →
          </Link>
        </div>
        {detail.recentSpeaking.length === 0 ? (
          <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-6 text-center text-xs text-slateDark-600">
            Chưa có bài nộp luyện nói nào.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                <tr>
                  <th className="px-4 py-3">Đề luyện nói</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Điểm tổng</th>
                  <th className="px-4 py-3">Thời gian nộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slateDark-100">
                {detail.recentSpeaking.map((s) => (
                  <tr key={s.id} className="hover:bg-slateDark-25">
                    <td className="px-4 py-3 font-semibold text-slateDark-900">
                      {s.promptTitle}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${
                          s.status === 'SUCCEEDED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : s.status === 'FAILED' || s.status === 'UNKNOWN'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slateDark-900">
                      {s.overallScore !== null
                        ? `${Math.round(s.overallScore)}đ`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                      {formatDateTime(s.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Phiên hội thoại Voice Live */}
      <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slateDark-900">
              Phiên Hội thoại Voice Live gần đây (tối đa 10)
            </h2>
          </div>
          <Link
            href={`/admin/speaking?tab=voice&search=${encodeURIComponent(detail.email)}`}
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            Xem trong Vận hành Voice →
          </Link>
        </div>
        {detail.recentVoiceConversations.length === 0 ? (
          <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-6 text-center text-xs text-slateDark-600">
            Chưa có phiên hội thoại AI Voice Live nào.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                <tr>
                  <th className="px-4 py-3">Chủ đề</th>
                  <th className="px-4 py-3">Trạng thái phiên</th>
                  <th className="px-4 py-3">Chấm điểm</th>
                  <th className="px-4 py-3">Lượt nói</th>
                  <th className="px-4 py-3">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slateDark-100">
                {detail.recentVoiceConversations.map((vc) => (
                  <tr key={vc.id} className="hover:bg-slateDark-25">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slateDark-900">
                        {vc.topicTitle}
                      </p>
                      {vc.endReason && (
                        <p className="font-mono text-[10px] text-slateDark-600">
                          Lý do kết thúc: {vc.endReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-slateDark-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slateDark-800">
                          {vc.status}
                        </span>
                        {vc.hasActiveLock && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            Đang giữ khóa
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slateDark-800">
                      {vc.assessmentStatus}
                    </td>
                    <td className="px-4 py-3 font-mono">{vc.turnsCount} lượt</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slateDark-400" />
                        {formatDateTime(vc.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function User360PlacementModal({
  placementModalSessionId,
  placementDetailLoading,
  placementDetailError,
  placementDetail,
  onClose,
}: {
  placementModalSessionId: string;
  placementDetailLoading: boolean;
  placementDetailError: string | null;
  placementDetail: AdminPlacementSessionDetail | null;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slateDark-900">
              Chi tiết phiên kiểm tra đầu vào (Placement)
            </h2>
            <p className="font-mono text-xs text-slateDark-600">
              Session ID: {placementModalSessionId}
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
          {placementDetailLoading ? (
            <p className="py-10 text-center text-slateDark-700">
              Đang tải chi tiết câu trả lời Placement...
            </p>
          ) : placementDetailError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-medium text-red-700">
              {placementDetailError}
            </div>
          ) : placementDetail ? (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slateDark-100 bg-slateDark-25 p-4 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] text-slateDark-600">Trạng thái</p>
                  <p className="mt-0.5 font-mono font-bold text-slateDark-900">
                    {placementDetail.status}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slateDark-600">
                    CEFR ước lượng
                  </p>
                  <p className="mt-0.5 font-mono font-bold text-brand-800">
                    {placementDetail.estimatedCefr ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slateDark-600">Số câu đúng</p>
                  <p className="mt-0.5 font-mono font-bold text-slateDark-900">
                    {placementDetail.correctCount}/{placementDetail.totalItems}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slateDark-600">Phiên bản đề</p>
                  <p className="mt-0.5 truncate font-mono font-semibold text-slateDark-900">
                    {placementDetail.testVersion}
                  </p>
                </div>
              </div>

              {placementDetail.responses.length === 0 ? (
                <p className="py-6 text-center text-slateDark-600">
                  Phiên này chưa có câu trả lời nào được ghi nhận.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {placementDetail.responses.map((resp) => (
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
