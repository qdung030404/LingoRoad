'use client';

import React from 'react';
import { Check, X, Sparkles } from 'lucide-react';
import { ModelComparison } from '@/types/landing';
import { COMPARISONS } from '@/data/landing-content';

export const ComparisonSection: React.FC = () => {
  return (
    <section id="comparison" className="scroll-mt-20 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Title */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 border border-brand-200">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            So sánh trực quan
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slateDark-900 sm:text-4xl">
            Vì sao học cùng LingoRoad hiệu quả hơn cách cũ?
          </h2>
          <p className="mt-3 text-base text-slateDark-700">
            Xem ngay sự khác biệt rõ rệt giữa cách học truyền thống gò bó và phương pháp học thích ứng thông minh.
          </p>
        </div>

        {/* Table Comparison Container */}
        <div className="mt-14 overflow-hidden rounded-2xl border border-slateDark-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slateDark-200 bg-slateDark-50">
                  <th className="py-4 px-6 text-sm font-bold text-slateDark-800 w-1/4">
                    Nhu cầu học tập
                  </th>
                  <th className="py-4 px-6 text-sm font-semibold text-slateDark-500 w-3/8">
                    Cách học truyền thống / App thông thường
                  </th>
                  <th className="py-4 px-6 text-sm font-bold text-brand-700 bg-brand-50/80 w-3/8">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-brand-500 animate-pulse" />
                      <span>Giải pháp LingoRoad</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slateDark-100 text-sm">
                {COMPARISONS.map((item: ModelComparison, idx: number) => (
                  <tr key={idx} className="hover:bg-slateDark-25/50 transition-colors">
                    <td className="py-5 px-6 font-semibold text-slateDark-900 align-top">
                      {item.feature}
                    </td>
                    <td className="py-5 px-6 text-slateDark-600 align-top">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 flex-shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </div>
                        <span className="leading-relaxed">{item.traditional}</span>
                      </div>
                    </td>
                    <td className="py-5 px-6 text-slateDark-900 bg-brand-25/30 font-medium align-top">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white flex-shrink-0">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <span className="leading-relaxed font-semibold text-slateDark-900">
                          {item.lingoRoad}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
};
