'use client';

import React, { useState } from 'react';
import { ChevronDown, MessageCircleQuestion } from 'lucide-react';
import { FaqItem } from '@/types/landing';
import { FAQ_DATA } from '@/data/landing-content';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleAccordion = (index: number): void => {
    setOpenIndex((prev: number | null) => (prev === index ? null : index));
  };

  return (
    <section id="faq" className="scroll-mt-20 bg-slateDark-25/40 py-20 lg:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-800">
            <MessageCircleQuestion className="h-3.5 w-3.5 text-brand-700" />
            Giải đáp thắc mắc
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slateDark-900 sm:text-4xl">
            Các câu hỏi thường gặp
          </h2>
          <p className="mt-3 text-base text-slateDark-700">
            Mọi điều bạn cần biết trước khi bắt đầu hành trình học tiếng Anh cùng LingoRoad.
          </p>
        </div>

        {/* Accordion List */}
        <div className="mt-12 space-y-4">
          {FAQ_DATA.map((faq: FaqItem, idx: number) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-slateDark-200 bg-white shadow-sm transition-all hover:border-brand-300"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(idx)}
                  className="flex w-full items-center justify-between p-6 text-left focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-base sm:text-lg font-bold text-slateDark-900 pr-4">
                    {faq.question}
                  </span>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg bg-slateDark-50 text-slateDark-600 transition-transform duration-200 flex-shrink-0 ${
                      isOpen ? 'rotate-180 bg-brand-50 text-brand-700' : ''
                    }`}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slateDark-100 px-6 pb-6 pt-3 text-sm sm:text-base leading-relaxed text-slateDark-700">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
