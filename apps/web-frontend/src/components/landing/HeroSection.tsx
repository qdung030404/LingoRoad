import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Flame, Brain, ShieldCheck, PlayCircle, Sparkles } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-25/60 via-white to-slateDark-25 py-16 sm:py-24 lg:py-28">
      {/* Decorative Background Blur */}
      <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -left-32 h-80 w-80 rounded-full bg-brand-100/50 blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">

          {/* Left Column: Headlines & Call to Actions */}
          <div className="flex flex-col items-start lg:col-span-7">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-300 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-800 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
              <span>Phương pháp học tiếng Anh thông minh &amp; cá nhân hóa</span>
            </div>

            {/* Headline */}
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slateDark-900 sm:text-5xl lg:text-6xl lg:leading-[1.15]">
              Học tiếng Anh chuẩn xác theo{' '}
              <span className="text-brand-500 underline decoration-brand-300 decoration-wavy decoration-2 underline-offset-8">
                năng lực thực tế
              </span>{' '}
              của riêng bạn
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-lg leading-relaxed text-slateDark-700 sm:text-xl">
              Chấm dứt việc học vẹt và những bài học dàn trải. LingoRoad tự động điều chỉnh độ khó theo sức học của bạn,
              nhắc ôn từ vựng đúng thời điểm sắp quên và có <strong className="text-brand-700 font-semibold">Gia sư AI</strong> chỉ rõ lỗi sai tận tình.
            </p>

            {/* Value Highlights */}
            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-sm text-slateDark-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-500 flex-shrink-0" />
                <span>Đo chuẩn trình độ chỉ sau 15 câu hỏi</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-500 flex-shrink-0" />
                <span>Nhớ từ vựng lâu gấp 3 lần, giảm 40% giờ ôn</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-500 flex-shrink-0" />
                <span>Học chắc từ gốc, mở khóa bài như chơi game</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-500 flex-shrink-0" />
                <span>Gia sư AI 24/7 chỉ rõ vì sao bạn làm sai</span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="#simulator"
                className="btn-primary inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 text-base font-semibold shadow-md transition-all hover:scale-[1.02] hover:shadow-lg active:scale-100"
              >
                <Sparkles className="h-4 w-4 !text-white" />
                <span className="!text-white">Kiểm tra trình độ miễn phí</span>
                <ArrowRight className="h-4 w-4 !text-white" />
              </Link>

              <Link
                href="#methodology"
                className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-6 py-3.5 text-base font-semibold text-slateDark-800 shadow-sm transition-all hover:bg-slateDark-25 hover:border-slateDark-300"
              >
                <PlayCircle className="h-5 w-5 text-brand-600" />
                <span>Khám phá phương pháp học</span>
              </Link>
            </div>

            {/* Trust Metrics */}
            <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-slateDark-100 pt-6 text-xs text-slateDark-600">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                <span>Chuẩn khung tham chiếu Châu Âu (CEFR)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Brain className="h-4 w-4 text-brand-600" />
                <span>Học theo quy luật ghi nhớ não bộ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-amberGold-500" />
                <span>Tạo thói quen học đều đặn mỗi ngày</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive App Preview Showcase */}
          <div className="relative flex justify-center lg:col-span-5">
            <div className="relative w-full max-w-sm sm:max-w-md">

              {/* Outer Decorative Glow */}
              <div className="absolute inset-0 -m-6 rounded-3xl bg-gradient-to-tr from-brand-300/30 to-brand-500/20 blur-2xl" />

              {/* Mobile Phone Mockup Box */}
              <div className="relative mx-auto overflow-hidden rounded-[2.5rem] border-[6px] border-slateDark-900 bg-slateDark-900 p-2 shadow-2xl">
                {/* Speaker Notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 h-4 w-28 rounded-full bg-slateDark-900 flex items-center justify-center">
                  <div className="h-1.5 w-10 rounded-full bg-slateDark-700" />
                </div>

                <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[2rem] bg-white">
                  <Image
                    src="/assets/mobile_app_screenshot.jpg"
                    alt="Giao diện học tập LingoRoad trên điện thoại"
                    fill
                    className="object-cover object-top"
                    priority
                  />
                </div>
              </div>

              {/* Floating Overlay Badge 1: Learning Path */}
              <div className="absolute -left-6 top-16 z-20 rounded-2xl border border-white/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white font-bold text-sm shadow-sm">
                    A1
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slateDark-500">Lộ trình học</div>
                    <div className="text-sm font-bold text-slateDark-900">CEFR A1 • May đo riêng 🎯</div>
                  </div>
                </div>
              </div>

              {/* Floating Overlay Badge 2: Progress */}
              <div className="absolute -right-6 bottom-20 z-20 rounded-2xl border border-white/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slateDark-500">Tiến độ tuần này</div>
                    <div className="text-sm font-bold text-slateDark-900">Đã thuộc 35 từ • 2h 15p ✨</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
