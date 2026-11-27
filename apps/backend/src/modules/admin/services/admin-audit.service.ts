import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
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

const NON_SENSITIVE_EXACT_KEYS = new Set(['tokenversion']);

const MAX_SNAPSHOT_JSON_BYTES = 16 * 1024;
const LARGE_DIFF_FIELD_BYTES = 10 * 1024;
const MAX_REDACT_DEPTH = 6;
const DEFAULT_AUDIT_RETENTION_DAYS = 180;
const RETENTION_BOOT_DELAY_MS = 60_000;
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETENTION_BATCH_SIZE = 1000;
const RETENTION_MAX_BATCHES_PER_RUN = 100;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (NON_SENSITIVE_EXACT_KEYS.has(lower)) {
    return false;
  }
  return SENSITIVE_KEY_FRAGMENTS.some((frag) => lower.includes(frag));
}

function isHiddenHashKey(key: string): boolean {
  return key.toLowerCase().includes('passwordhash');
}

function normalizeAuditValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (depth > 10) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAuditValue(item, depth + 1));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      if (isHiddenHashKey(key)) continue;
      out[key] = normalizeAuditValue(value[key], depth + 1);
    }
    return out;
  }
  return value;
}

function redactWithoutTruncation(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (depth > 10) return '[TRUNCATED]';
  if (Array.isArray(value)) {
    return value.map((item) => redactWithoutTruncation(item, depth + 1));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      if (isHiddenHashKey(key)) continue;
      out[key] = isSensitiveKey(key)
        ? '[REDACTED]'
        : redactWithoutTruncation(value[key], depth + 1);
    }
    return out;
  }
  return value;
}

function serializeCanonical(value: unknown): string {
  const normalized = normalizeAuditValue(value);
  return JSON.stringify(normalized) ?? 'undefined';
}

function hashAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const serialized = JSON.stringify(redactWithoutTruncation(value)) ?? '';
  return createHash('sha256').update(serialized).digest('hex');
}

function findChangedTopLevelKeys(beforeVal: unknown, afterVal: unknown): string[] {
  const beforeObj = isPlainObject(beforeVal) ? beforeVal : {};
  const afterObj = isPlainObject(afterVal) ? afterVal : {};
  if (!isPlainObject(beforeVal) && !isPlainObject(afterVal)) {
    return [];
  }
  const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  const changed: string[] = [];
  for (const key of Array.from(keys).sort()) {
    if (isHiddenHashKey(key)) continue;
    if (serializeCanonical(beforeObj[key]) !== serializeCanonical(afterObj[key])) {
      changed.push(key);
      if (changed.length >= 50) break;
    }
  }
  return changed;
}

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
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
    if (isSensitiveKey(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = redactSensitiveData(entry, depth + 1);
    }
  }
  return output;
}

export interface CompactDiffLargeField {
  changed: true;
  beforeHash: string | null;
  afterHash: string | null;
  changedKeys: string[];
}

export interface CompactDiffField {
  before: unknown;
  after: unknown;
}

export interface CompactDiffResult {
  diff: Record<string, CompactDiffField | CompactDiffLargeField>;
}

export function computeCompactDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): CompactDiffResult {
  const beforeObj = isPlainObject(before) ? before : {};
  const afterObj = isPlainObject(after) ? after : {};
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  const diff: Record<string, CompactDiffField | CompactDiffLargeField> = {};

  for (const key of Array.from(allKeys).sort()) {
    if (isHiddenHashKey(key)) {
      continue;
    }

    const rawBefore = beforeObj[key];
    const rawAfter = afterObj[key];

    if (serializeCanonical(rawBefore) === serializeCanonical(rawAfter)) {
      continue;
    }

    if (isSensitiveKey(key)) {
      diff[key] = {
        before: rawBefore === undefined || rawBefore === null ? null : '[REDACTED]',
        after: rawAfter === undefined || rawAfter === null ? null : '[REDACTED]',
      };
      continue;
    }

    const beforeBytes =
      rawBefore === undefined
        ? 0
        : Buffer.byteLength(serializeCanonical(rawBefore), 'utf8');
    const afterBytes =
      rawAfter === undefined
        ? 0
        : Buffer.byteLength(serializeCanonical(rawAfter), 'utf8');

    if (
      beforeBytes > LARGE_DIFF_FIELD_BYTES ||
      afterBytes > LARGE_DIFF_FIELD_BYTES
    ) {
      diff[key] = {
        changed: true,
        beforeHash: hashAuditValue(rawBefore),
        afterHash: hashAuditValue(rawAfter),
        changedKeys: findChangedTopLevelKeys(rawBefore, rawAfter),
      };
      continue;
    }

    diff[key] = {
      before:
        rawBefore === undefined
          ? null
          : redactSensitiveData(normalizeAuditValue(rawBefore)),
      after:
        rawAfter === undefined
          ? null
          : redactSensitiveData(normalizeAuditValue(rawAfter)),
    };
  }

  return { diff };
}

