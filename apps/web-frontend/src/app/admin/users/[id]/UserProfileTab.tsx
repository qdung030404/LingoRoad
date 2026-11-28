import React from 'react';
import { Download, Save, ShieldCheck } from 'lucide-react';
import type {
  AdminUserDetail,
  CefrLevel,
  LearningPurpose,
  UserRole,
  UserStatus,
} from '@/types/admin';
import {
  CEFR_LEVELS,
  LEARNING_KINDS,
  formatDateTime,
} from './user-detail.helpers';
import type { UserDetailState } from './useUserDetailState';

interface UserProfileTabProps {
  detail: AdminUserDetail;
  isSelf: boolean;
  state: UserDetailState;
}

export function UserProfileTab({
  detail,
  isSelf,
  state,
}: UserProfileTabProps): React.ReactElement {
  const {
    exporting,
    editName,
    setEditName,
    editRole,
    setEditRole,
    editStatus,
    setEditStatus,
    editPassword,
    setEditPassword,
    targetCefr,
    setTargetCefr,
    selfAssessedCefr,
    setSelfAssessedCefr,
    dailyGoalMinutes,
    setDailyGoalMinutes,
    learningPurpose,
    setLearningPurpose,
    preferredKinds,
    reminderEnabled,
    setReminderEnabled,
    reminderTime,
    setReminderTime,
    savingProfile,
    togglePreferredKind,
    handleSaveProfile,
    handleExportGdpr,
  } = state;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Cột trái: Thông tin định danh & GDPR */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slateDark-900">
            Định danh & Bảo mật
          </h2>
          <dl className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slateDark-600">Trạng thái</dt>
              <dd>
                <span
                  className={
                    detail.status === 'ACTIVE'
                      ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700'
                      : detail.status === 'SUSPENDED'
                        ? 'rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800'
                        : 'rounded-full bg-red-50 px-2.5 py-0.5 font-semibold text-red-700'
                  }
                >
                  {detail.status}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slateDark-600">Vai trò</dt>
              <dd className="font-semibold text-slateDark-900">
                {detail.role}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slateDark-600">Nhà cung cấp (Provider)</dt>
              <dd className="font-mono font-semibold text-slateDark-900">
                {detail.provider}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slateDark-600">Danh tính Firebase</dt>
              <dd>
                <span
                  className={
                    detail.hasFirebaseIdentity
                      ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700'
                      : 'inline-flex items-center gap-1 rounded-full bg-slateDark-50 px-2.5 py-0.5 font-semibold text-slateDark-700'
                  }
                >
                  <ShieldCheck className="h-3 w-3" />
                  <span>
                    {detail.hasFirebaseIdentity
                      ? 'Đã liên kết'
                      : 'Chưa liên kết'}
                  </span>
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slateDark-600">Ngày tạo</dt>
              <dd className="font-mono text-[11px] text-slateDark-800">
                {formatDateTime(detail.createdAt)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slateDark-600">Cập nhật gần nhất</dt>
              <dd className="font-mono text-[11px] text-slateDark-800">
                {formatDateTime(detail.updatedAt)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slateDark-600">Hoàn tất Onboarding</dt>
              <dd className="font-mono text-[11px] text-slateDark-800">
                {formatDateTime(detail.profile?.onboardingCompletedAt)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slateDark-600">Phiên bản cài đặt</dt>
              <dd className="font-mono text-[11px] text-slateDark-800">
                pref v{detail.profile?.preferencesVersion ?? 0} · rem v
                {detail.profile?.reminderVersion ?? 0}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-brand-25 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-brand-900">
            Tuân thủ quyền riêng tư (GDPR)
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-brand-800">
            Xuất toàn bộ dữ liệu học tập, hồ sơ, từ vựng, bài nộp nói và hội
            thoại dưới dạng JSON (đã tự động lọc bỏ mật khẩu và token hash).
          </p>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExportGdpr()}
            className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>
              {exporting ? 'Đang tạo gói JSON...' : 'Xuất dữ liệu GDPR (JSON)'}
            </span>
          </button>
        </div>
      </div>

      {/* Cột phải: Form chỉnh sửa User & UserProfile đầy đủ */}
      <form
        onSubmit={(e) => void handleSaveProfile(e)}
        className="space-y-5 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm lg:col-span-2"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slateDark-900">
              Chỉnh sửa Hồ sơ & Cài đặt học tập
            </h2>
            <p className="text-xs text-slateDark-700">
              Thay đổi mục tiêu học sẽ tự động đồng bộ lại kế hoạch học hôm nay
              (LearningDayPlan).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Họ tên *
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Vai trò
            </label>
            <select
              value={editRole}
              disabled={isSelf}
              onChange={(e) => setEditRole(e.target.value as UserRole)}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
            >
              <option value="LEARNER">Learner</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Trạng thái tài khoản
            </label>
            <select
              value={editStatus}
              disabled={isSelf}
              onChange={(e) => setEditStatus(e.target.value as UserStatus)}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-60"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DELETED">DELETED</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              CEFR mục tiêu
            </label>
            <select
              value={targetCefr}
              onChange={(e) => setTargetCefr(e.target.value as CefrLevel)}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              {CEFR_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Tự đánh giá CEFR
            </label>
            <select
              value={selfAssessedCefr}
              onChange={(e) =>
                setSelfAssessedCefr(e.target.value as CefrLevel | '')
              }
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">-- Chưa chọn --</option>
              {CEFR_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Mục tiêu ngày (phút)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              required
              value={dailyGoalMinutes}
              onChange={(e) => setDailyGoalMinutes(Number(e.target.value))}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Mục đích học
            </label>
            <select
              value={learningPurpose}
              onChange={(e) =>
                setLearningPurpose(e.target.value as LearningPurpose | '')
              }
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">-- Chưa chọn --</option>
              <option value="EXAM">Thi chứng chỉ (EXAM)</option>
              <option value="WORK">Công việc (WORK)</option>
              <option value="DAILY_COMMUNICATION">Giao tiếp hàng ngày</option>
              <option value="STUDY">Học tập (STUDY)</option>
            </select>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-slateDark-800">
            Kỹ năng ưu tiên trong lộ trình (chọn ít nhất 1)
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {LEARNING_KINDS.map((item) => {
              const checked = preferredKinds.includes(item.key);
              return (
                <label
                  key={item.key}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition ${
                    checked
                      ? 'border-brand-300 bg-brand-25 text-brand-900'
                      : 'border-slateDark-200 bg-white text-slateDark-800 hover:bg-slateDark-25'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePreferredKind(item.key)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-xl border border-slateDark-100 bg-slateDark-25 p-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-3 text-xs font-semibold text-slateDark-900">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            <span>Bật thông báo nhắc học hàng ngày</span>
          </label>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Giờ nhắc học (HH:mm)
            </label>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slateDark-800">
            Đặt lại mật khẩu mới (bỏ trống nếu giữ nguyên)
          </label>
          <input
            type="password"
            minLength={8}
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            placeholder="Nhập tối thiểu 8 ký tự để đổi mật khẩu và thu hồi phiên cũ"
            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex justify-end border-t border-slateDark-100 pt-4">
          <button
            type="submit"
            disabled={savingProfile}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>
              {savingProfile ? 'Đang lưu...' : 'Lưu hồ sơ & cài đặt'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
