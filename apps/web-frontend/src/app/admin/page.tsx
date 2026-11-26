'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
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
import type { DashboardOverview } from '@/types/admin';

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function AdminDashboardPage(): React.ReactElement {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardOverview();
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
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <AdminShell
      breadcrumbTitle="Tổng quan"
      title="Dashboard Overview"
      subtitle="Theo dõi tổng quan nội dung và hoạt động học tập từ dữ liệu LingoRoad."
      actions={
        <>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-4 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
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
                  subtitle="Tài khoản Learner"
                  icon={<Users className="h-4 w-4" />}
                  tone="green"
                />
                <LegacyStatCard
                  label="Active 30 ngày"
                  value={overview.users.active30d}
                  subtitle="Có hoạt động gần đây"
                  icon={<Activity className="h-4 w-4" />}
                  tone="emerald"
                />
                <LegacyStatCard
                  label="Bài hoàn thành"
                  value={overview.activity.learningAttemptsCompleted}
                  subtitle="Tổng lượt hoàn tất"
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

              {/* Hàng 2: Tổng quan nội dung */}
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-extrabold text-slateDark-900">
                    Tổng quan nội dung
                  </h2>
                  <p className="text-xs text-slateDark-700">
                    Cấu trúc học liệu đang được vận hành.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <LegacyStatCard
                    label="Kỹ năng"
                    value={overview.content.skillsTotal}
                    subtitle="Chuẩn CEFR & luyện tập"
                    icon={<Compass className="h-4 w-4" />}
                    tone="green"
                  />
                  <LegacyStatCard
                    label="Bài học"
                    value={overview.content.lessonsTotal}
                    subtitle={`${overview.content.unitsTotal} chương học`}
                    icon={<BookOpen className="h-4 w-4" />}
                    tone="slate"
                  />
                  <LegacyStatCard
                    label="Đã publish"
                    value={overview.content.lessonsPublished}
                    subtitle="Sẵn sàng cho learner"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    tone="emerald"
                  />
                  <LegacyStatCard
                    label="Items"
                    value={overview.content.assessmentItemsTotal}
                    subtitle={`${overview.content.speakingPromptsTotal} đề luyện nói`}
                    icon={<ClipboardList className="h-4 w-4" />}
                    tone="amber"
                  />
                </div>
              </section>

              {/* Hàng 3: Mastery & Hoạt động gần đây */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm lg:col-span-7">
                  <h2 className="text-base font-extrabold text-slateDark-900">
                    Mastery theo nhóm kỹ năng
                  </h2>
                  <p className="mt-0.5 text-xs text-slateDark-700">
                    Khả năng trả lời đúng trung bình theo nhóm.
                  </p>

                  <div className="mt-6 space-y-5">
                    {overview.masteryBySkill.map((entry) => (
                      <div
                        key={entry.group}
                        className="grid grid-cols-12 items-center gap-3"
                      >
                        <span className="col-span-3 text-sm font-medium capitalize text-slateDark-800">
                          {entry.group}
                        </span>
                        <div className="col-span-7 h-2 w-full overflow-hidden rounded-full bg-slateDark-50">
                          <div
                            className="h-full rounded-full bg-brand-600 transition-all"
                            style={{ width: `${entry.accuracyPercent}%` }}
                          />
                        </div>
                        <span className="col-span-2 text-right text-xs font-bold text-slateDark-900">
                          {entry.accuracyPercent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm lg:col-span-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-slateDark-900">
                      Hoạt động gần đây
                    </h2>
                    <Link
                      href="/admin/users"
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Xem người dùng
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
                          className="flex items-start gap-3 py-3.5 first:pt-1 last:pb-1"
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
