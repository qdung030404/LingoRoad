import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { CefrLevel, GrammarTopic, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateGrammarTopicDto,
  GrammarPrerequisiteEdgeDto,
  UpdateGrammarTopicDto,
} from '../dto/grammar-admin.dto';
import {
  GrammarExampleItem,
  GrammarFormulaItem,
  GrammarUsageItem,
  validateGrammarTopicPayload,
} from '../grammar.types';
import { GrammarCatalogService } from './grammar-catalog.service';

export interface AdminGrammarTopicView {
  id: string;
  code: string;
  parentId: string | null;
  parentCode: string | null;
  cefrLevel: CefrLevel;
  isLeaf: boolean;
  titleEn: string;
  titleVi: string;
  summaryVi: string;
  formulas: Prisma.JsonValue;
  usageNotes: Prisma.JsonValue;
  examples: Prisma.JsonValue;
  orderIndex: number;
  published: boolean;
  contentVersion: number;
  prerequisiteIds: string[];
  prerequisiteCodes: string[];
  dependentCodes: string[];
  lessonsCount: number;
  childrenCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminGrammarTopicsQuery {
  cefrLevel?: CefrLevel;
  search?: string;
  published?: string;
  isLeaf?: string;
}

@Injectable()
export class GrammarDagService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly catalog?: GrammarCatalogService,
  ) {}

  async listAdminTopics(
    query?: AdminGrammarTopicsQuery,
  ): Promise<AdminGrammarTopicView[]> {
    const search = query?.search?.trim();
    const where: Prisma.GrammarTopicWhereInput = {
      ...(query?.cefrLevel ? { cefrLevel: query.cefrLevel } : {}),
      ...(query?.published === 'true' || query?.published === 'false'
        ? { published: query.published === 'true' }
        : {}),
      ...(query?.isLeaf === 'true' || query?.isLeaf === 'false'
        ? { isLeaf: query.isLeaf === 'true' }
        : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { titleEn: { contains: search, mode: 'insensitive' } },
              { titleVi: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.grammarTopic.findMany({
      where,
      orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }, { code: 'asc' }],
      include: {
        parent: { select: { code: true } },
        prerequisites: {
          include: { prerequisite: { select: { id: true, code: true } } },
        },
        dependents: {
          include: { target: { select: { code: true } } },
        },
        _count: { select: { lessons: true, children: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      parentId: row.parentId,
      parentCode: row.parent?.code ?? null,
      cefrLevel: row.cefrLevel,
      isLeaf: row.isLeaf,
      titleEn: row.titleEn,
      titleVi: row.titleVi,
      summaryVi: row.summaryVi,
      formulas: row.formulas,
      usageNotes: row.usageNotes,
      examples: row.examples,
      orderIndex: row.orderIndex,
      published: row.published,
      contentVersion: row.contentVersion,
      prerequisiteIds: row.prerequisites.map((p) => p.prerequisite.id),
      prerequisiteCodes: row.prerequisites.map((p) => p.prerequisite.code),
      dependentCodes: row.dependents.map((d) => d.target.code),
      lessonsCount: row._count.lessons,
      childrenCount: row._count.children,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async assertValidHierarchyParent(
    topicId: string | null,
    parentId: string | null | undefined,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (!parentId) {
      return;
    }
    if (topicId && topicId === parentId) {
      throw new BadRequestException({
        code: 'GRAMMAR_HIERARCHY_SELF_PARENT',
        message: 'Chủ điểm ngữ pháp không thể nhận chính nó làm nút cha.',
      });
    }

    const nodes = await tx.grammarTopic.findMany({
      select: { id: true, parentId: true, isLeaf: true },
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const parent = byId.get(parentId);
    if (!parent) {
      throw new NotFoundException({
        code: 'GRAMMAR_PARENT_NOT_FOUND',
        message: 'Không tìm thấy nhóm ngữ pháp cha.',
      });
    }
    if (parent.isLeaf) {
      throw new BadRequestException({
        code: 'GRAMMAR_PARENT_MUST_BE_GROUP',
        message: 'Nút cha phải là nhóm chuyên đề (isLeaf = false), không thể là cấu trúc lá.',
      });
    }

    if (topicId) {
      let cursor: string | null = parent.parentId;
      const visited = new Set<string>([parent.id]);
      while (cursor) {
        if (cursor === topicId) {
          throw new BadRequestException({
            code: 'GRAMMAR_HIERARCHY_CYCLE_DETECTED',
            message: 'Phát hiện vòng lặp phân cấp Cha – Con trong cây ngữ pháp.',
          });
        }
        if (visited.has(cursor)) {
          break;
        }
        visited.add(cursor);
        cursor = byId.get(cursor)?.parentId ?? null;
      }
    }
  }

  async assertNoPrerequisiteCycle(
    prerequisiteId: string,
    targetId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (prerequisiteId === targetId) {
      throw new BadRequestException({
        code: 'GRAMMAR_DAG_SELF_LOOP',
        message: 'Cấu trúc ngữ pháp không thể là điều kiện tiên quyết của chính nó.',
      });
    }

    const [topics, edges] = await Promise.all([
      tx.grammarTopic.findMany({
        where: { id: { in: [prerequisiteId, targetId] } },
        select: { id: true, isLeaf: true, code: true },
      }),
      tx.grammarPrerequisite.findMany({
        select: { prerequisiteId: true, targetId: true },
      }),
    ]);

    if (topics.length !== 2) {
      throw new NotFoundException({
        code: 'GRAMMAR_TOPIC_NOT_FOUND',
        message: 'Không tìm thấy chủ điểm ngữ pháp để liên kết tiên quyết.',
      });
    }
    if (topics.some((t) => !t.isLeaf)) {
      throw new BadRequestException({
        code: 'GRAMMAR_DAG_LEAF_REQUIRED',
        message: 'Chỉ các cấu trúc ngữ pháp lá (isLeaf = true) mới được gắn quan hệ tiên quyết.',
      });
    }

    const adj = new Map<string, string[]>();
    for (const edge of edges) {
      const list = adj.get(edge.prerequisiteId) ?? [];
      list.push(edge.targetId);
      adj.set(edge.prerequisiteId, list);
    }

    const visited = new Set<string>();
    const stack: string[] = [targetId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === prerequisiteId) {
        throw new BadRequestException({
          code: 'GRAMMAR_DAG_CYCLE_DETECTED',
          message: 'Liên kết này tạo thành chu trình phụ thuộc vòng lặp (Cycle) trong đồ thị ngữ pháp.',
        });
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      for (const next of adj.get(current) ?? []) {
        if (!visited.has(next)) {
          stack.push(next);
        }
      }
    }
  }

  async createTopic(dto: CreateGrammarTopicDto): Promise<GrammarTopic> {
    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.grammarTopic.findUnique({
        where: { code: dto.code },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'GRAMMAR_CODE_ALREADY_EXISTS',
          message: `Mã cấu trúc ngữ pháp "${dto.code}" đã tồn tại.`,
        });
      }

      await this.assertValidHierarchyParent(null, dto.parentId, tx);

      const formulas: GrammarFormulaItem[] = dto.formulas ?? [];
      const usageNotes: GrammarUsageItem[] = dto.usageNotes ?? [];
      const examples: GrammarExampleItem[] = dto.examples ?? [];
      try {
        validateGrammarTopicPayload({ formulas, usageNotes, examples }, dto.isLeaf, dto.code);
      } catch (error: unknown) {
        throw new BadRequestException({
          code: 'GRAMMAR_INVALID_PAYLOAD',
          message: error instanceof Error ? error.message : 'Nội dung cấu trúc ngữ pháp không hợp lệ.',
        });
      }

      return tx.grammarTopic.create({
        data: {
          code: dto.code,
          parentId: dto.parentId ?? null,
          cefrLevel: dto.cefrLevel,
          isLeaf: dto.isLeaf,
          titleEn: dto.titleEn.trim(),
          titleVi: dto.titleVi.trim(),
          summaryVi: dto.summaryVi?.trim() ?? '',
          formulas: formulas as unknown as Prisma.InputJsonValue,
          usageNotes: usageNotes as unknown as Prisma.InputJsonValue,
          examples: examples as unknown as Prisma.InputJsonValue,
          orderIndex: dto.orderIndex ?? 0,
          published: dto.published ?? true,
        },
      });
    });
    this.catalog?.invalidateStaticCache();
    return created;
  }

  async updateTopic(id: string, dto: UpdateGrammarTopicDto): Promise<GrammarTopic> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.grammarTopic.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException({
          code: 'GRAMMAR_TOPIC_NOT_FOUND',
          message: 'Không tìm thấy chủ điểm ngữ pháp.',
        });
      }

      if (dto.parentId !== undefined) {
        await this.assertValidHierarchyParent(id, dto.parentId, tx);
      }

      const formulas = dto.formulas ?? (current.formulas as unknown as GrammarFormulaItem[]);
      const usageNotes = dto.usageNotes ?? (current.usageNotes as unknown as GrammarUsageItem[]);
      const examples = dto.examples ?? (current.examples as unknown as GrammarExampleItem[]);
      try {
        validateGrammarTopicPayload({ formulas, usageNotes, examples }, current.isLeaf, current.code);
      } catch (error: unknown) {
        throw new BadRequestException({
          code: 'GRAMMAR_INVALID_PAYLOAD',
          message: error instanceof Error ? error.message : 'Nội dung cấu trúc ngữ pháp không hợp lệ.',
        });
      }

      return tx.grammarTopic.update({
        where: { id },
        data: {
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.cefrLevel !== undefined ? { cefrLevel: dto.cefrLevel } : {}),
          ...(dto.titleEn !== undefined ? { titleEn: dto.titleEn.trim() } : {}),
          ...(dto.titleVi !== undefined ? { titleVi: dto.titleVi.trim() } : {}),
          ...(dto.summaryVi !== undefined ? { summaryVi: dto.summaryVi.trim() } : {}),
          ...(dto.formulas !== undefined ? { formulas: formulas as unknown as Prisma.InputJsonValue } : {}),
          ...(dto.usageNotes !== undefined ? { usageNotes: usageNotes as unknown as Prisma.InputJsonValue } : {}),
          ...(dto.examples !== undefined ? { examples: examples as unknown as Prisma.InputJsonValue } : {}),
          ...(dto.orderIndex !== undefined ? { orderIndex: dto.orderIndex } : {}),
          ...(dto.published !== undefined ? { published: dto.published } : {}),
          contentVersion: { increment: 1 },
        },
      });
    });
    this.catalog?.invalidateStaticCache();
    return updated;
  }

  async deleteTopic(id: string): Promise<{ deleted: true; id: string }> {
    const current = await this.prisma.grammarTopic.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    });
    if (!current) {
      throw new NotFoundException({
        code: 'GRAMMAR_TOPIC_NOT_FOUND',
        message: 'Không tìm thấy chủ điểm ngữ pháp.',
      });
    }
    if (current._count.children > 0) {
      throw new BadRequestException({
        code: 'GRAMMAR_TOPIC_HAS_CHILDREN',
        message: 'Không thể xóa nhóm ngữ pháp đang chứa các chủ điểm con.',
      });
    }

    await this.prisma.grammarTopic.delete({ where: { id } });
    this.catalog?.invalidateStaticCache();
    return { deleted: true, id };
  }

  async addPrerequisite(dto: GrammarPrerequisiteEdgeDto): Promise<{ prerequisiteId: string; targetId: string }> {
    await this.prisma.$transaction(async (tx) => {
      await this.assertNoPrerequisiteCycle(dto.prerequisiteId, dto.targetId, tx);
      await tx.grammarPrerequisite.upsert({
        where: {
          prerequisiteId_targetId: {
            prerequisiteId: dto.prerequisiteId,
            targetId: dto.targetId,
          },
        },
        create: { prerequisiteId: dto.prerequisiteId, targetId: dto.targetId },
        update: {},
      });
    });
    this.catalog?.invalidateStaticCache();
    return { prerequisiteId: dto.prerequisiteId, targetId: dto.targetId };
  }

  async removePrerequisite(dto: GrammarPrerequisiteEdgeDto): Promise<{ deleted: boolean }> {
    const res = await this.prisma.grammarPrerequisite.deleteMany({
      where: { prerequisiteId: dto.prerequisiteId, targetId: dto.targetId },
    });
    this.catalog?.invalidateStaticCache();
    return { deleted: res.count > 0 };
  }
}
