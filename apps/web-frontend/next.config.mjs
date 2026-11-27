import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Kiểm tra NEXT_PUBLIC_API_URL khi build bản phát hành cloud.
 * Bật kiểm tra bắt buộc khi LINGOROAD_REQUIRE_CLOUD_API_URL=true (trong Dockerfile / CD).
 *
 * @param {string | undefined} rawUrl
 */
export function assertValidCloudApiUrl(rawUrl) {
  const value = rawUrl?.trim() ?? '';
  if (!value) {
    throw new Error(
      'NEXT_PUBLIC_API_URL không được để trống khi build bản triển khai cloud.',
    );
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_API_URL không phải là URL hợp lệ: "${value}".`,
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      `NEXT_PUBLIC_API_URL trên cloud bắt buộc dùng giao thức HTTPS (nhận được "${parsed.protocol}").`,
    );
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    throw new Error(
      `NEXT_PUBLIC_API_URL không được trỏ tới localhost hoặc mạng nội bộ khi build cloud (nhận được "${host}").`,
    );
  }

  return value.replace(/\/+$/, '');
}

if (process.env.LINGOROAD_REQUIRE_CLOUD_API_URL === 'true') {
  assertValidCloudApiUrl(process.env.NEXT_PUBLIC_API_URL);
}

const configuredApiBase = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3000'
).replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  env: {
    NEXT_PUBLIC_API_URL: configuredApiBase,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/media/:path*',
        destination: `${configuredApiBase}/media/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;

