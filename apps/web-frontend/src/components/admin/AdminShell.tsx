'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileUp,
  LayoutGrid,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import {
  adminLogout,
  clearAdminSession,
  getAdminMe,
  getStoredAdminSession,
  saveAdminSession,
} from '@/lib/admin-api';
import type { AdminUser } from '@/types/admin';
import { LingoRoadWordmark } from './LingoRoadWordmark';

interface AdminShellProps {
  breadcrumbTitle: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: (currentAdmin: AdminUser) => React.ReactNode;
}

const PRIMARY_NAV = [
  {
    href: '/admin',
    label: 'Tổng quan',
    icon: LayoutGrid,
    exact: true,
  },
  {
    href: '/admin/users',
    label: 'Người dùng',
    icon: Users,
    exact: false,
  },
] as const;

const CONTENT_NAV = [
  {
    href: '/admin/lessons',
    label: 'Bài học',
    icon: BookOpen,
    exact: false,
  },
  {
    href: '/admin/items',
    label: 'Items',
    icon: ClipboardList,
    exact: false,
  },
  {
    href: '/admin/import',
    label: 'Import',
    icon: FileUp,
    exact: false,
  },
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AdminShell({
  breadcrumbTitle,
  title,
  subtitle,
  actions,
  children,
}: AdminShellProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const verify = async (): Promise<void> => {
      const session = getStoredAdminSession();
      if (!session) {
        router.replace('/admin/login');
        return;
      }
      try {
        const freshAdmin = await getAdminMe();
        if (!active) return;
        if (freshAdmin.role !== 'ADMIN') {
          clearAdminSession();
          router.replace('/admin/login');
          return;
        }
        saveAdminSession({ ...session, user: freshAdmin });
        setAdmin(freshAdmin);
      } catch {
        if (!active) return;
        clearAdminSession();
        router.replace('/admin/login');
      } finally {
        if (active) setChecking(false);
      }
    };

    void verify();
    return () => {
      active = false;
    };
  }, [router]);

  const handleLogout = async (): Promise<void> => {
    await adminLogout();
    router.replace('/admin/login');
  };

  if (checking || !admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slateDark-25 px-4">
        <div className="rounded-2xl border border-slateDark-100 bg-white px-8 py-6 text-center shadow-sm">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm font-medium text-slateDark-800">
            Đang xác thực phiên Quản trị viên...
          </p>
        </div>
      </div>
    );
  }

  const renderNavItem = (
    item: (typeof PRIMARY_NAV)[number] | (typeof CONTENT_NAV)[number],
    onNavigate?: () => void,
  ): React.ReactElement => {
    const isActive = item.exact
      ? pathname === item.href
      : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={
          isActive
            ? 'flex items-center gap-3 rounded-xl bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-800 transition'
            : 'flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium text-slateDark-800 transition hover:bg-slateDark-50 hover:text-slateDark-900'
        }
      >
        <Icon
          className={
            isActive
              ? 'h-4 w-4 shrink-0 text-brand-600'
              : 'h-4 w-4 shrink-0 text-slateDark-600'
          }
        />
        <span>{item.label}</span>
      </Link>
    );
  };

  const renderSidebarBody = (onNavigate?: () => void): React.ReactElement => (
    <>
      <div className="px-5 pb-3 pt-4">
        <Link href="/admin" onClick={onNavigate}>
          <LingoRoadWordmark variant="dark" subtitle="Admin Portal" />
        </Link>
      </div>

      <div className="flex-1 space-y-4 px-3 py-2">
        <div>
          <p className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slateDark-600">
            Quản trị
          </p>
          <div className="space-y-1">
            {PRIMARY_NAV.map((item) => renderNavItem(item, onNavigate))}
          </div>
        </div>

        <div>
          <p className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slateDark-600">
            Nội dung & Vận hành
          </p>
          <div className="space-y-1">
            {CONTENT_NAV.map((item) => renderNavItem(item, onNavigate))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 border-t border-slateDark-100 p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-slateDark-100 bg-slateDark-25 px-3 py-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slateDark-900">
              Vùng bảo vệ
            </p>
            <p className="text-[11px] text-slateDark-700">Role Admin</p>
          </div>
        </div>

        <Link
          href="/"
          className="flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-medium text-slateDark-800 transition hover:bg-slateDark-50"
        >
          <span>Trang giới thiệu</span>
          <ExternalLink className="h-3.5 w-3.5 text-slateDark-600" />
        </Link>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slateDark-800 transition hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slateDark-25 text-slateDark-900">
      {/* Sidebar Desktop cố định tuyệt đối bên trái */}
      <aside className="hidden w-60 flex-col border-r border-slateDark-100 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex">
        {renderSidebarBody()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slateDark-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col overflow-y-auto bg-white shadow-xl">
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebarBody(() => setMobileMenuOpen(false))}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-60">
        {/* Topbar kiểu Legacy */}
        <header className="flex h-16 items-center justify-between border-b border-slateDark-100 bg-white px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Mở menu điều hướng"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slateDark-200 text-slateDark-900 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-[11px] font-medium text-slateDark-700">
                Không gian quản trị
              </p>
              <p className="text-sm font-semibold text-slateDark-900">
                {breadcrumbTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#123820] text-xs font-bold text-white">
              {getInitials(admin.name)}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-bold leading-tight text-slateDark-900">
                {admin.name}
              </p>
              <p className="text-[11px] text-slateDark-700">Admin</p>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
                LingoRoad Admin
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slateDark-900 sm:text-[28px]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-slateDark-800">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2.5">
                {actions}
              </div>
            )}
          </div>

          {children(admin)}
        </main>
      </div>
    </div>
  );
}
