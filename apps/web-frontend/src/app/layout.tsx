import type { Metadata, Viewport } from 'next';
import './globals.css';

const DEFAULT_SITE_URL = 'https://lingoroad-admin-wfpi3gzq.azurewebsites.net';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
const DEFAULT_TITLE = 'LingoRoad - Nền tảng Học Tiếng Anh Thông Minh & Cá Nhân Hóa';
const DEFAULT_DESCRIPTION =
  'LingoRoad là giải pháp học tiếng Anh thích ứng thông minh, giúp bạn đo đúng trình độ chỉ sau 15 phút, ghi nhớ từ vựng bền vững và có gia sư AI đồng hành 24/7.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#59B070',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s | LingoRoad',
  },
  description: DEFAULT_DESCRIPTION,
  icons: {
    icon: '/assets/brand_mark.svg',
    shortcut: '/assets/brand_mark.svg',
    apple: '/assets/logo.png',
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: '/',
    siteName: 'LingoRoad',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: '/assets/logo.png',
        width: 512,
        height: 512,
        alt: 'LingoRoad - Nền tảng Học Tiếng Anh Thông Minh',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ['/assets/logo.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body className="min-h-screen bg-slateDark-25 text-slateDark-900 antialiased selection:bg-brand-100 selection:text-brand-900">
        {children}
      </body>
    </html>
  );
}
