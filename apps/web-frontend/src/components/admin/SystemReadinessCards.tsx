import React from 'react';
import {
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Mic,
  Radio,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { AdminSystemReadinessView, SpeakingMode } from '@/types/admin';

const CANONICAL_ML_SUBSYSTEMS: ReadonlyArray<{
  key: string;
  label: string;
  description: string;
}> = [
  {
    key: 'cat',
    label: 'CAT (Kiểm tra thích ứng)',
    description: 'Chọn câu hỏi IRT & ước lượng năng lực đầu vào',
  },
  {
    key: 'llm',
    label: 'LLM (Phản hồi AI)',
    description: 'Giải thích bài học, đánh giá viết và tư vấn học tập',
  },
  {
    key: 'rag',
    label: 'RAG (Truy xuất tri thức)',
    description: 'Ngữ cảnh học liệu cho phản hồi thông minh',
  },
  {
    key: 'speech',
    label: 'Speech (ASR cơ bản)',
    description: 'Nhận diện giọng nói và chấm đọc cơ bản',
  },
  {
    key: 'speech_azure',
    label: 'Speech Azure',
    description: 'Chấm điểm phát âm Read Aloud / Tongue Twister',
  },
  {
    key: 'speech_topic',
    label: 'Speech Topic',
    description: 'Chấm phát âm nói tự do (Topic & Picture)',
  },
  {
    key: 'speaking_content',
    label: 'Speaking Content',
    description: 'Chấm nội dung từ vựng, ngữ pháp và bám sát đề',
  },
  {
    key: 'kt',
    label: 'Knowledge Tracing (KT)',
    description: 'Theo dõi mức độ nắm vững kỹ năng theo thời gian',
  },
];

const SPEAKING_MODE_LABELS: Record<
  SpeakingMode,
  { label: string; description: string }
> = {
  READ_ALOUD: {
    label: 'Read Aloud (Đọc to)',
    description: 'Chấm phát âm theo văn bản mẫu',
  },
  TOPIC: {
    label: 'Topic Speaking (Chủ đề)',
    description: 'Nói tự do theo gợi ý & chấm nội dung AI',
  },
  PICTURE_DESCRIPTION: {
    label: 'Picture Description (Mô tả tranh)',
    description: 'Mô tả hình ảnh & chấm ngữ cảnh trực quan',
  },
  TONGUE_TWISTER: {
    label: 'Tongue Twister (Xoắn lưỡi)',
    description: 'Trò chơi luyện phát âm tính sao',
  },
};

interface ParsedSubsystemStatus {
  label: string;
  tone: 'ready' | 'warn' | 'error' | 'muted';
  detail?: string;
}

function parseSubsystemStatus(raw: unknown): ParsedSubsystemStatus {
  if (raw === undefined || raw === null) {
    return { label: 'Chưa có dữ liệu', tone: 'muted' };
  }
  if (typeof raw === 'boolean') {
    return raw
      ? { label: 'ready', tone: 'ready' }
      : { label: 'unavailable', tone: 'error' };
  }
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'ready' || normalized === 'ok' || normalized === 'healthy') {
      return { label: raw, tone: 'ready' };
    }
    if (
      normalized === 'cold' ||
      normalized === 'degraded' ||
      normalized === 'warming' ||
      normalized === 'partial'
    ) {
      return { label: raw, tone: 'warn' };
    }
    return { label: raw, tone: 'error' };
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const rawStatus =
      typeof obj.status === 'string'
        ? obj.status
        : typeof obj.ready === 'boolean'
          ? obj.ready
            ? 'ready'
            : 'not_ready'
          : 'unknown';
    const base = parseSubsystemStatus(rawStatus);
    const detail =
      typeof obj.reason === 'string'
        ? obj.reason
        : typeof obj.error === 'string'
          ? obj.error
          : typeof obj.message === 'string'
            ? obj.message
            : undefined;
    return { ...base, detail };
  }
  return { label: String(raw), tone: 'muted' };
}

