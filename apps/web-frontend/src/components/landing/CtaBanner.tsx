import React from 'react';
import Link from 'next/link';
import { Smartphone, Sparkles, Download, CheckCircle } from 'lucide-react';

export const CtaBanner: React.FC = () => {
  return (
    <section id="cta" className="relative overflow-hidden bg-slateDark-900 py-20 text-white lg:py-24">
      {/* Decorative Gradients */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">

          {/* Content */}
          <div className="lg:col-span-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold text-brand-300">
              <Sparkles className="h-4 w-4 text-brand-400" />
              Bắt đầu học tiếng Anh thông minh ngay hôm nay
            </span>

            <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl lg:leading-tight">
              Biết chính xác trình độ tiếng Anh của bạn chỉ sau 15 phút
            </h2>

            <p className="mt-4 text-base text-slateDark-300 sm:text-lg max-w-2xl leading-relaxed">
              Tải ngay ứng dụng di động LingoRoad để trải nghiệm phương pháp ghi nhớ từ vựng chống quên, lộ trình bài học như chơi game và gia sư AI hoàn toàn miễn phí.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-slateDark-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-brand-400 flex-shrink-0" />
                <span>Không yêu cầu thẻ tín dụng</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-brand-400 flex-shrink-0" />
                <span>Kiểm tra trình độ nhanh chóng &amp; chính xác</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-brand-400 flex-shrink-0" />
                <span>Đồng bộ tiến độ học tập trên điện thoại</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="#simulator"
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold shadow-lg shadow-brand-500/25 transition-all hover:scale-105 active:scale-100"
              >
                <Sparkles className="h-5 w-5 !text-white" />
                <span className="!text-white">Kiểm tra trình độ miễn phí ngay</span>
              </Link>

              <a
                href="#download"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:border-white/30"
              >
                <Download className="h-5 w-5 text-brand-300" />
                <span>Tải bộ cài cho Android</span>
              </a>
            </div>
          </div>

          {/* Right Visual Badge with Download Anchor */}
          <div id="download" className="scroll-mt-24 flex justify-center lg:col-span-4">
            <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md text-center max-w-xs w-full shadow-2xl">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-500/20 border border-brand-500/40">
                <Smartphone className="h-10 w-10 text-brand-400" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">LingoRoad Mobile</h3>
              <p className="mt-2 text-xs text-slateDark-400">
                Hỗ trợ mượt mà trên Android và iOS. Giao diện trực quan, bắt mắt và dễ sử dụng.
              </p>
              <div className="mt-5 rounded-xl bg-slateDark-800/80 p-3 border border-slateDark-700">
                <div className="text-[11px] font-medium text-brand-300">Đã sẵn sàng tải về trải nghiệm</div>
                <div className="mt-1 text-[11px] text-slateDark-400">Dự án Đồ án Tốt nghiệp</div>
              </div>
              <a
                href="https://github.com/qdung030404/LingoRoad/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-5 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold shadow-md transition-all hover:scale-[1.02]"
              >
                <Download className="h-4 w-4 !text-white" />
                <span className="!text-white">Tải file cài APK (Android)</span>
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
