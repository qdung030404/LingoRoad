import React from 'react';
import type { CefrAttemptStat, LearningTrendPoint } from '@/types/admin';

export function formatDashboardDateTime(iso: string): string {
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

export function TrendSvgChart({
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
              idx % Math.max(1, Math.floor(attemptPoints.length / 5)) ===
                0) && (
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
          <span className="h-2 w-4 rounded bg-emerald-600" /> Lượt học
          (Attempts)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-500" />{' '}
          Học viên hoạt động (Active Users)
        </span>
      </div>
    </div>
  );
}

export function CefrBarChart({
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