function badgeClassForTone(tone: ParsedSubsystemStatus['tone']): string {
  switch (tone) {
    case 'ready':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'warn':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'error':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slateDark-50 text-slateDark-700 border-slateDark-200';
  }
}

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
          const parsed = parseSubsystemStatus(value);
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

export function SystemDatabaseSection({
  data,
}: {
  data: AdminSystemReadinessView;
}): React.ReactElement {
  return (
    <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slateDark-900">
              Backend & Cơ sở dữ liệu
            </h2>
            <p className="text-xs text-slateDark-700">
              Kiểm tra kết nối PostgreSQL, phiên bản máy chủ, xác thực và lưu trữ media.
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            data.database.status === 'ready'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {data.database.status === 'ready' ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          <span>
            {data.database.status === 'ready'
              ? `DB Sẵn sàng (${data.database.latencyMs} ms)`
              : `DB Gián đoạn (${data.database.latencyMs} ms)`}
          </span>
        </span>
      </div>

      {data.database.error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          Lỗi kết nối DB: {data.database.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
            Độ trễ DB Ping
          </p>
          <p className="mt-1 font-mono text-lg font-extrabold text-slateDark-900">
            {data.database.latencyMs} ms
          </p>
        </div>

        <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
            Phiên bản Backend
          </p>
          <p className="mt-1 font-mono text-lg font-extrabold text-slateDark-900">
            {data.appVersion}
          </p>
        </div>

        <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
            <span>Auth Provider</span>
          </p>
          <p className="mt-1 font-mono text-lg font-extrabold text-slateDark-900">
            {data.authProvider}
          </p>
        </div>

        <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slateDark-600">
            <HardDrive className="h-3.5 w-3.5 text-brand-600" />
            <span>Media Storage</span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-lg font-extrabold uppercase text-slateDark-900">
              {data.mediaStorage.mode}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                data.mediaStorage.azureConfigured
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slateDark-100 text-slateDark-700'
              }`}
            >
              {data.mediaStorage.azureConfigured
                ? 'Azure OK'
                : data.mediaStorage.azureRequired
                  ? 'Thiếu Azure'
                  : 'Local'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SystemMlReadinessSection({
  data,
}: {
  data: AdminSystemReadinessView;
}): React.ReactElement {
  const extraMlKeys = Object.keys(data.ml.components).filter(
    (key) => !CANONICAL_ML_SUBSYSTEMS.some((sub) => sub.key === key),
  );

  return (
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
              Hiển thị chi tiết từng thành phần AI kể cả khi ML trả về HTTP 503 degraded.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold ${
              data.ml.reachable && data.ml.httpStatus === 200
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
          thành phần bên dưới để xác định dịch vụ thiếu cấu hình hoặc artifact.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CANONICAL_ML_SUBSYSTEMS.map((subsystem) => {
          const parsed = parseSubsystemStatus(data.ml.components[subsystem.key]);
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
          const parsed = parseSubsystemStatus(data.ml.components[extraKey]);
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
  );
}

export function SystemVoiceAndSpeakingSection({
  data,
}: {
  data: AdminSystemReadinessView;
}): React.ReactElement {
  return (
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
            <dt className="text-[11px] text-slateDark-600">Trạng thái sẵn sàng</dt>
            <dd className="mt-1 font-mono font-bold text-slateDark-900">
              {data.voiceLive.status}
            </dd>
          </div>
          <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
            <dt className="text-[11px] text-slateDark-600">Thời lượng tối đa</dt>
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
            <dt className="text-[11px] text-slateDark-600">Giọng đọc mặc định</dt>
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
          {(Object.keys(SPEAKING_MODE_LABELS) as SpeakingMode[]).map((mode) => {
            const enabled = Boolean(data.speaking.modes[mode]);
            const meta = SPEAKING_MODE_LABELS[mode];
            return (
              <div
                key={mode}
                className="flex items-center justify-between gap-3 rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slateDark-900">{meta.label}</p>
                  <p className="text-[11px] text-slateDark-700">{meta.description}</p>
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
          })}
        </div>
      </section>
    </div>
  );
}
