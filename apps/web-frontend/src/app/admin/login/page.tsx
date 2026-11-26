'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { LingoRoadWordmark } from '@/components/admin/LingoRoadWordmark';
import {
  adminLogin,
  getStoredAdminSession,
} from '@/lib/admin-api';

export default function AdminLoginPage(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const existing = getStoredAdminSession();
    if (existing?.user?.role === 'ADMIN') {
      router.replace('/admin');
    }
  }, [router]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    try {
      await adminLogin(email.trim(), password);
      router.replace('/admin');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Không thể kết nối máy chủ xác thực.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slateDark-25 px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slateDark-100 bg-white shadow-xl md:grid-cols-2">
        {/* Cột trái thương hiệu LingoRoad Admin */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#164427] via-[#123820] to-[#0B2414] p-8 text-white sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full border-[36px] border-white/[0.06]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full border-[22px] border-brand-400/10"
          />

          <div className="relative z-10">
            <LingoRoadWordmark variant="light" subtitle="Admin Portal" />

            <p className="mt-10 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-300">
              Content Operations
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-white">
              Điều hành trải nghiệm học tập từ một nơi.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Theo dõi chất lượng nội dung, hoạt động người học và quản lý kho
              bài tập hệ thống bằng dữ liệu thật.
            </p>
          </div>

          <div className="relative z-10 mt-10 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-300">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  Insight tập trung
                </p>
                <p className="text-xs text-white/70">
                  Tổng quan người dùng, bài học và độ chính xác rõ ràng.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-300">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  Truy cập được bảo vệ
                </p>
                <p className="text-xs text-white/70">
                  Role Admin được xác minh trực tiếp trên mọi request.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải form đăng nhập */}
        <div className="flex flex-col justify-center bg-white p-8 sm:p-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-25 px-3 py-1 text-xs font-semibold text-brand-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" />
              <span>Khu vực quản trị an toàn</span>
            </span>

            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-slateDark-900">
              Chào mừng trở lại
            </h2>
            <p className="mt-1 text-sm text-slateDark-800">
              Đăng nhập để tiếp tục quản trị LingoRoad.
            </p>
          </div>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="mt-6 space-y-4"
          >
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}

            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-xs font-semibold text-slateDark-800"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@lingoroad.local"
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-3 text-sm text-slateDark-900 focus:border-brand-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-xs font-semibold text-slateDark-800"
              >
                Mật khẩu
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu quản trị"
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-3 text-sm text-slateDark-900 focus:border-brand-500 focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full rounded-xl py-3 text-sm font-semibold shadow-sm disabled:opacity-50"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>

            <p className="text-center text-xs text-slateDark-700">
              Thông tin phiên được lưu cục bộ và tự làm mới an toàn.
            </p>
          </form>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slateDark-800 hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Quay lại trang giới thiệu LingoRoad</span>
        </Link>
      </div>
    </div>
  );
}
