import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type AdminExportEntity =
  | 'units'
  | 'lessons'
  | 'items'
  | 'topics'
  | 'speaking'
  | 'grammar'
  | 'users'
  | 'audit-logs';

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

@Injectable()
export class AdminExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportEntity(
    entity: string,
    format: 'json' | 'csv' = 'json',
  ): Promise<{ filename: string; contentType: string; body: string }> {
    const allowed: readonly AdminExportEntity[] = [
      'units',
      'lessons',
      'items',
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
        const units = await this.prisma.learningUnit.findMany({
          orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }],
        });
        if (format === 'json') {
          return {
            filename,
            contentType,
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
          body: rowsToSafeCsv(
            ['code', 'cefrLevel', 'orderIndex', 'title', 'description'],
            units.map((u) => [u.code, u.cefrLevel, u.orderIndex, u.title, u.description]),
          ),
        };
      }

      case 'lessons': {
        const lessons = await this.prisma.learningLesson.findMany({
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
          include: {
            unit: { select: { code: true } },
            grammarTopic: { select: { code: true } },
          },
        });
        if (format === 'json') {
          return {
            filename,
            contentType,
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
        const items = await this.prisma.assessmentItem.findMany({
          orderBy: [{ createdAt: 'desc' }],
        });
        if (format === 'json') {
          return {
            filename,
            contentType,
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

      case 'topics': {
        const topics = await this.prisma.curatedTopic.findMany({
          orderBy: [{ displayOrder: 'asc' }],
          include: { words: { orderBy: [{ word: 'asc' }] } },
        });
        if (format === 'json') {
          return {
            filename,
            contentType,
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
            ]);
          }
        }
        return {
          filename,
          contentType,
          body: rowsToSafeCsv(
            ['topicSlug', 'topicTitleVi', 'word', 'phonetic', 'partOfSpeech', 'meaningVi', 'exampleEn', 'exampleVi', 'imageUrl'],
            flatRows,
          ),
        };
      }

      case 'speaking': {
        const prompts = await this.prisma.speakingPrompt.findMany({
          orderBy: [{ mode: 'asc' }, { sortOrder: 'asc' }],
        });
        if (format === 'json') {
          return {
            filename,
            contentType,
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
        const topics = await this.prisma.grammarTopic.findMany({
          orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }],
          include: { parent: { select: { code: true } } },
        });
        if (format === 'json') {
          return {
            filename,
            contentType,
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
        const users = await this.prisma.user.findMany({
          orderBy: [{ createdAt: 'desc' }],
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
        });
        if (format === 'json') {
          return { filename, contentType, body: JSON.stringify({ users }, null, 2) };
        }
        return {
          filename,
          contentType,
          body: rowsToSafeCsv(
            ['id', 'email', 'name', 'role', 'status', 'provider', 'targetCefr', 'dailyGoalMinutes', 'createdAt'],
            users.map((u) => [
              u.id,
              u.email,
              u.name,
              u.role,
              u.status,
              u.provider,
              u.profile?.targetCefr ?? '',
              u.profile?.dailyGoalMinutes ?? '',
              u.createdAt,
            ]),
          ),
        };
      }

      case 'audit-logs': {
        const logs = await this.prisma.auditLog.findMany({
          orderBy: [{ createdAt: 'desc' }],
          take: 2000,
        });
        if (format === 'json') {
          return { filename, contentType, body: JSON.stringify({ auditLogs: logs }, null, 2) };
        }
        return {
          filename,
          contentType,
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
