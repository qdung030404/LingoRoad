'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Compass,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import { getDashboardOverview } from '@/lib/admin-api';
import type {
  CefrAttemptStat,
  DashboardOverview,
  DashboardTimeframe,
  LearningTrendPoint,
} from '@/types/admin';

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const TIMEFRAME_OPTIONS: Array<{ value: DashboardTimeframe; label: string }> = [
  { value: '7_DAYS', label: '7 ngày' },
  { value: '30_DAYS', label: '30 ngày' },
  { value: '90_DAYS', label: '90 ngày' },
  { value: 'ALL_TIME', label: 'Toàn thời gian' },
];

function TrendSvgChart({
  data,
}: {
  data: LearningTrendPoint[];
}): React.ReactElement {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-slateDark-25 text-xs text-slateDark-600">
        Chưa có dữ liệu xu hướng học tập trong khoảng thời gian này.
      </div>
    );
  }

  const width = 640;
  const height = 190;
  const padX = 36;
  const padY = 22;
  const maxAttempts = Math.max(1, ...data.map((d) => d.attempts));
  const stepX =
    data.length > 1 ? (width - padX * 2) / (data.length - 1) : width / 2;

  const attemptPoints = data.map((d, idx) => {
    const x = data.length > 1 ? padX + idx * stepX : width / 2;
    const y =
      height - padY - (d.attempts / maxAttempts) * (height - padY * 2);
    return { x, y, ...d };
  });

  const userPoints = data.map((d, idx) => {
    const x = data.length > 1 ? padX + idx * stepX : width / 2;
    const y =
      height - padY - (d.activeUsers / maxAttempts) * (height - padY * 2);
    return { x, y, ...d };
  });

  const attemptPolyline = attemptPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const userPolyline = userPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full min-w-[420px]"
        role="img"
        aria-label="Biểu đồ xu hướng lượt học và học viên hoạt động"
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = height - padY - ratio * (height - padY * 2);
          const val = Math.round(maxAttempts * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="3 3"
              />
              <text
                x={padX - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-500 text-[10px]"
              >
                {val}
              </text>
            </g>
          );
        })}

        <polyline
          fill="none"
          stroke="#16A34A"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={attemptPolyline}
        />
        <polyline
          fill="none"
          stroke="#F59E0B"
          strokeWidth={2}
          strokeDasharray="4 3"
          points={userPolyline}
        />

        {attemptPoints.map((p, idx) => (
          <g key={p.bucket}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="#16A34A">
              <title>{`${p.bucket}: ${p.attempts} lượt học, ${p.activeUsers} học viên`}</title>
            </circle>
            {(idx === 0 ||
              idx === attemptPoints.length - 1 ||
              idx % Math.max(1, Math.floor(attemptPoints.length / 5)) === 0) && (
              <text
                x={p.x}
                y={height - 4}
                textAnchor="middle"
                className="fill-slate-500 text-[9px]"
              >
                {p.bucket.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-slateDark-700">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded bg-emerald-600" /> Lượt học (Attempts)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-500" />{' '}
          Học viên hoạt động (Active Users)
        </span>
      </div>
    </div>
  );
}

function CefrBarChart({
  data,
}: {
  data: CefrAttemptStat[];
}): React.ReactElement {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-slateDark-25 text-xs text-slateDark-600">
        Chưa có lượt học phân bổ theo bậc CEFR.
      </div>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-48 items-end justify-around gap-3 px-2 pt-6">
      {data.map((item) => {
        const pct = Math.max(6, Math.round((item.count / max) * 100));
        return (
          <div
            key={item.cefrLevel}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className="text-[11px] font-bold text-slateDark-900">
              {item.count}
            </span>
            <div className="flex w-full max-w-[44px] flex-1 items-end rounded-t-lg bg-slateDark-50">
              <div
                className="w-full rounded-t-lg bg-brand-600 transition-all"
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-slateDark-700">
              {item.cefrLevel === 'UNASSIGNED' ? 'Khác' : item.cefrLevel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboardPage(): React.ReactElement {
  const [timeframe, setTimeframe] = useState<DashboardTimeframe>('30_DAYS');
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getDashboardOverview(timeframe, forceRefresh);
        setOverview(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải dữ liệu tổng quan.',
        );
      } finally {
        setLoading(false);
      }
    },
    [timeframe],
  );

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  return (
    <AdminShell
      breadcrumbTitle="Tổng quan"
      title="Dashboard Overview"
      subtitle="Phân tích dữ liệu vận hành theo thời gian thực với bộ nhớ đệm SQL Aggregate."
      actions={
        <>
          <div className="inline-flex rounded-xl border border-slateDark-200 bg-white p-1">
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTimeframe(opt.value)}
                className={
                  timeframe === opt.value
                    ? 'rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slateDark-700 hover:bg-slateDark-50'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadData(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-4 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            <span>Làm mới</span>
          </button>
          <Link
            href="/admin/lessons"
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Quản lý bài học</span>
          </Link>
        </>
      }
    >
      {() => (
        <div className="space-y-8">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {loading && !overview ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-32 animate-pulse rounded-2xl border border-slateDark-100 bg-white"
                />
              ))}
            </div>
          ) : overview ? (
            <>
              {/* Hàng 1: KPI Hoạt động học tập */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <LegacyStatCard
                  label="Tổng người học"
                  value={overview.users.learners}
                  subtitle={`${overview.users.admins} admin · ${overview.users.suspended} bị khóa`}
                  icon={<Users className="h-4 w-4" />}
                  tone="green"
                />
                <LegacyStatCard
                  label="Active 30 ngày"
                  value={overview.users.active30d}
                  subtitle="Học viên có hoạt động gần đây"
                  icon={<Activity className="h-4 w-4" />}
                  tone="emerald"
                />
                <LegacyStatCard
                  label="Bài hoàn thành"
                  value={overview.activity.learningAttemptsCompleted}
                  subtitle={`${overview.activity.placementSessionsTotal} phiên placement`}
                  icon={<Award className="h-4 w-4" />}
                  tone="slate"
                />
                <LegacyStatCard
                  label="Độ chính xác"
                  value={`${overview.activity.accuracyPercent}%`}
                  subtitle={`${overview.activity.totalAnsweredQuestions} lượt trả lời`}
                  icon={<Target className="h-4 w-4" />}
                  tone="amber"
                />
              </div>

              {/* Hàng 2: Tổng quan nội dung + Lessons by Kind */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-extrabold text-slateDark-900">
                      Tổng quan kho học liệu
                    </h2>
                    <p className="text-xs text-slateDark-700">
                      {overview.generatedAt
                        ? `Cập nhật lúc ${formatDateTime(overview.generatedAt)}`
                        : 'Cấu trúc học liệu đang được vận hành.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {overview.lessonsByKind.map((item) => (
                      <span
                        key={item.kind}
                        className="rounded-full border border-slateDark-100 bg-white px-3 py-1 text-xs font-semibold text-slateDark-800 shadow-sm"
                      >
                        {item.kind}: <strong>{item.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <LegacyStatCard
                    label="Kỹ năng & Ngữ pháp"
                    value={overview.content.skillsTotal}
                    subtitle={`${overview.content.grammarTopicsTotal ?? 0} nút ngữ pháp DAG`}
                    icon={<Compass className="h-4 w-4" />}
                    tone="green"
                  />
                  <LegacyStatCard
                    label="Bài học"
                    value={overview.content.lessonsTotal}
                    subtitle={`${overview.content.unitsTotal} chương học CEFR`}
                    icon={<BookOpen className="h-4 w-4" />}
                    tone="slate"
                  />
                  <LegacyStatCard
                    label="Đã publish"
                    value={overview.content.lessonsPublished}
                    subtitle={`${overview.content.curatedTopicsTotal ?? 0} chủ đề từ vựng`}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    tone="emerald"
                  />
                  <LegacyStatCard
                    label="Ngân hàng đề"
                    value={overview.content.assessmentItemsTotal}
                    subtitle={`${overview.content.speakingPromptsTotal} đề luyện nói`}
                    icon={<ClipboardList className="h-4 w-4" />}
                    tone="amber"
                  />
                </div>
              </section>

              {/* Hàng 3: Biểu đồ xu hướng & Phân bổ CEFR */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm lg:col-span-7">
                  <h2 className="text-base font-extrabold text-slateDark-900">
                    Xu hướng hoạt động học tập
                  </h2>
                  <p className="mt-0.5 text-xs text-slateDark-700">
                    Lượt làm bài và số học viên tương tác theo mốc thời gian.
                  </p>
                  <div className="mt-4">
                    <TrendSvgChart data={overview.learningTrend ?? []} />
                  </div>
                </div>

                <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm lg:col-span-5">
                  <h2 className="text-base font-extrabold text-slateDark-900">
                    Phân bổ lượt học theo CEFR
                  </h2>
                  <p className="mt-0.5 text-xs text-slateDark-700">
                    Mật độ hoàn thành bài học từ A1 đến C2.
                  </p>
                  <div className="mt-4">
                    <CefrBarChart data={overview.attemptsByCefr ?? []} />
                  </div>
                </div>
              </div>

              {/* Hàng 4: Mastery & Cảnh báo câu hỏi khó */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm lg:col-span-6">
                  <h2 className="text-base font-extrabold text-slateDark-900">
                    Mastery theo nhóm kỹ năng
                  </h2>
                  <p className="mt-0.5 text-xs text-slateDark-700">
                    Tỉ lệ chính xác / điểm trung bình gồm cả kỹ năng Nói (Speaking).
                  </p>

                  <div className="mt-5 space-y-4">
                    {overview.masteryBySkill.map((entry) => (
                      <div
                        key={entry.group}
                        className="grid grid-cols-12 items-center gap-3"
                      >
                        <span className="col-span-3 text-xs font-semibold capitalize text-slateDark-800">
                          {entry.group}
                        </span>
                        <div className="col-span-6 h-2 w-full overflow-hidden rounded-full bg-slateDark-50">
                          <div
                            className="h-full rounded-full bg-brand-600 transition-all"
                            style={{ width: `${entry.accuracyPercent}%` }}
                          />
                        </div>
                        <span className="col-span-3 text-right text-xs font-bold text-slateDark-900">
                          {entry.accuracyPercent}%{' '}
                          <span className="font-normal text-slateDark-600">
                            ({entry.sampleCount})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm lg:col-span-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <h2 className="text-base font-extrabold text-slateDark-900">
                        Cảnh báo câu hỏi sai cao (&gt;75%)
                      </h2>
                    </div>
                    <Link
                      href="/admin/items"
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Kiểm tra Item Bank
                    </Link>
                  </div>
                  <p className="mt-0.5 text-xs text-slateDark-700">
                    Các câu hỏi có ≥ 5 lượt trả lời với tỉ lệ sai bất thường cần rà
                    soát đáp án hoặc độ khó IRT.
                  </p>

                  <div className="mt-4 divide-y divide-slateDark-100">
                    {(overview.hardItems ?? []).length === 0 ? (
                      <p className="py-8 text-center text-xs text-emerald-700">
                        Chưa phát hiện câu hỏi nào có tỉ lệ sai vượt ngưỡng 75%.
                      </p>
                    ) : (
                      (overview.hardItems ?? []).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 py-3 first:pt-1 last:pb-1"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-xs font-bold text-slateDark-900">
                              {item.prompt}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-slateDark-600">
                              {item.externalId ?? item.id.slice(0, 8)} ·{' '}
                              {item.cefrLevel} · {item.skillCode}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700">
                            Sai {item.wrongRatePercent}% ({item.totalResponses})
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Hàng 5: Người dùng mới nhất & Hoạt động gần đây */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm lg:col-span-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-slateDark-900">
                      Người dùng mới đăng ký
                    </h2>
                    <Link
                      href="/admin/users"
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Quản lý Users
                    </Link>
                  </div>
                  <div className="mt-4 divide-y divide-slateDark-100">
                    {overview.recentUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slateDark-900">
                            {u.name}
                          </p>
                          <p className="truncate text-slateDark-600">{u.email}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="rounded-full bg-slateDark-50 px-2 py-0.5 font-semibold text-slateDark-800">
                            {u.role}
                          </span>
                          <p className="mt-0.5 text-[10px] text-slateDark-600">
                            {formatDateTime(u.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm lg:col-span-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-slateDark-900">
                      Hoạt động gần đây
                    </h2>
                    <Link
                      href="/admin/audit-logs"
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Nhật ký Admin
                    </Link>
                  </div>

                  <div className="mt-4 divide-y divide-slateDark-100">
                    {overview.recentActivities.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slateDark-700">
                        Chưa có hoạt động nào được ghi nhận.
                      </p>
                    ) : (
                      overview.recentActivities.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 py-3 first:pt-1 last:pb-1"
                        >
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-50" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-slateDark-900">
                              {item.action} ·{' '}
                              <span className="font-medium text-brand-700">
                                {item.target}
                              </span>
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-slateDark-700">
                              {item.actorEmail} · {formatDateTime(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
