import React from 'react';
import { CalendarDays, Eye, RotateCcw } from 'lucide-react';
import type { AdminUserDetail, CefrLevel } from '@/types/admin';
import {
  CEFR_LEVELS,
  LEARNING_KINDS,
  formatDateTime,
  kindLabel,
} from './user-detail.helpers';
import type { UserDetailState } from './useUserDetailState';

function renderDayPlanItems(items: unknown): React.ReactNode {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <p className="text-xs text-slateDark-600">
        Không có mục bài học nào trong kế hoạch hôm nay.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((raw, idx) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          return (
            <div
              key={`plan-item-${idx}`}
              className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-3 py-2 font-mono text-xs text-slateDark-800"
            >
              {String(raw)}
            </div>
          );
        }
        const obj = raw as Record<string, unknown>;
        const title =
          typeof obj.title === 'string'
            ? obj.title
            : typeof obj.lessonTitle === 'string'
              ? obj.lessonTitle
              : typeof obj.lessonCode === 'string'
                ? obj.lessonCode
                : `Mục #${idx + 1}`;
        const kind = typeof obj.kind === 'string' ? obj.kind : null;
        const status = typeof obj.status === 'string' ? obj.status : null;
        const minutes =
          typeof obj.estimatedMinutes === 'number'
            ? obj.estimatedMinutes
            : typeof obj.minutes === 'number'
              ? obj.minutes
              : null;
        return (
          <div
            key={typeof obj.id === 'string' ? obj.id : `plan-item-${idx}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slateDark-100 bg-slateDark-25 px-3.5 py-2.5 text-xs"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slateDark-900">{title}</p>
              {kind && (
                <p className="font-mono text-[10px] text-slateDark-600">
                  {kind}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {minutes !== null && (
                <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[11px] text-slateDark-700">
                  {minutes} phút
                </span>
              )}
              {status && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-800">
                  {status}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface UserSkillsTabProps {
  detail: AdminUserDetail;
  state: UserDetailState;
}

export function UserSkillsTab({
  detail,
  state,
}: UserSkillsTabProps): React.ReactElement {
  const {
    skillDrafts,
    setSkillDrafts,
    savingSkillKind,
    handleOverrideSkill,
    openPlacementModal,
    setResetPlacementSkillLevels,
    setConfirmResetRetakeOpen,
  } = state;

  return (
    <div className="space-y-6">
      {/* Bảng trình độ từng kỹ năng */}
      <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slateDark-900">
              Trình độ theo kỹ năng (Skill Levels)
            </h2>
            <p className="text-xs text-slateDark-700">
              Điều chỉnh thủ công trình độ CEFR theo từng kỹ năng (nguồn
              ADAPTIVE) và tùy chọn đặt lại lịch sử lộ đáp án.
            </p>
          </div>
          <span className="rounded-full bg-slateDark-50 px-3 py-1 text-xs font-semibold text-slateDark-800">
            Tổng đáp án đã lộ: {detail.answerExposuresCount}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {LEARNING_KINDS.map((item) => {
            const existing = detail.skillLevels.find(
              (s) => s.kind === item.key,
            );
            const draft = skillDrafts[item.key];
            const isSaving = savingSkillKind === item.key;

            return (
              <div
                key={item.key}
                className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slateDark-900">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slateDark-700">
                      {existing ? (
                        <>
                          Hiện tại:{' '}
                          <strong className="text-brand-800">
                            {existing.cefrLevel}
                          </strong>{' '}
                          · Nguồn:{' '}
                          <span className="font-mono">{existing.source}</span>
                          {existing.previousCefr
                            ? ` (trước: ${existing.previousCefr})`
                            : ''}
                        </>
                      ) : (
                        'Chưa có bản ghi trình độ (mặc định A1)'
                      )}
                    </p>
                  </div>
                  {existing && (
                    <span className="font-mono text-[10px] text-slateDark-600">
                      {formatDateTime(existing.updatedAt)}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <select
                    value={draft.cefrLevel}
                    onChange={(e) =>
                      setSkillDrafts((prev) => ({
                        ...prev,
                        [item.key]: {
                          ...prev[item.key],
                          cefrLevel: e.target.value as CefrLevel,
                        },
                      }))
                    }
                    aria-label={`Chọn mức CEFR cho ${item.label}`}
                    className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900"
                  >
                    {CEFR_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>

                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slateDark-800">
                    <input
                      type="checkbox"
                      checked={draft.resetExposures}
                      onChange={(e) =>
                        setSkillDrafts((prev) => ({
                          ...prev,
                          [item.key]: {
                            ...prev[item.key],
                            resetExposures: e.target.checked,
                          },
                        }))
                      }
                      className="h-3.5 w-3.5 accent-brand-600"
                    />
                    <span>Xóa lộ đáp án</span>
                  </label>

                  <button
                    type="button"
                    disabled={savingSkillKind !== null}
                    onClick={() => void handleOverrideSkill(item.key)}
                    className="ml-auto rounded-xl border border-brand-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50"
                  >
                    {isSaving ? 'Đang lưu...' : 'Lưu trình độ'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Kế hoạch hôm nay & Biến động trình độ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slateDark-900">
                Kế hoạch học hôm nay (Today Day Plan)
              </h2>
            </div>
            {detail.todayDayPlan && (
              <span className="font-mono text-[11px] font-semibold text-slateDark-700">
                {detail.todayDayPlan.date} · v{detail.todayDayPlan.version}
              </span>
            )}
          </div>

          {detail.todayDayPlan ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-[11px] text-slateDark-700">
                <span className="rounded-full bg-slateDark-50 px-2.5 py-0.5 font-semibold">
                  Mục tiêu: {detail.todayDayPlan.dailyGoalMinutes} phút
                </span>
                <span className="rounded-full bg-slateDark-50 px-2.5 py-0.5 font-mono">
                  policy: {detail.todayDayPlan.policyVersion}
                </span>
                <span className="rounded-full bg-slateDark-50 px-2.5 py-0.5 font-mono">
                  pref v{detail.todayDayPlan.preferencesVersion}
                </span>
              </div>
              {renderDayPlanItems(detail.todayDayPlan.items)}
            </div>
          ) : (
            <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-6 text-center text-xs text-slateDark-600">
              Người học chưa khởi tạo kế hoạch học cho ngày hôm nay.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-slateDark-900">
            Lịch sử biến động trình độ (20 sự kiện gần nhất)
          </h2>
          {detail.skillLevelEvents.length === 0 ? (
            <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-6 text-center text-xs text-slateDark-600">
              Chưa có sự kiện tăng/giảm trình độ nào.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {detail.skillLevelEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slateDark-100 bg-slateDark-25 px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slateDark-900">
                      {kindLabel(ev.kind)}:{' '}
                      <span className="font-mono text-brand-800">
                        {ev.fromCefr} → {ev.toCefr}
                      </span>
                    </p>
                    <p className="font-mono text-[10px] text-slateDark-600">
                      Attempt: {ev.attemptId.slice(0, 12)} ·{' '}
                      {formatDateTime(ev.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                      ev.direction.toUpperCase() === 'UP'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {ev.direction}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Danh sách Placement Sessions */}
      <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slateDark-900">
              Lịch sử kiểm tra đầu vào (Placement Sessions)
            </h2>
            <p className="text-xs text-slateDark-700">
              Xem chi tiết từng câu trả lời hoặc mở lại quyền thi đầu vào cho
              người học.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setResetPlacementSkillLevels(false);
              setConfirmResetRetakeOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset cho thi lại</span>
          </button>
        </div>

        {detail.recentPlacements.length === 0 ? (
          <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-8 text-center text-xs text-slateDark-600">
            Người học chưa có bài kiểm tra đầu vào nào.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                <tr>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">CEFR ước lượng</th>
                  <th className="px-4 py-3">Đúng / Tổng</th>
                  <th className="px-4 py-3">Bắt đầu</th>
                  <th className="px-4 py-3">Hoàn tất</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slateDark-100">
                {detail.recentPlacements.map((p) => (
                  <tr key={p.id} className="hover:bg-slateDark-25">
                    <td className="px-4 py-3 font-mono font-semibold text-slateDark-900">
                      {p.status}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-mono font-bold text-brand-800">
                        {p.estimatedCefr ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {p.correctCount}/{p.totalItems}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                      {formatDateTime(p.startedAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                      {formatDateTime(p.completedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void openPlacementModal(p.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 font-semibold text-slateDark-900 hover:bg-slateDark-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Xem câu trả lời</span>
                      </button>
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
