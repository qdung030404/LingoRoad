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

/**
 * Trích xuất origin an toàn từ NEXT_PUBLIC_API_URL cho cấu hình CSP.
 *
 * @param {string | undefined} rawUrl
 */
export function resolveApiOrigin(rawUrl = process.env.NEXT_PUBLIC_API_URL) {
  const candidate = rawUrl?.trim() || 'http://localhost:3000';
  try {
    return new URL(candidate).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

/**
 * Tạo chuỗi Content-Security-Policy tĩnh gắn chặt với apiOrigin.
 *
 * @param {string} apiOrigin
 * @param {string | undefined} nodeEnv
 */
export function buildContentSecurityPolicy(
  apiOrigin,
  nodeEnv = process.env.NODE_ENV,
) {
  const isDev = nodeEnv === 'development';
  const isProd = nodeEnv === 'production';
  return `default-src 'self'; script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${apiOrigin} https:; media-src 'self' blob: ${apiOrigin}; font-src 'self' data:; connect-src 'self' ${apiOrigin}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';${isProd ? ' upgrade-insecure-requests;' : ''}`;
}

/**
 * Xây dựng danh sách security headers dựa trên biến môi trường hiện hành.
 *
 * @param {NodeJS.ProcessEnv} env
 */
export function buildSecurityHeaders(env = process.env) {
  const apiOrigin = resolveApiOrigin(env.NEXT_PUBLIC_API_URL);
  const csp = buildContentSecurityPolicy(apiOrigin, env.NODE_ENV);
  return [
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
    { key: 'X-XSS-Protection', value: '0' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()',
    },
    { key: 'Content-Security-Policy', value: csp },
  ];
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
        headers: buildSecurityHeaders(process.env),
      },
    ];
  },
};

export default nextConfig;

