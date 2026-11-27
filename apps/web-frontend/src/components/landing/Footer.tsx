import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Globe, Mail } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slateDark-100 bg-white text-slateDark-600">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">

          {/* Brand Info */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 border border-brand-200">
                <Image
                  src="/assets/brand_mark.svg"
                  alt="LingoRoad Logo"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold tracking-tight text-slateDark-900">
                Lingo<span className="text-brand-500">Road</span>
              </span>
            </Link>

            <p className="mt-4 text-sm leading-relaxed text-slateDark-600 max-w-sm">
              Nền tảng học tiếng Anh thích ứng thông minh, giúp người học ghi nhớ từ vựng bền vững,
              học đúng trình độ thực tế và tự tin giao tiếp cùng Trợ lý AI.
            </p>

            <div className="mt-4 flex items-center gap-2 text-xs text-slateDark-600">
              <Mail className="h-3.5 w-3.5 text-brand-600 flex-shrink-0" />
              <a
                href="mailto:support@lingoroad.app"
                className="font-medium text-slateDark-700 transition-colors hover:text-brand-600"
              >
                support@lingoroad.app
              </a>
            </div>
          </div>

          {/* Column 1: Khám phá */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slateDark-900">
              Khám phá
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/#features" className="hover:text-brand-600 transition-colors">
                  Tính năng nổi bật
                </Link>
              </li>
              <li>
                <Link href="/#methodology" className="hover:text-brand-600 transition-colors">
                  Phương pháp học
                </Link>
              </li>
              <li>
                <Link href="/#simulator" className="hover:text-brand-600 transition-colors">
                  Trải nghiệm thử
                </Link>
              </li>
              <li>
                <Link href="/#comparison" className="hover:text-brand-600 transition-colors">
                  So sánh ưu việt
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-brand-600 transition-colors">
                  Hỏi đáp (FAQ)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Ứng dụng */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slateDark-900">
              Ứng dụng
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/#download" className="hover:text-brand-600 transition-colors">
                  Tải APK cho Android
                </Link>
              </li>
              <li>
                <span className="text-slateDark-500">Phiên bản iOS (Sắp ra mắt)</span>
              </li>
              <li>
                <span className="text-slateDark-500">Chuẩn khung tham chiếu CEFR</span>
              </li>
              <li>
                <span className="text-slateDark-500">Đồng bộ tiến độ đa phiên học</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Pháp lý & Hỗ trợ */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slateDark-900">
              Pháp lý &amp; Hỗ trợ
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-brand-600 transition-colors">
                  Chính sách bảo mật
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-brand-600 transition-colors">
                  Điều khoản sử dụng
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@lingoroad.app"
                  className="hover:text-brand-600 transition-colors"
                >
                  Liên hệ: support@lingoroad.app
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between border-t border-slateDark-100 pt-8 text-xs text-slateDark-500 gap-4">
          <div>© 2026 LingoRoad. Bảo lưu mọi quyền.</div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/privacy" className="hover:text-brand-600 transition-colors">
              Chính sách bảo mật
            </Link>
            <Link href="/terms" className="hover:text-brand-600 transition-colors">
              Điều khoản sử dụng
            </Link>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-slateDark-400" />
              <span>GMT+7 (Asia/Ho_Chi_Minh)</span>
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
