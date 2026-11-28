import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminExportEntity,
  AdminExportResult,
  exportSensitiveEntity,
  fetchCursorBatched,
  MAX_CONTENT_EXPORT_ROWS,
  rowsToSafeCsv,
} from './export/admin-export.helpers';

export {
  EXPORT_BATCH_SIZE,
  MAX_CONTENT_EXPORT_ROWS,
  MAX_SENSITIVE_EXPORT_ROWS,
  rowsToSafeCsv,
  sanitizeCsvCell,
} from './export/admin-export.helpers';
export type {
  AdminExportEntity,
  AdminExportResult,
} from './export/admin-export.helpers';

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

      case 'users':
      case 'audit-logs':
        return exportSensitiveEntity(
          this.prisma,
          entity as 'users' | 'audit-logs',
          format,
          filename,
          contentType,
        );
    }
  }
}
