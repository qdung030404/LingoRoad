import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Không tìm thấy trang',
  description: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển trên LingoRoad.',
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slateDark-25 px-4 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-slateDark-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <Link href="/" className="mx-auto inline-flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-200 bg-brand-50">
            <Image
              src="/assets/brand_mark.svg"
              alt="LingoRoad Logo"
              width={28}
              height={28}
              className="object-contain"
            />
          </div>
          <span className="text-xl font-bold tracking-tight text-slateDark-900">
            Lingo<span className="text-brand-500">Road</span>
          </span>
        </Link>

        <div className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 text-brand-600">
          <Compass className="h-8 w-8" />
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-brand-700">
          Lỗi 404
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slateDark-900 sm:text-3xl">
          Không tìm thấy trang bạn yêu cầu
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slateDark-600">
          Đường dẫn này có thể đã thay đổi, bị xóa hoặc nhập chưa chính xác. Bạn có thể quay lại trang chủ để tiếp tục khám phá LingoRoad.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-sm"
          >
            <ArrowLeft className="h-4 w-4 !text-white" />
            <span className="!text-white">Quay về trang chủ</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
