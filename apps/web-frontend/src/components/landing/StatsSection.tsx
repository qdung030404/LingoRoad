'use client';

import React from 'react';
import { StatItem } from '@/types/landing';
import { STATS_DATA } from '@/data/landing-content';

export const StatsSection: React.FC = () => {
  return (
    <section className="border-y border-slateDark-100 bg-white py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STATS_DATA.map((stat: StatItem) => (
            <div
              key={stat.id}
              className="relative flex flex-col justify-between rounded-2xl border border-slateDark-100 bg-slateDark-25/50 p-6 transition-all hover:border-brand-300 hover:bg-brand-25/30 hover:shadow-sm"
            >
              <div>
                {stat.badge && (
                  <span className="inline-block rounded-md bg-brand-100 px-2.5 py-1 text-[11px] font-bold text-brand-800">
                    {stat.badge}
                  </span>
                )}
                <div className="mt-4 text-3xl font-extrabold tracking-tight text-slateDark-900 lg:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm font-semibold text-brand-700">
                  {stat.label}
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slateDark-600">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
