import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Globe, Heart } from 'lucide-react';

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

            <div className="mt-4 text-xs text-slateDark-500">
              Đồ án Tốt nghiệp Kỹ sư Công nghệ Thông tin (Graduation Thesis)
            </div>
          </div>

          {/* Column 1: Khám phá */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slateDark-900">
              Tính năng nổi bật
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="#features" className="hover:text-brand-600 transition-colors">
                  Kiểm tra trình độ nhanh
                </Link>
              </li>
              <li>
                <Link href="#features" className="hover:text-brand-600 transition-colors">
                  Lộ trình cây kỹ năng
                </Link>
              </li>
              <li>
                <Link href="#features" className="hover:text-brand-600 transition-colors">
                  Sổ tay từ vựng chống quên
                </Link>
              </li>
              <li>
                <Link href="#features" className="hover:text-brand-600 transition-colors">
                  Gia sư AI sửa lỗi 24/7
                </Link>
              </li>
              <li>
                <Link href="#features" className="hover:text-brand-600 transition-colors">
                  Luyện nói &amp; sửa phát âm
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Phương pháp */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slateDark-900">
              Phương pháp học
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="#methodology" className="hover:text-brand-600 transition-colors">
                  Đo trình độ thích ứng
                </Link>
              </li>
              <li>
                <Link href="#methodology" className="hover:text-brand-600 transition-colors">
                  Quy luật ghi nhớ từ vựng
                </Link>
              </li>
              <li>
                <Link href="#methodology" className="hover:text-brand-600 transition-colors">
                  Học từ gốc rễ đến nâng cao
                </Link>
              </li>
              <li>
                <Link href="#methodology" className="hover:text-brand-600 transition-colors">
                  Gia sư AI đồng hành
                </Link>
              </li>
              <li>
                <Link href="#simulator" className="hover:text-brand-600 transition-colors">
                  Trải nghiệm tính năng thử
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Liên kết */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-slateDark-900">
              Hệ thống
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <span className="text-slateDark-500">Ứng dụng di động Flutter</span>
              </li>
              <li>
                <span className="text-slateDark-500">Hệ thống dịch vụ API NestJS</span>
              </li>
              <li>
                <span className="text-slateDark-500">Mô hình AI &amp; Xử lý giọng nói</span>
              </li>
              <li>
                <span className="text-slateDark-500">Đồng bộ đám mây</span>
              </li>
              <li>
                <Link href="#faq" className="hover:text-brand-600 transition-colors">
                  Hỏi đáp (FAQ)
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between border-t border-slateDark-100 pt-8 text-xs text-slateDark-500 gap-4">
          <div className="flex items-center gap-1">
            <span>© 2026 LingoRoad. Xây dựng với</span>
            <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
            <span>cho Đồ án Tốt nghiệp.</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-slateDark-400" />
              <span>Múi giờ: GMT+7 (Asia/Ho_Chi_Minh)</span>
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
