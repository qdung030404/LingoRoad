'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    if (error.digest) {
      console.error('Unhandled page error digest:', error.digest);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slateDark-25 px-4 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-slateDark-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200 bg-amberGold-50 text-amber-600">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-slateDark-900 sm:text-3xl">
          Đã có sự cố xảy ra
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slateDark-600">
          Hệ thống gặp lỗi tạm thời khi tải nội dung trang này. Vui lòng thử tải lại hoặc quay về trang chủ.
        </p>

        {error.digest && (
          <p className="mt-4 inline-block rounded-lg bg-slateDark-50 px-3 py-1.5 font-mono text-xs text-slateDark-500">
            Mã tham chiếu: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-sm"
          >
            <RotateCcw className="h-4 w-4 !text-white" />
            <span className="!text-white">Thử lại</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slateDark-200 bg-white px-6 py-3 text-sm font-semibold text-slateDark-800 transition-colors hover:bg-slateDark-50"
          >
            <Home className="h-4 w-4 text-slateDark-600" />
            <span>Về trang chủ</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
