'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X, Sparkles, Smartphone } from 'lucide-react';
import { NavItem } from '@/types/landing';
import { NAV_ITEMS } from '@/data/landing-content';

export const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const toggleMobileMenu = (): void => {
    setIsMobileMenuOpen((prev: boolean) => !prev);
  };

  const closeMobileMenu = (): void => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slateDark-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group" onClick={closeMobileMenu}>
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 border border-brand-200 transition-transform group-hover:scale-105">
            <Image
              src="/assets/brand_mark.svg"
              alt="LingoRoad Logo"
              width={28}
              height={28}
              priority
              className="object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-slateDark-900">
              Lingo<span className="text-brand-500">Road</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slateDark-500">
              Học Tiếng Anh Thông Minh
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item: NavItem) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slateDark-700 transition-colors hover:text-brand-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="#simulator"
            className="flex items-center gap-2 rounded-xl border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition-all hover:bg-brand-100"
          >
            <Sparkles className="h-4 w-4 text-brand-600" />
            <span>Kiểm tra trình độ</span>
          </Link>

          <Link
            href="#cta"
            className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm shadow-sm transition-all hover:shadow-md"
          >
            <Smartphone className="h-4 w-4 !text-white" />
            <span className="!text-white">Tải ứng dụng</span>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={toggleMobileMenu}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slateDark-200 text-slateDark-700 md:hidden"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="border-b border-slateDark-100 bg-white px-4 py-6 md:hidden">
          <div className="flex flex-col space-y-4">
            {NAV_ITEMS.map((item: NavItem) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileMenu}
                className="text-base font-medium text-slateDark-800 transition-colors hover:text-brand-600"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <Link
                href="#simulator"
                onClick={closeMobileMenu}
                className="flex items-center justify-center gap-2 rounded-xl border border-brand-300 bg-brand-50 py-3 text-sm font-semibold text-brand-700"
              >
                <Sparkles className="h-4 w-4" />
                <span>Kiểm tra trình độ</span>
              </Link>
              <Link
                href="#cta"
                onClick={closeMobileMenu}
                className="btn-primary flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
              >
                <Smartphone className="h-4 w-4 !text-white" />
                <span className="!text-white">Tải ứng dụng di động</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
