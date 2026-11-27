import React from 'react';

type StatTone = 'green' | 'emerald' | 'amber' | 'slate';

interface LegacyStatCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  tone?: StatTone;
}

const ICON_TONE_CLASSES: Record<StatTone, string> = {
  green: 'bg-brand-25 text-brand-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slateDark-50 text-slateDark-800',
};

const CORNER_TONE_CLASSES: Record<StatTone, string> = {
  green: 'bg-brand-50/75',
  emerald: 'bg-emerald-50/80',
  amber: 'bg-amber-50/80',
  slate: 'bg-slateDark-100/70',
};

export function LegacyStatCard({
  label,
  value,
  subtitle,
  icon,
  tone = 'green',
}: LegacyStatCardProps): React.ReactElement {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm transition hover:border-brand-200">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-slateDark-700">{label}</span>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ICON_TONE_CLASSES[tone]}`}
        >
          {icon}
        </div>
      </div>

      <p className="relative z-10 mt-3 text-3xl font-extrabold tracking-tight text-slateDark-900">
        {value}
      </p>
      <p className="relative z-10 mt-1 text-xs text-slateDark-700">
        {subtitle}
      </p>

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-5 -right-5 h-16 w-16 rounded-full ${CORNER_TONE_CLASSES[tone]}`}
      />
    </div>
  );
}
