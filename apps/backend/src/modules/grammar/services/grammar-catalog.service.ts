import { Injectable, NotFoundException } from '@nestjs/common';
import { CefrLevel, GrammarTopic, ItemUsageScope } from '@prisma/client';
import { AssessmentSafeItemDto } from '../../assessment/dto/assessment-safe-item.dto';
import { AssessmentSafeMapper } from '../../assessment/mappers/assessment-safe.mapper';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GrammarPracticeItemsQueryDto,
  GrammarTopicsQueryDto,
  GrammarTreeQueryDto,
} from '../dto/grammar-query.dto';
import {
  CEFR_ORDER,
  GrammarCefrLevelSummaryDto,
  GrammarExampleItem,
  GrammarFormulaItem,
  GrammarLinkedLessonDto,
  GrammarRelatedNodeDto,
  GrammarTopicDetailDto,
  GrammarTopicListItemDto,
  GrammarTreeNodeDto,
  GrammarUsageItem,
  LearnerGrammarStatus,
} from '../grammar.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CatalogContext {
  topics: GrammarTopic[];
  byId: Map<string, GrammarTopic>;
  prereqCodesById: Map<string, string[]>;
  dependentCodesById: Map<string, string[]>;
  prereqIdsById: Map<string, string[]>;
  lessonIdsByTopicId: Map<string, string[]>;
  practiceCountByCode: Map<string, number>;
  learnerStatusById?: Map<string, LearnerGrammarStatus>;
}

