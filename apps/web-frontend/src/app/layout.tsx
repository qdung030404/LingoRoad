import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LingoRoad - Nền tảng Học Tiếng Anh Thông Minh & Cá Nhân Hóa',
  description:
    'LingoRoad là giải pháp học tiếng Anh thích ứng thông minh, giúp bạn đo đúng trình độ chỉ sau 15 phút, ghi nhớ từ vựng bền vững và có gia sư AI đồng hành 24/7.',
  icons: {
    icon: '/assets/brand_mark.svg',
    shortcut: '/assets/brand_mark.svg',
    apple: '/assets/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="scroll-smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/assets/brand_mark.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-slateDark-25 text-slateDark-900 antialiased selection:bg-brand-100 selection:text-brand-900">
        {children}
      </body>
    </html>
  );
}
