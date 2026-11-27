import React from 'react';
import Image from 'next/image';

interface LingoRoadWordmarkProps {
  variant?: 'dark' | 'light';
  subtitle?: string;
}

export function LingoRoadWordmark({
  variant = 'dark',
  subtitle = 'Admin Portal',
}: LingoRoadWordmarkProps): React.ReactElement {
  const isLight = variant === 'light';

  return (
    <div className="inline-flex select-none items-center gap-3">
      <div
        className={
          isLight
            ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm'
            : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50'
        }
      >
        <Image
          src="/assets/brand_mark.svg"
          alt="LingoRoad Logo"
          width={26}
          height={26}
          priority
          className="object-contain"
        />
      </div>

      <div className="flex flex-col leading-tight">
        <span
          className={
            isLight
              ? 'text-xl font-bold tracking-tight text-white'
              : 'text-lg font-bold tracking-tight text-slateDark-900'
          }
        >
          Lingo
          <span className={isLight ? 'text-brand-300' : 'text-brand-500'}>
            Road
          </span>
        </span>
        {subtitle && (
          <span
            className={
              isLight
                ? 'text-[10px] font-semibold uppercase tracking-wider text-brand-200/85'
                : 'text-[10px] font-semibold uppercase tracking-wider text-slateDark-500'
            }
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
