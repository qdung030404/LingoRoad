import { PrismaService } from '../../../prisma/prisma.service';

export type AdminExportEntity =
  | 'units'
  | 'lessons'
  | 'items'
  | 'assessment-groups'
  | 'topics'
  | 'speaking'
  | 'grammar'
  | 'users'
  | 'audit-logs';

export interface AdminExportResult {
  filename: string;
  contentType: string;
  body: string;
  count: number;
  truncated: boolean;
}

export const EXPORT_BATCH_SIZE = 500;
export const MAX_CONTENT_EXPORT_ROWS = 10_000;
export const MAX_SENSITIVE_EXPORT_ROWS = 5_000;

const FORMULA_TRIGGERS = new Set([
  '=',
  '+',
  '-',
  '@',
  '\t',
  '\r',
  '\n',
  '＝',
  '＋',
  '－',
  '＠',
]);

/**
 * Trung hòa OWASP CSV/Formula Injection và escape theo chuẩn RFC 4180.
 */
export function sanitizeCsvCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '""';
  let text =
    typeof raw === 'string'
      ? raw
      : raw instanceof Date
        ? raw.toISOString()
        : typeof raw === 'object'
          ? JSON.stringify(raw)
          : String(raw);

  if (text.length > 0 && FORMULA_TRIGGERS.has(text[0])) {
    text = `'${text}`;
  }
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function rowsToSafeCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  const lines = [
    headers.map((h) => sanitizeCsvCell(h)).join(','),
    ...rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export async function fetchCursorBatched<T extends { id?: string }>(
  fetchPage: (args: {
    take: number;
    cursor?: { id: string };
    skip?: number;
  }) => Promise<T[]>,
  maxRows: number,
  batchSize = EXPORT_BATCH_SIZE,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let cursorId: string | undefined;
  let truncated = false;

  while (rows.length < maxRows) {
    const remaining = maxRows - rows.length;
    const pageLimit = Math.min(batchSize, remaining);
    const checkOverflow = remaining <= batchSize;
    const take = checkOverflow ? pageLimit + 1 : pageLimit;

    const batch = await fetchPage({
      take,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    if (batch.length === 0) break;

    if (checkOverflow && batch.length > pageLimit) {
      rows.push(...batch.slice(0, pageLimit));
      truncated = true;
      break;
    }

    rows.push(...batch);
    if (batch.length < pageLimit) break;

    const lastId = batch[batch.length - 1]?.id;
    if (!lastId) break;
    cursorId = lastId;
  }

  return { rows, truncated };
}

export async function exportSensitiveEntity(
  prisma: PrismaService,
  entity: 'users' | 'audit-logs',
  format: 'json' | 'csv',
  filename: string,
  contentType: string,
): Promise<AdminExportResult> {
  if (entity === 'users') {
    const { rows: users, truncated } = await fetchCursorBatched(
      (pageArgs) =>
        prisma.user.findMany({
          ...pageArgs,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            provider: true,
            createdAt: true,
            profile: {
              select: {
                targetCefr: true,
                dailyGoalMinutes: true,
                learningPurpose: true,
              },
            },
          },
        }),
      MAX_SENSITIVE_EXPORT_ROWS,
    );
    if (format === 'json') {
      return {
        filename,
        contentType,
        count: users.length,
        truncated,
        body: JSON.stringify({ users }, null, 2),
      };
    }
    return {
      filename,
      contentType,
      count: users.length,
      truncated,
      body: rowsToSafeCsv(
        [
          'id',
          'email',
          'name',
          'role',
          'status',
          'provider',
          'targetCefr',
          'dailyGoalMinutes',
          'learningPurpose',
          'createdAt',
        ],
        users.map((u) => [
          u.id,
          u.email,
          u.name,
          u.role,
          u.status,
          u.provider,
          u.profile?.targetCefr ?? '',
          u.profile?.dailyGoalMinutes ?? '',
          u.profile?.learningPurpose ?? '',
          u.createdAt,
        ]),
      ),
    };
  }

  const { rows: logs, truncated } = await fetchCursorBatched(
    (pageArgs) =>
      prisma.auditLog.findMany({
        ...pageArgs,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    MAX_SENSITIVE_EXPORT_ROWS,
  );
  if (format === 'json') {
    return {
      filename,
      contentType,
      count: logs.length,
      truncated,
      body: JSON.stringify({ auditLogs: logs }, null, 2),
    };
  }
  return {
    filename,
    contentType,
    count: logs.length,
    truncated,
    body: rowsToSafeCsv(
      [
        'createdAt',
        'adminEmail',
        'action',
        'method',
        'path',
        'resourceType',
        'resourceId',
        'statusCode',
        'ipAddress',
      ],
      logs.map((l) => [
        l.createdAt,
        l.adminEmail,
        l.action,
        l.method,
        l.path,
        l.resourceType,
        l.resourceId ?? '',
        l.statusCode,
        l.ipAddress ?? '',
      ]),
    ),
  };
}
