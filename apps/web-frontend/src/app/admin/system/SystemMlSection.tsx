import React from 'react';
import { Cpu, Mic, Radio } from 'lucide-react';
import { parseMlSubsystemStatus } from '@/lib/admin-validation';
import type { AdminSystemReadinessView, SpeakingMode } from '@/types/admin';
import {
  CANONICAL_ML_SUBSYSTEMS,
  SPEAKING_MODE_LABELS,
  badgeClassForTone,
} from './system-readiness.helpers';

function renderSpeakingProfiles(profiles: unknown): React.ReactNode {
  if (profiles === undefined || profiles === null) {
    return (
      <span className="text-xs text-slateDark-600">
        ML không trả về danh sách speakingProfiles.
      </span>
    );
  }
  if (Array.isArray(profiles)) {
    if (profiles.length === 0) {
      return (
        <span className="text-xs text-slateDark-600">
          Không có profile nào được khai báo.
        </span>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {profiles.map((entry, idx) => (
          <span
            key={typeof entry === 'string' ? entry : `profile-${idx}`}
            className="rounded-full border border-brand-200 bg-brand-25 px-3 py-1 font-mono text-xs font-semibold text-brand-800"
          >
            {typeof entry === 'string' ? entry : JSON.stringify(entry)}
          </span>
        ))}
      </div>
    );
  }
  if (typeof profiles === 'object') {
    const entries = Object.entries(profiles as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <span className="text-xs text-slateDark-600">
          Không có profile nào được khai báo.
        </span>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map(([profileKey, value]) => {
          const parsed = parseMlSubsystemStatus(value);
          return (
            <div
              key={profileKey}
              className="flex items-center justify-between gap-2 rounded-xl border border-slateDark-100 bg-slateDark-25 px-3 py-2 text-xs"
            >
              <span className="font-mono font-semibold text-slateDark-900">
                {profileKey}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold ${badgeClassForTone(parsed.tone)}`}
              >
                {parsed.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <span className="font-mono text-xs text-slateDark-800">
      {String(profiles)}
    </span>
  );
}

interface SystemMlSectionProps {
  data: AdminSystemReadinessView;
  mlServiceReady: boolean;
  extraMlKeys: string[];
}

export function SystemMlSection({
  data,
  mlServiceReady,
  extraMlKeys,
}: SystemMlSectionProps): React.ReactElement {
  return (
    <>
      {/* ML Service Readiness card */}
      <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slateDark-900">
                ML Service Readiness (8 thành phần)
              </h2>
              <p className="text-xs text-slateDark-700">
                Hiển thị chi tiết từng thành phần AI kể cả khi ML trả về HTTP
                503 degraded.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold ${
                mlServiceReady
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : data.ml.reachable
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {data.ml.reachable
                ? `HTTP ${data.ml.httpStatus ?? '—'} · ${data.ml.status}`
                : `Unreachable · ${data.ml.status}`}
            </span>
          </div>
        </div>

        {!data.ml.reachable && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
            Không thể kết nối tới ML Service
            {data.ml.error ? `: ${data.ml.error}` : '.'}
          </div>
        )}

        {data.ml.reachable && data.ml.httpStatus === 503 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
            ML Service đang ở trạng thái suy giảm (HTTP 503 —{' '}
            <code className="font-mono">{data.ml.status}</code>). Kiểm tra từng
            thành phần bên dưới để xác định dịch vụ thiếu cấu hình hoặc
            artifact.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CANONICAL_ML_SUBSYSTEMS.map((subsystem) => {
            const parsed = parseMlSubsystemStatus(
              data.ml.components[subsystem.key],
              {
                optional: subsystem.optional,
                serviceReady: mlServiceReady,
              },
            );
            return (
              <div
                key={subsystem.key}
                className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slateDark-900">
                      {subsystem.label}
                    </p>
                    <p className="font-mono text-[10px] text-slateDark-600">
                      {subsystem.key}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${badgeClassForTone(parsed.tone)}`}
                  >
                    {parsed.label}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slateDark-700">
                  {parsed.detail ?? subsystem.description}
                </p>
              </div>
            );
          })}

          {extraMlKeys.map((extraKey) => {
            const parsed = parseMlSubsystemStatus(
              data.ml.components[extraKey],
              { serviceReady: mlServiceReady },
            );
            return (
              <div
                key={extraKey}
                className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-xs font-bold text-slateDark-900">
                    {extraKey}
                  </p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${badgeClassForTone(parsed.tone)}`}
                  >
                    {parsed.label}
                  </span>
                </div>
                {parsed.detail && (
                  <p className="mt-2 text-[11px] text-slateDark-700">
                    {parsed.detail}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 border-t border-slateDark-100 pt-4">
          <p className="mb-2 text-xs font-bold text-slateDark-900">
            Speaking Profiles (từ ML Service)
          </p>
          {renderSpeakingProfiles(data.ml.speakingProfiles)}
        </div>
      </section>

      {/* Voice Live & Speaking Modes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Radio className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slateDark-900">
                  Voice Live (Hội thoại thời gian thực)
                </h2>
                <p className="text-xs text-slateDark-700">
                  Cấu hình an toàn đang kích hoạt (không hiển thị khóa bí mật).
                </p>
              </div>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                data.voiceLive.enabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slateDark-200 bg-slateDark-50 text-slateDark-700'
              }`}
            >
              {data.voiceLive.enabled ? 'Đang bật' : 'Đang tắt'}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
              <dt className="text-[11px] text-slateDark-600">
                Trạng thái sẵn sàng
              </dt>
              <dd className="mt-1 font-mono font-bold text-slateDark-900">
                {data.voiceLive.status}
              </dd>
            </div>
            <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
              <dt className="text-[11px] text-slateDark-600">
                Thời lượng tối đa
              </dt>
              <dd className="mt-1 font-mono font-bold text-slateDark-900">
                {data.voiceLive.maxDurationSeconds} giây
              </dd>
            </div>
            <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
              <dt className="text-[11px] text-slateDark-600">Model</dt>
              <dd className="mt-1 truncate font-mono font-bold text-slateDark-900">
                {data.voiceLive.model || '—'}
              </dd>
            </div>
            <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
              <dt className="text-[11px] text-slateDark-600">
                Giọng đọc mặc định
              </dt>
              <dd className="mt-1 truncate font-mono font-bold text-slateDark-900">
                {data.voiceLive.voice || '—'}
              </dd>
            </div>
            <div className="col-span-2 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
              <dt className="text-[11px] text-slateDark-600">API Version</dt>
              <dd className="mt-1 font-mono font-bold text-slateDark-900">
                {data.voiceLive.apiVersion || '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Mic className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slateDark-900">
                  Chế độ Luyện nói (Speaking Modes)
                </h2>
                <p className="text-xs text-slateDark-700">
                  Profile chấm điểm:{' '}
                  <code className="rounded bg-slateDark-50 px-1.5 py-0.5 font-mono font-semibold text-slateDark-900">
                    {data.speaking.scoringProfile}
                  </code>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {(Object.keys(SPEAKING_MODE_LABELS) as SpeakingMode[]).map(
              (mode) => {
                const enabled = Boolean(data.speaking.modes[mode]);
                const meta = SPEAKING_MODE_LABELS[mode];
                return (
                  <div
                    key={mode}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slateDark-900">
                        {meta.label}
                      </p>
                      <p className="text-[11px] text-slateDark-700">
                        {meta.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        enabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slateDark-200 bg-white text-slateDark-600'
                      }`}
                    >
                      {enabled ? 'Đang bật' : 'Đang tắt'}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </section>
      </div>
    </>
  );
}
