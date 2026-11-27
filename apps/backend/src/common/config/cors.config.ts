import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const LOCAL_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '').toLowerCase();
}

export function parseAllowedOrigins(raw?: string): Set<string> {
  if (!raw || !raw.trim()) {
    return new Set();
  }
  const origins = raw
    .split(',')
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);
  return new Set(origins);
}

export function isOriginAllowed(
  requestOrigin: string | undefined,
  options: {
    corsAllowedOrigins?: string;
    nodeEnv?: string;
  },
): boolean {
  // Cho phép các request không có header Origin (native mobile app, health check, server-to-server)
  if (!requestOrigin) {
    return true;
  }

  const normalized = normalizeOrigin(requestOrigin);
  const configured = parseAllowedOrigins(options.corsAllowedOrigins);

  if (configured.has(normalized)) {
    return true;
  }

  const isProduction = options.nodeEnv === 'production';
  if (!isProduction && LOCAL_ORIGIN_PATTERN.test(normalized)) {
    return true;
  }

  return false;
}

export function buildCorsOptions(options: {
  corsAllowedOrigins?: string;
  nodeEnv?: string;
}): CorsOptions {
  return {
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = isOriginAllowed(requestOrigin, options);
      callback(null, allowed);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  };
}