export function compactSnapshotForAudit(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (isHiddenHashKey(key)) continue;
    if (isSensitiveKey(key)) {
      output[key] = '[REDACTED]';
      continue;
    }
    const serialized = serializeCanonical(value);
    const bytes = Buffer.byteLength(serialized, 'utf8');
    if (bytes > LARGE_DIFF_FIELD_BYTES) {
      output[key] = {
        compacted: true,
        bytes,
        hash: hashAuditValue(value),
      };
    } else {
      output[key] = redactSensitiveData(normalizeAuditValue(value));
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
export class AdminAuditService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminAuditService.name);
  private initialCleanupTimer: NodeJS.Timeout | null = null;
  private dailyCleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  onModuleInit(): void {
    const nodeEnv =
      this.configService?.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
    if (nodeEnv === 'test') {
      return;
    }

    const retentionDays = this.getRetentionDays();
    if (retentionDays <= 0) {
      return;
    }

    this.initialCleanupTimer = setTimeout(() => {
      void this.cleanupExpiredLogs(retentionDays);
    }, RETENTION_BOOT_DELAY_MS);
    this.initialCleanupTimer.unref?.();

    this.dailyCleanupTimer = setInterval(() => {
      void this.cleanupExpiredLogs(retentionDays);
    }, RETENTION_INTERVAL_MS);
    this.dailyCleanupTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.initialCleanupTimer) {
      clearTimeout(this.initialCleanupTimer);
      this.initialCleanupTimer = null;
    }
    if (this.dailyCleanupTimer) {
      clearInterval(this.dailyCleanupTimer);
      this.dailyCleanupTimer = null;
    }
  }

  getRetentionDays(): number {
    const raw =
      this.configService?.get<string | number>('AUDIT_LOG_RETENTION_DAYS') ??
      process.env.AUDIT_LOG_RETENTION_DAYS;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      return DEFAULT_AUDIT_RETENTION_DAYS;
    }
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isFinite(parsed) ? parsed : DEFAULT_AUDIT_RETENTION_DAYS;
  }

  async cleanupExpiredLogs(
    retentionDays = this.getRetentionDays(),
  ): Promise<number> {
    if (retentionDays <= 0) {
      return 0;
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;

    try {
      for (let batch = 0; batch < RETENTION_MAX_BATCHES_PER_RUN; batch += 1) {
        const staleRows = await this.prisma.auditLog.findMany({
          where: { createdAt: { lt: cutoff } },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
          take: RETENTION_BATCH_SIZE,
        });
        if (staleRows.length === 0) {
          break;
        }
        const { count } = await this.prisma.auditLog.deleteMany({
          where: { id: { in: staleRows.map((row) => row.id) } },
        });
        totalDeleted += count;
        if (staleRows.length < RETENTION_BATCH_SIZE || count === 0) {
          break;
        }
      }

      if (totalDeleted > 0) {
        this.logger.log(
          `Đã dọn dẹp ${totalDeleted} bản ghi audit_logs cũ hơn ${retentionDays} ngày.`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Không thể dọn dẹp nhật ký kiểm toán định kỳ: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return totalDeleted;
  }

  async captureBeforeSnapshot(
    resourceType: string,
    resourceId: string,
  ): Promise<Record<string, unknown> | null> {
    if (!resourceId || !UUID_REGEX.test(resourceId)) {
      return null;
    }

    const normalizedType = resourceType.trim().toUpperCase();
    try {
      let row: unknown = null;
      switch (normalizedType) {
        case 'USERS':
          row = await this.prisma.user?.findUnique({
            where: { id: resourceId },
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
              provider: true,
              role: true,
              status: true,
              firebaseUid: true,
              tokenVersion: true,
              createdAt: true,
              updatedAt: true,
              profile: {
                select: {
                  targetCefr: true,
                  dailyGoalMinutes: true,
                  learningPurpose: true,
                },
              },
            },
          });
          break;
        case 'UNITS':
          row = await this.prisma.learningUnit?.findUnique({
            where: { id: resourceId },
          });
          break;
        case 'LESSONS':
          row = await this.prisma.learningLesson?.findUnique({
            where: { id: resourceId },
          });
          break;
        case 'ASSESSMENT_ITEMS':
          row = await this.prisma.assessmentItem?.findUnique({
            where: { id: resourceId },
          });
          break;
        case 'ASSESSMENT_GROUPS':
          row = await this.prisma.assessmentItemGroup?.findUnique({
            where: { id: resourceId },
          });
          break;
        case 'VOCABULARY':
        case 'VOCABULARY_TOPIC':
          row = await this.prisma.curatedTopic?.findUnique({
            where: { id: resourceId },
          });
          break;
        case 'VOCABULARY_WORD':
          row = await this.prisma.curatedTopicWord?.findUnique({
            where: { id: resourceId },
          });
          break;
        case 'SPEAKING_PROMPTS':
          row = await this.prisma.speakingPrompt?.findUnique({
            where: { id: resourceId },
          });
          break;
        case 'GRAMMAR':
        case 'GRAMMAR_TOPICS':
          row = await this.prisma.grammarTopic?.findUnique({
            where: { id: resourceId },
          });
          break;
        default:
          return null;
      }

      return isPlainObject(row) ? row : null;
    } catch (err) {
      this.logger.warn(
        `Không thể chụp bản ghi trước khi thay đổi (${normalizedType}:${resourceId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  computeCompactDiff(
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown> | null | undefined,
  ): CompactDiffResult {
    return computeCompactDiff(before, after);
  }

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
