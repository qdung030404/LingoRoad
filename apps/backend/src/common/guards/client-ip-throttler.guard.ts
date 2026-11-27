import {
  ExecutionContext,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Request } from 'express';
import { AdminAuditService } from '../../modules/admin/services/admin-audit.service';

const IPV4_MAPPED_IPV6_RE = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/i;
const BRACKETED_IPV6_WITH_PORT_RE = /^\[([0-9a-fA-F:]+)\](?::\d+)?$/;
const IPV4_WITH_PORT_RE = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/;

export function normalizeClientIp(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  let value = raw.trim();
  if (!value) {
    return null;
  }

  const mapped = IPV4_MAPPED_IPV6_RE.exec(value);
  if (mapped) {
    return mapped[1];
  }

  const bracketed = BRACKETED_IPV6_WITH_PORT_RE.exec(value);
  if (bracketed) {
    value = bracketed[1];
    const innerMapped = IPV4_MAPPED_IPV6_RE.exec(value);
    return innerMapped ? innerMapped[1] : value;
  }

  const ipv4WithPort = IPV4_WITH_PORT_RE.exec(value);
  if (ipv4WithPort) {
    return ipv4WithPort[1];
  }

  return value;
}

export function normalizeForwardedForHeader(header: string | string[]): string {
  const raw = Array.isArray(header) ? header.join(',') : header;
  return raw
    .split(',')
    .map((entry) => {
      const trimmed = entry.trim();
      if (!trimmed) return '';
      return normalizeClientIp(trimmed) ?? trimmed;
    })
    .filter(Boolean)
    .join(', ');
}

@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    @Optional() private readonly auditService?: AdminAuditService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const rawIp =
      typeof req?.ip === 'string' && req.ip.trim().length > 0
        ? req.ip
        : typeof (req?.socket as { remoteAddress?: unknown } | undefined)
              ?.remoteAddress === 'string'
          ? (req.socket as { remoteAddress: string }).remoteAddress
          : undefined;
    return normalizeClientIp(rawIp) ?? 'unknown';
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    if (this.auditService && context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<Request>();
      const cleanPath = (req.originalUrl || req.url || '').split('?')[0];
      const method = (req.method || '').toUpperCase();
      if (method === 'POST' && /\/admin\/auth\/login$/i.test(cleanPath)) {
        const rawEmail = (req.body as { email?: unknown } | undefined)?.email;
        const adminEmail =
          typeof rawEmail === 'string' && rawEmail.trim()
            ? rawEmail.trim().toLowerCase()
            : 'anonymous';
        void this.auditService.record({
          adminUserId: null,
          adminEmail,
          action: 'ADMIN_LOGIN_RATE_LIMITED',
          method,
          path: cleanPath,
          resourceType: 'AUTH',
          resourceId: null,
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          ipAddress: throttlerLimitDetail.tracker || null,
          payloadSnapshot: {
            limit: throttlerLimitDetail.limit,
            ttl: throttlerLimitDetail.ttl,
            totalHits: throttlerLimitDetail.totalHits,
          },
        });
      }
    }

    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