@Injectable()
export class GrammarCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadContext(userId?: string): Promise<CatalogContext> {
    const [topics, edges, lessons, practiceCounts, attempts, placement] = await Promise.all([
      this.prisma.grammarTopic.findMany({
        where: { published: true },
        orderBy: [{ orderIndex: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.grammarPrerequisite.findMany({
        select: { prerequisiteId: true, targetId: true },
      }),
      this.prisma.learningLesson.findMany({
        where: { published: true, kind: 'GRAMMAR', grammarTopicId: { not: null } },
        select: { id: true, grammarTopicId: true },
      }),
      this.prisma.assessmentItem.groupBy({
        by: ['skillCode'],
        where: {
          skillCode: { startsWith: 'grammar.' },
          usageScope: { in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL] },
        },
        _count: { _all: true },
      }),
      userId
        ? this.prisma.learningAttempt.findMany({
            where: { userId, lesson: { kind: 'GRAMMAR' } },
            select: { lessonId: true, status: true },
          })
        : Promise.resolve(null),
      userId
        ? (this.prisma.placementSession?.findFirst({
            where: { userId, status: 'COMPLETED' },
            orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
            select: { estimatedCefr: true },
          }) ?? Promise.resolve(null))
        : Promise.resolve(null),
    ]);

    const byId = new Map<string, GrammarTopic>(topics.map((t) => [t.id, t]));
    const prereqCodesById = new Map<string, string[]>();
    const dependentCodesById = new Map<string, string[]>();
    const prereqIdsById = new Map<string, string[]>();

    for (const edge of edges) {
      const prereq = byId.get(edge.prerequisiteId);
      const target = byId.get(edge.targetId);
      if (!prereq || !target) continue;

      const pCodes = prereqCodesById.get(target.id) ?? [];
      pCodes.push(prereq.code);
      prereqCodesById.set(target.id, pCodes);

      const pIds = prereqIdsById.get(target.id) ?? [];
      pIds.push(prereq.id);
      prereqIdsById.set(target.id, pIds);

      const dCodes = dependentCodesById.get(prereq.id) ?? [];
      dCodes.push(target.code);
      dependentCodesById.set(prereq.id, dCodes);
    }

    const lessonIdsByTopicId = new Map<string, string[]>();
    for (const lesson of lessons) {
      if (!lesson.grammarTopicId) continue;
      const list = lessonIdsByTopicId.get(lesson.grammarTopicId) ?? [];
      list.push(lesson.id);
      lessonIdsByTopicId.set(lesson.grammarTopicId, list);
    }

    const practiceCountByCode = new Map<string, number>();
    for (const row of practiceCounts) {
      practiceCountByCode.set(row.skillCode, row._count._all);
    }

    let learnerStatusById: Map<string, LearnerGrammarStatus> | undefined;
    if (attempts !== null) {
      const completedLessonIds = new Set(
        attempts.filter((a) => a.status === 'COMPLETED').map((a) => a.lessonId),
      );
      const inProgressLessonIds = new Set(
        attempts.filter((a) => a.status === 'IN_PROGRESS').map((a) => a.lessonId),
      );
      learnerStatusById = new Map<string, LearnerGrammarStatus>();

      for (const topic of topics) {
        if (!topic.isLeaf) continue;
        const linked = lessonIdsByTopicId.get(topic.id) ?? [];
        if (linked.length > 0 && linked.every((id) => completedLessonIds.has(id))) {
          learnerStatusById.set(topic.id, 'COMPLETED');
        } else if (
          linked.some((id) => completedLessonIds.has(id) || inProgressLessonIds.has(id))
        ) {
          learnerStatusById.set(topic.id, 'IN_PROGRESS');
        }
      }

      const placementRank = placement?.estimatedCefr ? CEFR_ORDER.indexOf(placement.estimatedCefr) : -1;

      for (const topic of topics) {
        if (!topic.isLeaf || learnerStatusById.has(topic.id)) continue;
        if (placementRank > 0 && CEFR_ORDER.indexOf(topic.cefrLevel) < placementRank) {
          learnerStatusById.set(topic.id, 'AVAILABLE');
          continue;
        }
        const prereqIds = prereqIdsById.get(topic.id) ?? [];
        const blocked = prereqIds.some((pid) => {
          if (placementRank > 0) {
            const prereqTopic = byId.get(pid);
            if (prereqTopic && CEFR_ORDER.indexOf(prereqTopic.cefrLevel) < placementRank) {
              return false;
            }
          }
          const pLessons = lessonIdsByTopicId.get(pid) ?? [];
          return pLessons.length > 0 && learnerStatusById!.get(pid) !== 'COMPLETED';
        });
        learnerStatusById.set(topic.id, blocked ? 'LOCKED' : 'AVAILABLE');
      }
    }

    return {
      topics,
      byId,
      prereqCodesById,
      dependentCodesById,
      prereqIdsById,
      lessonIdsByTopicId,
      practiceCountByCode,
      learnerStatusById,
    };
  }

  private toTreeNode(topic: GrammarTopic, ctx: CatalogContext, children: GrammarTreeNodeDto[]): GrammarTreeNodeDto {
    const parent = topic.parentId ? ctx.byId.get(topic.parentId) : undefined;
    const lessonCount = topic.isLeaf
      ? (ctx.lessonIdsByTopicId.get(topic.id)?.length ?? 0)
      : children.reduce((sum, c) => sum + c.lessonCount, 0);
    const practiceItemCount = topic.isLeaf
      ? (ctx.practiceCountByCode.get(topic.code) ?? 0)
      : children.reduce((sum, c) => sum + c.practiceItemCount, 0);

    return {
      id: topic.id,
      code: topic.code,
      parentId: topic.parentId,
      parentCode: parent?.code ?? null,
      cefrLevel: topic.cefrLevel,
      isLeaf: topic.isLeaf,
      titleEn: topic.titleEn,
      titleVi: topic.titleVi,
      summaryVi: topic.summaryVi,
      orderIndex: topic.orderIndex,
      prerequisiteCodes: ctx.prereqCodesById.get(topic.id) ?? [],
      dependentCodes: ctx.dependentCodesById.get(topic.id) ?? [],
      lessonCount,
      practiceItemCount,
      ...(ctx.learnerStatusById && topic.isLeaf
        ? { learnerStatus: ctx.learnerStatusById.get(topic.id) }
        : {}),
      children,
    };
  }

  async getLevelsOverview(userId?: string): Promise<{ levels: GrammarCefrLevelSummaryDto[] }> {
    const ctx = await this.loadContext(userId);
    const levels: GrammarCefrLevelSummaryDto[] = CEFR_ORDER.map((level) => {
      const leaves = ctx.topics.filter((t) => t.isLeaf && t.cefrLevel === level);
      const groupNames: string[] = [];
      for (const leaf of leaves) {
        const parentTitle = leaf.parentId ? ctx.byId.get(leaf.parentId)?.titleVi : undefined;
        if (parentTitle && !groupNames.includes(parentTitle)) {
          groupNames.push(parentTitle);
        }
      }
      const lessonCount = leaves.reduce(
        (sum, t) => sum + (ctx.lessonIdsByTopicId.get(t.id)?.length ?? 0),
        0,
      );
      const completedCount = ctx.learnerStatusById
        ? leaves.filter((t) => ctx.learnerStatusById!.get(t.id) === 'COMPLETED').length
        : undefined;

      return {
        cefrLevel: level,
        topicCount: leaves.length,
        lessonCount,
        sampleGroups: groupNames.slice(0, 5),
        ...(completedCount !== undefined ? { completedCount } : {}),
      };
    });

    return { levels };
  }

  async getGrammarTree(
    query: GrammarTreeQueryDto,
    userId?: string,
  ): Promise<
    | { groupBy: 'hierarchy'; tree: GrammarTreeNodeDto[] }
    | { groupBy: 'cefr'; levels: Array<{ cefrLevel: CefrLevel; topics: GrammarTreeNodeDto[] }> }
  > {
    const ctx = await this.loadContext(userId);

    if (query.groupBy === 'cefr') {
      const targetLevels = query.cefrLevel ? [query.cefrLevel] : [...CEFR_ORDER];
      const levels = targetLevels.map((level) => ({
        cefrLevel: level,
        topics: ctx.topics
          .filter((t) => t.isLeaf && t.cefrLevel === level)
          .map((t) => this.toTreeNode(t, ctx, [])),
      }));
      return { groupBy: 'cefr', levels };
    }

    const childrenByParent = new Map<string | null, GrammarTopic[]>();
    for (const topic of ctx.topics) {
      const list = childrenByParent.get(topic.parentId) ?? [];
      list.push(topic);
      childrenByParent.set(topic.parentId, list);
    }

    const buildSubtree = (topic: GrammarTopic): GrammarTreeNodeDto | null => {
      if (topic.isLeaf) {
        if (query.cefrLevel && topic.cefrLevel !== query.cefrLevel) {
          return null;
        }
        return this.toTreeNode(topic, ctx, []);
      }
      const rawChildren = childrenByParent.get(topic.id) ?? [];
      const builtChildren = rawChildren
        .map((child) => buildSubtree(child))
        .filter((node): node is GrammarTreeNodeDto => node !== null);

      if (query.cefrLevel && builtChildren.length === 0) {
        return null;
      }
      return this.toTreeNode(topic, ctx, builtChildren);
    };

    const roots = (childrenByParent.get(null) ?? [])
      .map((root) => buildSubtree(root))
      .filter((node): node is GrammarTreeNodeDto => node !== null);

    return { groupBy: 'hierarchy', tree: roots };
  }

  async listTopics(
    query: GrammarTopicsQueryDto,
    userId?: string,
  ): Promise<{
    items: GrammarTopicListItemDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const ctx = await this.loadContext(userId);
    const leafOnly = (query.leafOnly ?? 'true') === 'true';
    const needle = query.search?.trim().toLowerCase();

    const filtered = ctx.topics.filter((t) => {
      if (leafOnly && !t.isLeaf) return false;
      if (query.cefrLevel && t.cefrLevel !== query.cefrLevel) return false;
      if (query.parentCode) {
        const parentCode = t.parentId ? ctx.byId.get(t.parentId)?.code : null;
        if (parentCode !== query.parentCode) return false;
      }
      if (needle) {
        const matched =
          t.code.toLowerCase().includes(needle) ||
          t.titleEn.toLowerCase().includes(needle) ||
          t.titleVi.toLowerCase().includes(needle) ||
          t.summaryVi.toLowerCase().includes(needle);
        if (!matched) return false;
      }
      return true;
    });

    const total = filtered.length;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const slice = filtered.slice(start, start + limit);

    const items: GrammarTopicListItemDto[] = slice.map((t) => {
      const formulas = t.formulas as unknown as GrammarFormulaItem[];
      const parent = t.parentId ? ctx.byId.get(t.parentId) : undefined;
      return {
        id: t.id,
        code: t.code,
        parentCode: parent?.code ?? null,
        cefrLevel: t.cefrLevel,
        isLeaf: t.isLeaf,
        titleEn: t.titleEn,
        titleVi: t.titleVi,
        summaryVi: t.summaryVi,
        orderIndex: t.orderIndex,
        formulaPreview: Array.isArray(formulas) && formulas.length > 0 ? formulas[0].structure : null,
        prerequisiteCodes: ctx.prereqCodesById.get(t.id) ?? [],
        lessonCount: ctx.lessonIdsByTopicId.get(t.id)?.length ?? 0,
        practiceItemCount: ctx.practiceCountByCode.get(t.code) ?? 0,
        ...(ctx.learnerStatusById && t.isLeaf
          ? { learnerStatus: ctx.learnerStatusById.get(t.id) }
          : {}),
      };
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getTopicDetail(codeOrId: string, userId?: string): Promise<GrammarTopicDetailDto> {
    const ctx = await this.loadContext(userId);
    const trimmed = codeOrId.trim();
    const topic = UUID_REGEX.test(trimmed)
      ? ctx.byId.get(trimmed)
      : ctx.topics.find((t) => t.code === trimmed);

    if (!topic) {
      throw new NotFoundException({
        code: 'GRAMMAR_TOPIC_NOT_FOUND',
        message: `Không tìm thấy cấu trúc ngữ pháp "${trimmed}".`,
      });
    }

    const toRelated = (node: GrammarTopic): GrammarRelatedNodeDto => ({
      id: node.id,
      code: node.code,
      cefrLevel: node.cefrLevel,
      titleEn: node.titleEn,
      titleVi: node.titleVi,
      ...(ctx.learnerStatusById && node.isLeaf
        ? { learnerStatus: ctx.learnerStatusById.get(node.id) }
        : {}),
    });

    const parent = topic.parentId ? (ctx.byId.get(topic.parentId) ?? null) : null;
    const children = ctx.topics.filter((t) => t.parentId === topic.id).map(toRelated);

    const prereqCodes = new Set(ctx.prereqCodesById.get(topic.id) ?? []);
    const dependentCodes = new Set(ctx.dependentCodesById.get(topic.id) ?? []);
    const prerequisites = ctx.topics.filter((t) => prereqCodes.has(t.code)).map(toRelated);
    const dependents = ctx.topics.filter((t) => dependentCodes.has(t.code)).map(toRelated);

    const rawLessons = await this.prisma.learningLesson.findMany({
      where: { published: true, grammarTopicId: topic.id },
      include: { unit: { select: { cefrLevel: true } } },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    let attemptMap: Map<string, 'IN_PROGRESS' | 'COMPLETED'> | undefined;
    if (userId && rawLessons.length > 0) {
      const lessonAttempts = await this.prisma.learningAttempt.findMany({
        where: { userId, lessonId: { in: rawLessons.map((l) => l.id) } },
        select: { lessonId: true, status: true },
      });
      attemptMap = new Map();
      for (const att of lessonAttempts) {
        if (att.status === 'COMPLETED') {
          attemptMap.set(att.lessonId, 'COMPLETED');
        } else if (!attemptMap.has(att.lessonId)) {
          attemptMap.set(att.lessonId, 'IN_PROGRESS');
        }
      }
    }

    const lessons: GrammarLinkedLessonDto[] = rawLessons.map((l) => ({
      id: l.id,
      code: l.code,
      title: l.title,
      description: l.description,
      estimatedMinutes: l.estimatedMinutes,
      ...(l.unit ? { cefrLevel: l.unit.cefrLevel } : {}),
      ...(attemptMap ? { state: attemptMap.get(l.id) ?? 'NOT_STARTED' } : {}),
    }));

    return {
      id: topic.id,
      code: topic.code,
      cefrLevel: topic.cefrLevel,
      isLeaf: topic.isLeaf,
      titleEn: topic.titleEn,
      titleVi: topic.titleVi,
      summaryVi: topic.summaryVi,
      orderIndex: topic.orderIndex,
      contentVersion: topic.contentVersion,
      parent: parent ? toRelated(parent) : null,
      children,
      formulas: (topic.formulas as unknown as GrammarFormulaItem[]) ?? [],
      usageNotes: (topic.usageNotes as unknown as GrammarUsageItem[]) ?? [],
      examples: (topic.examples as unknown as GrammarExampleItem[]) ?? [],
      prerequisites,
      dependents,
      lessons,
      practiceItemCount: ctx.practiceCountByCode.get(topic.code) ?? 0,
      ...(ctx.learnerStatusById && topic.isLeaf
        ? { learnerStatus: ctx.learnerStatusById.get(topic.id) }
        : {}),
    };
  }

  async getTopicPracticeItems(
    codeOrId: string,
    query: GrammarPracticeItemsQueryDto,
  ): Promise<{
    topicCode: string;
    cefrLevel: CefrLevel;
    items: AssessmentSafeItemDto[];
    meta: { total: number; limit: number; offset: number };
  }> {
    const trimmed = codeOrId.trim();
    const topic = await this.prisma.grammarTopic.findFirst({
      where: UUID_REGEX.test(trimmed)
        ? { id: trimmed, published: true }
        : { code: trimmed, published: true },
      select: { code: true, cefrLevel: true },
    });
    if (!topic) {
      throw new NotFoundException({
        code: 'GRAMMAR_TOPIC_NOT_FOUND',
        message: `Không tìm thấy cấu trúc ngữ pháp "${trimmed}".`,
      });
    }

    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;
    const where = {
      skillCode: topic.code,
      usageScope: { in: [ItemUsageScope.PRACTICE, ItemUsageScope.ALL] },
    };

    const [items, total] = await Promise.all([
      this.prisma.assessmentItem.findMany({
        where,
        include: { group: true },
        orderBy: [{ itemOrder: 'asc' }, { createdAt: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.assessmentItem.count({ where }),
    ]);

    return {
      topicCode: topic.code,
      cefrLevel: topic.cefrLevel,
      items: AssessmentSafeMapper.toSafeItemList(items),
      meta: { total, limit, offset },
    };
  }
}
