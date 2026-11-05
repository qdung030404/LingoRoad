'use client';

import React from 'react';
import { Target, GitFork, RotateCw, Bot, Award, Mic } from 'lucide-react';
import { FeatureItem } from '@/types/landing';
import { FEATURES_DATA } from '@/data/landing-content';

export const FeaturesSection: React.FC = () => {
  const getIcon = (name: FeatureItem['iconName']): React.ReactNode => {
    switch (name) {
      case 'target':
        return <Target className="h-6 w-6 text-brand-600" />;
      case 'gitBranch':
        return <GitFork className="h-6 w-6 text-brand-600" />;
      case 'repeat':
        return <RotateCw className="h-6 w-6 text-brand-600" />;
      case 'bot':
        return <Bot className="h-6 w-6 text-brand-600" />;
      case 'mic':
        return <Mic className="h-6 w-6 text-brand-600" />;
      case 'award':
        return <Award className="h-6 w-6 text-amberGold-500" />;
      default:
        return <Target className="h-6 w-6 text-brand-600" />;
    }
  };

  return (
    <section id="features" className="scroll-mt-20 bg-slateDark-25/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-brand-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-800">
            Hệ sinh thái tính năng
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slateDark-900 sm:text-4xl">
            Các tính năng thông minh giúp bạn học nhanh &amp; nhớ lâu
          </h2>
          <p className="mt-4 text-base text-slateDark-700 sm:text-lg">
            Mỗi tính năng của LingoRoad được thiết kế xoay quanh trải nghiệm của người học,
            giúp bạn bớt mệt mỏi nhưng tiến bộ rõ rệt sau từng ngày.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES_DATA.map((item: FeatureItem) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between rounded-2xl border border-slateDark-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-400 hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 border border-brand-200 transition-colors group-hover:bg-brand-100">
                    {getIcon(item.iconName)}
                  </div>
                  <span className="rounded-full bg-slateDark-50 px-2.5 py-0.5 text-xs font-semibold text-slateDark-700">
                    {item.tag}
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold text-slateDark-900 group-hover:text-brand-700 transition-colors">
                  {item.title}
                </h3>
                <div className="mt-1 text-xs font-medium text-brand-600">
                  {item.subtitle}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slateDark-700">
                  {item.description}
                </p>
              </div>

              <div className="mt-6 border-t border-slateDark-100 pt-4">
                <ul className="space-y-2 text-xs font-medium text-slateDark-800">
                  {item.highlights.map((highlight: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
