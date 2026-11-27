import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  // UTF-8 BOM để Excel hiển thị tiếng Việt có dấu đúng chuẩn.
  return `\uFEFF${lines.join('\r\n')}`;
}

async function fetchCursorBatched<T extends { id?: string }>(
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

    if (batch.length === 0) {
      break;
    }

    if (checkOverflow && batch.length > pageLimit) {
      rows.push(...batch.slice(0, pageLimit));
      truncated = true;
      break;
    }

    rows.push(...batch);
    if (batch.length < pageLimit) {
      break;
    }

    const lastId = batch[batch.length - 1]?.id;
    if (!lastId) {
      break;
    }
    cursorId = lastId;
  }

  return { rows, truncated };
}

@Injectable()
export class AdminExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportEntity(
    entity: string,
    format: 'json' | 'csv' = 'json',
  ): Promise<AdminExportResult> {
    const allowed: readonly AdminExportEntity[] = [
      'units',
      'lessons',
      'items',
      'assessment-groups',
      'topics',
      'speaking',
      'grammar',
      'users',
      'audit-logs',
    ];
    if (!allowed.includes(entity as AdminExportEntity)) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_EXPORT_ENTITY',
        message: `Thực thể export "${entity}" không được hỗ trợ.`,
      });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `lingoroad-${entity}-${stamp}.${format}`;
    const contentType =
      format === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/json; charset=utf-8';

    switch (entity as AdminExportEntity) {
      case 'units': {
        const { rows: units, truncated } = await fetchCursorBatched(
          (pageArgs) =>
            this.prisma.learningUnit.findMany({
              ...pageArgs,
              orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
            }),
          MAX_CONTENT_EXPORT_ROWS,
        );
        if (format === 'json') {
          return {
            filename,
            contentType,
            count: units.length,
            truncated,
            body: JSON.stringify(
              {
                units: units.map((u) => ({
                  code: u.code,
                  cefrLevel: u.cefrLevel,
                  orderIndex: u.orderIndex,
                  title: u.title,
                  description: u.description,
                })),
              },
              null,
              2,
            ),
          };
        }
        return {
          filename,
          contentType,
          count: units.length,
          truncated,
          body: rowsToSafeCsv(
            ['code', 'cefrLevel', 'orderIndex', 'title', 'description'],
            units.map((u) => [u.code, u.cefrLevel, u.orderIndex, u.title, u.description]),
          ),
        };
      }

      case 'lessons': {
        const { rows: lessons, truncated } = await fetchCursorBatched(
          (pageArgs) =>
            this.prisma.learningLesson.findMany({
              ...pageArgs,
              orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }, { id: 'asc' }],
              include: {
                unit: { select: { code: true } },
                grammarTopic: { select: { code: true } },
              },
            }),
          MAX_CONTENT_EXPORT_ROWS,
        );
        if (format === 'json') {
          return {
            filename,
            contentType,
            count: lessons.length,
            truncated,
            body: JSON.stringify(
              {
                lessons: lessons.map((l) => ({
                  code: l.code,
                  kind: l.kind,
                  title: l.title,
                  description: l.description,
                  estimatedMinutes: l.estimatedMinutes,
                  sortOrder: l.sortOrder,
                  published: l.published,
                  ...(l.unit ? { unitCode: l.unit.code } : {}),
                  ...(l.grammarTopic ? { grammarTopicCode: l.grammarTopic.code } : {}),
                  content: l.content,
                })),
              },
              null,
              2,
            ),
          };
        }
        return {
          filename,
          contentType,
          count: lessons.length,
          truncated,
          body: rowsToSafeCsv(
            ['code', 'kind', 'title', 'estimatedMinutes', 'sortOrder', 'published', 'unitCode', 'grammarTopicCode'],
            lessons.map((l) => [
              l.code,
              l.kind,
              l.title,
              l.estimatedMinutes,
              l.sortOrder,
              l.published,
              l.unit?.code ?? '',
              l.grammarTopic?.code ?? '',
            ]),
          ),
        };
      }

      case 'items': {
        const { rows: items, truncated } = await fetchCursorBatched(
          (pageArgs) =>
            this.prisma.assessmentItem.findMany({
              ...pageArgs,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            }),
          MAX_CONTENT_EXPORT_ROWS,
        );
        if (format === 'json') {
          return {
            filename,
            contentType,
            count: items.length,
            truncated,
            body: JSON.stringify(
              {
                items: items.map((i) => ({
                  ...(i.externalId ? { externalId: i.externalId } : {}),
                  ...(i.groupId ? { groupId: i.groupId, itemOrder: i.itemOrder } : {}),
                  skill: i.skill,
                  skillCode: i.skillCode,
                  cefrLevel: i.cefrLevel,
                  type: i.type,
                  usageScope: i.usageScope,
                  ...(i.passage ? { passage: i.passage } : {}),
                  prompt: i.prompt,
                  ...(i.options ? { options: i.options } : {}),
                  ...(i.correctOption ? { correctOption: i.correctOption } : {}),
                  ...(i.explanation ? { explanation: i.explanation } : {}),
                  ...(i.audioUrl ? { audioUrl: i.audioUrl } : {}),
                  ...(i.rubricCriteria ? { rubricCriteria: i.rubricCriteria } : {}),
                  irtA: i.irtA,
                  irtB: i.irtB,
                  irtC: i.irtC,
                })),
              },
              null,
              2,
            ),
          };
        }
        return {
          filename,
          contentType,
          count: items.length,
          truncated,
          body: rowsToSafeCsv(
            ['externalId', 'skill', 'skillCode', 'cefrLevel', 'type', 'usageScope', 'prompt', 'correctOption', 'irtA', 'irtB', 'irtC'],
            items.map((i) => [
              i.externalId ?? '',
              i.skill ?? '',
              i.skillCode,
              i.cefrLevel,
              i.type,
              i.usageScope,
              i.prompt,
              i.correctOption ?? '',
              i.irtA,
              i.irtB,
              i.irtC,
            ]),
          ),
        };
      }

      case 'assessment-groups': {
        const { rows: groups, truncated } = await fetchCursorBatched(
          (pageArgs) =>
            this.prisma.assessmentItemGroup.findMany({
              ...pageArgs,
              orderBy: [{ cefrLevel: 'asc' }, { partNumber: 'asc' }, { id: 'asc' }],
            }),
          MAX_CONTENT_EXPORT_ROWS,
        );
        if (format === 'json') {
          return {
            filename,
            contentType,
            count: groups.length,
            truncated,
            body: JSON.stringify(
              {
                assessmentGroups: groups.map((g) => ({
                  id: g.id,
                  skill: g.skill,
                  title: g.title,
                  cefrLevel: g.cefrLevel,
                  partNumber: g.partNumber,
                  passage: g.passage,
                  audioUrl: g.audioUrl,
                  transcript: g.transcript,
                  usageScope: g.usageScope,
                })),
              },
              null,
              2,
            ),
          };
        }
        return {
          filename,
          contentType,
          count: groups.length,
          truncated,
          body: rowsToSafeCsv(
            ['id', 'skill', 'title', 'cefrLevel', 'partNumber', 'usageScope', 'audioUrl', 'passage', 'transcript'],
            groups.map((g) => [
              g.id,
              g.skill,
              g.title ?? '',
              g.cefrLevel,
              g.partNumber,
              g.usageScope,
              g.audioUrl ?? '',
              g.passage ?? '',
              g.transcript ?? '',
            ]),
          ),
        };
      }

      case 'topics': {
        const { rows: topics, truncated } = await fetchCursorBatched(
          (pageArgs) =>
            this.prisma.curatedTopic.findMany({
              ...pageArgs,
              orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
              include: { words: { orderBy: [{ word: 'asc' }] } },
            }),
          MAX_CONTENT_EXPORT_ROWS,
        );
        if (format === 'json') {
          return {
            filename,
            contentType,
            count: topics.length,
            truncated,
            body: JSON.stringify(
              {
                topics: topics.map((t) => ({
                  slug: t.slug,
                  titleEn: t.titleEn,
                  titleVi: t.titleVi,
                  description: t.description,
                  icon: t.icon,
                  displayOrder: t.displayOrder,
                  words: t.words.map((w) => ({
                    word: w.word,
                    phonetic: w.phonetic,
                    partOfSpeech: w.partOfSpeech,
                    meaningVi: w.meaningVi,
                    exampleEn: w.exampleEn,
                    exampleVi: w.exampleVi,
                    ...(w.imageUrl ? { imageUrl: w.imageUrl } : {}),
                    ...(w.audioUrl ? { audioUrl: w.audioUrl } : {}),
                  })),
                })),
              },
              null,
              2,
            ),
          };
        }
        const flatRows: unknown[][] = [];
        for (const t of topics) {
          for (const w of t.words) {
            flatRows.push([
              t.slug,
              t.titleVi,
              w.word,
              w.phonetic,
              w.partOfSpeech,
              w.meaningVi,
              w.exampleEn,
              w.exampleVi,
              w.imageUrl ?? '',
              w.audioUrl ?? '',
            ]);
          }
        }
        return {
          filename,
          contentType,
          count: flatRows.length,
          truncated,
          body: rowsToSafeCsv(
            ['topicSlug', 'topicTitleVi', 'word', 'phonetic', 'partOfSpeech', 'meaningVi', 'exampleEn', 'exampleVi', 'imageUrl', 'audioUrl'],
            flatRows,
          ),
        };
      }

      case 'speaking': {
        const { rows: prompts, truncated } = await fetchCursorBatched(
          (pageArgs) =>
            this.prisma.speakingPrompt.findMany({
              ...pageArgs,
              orderBy: [{ mode: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
            }),
          MAX_CONTENT_EXPORT_ROWS,
        );
        if (format === 'json') {
          return {
            filename,
            contentType,
            count: prompts.length,
            truncated,
            body: JSON.stringify(
              {
                speakingPrompts: prompts.map((p) => ({
                  code: p.code,
                  mode: p.mode,
                  title: p.title,
                  text: p.text,
                  difficulty: p.difficulty,
                  maxDurationSeconds: p.maxDurationSeconds,
                  hints: p.hints,
                  sampleAsset: p.sampleAsset,
                  imageUrl: p.imageUrl,
                  visualContext: p.visualContext,
                  preparation: p.preparation,
                  linkedReadAloudCodes: p.linkedReadAloudCodes,
                  sortOrder: p.sortOrder,
                  published: p.published,
                })),
              },
              null,
              2,
            ),
          };
        }
        return {
          filename,
          contentType,
          count: prompts.length,
          truncated,
          body: rowsToSafeCsv(
            ['code', 'mode', 'title', 'text', 'difficulty', 'maxDurationSeconds', 'published', 'imageUrl'],
            prompts.map((p) => [
              p.code,
              p.mode,
              p.title,
              p.text,
              p.difficulty,
              p.maxDurationSeconds,
              p.published,
              p.imageUrl ?? '',
            ]),
          ),
        };
      }

      case 'grammar': {
        const { rows: topics, truncated } = await fetchCursorBatched(
          (pageArgs) =>
            this.prisma.grammarTopic.findMany({
              ...pageArgs,
              orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
              include: {
                parent: { select: { code: true } },
                prerequisites: {
                  include: { prerequisite: { select: { code: true } } },
                },
              },
            }),
          MAX_CONTENT_EXPORT_ROWS,
        );
        if (format === 'json') {
          return {
            filename,
            contentType,
            count: topics.length,
            truncated,
            body: JSON.stringify(
              {
                grammarTopics: topics.map((t) => ({
                  code: t.code,
                  parentCode: t.parent?.code ?? null,
                  cefrLevel: t.cefrLevel,
                  isLeaf: t.isLeaf,
                  titleEn: t.titleEn,
                  titleVi: t.titleVi,
                  summaryVi: t.summaryVi,
                  formulas: t.formulas,
                  usageNotes: t.usageNotes,
                  examples: t.examples,
                  orderIndex: t.orderIndex,
                  published: t.published,
                  prerequisiteCodes: (t.prerequisites ?? []).map(
                    (edge) => edge.prerequisite.code,
                  ),
                })),
              },
              null,
              2,
            ),
          };
        }
        return {
          filename,
          contentType,
          count: topics.length,
          truncated,
          body: rowsToSafeCsv(
            ['code', 'parentCode', 'cefrLevel', 'isLeaf', 'titleEn', 'titleVi', 'orderIndex', 'published'],
            topics.map((t) => [
              t.code,
              t.parent?.code ?? '',
              t.cefrLevel,
              t.isLeaf,
              t.titleEn,
              t.titleVi,
              t.orderIndex,
              t.published,
            ]),
          ),
        };
      }

      case 'users': {
        const { rows: users, truncated } = await fetchCursorBatched(
          (pageArgs) =>
            this.prisma.user.findMany({
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
                  select: { targetCefr: true, dailyGoalMinutes: true, learningPurpose: true },
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
            ['id', 'email', 'name', 'role', 'status', 'provider', 'targetCefr', 'dailyGoalMinutes', 'learningPurpose', 'createdAt'],
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

      case 'audit-logs': {
        const { rows: logs, truncated } = await fetchCursorBatched(
          (pageArgs) =>
            this.prisma.auditLog.findMany({
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
            ['createdAt', 'adminEmail', 'action', 'method', 'path', 'resourceType', 'resourceId', 'statusCode', 'ipAddress'],
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
    }
  }
}
