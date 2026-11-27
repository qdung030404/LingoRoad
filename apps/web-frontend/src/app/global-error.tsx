'use client';

import { useEffect } from 'react';
import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (error.digest) {
      console.error('Unhandled root error digest:', error.digest);
    }
  }, [error]);

  return (
    <html lang="vi">
      <body className="min-h-screen bg-slateDark-25 text-slateDark-900 antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg rounded-3xl border border-slateDark-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="text-xl font-bold tracking-tight text-slateDark-900">
              Lingo<span className="text-brand-500">Road</span>
            </div>

            <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-slateDark-900 sm:text-3xl">
              Ứng dụng gặp sự cố ngoài ý muốn
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slateDark-600">
              Rất tiếc vì sự bất tiện này. Bạn vui lòng tải lại trang hoặc quay về trang chủ để tiếp tục.
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
                className="btn-primary inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold shadow-sm"
              >
                <span className="!text-white">Thử lại</span>
              </button>

              <a
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-slateDark-200 bg-white px-6 py-3 text-sm font-semibold text-slateDark-800 transition-colors hover:bg-slateDark-50"
              >
                Về trang chủ
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
