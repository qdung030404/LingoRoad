import React from 'react';
import Link from 'next/link';
import { BookOpen, Clock, Mic, Radio } from 'lucide-react';
import type { AdminUserDetail } from '@/types/admin';
import { formatDateTime } from './user-detail.helpers';

interface UserActivityTabProps {
  detail: AdminUserDetail;
}

export function UserActivityTab({
  detail,
}: UserActivityTabProps): React.ReactElement {
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
                    <td className="px-4 py-3 font-mono">
                      {vc.turnsCount} lượt
                    </td>
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
