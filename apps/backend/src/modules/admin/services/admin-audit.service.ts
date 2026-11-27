import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from './admin-users.service';

const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'privatekey',
  'credential',
];

const MAX_SNAPSHOT_JSON_BYTES = 16 * 1024;
const MAX_REDACT_DEPTH = 6;

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_REDACT_DEPTH) return '[TRUNCATED]';
  if (typeof value === 'string') {
    return value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactSensitiveData(item, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEY_FRAGMENTS.some((frag) => lower.includes(frag))) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redactSensitiveData(entry, depth + 1);
    }
  }
  return output;
}

export interface RecordAuditLogInput {
  adminUserId: string | null;
  adminEmail: string;
  action: string;
  method: string;
  path: string;
  resourceType: string;
  resourceId?: string | null;
  statusCode: number;
  ipAddress?: string | null;
  payloadSnapshot?: unknown;
}

export interface AdminAuditLogsQuery {
  page?: number;
  limit?: number;
  adminEmail?: string;
  resourceType?: string;
  action?: string;
  from?: string;
  to?: string;
}

export interface AdminAuditLogView {
  id: string;
  adminUserId: string | null;
  adminEmail: string;
  action: string;
  method: string;
  path: string;
  resourceType: string;
  resourceId: string | null;
  statusCode: number;
  ipAddress: string | null;
  payloadSnapshot: Prisma.JsonValue | null;
  createdAt: Date;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    try {
      let safeSnapshot: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
      if (input.payloadSnapshot !== undefined && input.payloadSnapshot !== null) {
        const redacted = redactSensitiveData(input.payloadSnapshot);
        const serialized = JSON.stringify(redacted);
        if (serialized && Buffer.byteLength(serialized, 'utf8') <= MAX_SNAPSHOT_JSON_BYTES) {
          safeSnapshot = redacted as Prisma.InputJsonValue;
        } else {
          safeSnapshot = {
            truncated: true,
            originalBytes: serialized ? Buffer.byteLength(serialized, 'utf8') : 0,
          };
        }
      }

      await this.prisma.auditLog.create({
        data: {
          adminUserId: input.adminUserId,
          adminEmail: input.adminEmail.slice(0, 255),
          action: input.action.slice(0, 100),
          method: input.method.slice(0, 10),
          path: input.path.slice(0, 300),
          resourceType: input.resourceType.slice(0, 60),
          resourceId: input.resourceId ? input.resourceId.slice(0, 100) : null,
          statusCode: input.statusCode,
          ipAddress: input.ipAddress ? input.ipAddress.slice(0, 64) : null,
          payloadSnapshot: safeSnapshot,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Không thể ghi nhật ký kiểm toán (${input.action}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async listLogs(
    query: AdminAuditLogsQuery,
  ): Promise<PaginatedResult<AdminAuditLogView>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const adminEmail = query.adminEmail?.trim();
    const resourceType = query.resourceType?.trim();
    const action = query.action?.trim();

    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (query.from) {
      const parsedFrom = new Date(query.from);
      if (!Number.isNaN(parsedFrom.getTime())) createdAtFilter.gte = parsedFrom;
    }
    if (query.to) {
      const parsedTo = new Date(query.to);
      if (!Number.isNaN(parsedTo.getTime())) createdAtFilter.lte = parsedTo;
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(adminEmail
        ? { adminEmail: { contains: adminEmail, mode: 'insensitive' } }
        : {}),
      ...(resourceType
        ? { resourceType: { equals: resourceType, mode: 'insensitive' } }
        : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
      ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}
