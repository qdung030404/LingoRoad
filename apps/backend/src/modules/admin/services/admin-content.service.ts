import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
  Prisma,
} from '@prisma/client';
import {
  CEFR_CAN_DO_DESCRIPTORS,
  CanDoDescriptor,
} from '../../assessment/constants/cefr-can-do-matrix.constant';
import { AssessmentMatrixService } from '../../assessment/services/assessment-matrix.service';
import { LearningContent, validateLearningContent } from '../../learning/learning.types';
import { validateListeningAudio } from '../../learning/listening-media';
import { learningMediaRoot } from '../../learning/learning.service';
import { MediaStorageService } from '../../media/media-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminAssessmentGroupsQueryDto,
  AdminAssessmentItemsQueryDto,
  AdminLessonsQueryDto,
  BulkPublishDto,
  CreateAdminAssessmentItemDto,
  CreateAdminLessonDto,
  CreateAssessmentItemGroupDto,
  CreateLearningUnitDto,
  UpdateAdminAssessmentItemDto,
  UpdateAdminLessonDto,
  UpdateAssessmentItemGroupDto,
  UpdateLearningUnitDto,
} from '../dto/admin-content.dto';
import { PaginatedResult } from './admin-users.service';
import {
  assertReferencedItemUnchanged,
  lockAssessmentItem,
  resolveAdminPlacementBankVersion,
} from './assessment-item-integrity';

export interface AdminUnitItem {
  id: string;
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
  lessonsCount: number;
}

export interface AdminLessonSummary {
  id: string;
  code: string;
  kind: LearningKind;
  primarySkillCode: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  sortOrder: number;
  published: boolean;
  contentVersion: number;
  questionsCount: number;
  attemptsCount: number;
  unit: {
    id: string;
    code: string;
    title: string;
    cefrLevel: CefrLevel;
  } | null;
  grammarTopic: {
    id: string;
    code: string;
    titleVi: string;
    cefrLevel: CefrLevel;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonsListSummary {
  total: number;
  published: number;
  drafts: number;
  linkedQuestions: number;
}

export interface AdminLessonDetail extends AdminLessonSummary {
  content: Prisma.JsonValue;
}

export interface AdminAssessmentItemView {
  id: string;
  externalId: string | null;
  groupId: string | null;
  itemOrder: number;
  group: {
    id: string;
    title: string | null;
    skill: AssessmentSkill;
    cefrLevel: CefrLevel;
    partNumber: number;
  } | null;
  skill: AssessmentSkill | null;
  skillCode: string;
  cefrLevel: CefrLevel;
  type: ItemType;
  usageScope: ItemUsageScope;
  passage: string | null;
  prompt: string;
  options: Prisma.JsonValue | null;
  correctOption: string | null;
  explanation: string | null;
  audioUrl: string | null;
  rubricCriteria: Prisma.JsonValue | null;
  irtA: number;
  irtB: number;
  irtC: number;
  responsesCount: number;
  activeSessionsCount: number;
  createdAt: Date;
}

export interface AssessmentItemsSummary {
  total: number;
  mcqCount: number;
  clozeAndOtherCount: number;
  coveredSkillsCount: number;
}

export interface AdminAssessmentGroupView {
  id: string;
  skill: AssessmentSkill;
  title: string | null;
  cefrLevel: CefrLevel;
  partNumber: number;
  passage: string | null;
  audioUrl: string | null;
  transcript: string | null;
  usageScope: ItemUsageScope;
  itemsCount: number;
  items?: Array<{
    id: string;
    externalId: string | null;
    itemOrder: number;
    skillCode: string;
    type: ItemType;
    prompt: string;
  }>;
  createdAt: Date;
}

function extractQuestionsCount(content: Prisma.JsonValue): number {
  if (
    content &&
    typeof content === 'object' &&
    !Array.isArray(content) &&
    Array.isArray((content as { questions?: unknown }).questions)
  ) {
    return (content as { questions: unknown[] }).questions.length;
  }
  return 0;
}

function extractPrimarySkillCode(
  kind: LearningKind,
  content: Prisma.JsonValue,
): string {
  if (
    content &&
    typeof content === 'object' &&
    !Array.isArray(content) &&
    Array.isArray((content as { questions?: unknown }).questions)
  ) {
    const firstWithSkill = (
      content as { questions: Array<{ skillCode?: unknown }> }
    ).questions.find(
      (q) => typeof q?.skillCode === 'string' && q.skillCode.trim().length > 0,
    );
    if (firstWithSkill && typeof firstWithSkill.skillCode === 'string') {
      return firstWithSkill.skillCode.trim();
    }
  }
  if (kind === LearningKind.GRAMMAR) return 'grammar.general';
  if (kind === LearningKind.VOCABULARY) return 'vocabulary.general';
  if (kind === LearningKind.READING) return 'reading.comprehension';
  return 'listening.comprehension';
}

function extractOptionValues(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  const values: string[] = [];
  for (const entry of options) {
    if (typeof entry === 'string' && entry.trim()) {
      values.push(entry.trim());
    } else if (entry && typeof entry === 'object') {
      const obj = entry as { id?: unknown; text?: unknown };
      if (typeof obj.id === 'string' && obj.id.trim()) values.push(obj.id.trim());
      if (typeof obj.text === 'string' && obj.text.trim()) {
        values.push(obj.text.trim());
      }
    }
  }
  return values;
}

const LESSON_INCLUDE = {
  unit: {
    select: {
      id: true,
      code: true,
      title: true,
      cefrLevel: true,
    },
  },
  grammarTopic: {
    select: {
      id: true,
      code: true,
      titleVi: true,
      cefrLevel: true,
    },
  },
  _count: {
    select: { attempts: true },
  },
} as const;

const ITEM_INCLUDE = {
  group: {
    select: {
      id: true,
      title: true,
      skill: true,
      cefrLevel: true,
      partNumber: true,
    },
  },
  _count: {
    select: { responses: true, currentSessions: true },
  },
} as const;

type ItemRowWithCount = {
  id: string;
  externalId: string | null;
  groupId?: string | null;
  itemOrder?: number;
  group?: {
    id: string;
    title: string | null;
    skill: AssessmentSkill;
    cefrLevel: CefrLevel;
    partNumber: number;
  } | null;
  skill: AssessmentSkill | null;
  skillCode: string;
  cefrLevel: CefrLevel;
  type: ItemType;
  usageScope: ItemUsageScope;
  passage: string | null;
  prompt: string;
  options: Prisma.JsonValue | null;
  correctOption: string | null;
  explanation: string | null;
  audioUrl: string | null;
  rubricCriteria?: Prisma.JsonValue | null;
  irtA: number;
  irtB: number;
  irtC: number;
  createdAt: Date;
  _count?: { responses?: number; currentSessions?: number };
};

function mapAssessmentItemView(row: ItemRowWithCount): AdminAssessmentItemView {
  return {
    id: row.id,
    externalId: row.externalId ?? null,
    groupId: row.groupId ?? null,
    itemOrder: row.itemOrder ?? 1,
    group: row.group ?? null,
    skill: row.skill,
    skillCode: row.skillCode,
    cefrLevel: row.cefrLevel,
    type: row.type,
    usageScope: row.usageScope,
    passage: row.passage,
    prompt: row.prompt,
    options: row.options,
    correctOption: row.correctOption,
    explanation: row.explanation,
    audioUrl: row.audioUrl,
    rubricCriteria: row.rubricCriteria ?? null,
    irtA: row.irtA,
    irtB: row.irtB,
    irtC: row.irtC,
    responsesCount: row._count?.responses ?? 0,
    activeSessionsCount: row._count?.currentSessions ?? 0,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentMatrixService: AssessmentMatrixService,
    @Optional() private readonly mediaStorage?: MediaStorageService,
  ) {}

  async listUnits(): Promise<AdminUnitItem[]> {
    const rows = await this.prisma.learningUnit.findMany({
      orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }],
      include: {
        _count: {
          select: { lessons: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      cefrLevel: row.cefrLevel,
      orderIndex: row.orderIndex,
      title: row.title,
      description: row.description,
      lessonsCount: row._count.lessons,
    }));
  }

  async createUnit(dto: CreateLearningUnitDto): Promise<AdminUnitItem> {
    const code = dto.code.trim().toLowerCase();
    const existingCode = await this.prisma.learningUnit.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existingCode) {
      throw new ConflictException({
        code: 'ADMIN_UNIT_CODE_EXISTS',
        message: `Mã chương "${code}" đã tồn tại.`,
      });
    }

    const existingOrder = await this.prisma.learningUnit.findUnique({
      where: {
        cefrLevel_orderIndex: {
          cefrLevel: dto.cefrLevel,
          orderIndex: dto.orderIndex,
        },
      },
      select: { id: true },
    });
    if (existingOrder) {
      throw new ConflictException({
        code: 'ADMIN_UNIT_ORDER_EXISTS',
        message: `Bậc ${dto.cefrLevel} đã có chương thứ ${dto.orderIndex}.`,
      });
    }

    const created = await this.prisma.learningUnit.create({
      data: {
        code,
        cefrLevel: dto.cefrLevel,
        orderIndex: dto.orderIndex,
        title: dto.title.trim(),
        description: dto.description.trim(),
      },
      include: {
        _count: { select: { lessons: true } },
      },
    });

    return {
      id: created.id,
      code: created.code,
      cefrLevel: created.cefrLevel,
      orderIndex: created.orderIndex,
      title: created.title,
      description: created.description,
      lessonsCount: created._count.lessons,
    };
  }

  async updateUnit(id: string, dto: UpdateLearningUnitDto): Promise<AdminUnitItem> {
    const current = await this.prisma.learningUnit.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException({
        code: 'ADMIN_UNIT_NOT_FOUND',
        message: 'Không tìm thấy chương học.',
      });
    }

    const nextCode = dto.code?.trim().toLowerCase();
    if (nextCode && nextCode !== current.code) {
      const dupCode = await this.prisma.learningUnit.findUnique({
        where: { code: nextCode },
        select: { id: true },
      });
      if (dupCode) {
        throw new ConflictException({
          code: 'ADMIN_UNIT_CODE_EXISTS',
          message: `Mã chương "${nextCode}" đã tồn tại.`,
        });
      }
    }

    const nextCefr = dto.cefrLevel ?? current.cefrLevel;
    const nextOrder = dto.orderIndex ?? current.orderIndex;
    if (nextCefr !== current.cefrLevel || nextOrder !== current.orderIndex) {
      const dupOrder = await this.prisma.learningUnit.findUnique({
        where: {
          cefrLevel_orderIndex: {
            cefrLevel: nextCefr,
            orderIndex: nextOrder,
          },
        },
        select: { id: true },
      });
      if (dupOrder && dupOrder.id !== id) {
        throw new ConflictException({
          code: 'ADMIN_UNIT_ORDER_EXISTS',
          message: `Bậc ${nextCefr} đã có chương thứ ${nextOrder}.`,
        });
      }
    }

    const updated = await this.prisma.learningUnit.update({
      where: { id },
      data: {
        ...(nextCode ? { code: nextCode } : {}),
        ...(dto.cefrLevel !== undefined ? { cefrLevel: dto.cefrLevel } : {}),
        ...(dto.orderIndex !== undefined ? { orderIndex: dto.orderIndex } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      },
      include: {
        _count: { select: { lessons: true } },
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      cefrLevel: updated.cefrLevel,
      orderIndex: updated.orderIndex,
      title: updated.title,
      description: updated.description,
      lessonsCount: updated._count.lessons,
    };
  }

  async deleteUnit(
    id: string,
    detach = false,
  ): Promise<{ id: string; action: 'DELETED'; detachedLessonsCount: number }> {
    const existing = await this.prisma.learningUnit.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { lessons: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_UNIT_NOT_FOUND',
        message: 'Không tìm thấy chương học.',
      });
    }

    const lessonsCount = existing._count.lessons;
    if (lessonsCount > 0 && !detach) {
      throw new ConflictException({
        code: 'ADMIN_UNIT_HAS_LESSONS',
        message: `Chương học đang chứa ${lessonsCount} bài học. Xác nhận gỡ liên kết bài học trước khi xóa.`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (lessonsCount > 0) {
        await tx.learningLesson.updateMany({
          where: { unitId: id },
          data: { unitId: null },
        });
      }
      await tx.learningUnit.delete({ where: { id } });
    });

    return { id, action: 'DELETED', detachedLessonsCount: lessonsCount };
  }

  private async verifyGrammarTopicLeaf(grammarTopicId: string): Promise<void> {
    const topic = await this.prisma.grammarTopic.findUnique({
      where: { id: grammarTopicId },
      select: { id: true, isLeaf: true },
    });
    if (!topic) {
      throw new NotFoundException({
        code: 'ADMIN_GRAMMAR_TOPIC_NOT_FOUND',
        message: 'Không tìm thấy chủ điểm ngữ pháp đã chọn.',
      });
    }
    if (!topic.isLeaf) {
      throw new BadRequestException({
        code: 'ADMIN_GRAMMAR_TOPIC_NOT_LEAF',
        message: 'Bài học chỉ có thể gắn vào chủ điểm ngữ pháp lá (isLeaf = true).',
      });
    }
  }

  async listLessons(
    query: AdminLessonsQueryDto,
  ): Promise<PaginatedResult<AdminLessonSummary, LessonsListSummary>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.LearningLessonWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.published !== undefined
        ? { published: query.published === 'true' }
        : {}),
      ...(query.cefrLevel ? { unit: { cefrLevel: query.cefrLevel } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows, allLessons] = await Promise.all([
      this.prisma.learningLesson.count({ where }),
      this.prisma.learningLesson.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: LESSON_INCLUDE,
      }),
      this.prisma.learningLesson.findMany({
        select: {
          published: true,
          content: true,
        },
      }),
    ]);

    let publishedCount = 0;
    let linkedQuestions = 0;
    for (const lesson of allLessons) {
      if (lesson.published) publishedCount += 1;
      linkedQuestions += extractQuestionsCount(lesson.content);
    }

    return {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        kind: row.kind,
        primarySkillCode: extractPrimarySkillCode(row.kind, row.content),
        title: row.title,
        description: row.description,
        estimatedMinutes: row.estimatedMinutes,
        sortOrder: row.sortOrder,
        published: row.published,
        contentVersion: row.contentVersion,
        questionsCount: extractQuestionsCount(row.content),
        attemptsCount: row._count.attempts,
        unit: row.unit,
        grammarTopic: row.grammarTopic ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      summary: {
        total: allLessons.length,
        published: publishedCount,
        drafts: allLessons.length - publishedCount,
        linkedQuestions,
      },
    };
  }

  async getLesson(id: string): Promise<AdminLessonDetail> {
    const row = await this.prisma.learningLesson.findUnique({
      where: { id },
      include: LESSON_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({
        code: 'ADMIN_LESSON_NOT_FOUND',
        message: 'Không tìm thấy bài tập.',
      });
    }

    return {
      id: row.id,
      code: row.code,
      kind: row.kind,
      primarySkillCode: extractPrimarySkillCode(row.kind, row.content),
      title: row.title,
      description: row.description,
      estimatedMinutes: row.estimatedMinutes,
      sortOrder: row.sortOrder,
      published: row.published,
      contentVersion: row.contentVersion,
      questionsCount: extractQuestionsCount(row.content),
      attemptsCount: row._count.attempts,
      unit: row.unit,
      grammarTopic: row.grammarTopic ?? null,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async createLesson(dto: CreateAdminLessonDto): Promise<AdminLessonDetail> {
    const code = dto.code.trim().toLowerCase();
    try {
      validateLearningContent(dto.content, dto.kind);
      if (dto.published ?? true) {
        if (this.mediaStorage) {
          await this.mediaStorage.verifyListeningAudio(dto.content, learningMediaRoot());
        } else {
          validateListeningAudio(dto.content, learningMediaRoot());
        }
      }
    } catch (error) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_LESSON_CONTENT',
        message:
          error instanceof Error
            ? error.message
            : 'Nội dung bài tập không hợp lệ.',
      });
    }

    const existing = await this.prisma.learningLesson.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ADMIN_LESSON_CODE_EXISTS',
        message: `Mã bài học "${code}" đã tồn tại.`,
      });
    }

    if (dto.unitId) {
      const unit = await this.prisma.learningUnit.findUnique({
        where: { id: dto.unitId },
        select: { id: true },
      });
      if (!unit) {
        throw new NotFoundException({
          code: 'ADMIN_UNIT_NOT_FOUND',
          message: 'Không tìm thấy chương học đã chọn.',
        });
      }
    }

    if (dto.grammarTopicId) {
      await this.verifyGrammarTopicLeaf(dto.grammarTopicId);
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxRow = await this.prisma.learningLesson.aggregate({
        _max: { sortOrder: true },
      });
      sortOrder = (maxRow._max.sortOrder ?? 0) + 1;
    }

    const created = await this.prisma.learningLesson.create({
      data: {
        code,
        kind: dto.kind,
        title: dto.title.trim(),
        description: dto.description.trim(),
        estimatedMinutes: dto.estimatedMinutes,
        sortOrder,
        published: dto.published ?? true,
        unitId: dto.unitId ?? null,
        grammarTopicId: dto.kind === LearningKind.GRAMMAR ? (dto.grammarTopicId ?? null) : null,
        content: dto.content as Prisma.InputJsonValue,
      },
      include: LESSON_INCLUDE,
    });

    return {
      id: created.id,
      code: created.code,
      kind: created.kind,
      primarySkillCode: extractPrimarySkillCode(created.kind, created.content),
      title: created.title,
      description: created.description,
      estimatedMinutes: created.estimatedMinutes,
      sortOrder: created.sortOrder,
      published: created.published,
      contentVersion: created.contentVersion,
      questionsCount: extractQuestionsCount(created.content),
      attemptsCount: created._count.attempts,
      unit: created.unit,
      grammarTopic: created.grammarTopic ?? null,
      content: created.content,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async updateLesson(
    id: string,
    dto: UpdateAdminLessonDto,
  ): Promise<AdminLessonDetail> {
    const current = await this.prisma.learningLesson.findUnique({
      where: { id },
      select: { id: true, code: true, kind: true, content: true, published: true },
    });
    if (!current) {
      throw new NotFoundException({
        code: 'ADMIN_LESSON_NOT_FOUND',
        message: 'Không tìm thấy bài tập.',
      });
    }

    const nextKind = dto.kind ?? current.kind;
    if (dto.content !== undefined || dto.kind !== undefined || dto.published === true) {
      try {
        const nextContent = dto.content ?? current.content;
        validateLearningContent(nextContent, nextKind);
        if (dto.published ?? current.published) {
          if (this.mediaStorage) {
            await this.mediaStorage.verifyListeningAudio(nextContent, learningMediaRoot());
          } else {
            validateListeningAudio(nextContent, learningMediaRoot());
          }
        }
      } catch (error) {
        throw new BadRequestException({
          code: 'ADMIN_INVALID_LESSON_CONTENT',
          message:
            error instanceof Error
              ? error.message
              : 'Nội dung bài tập không hợp lệ.',
        });
      }
    }

    const nextCode = dto.code?.trim().toLowerCase();
    if (nextCode && nextCode !== current.code) {
      const duplicate = await this.prisma.learningLesson.findUnique({
        where: { code: nextCode },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'ADMIN_LESSON_CODE_EXISTS',
          message: `Mã bài học "${nextCode}" đã tồn tại.`,
        });
      }
    }

    if (dto.unitId) {
      const unit = await this.prisma.learningUnit.findUnique({
        where: { id: dto.unitId },
        select: { id: true },
      });
      if (!unit) {
        throw new NotFoundException({
          code: 'ADMIN_UNIT_NOT_FOUND',
          message: 'Không tìm thấy chương học đã chọn.',
        });
      }
    }

    if (dto.grammarTopicId) {
      await this.verifyGrammarTopicLeaf(dto.grammarTopicId);
    }

    const nextGrammarTopicData =
      nextKind !== LearningKind.GRAMMAR
        ? { grammarTopicId: null }
        : dto.grammarTopicId !== undefined
          ? { grammarTopicId: dto.grammarTopicId }
          : {};

    const updated = await this.prisma.learningLesson.update({
      where: { id },
      data: {
        ...(nextCode ? { code: nextCode } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.estimatedMinutes !== undefined
          ? { estimatedMinutes: dto.estimatedMinutes }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
        ...(dto.unitId !== undefined ? { unitId: dto.unitId } : {}),
        ...nextGrammarTopicData,
        ...(dto.content !== undefined
          ? {
              content: dto.content as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.content !== undefined || nextKind !== current.kind
          ? { contentVersion: { increment: 1 } }
          : {}),
      },
      include: LESSON_INCLUDE,
    });

    return {
      id: updated.id,
      code: updated.code,
      kind: updated.kind,
      primarySkillCode: extractPrimarySkillCode(updated.kind, updated.content),
      title: updated.title,
      description: updated.description,
      estimatedMinutes: updated.estimatedMinutes,
      sortOrder: updated.sortOrder,
      published: updated.published,
      contentVersion: updated.contentVersion,
      questionsCount: extractQuestionsCount(updated.content),
      attemptsCount: updated._count.attempts,
      unit: updated.unit,
      grammarTopic: updated.grammarTopic ?? null,
      content: updated.content,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteLesson(
    id: string,
    force = false,
  ): Promise<{
    id: string;
    action: 'DELETED' | 'UNPUBLISHED';
    attemptsCount: number;
  }> {
    const lesson = await this.prisma.learningLesson.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: { attempts: true },
        },
      },
    });
    if (!lesson) {
      throw new NotFoundException({
        code: 'ADMIN_LESSON_NOT_FOUND',
        message: 'Không tìm thấy bài tập.',
      });
    }

    const attemptsCount = lesson._count.attempts;
    if (attemptsCount === 0) {
      await this.prisma.learningLesson.delete({ where: { id } });
      return { id, action: 'DELETED', attemptsCount: 0 };
    }

    if (!force) {
      await this.prisma.learningLesson.update({
        where: { id },
        data: { published: false },
      });
      return { id, action: 'UNPUBLISHED', attemptsCount };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.learningAttempt.deleteMany({ where: { lessonId: id } });
      await tx.learningLesson.delete({ where: { id } });
    });

    return { id, action: 'DELETED', attemptsCount };
  }

  async bulkPublishLessons(
    dto: BulkPublishDto,
  ): Promise<{ updatedCount: number; published: boolean; ids: string[] }> {
    const uniqueIds = [...new Set(dto.ids)];
    const lessons = await this.prisma.learningLesson.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, code: true, kind: true, content: true },
    });
    if (lessons.length !== uniqueIds.length) {
      throw new NotFoundException({
        code: 'ADMIN_LESSON_NOT_FOUND',
        message: 'Một hoặc nhiều bài tập trong danh sách không tồn tại.',
      });
    }

    if (dto.published) {
      for (const lesson of lessons) {
        if (lesson.kind !== LearningKind.LISTENING) continue;
        try {
          if (this.mediaStorage) {
            await this.mediaStorage.verifyListeningAudio(
              lesson.content as unknown as LearningContent,
              learningMediaRoot(),
            );
          } else {
            validateListeningAudio(
              lesson.content as unknown as LearningContent,
              learningMediaRoot(),
            );
          }
        } catch (error) {
          throw new BadRequestException({
            code: 'ADMIN_INVALID_LESSON_CONTENT',
            message: `Bài tập nghe "${lesson.code}" không đạt điều kiện âm thanh để xuất bản: ${
              error instanceof Error ? error.message : 'Âm thanh không hợp lệ.'
            }`,
          });
        }
      }
    }

    const updated = await this.prisma.$transaction((tx) =>
      tx.learningLesson.updateMany({
        where: { id: { in: uniqueIds } },
        data: { published: dto.published },
      }),
    );

    return {
      updatedCount: updated.count,
      published: dto.published,
      ids: uniqueIds,
    };
  }

  listDescriptors(): readonly CanDoDescriptor[] {
    return CEFR_CAN_DO_DESCRIPTORS;
  }

  async listAssessmentItems(
    query: AdminAssessmentItemsQueryDto,
  ): Promise<PaginatedResult<AdminAssessmentItemView, AssessmentItemsSummary>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.AssessmentItemWhereInput = {
      ...(query.skill ? { skill: query.skill } : {}),
      ...(query.cefrLevel ? { cefrLevel: query.cefrLevel } : {}),
      ...(query.usageScope ? { usageScope: query.usageScope } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(search
        ? {
            OR: [
              { prompt: { contains: search, mode: 'insensitive' } },
              { skillCode: { contains: search, mode: 'insensitive' } },
              { externalId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows, typeGroups, skillGroups] = await Promise.all([
      this.prisma.assessmentItem.count({ where }),
      this.prisma.assessmentItem.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: ITEM_INCLUDE,
      }),
      this.prisma.assessmentItem.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
      this.prisma.assessmentItem.groupBy({
        by: ['skillCode'],
      }),
    ]);

    let allTotal = 0;
    let mcqCount = 0;
    for (const row of typeGroups) {
      allTotal += row._count.id;
      if (row.type === ItemType.MULTIPLE_CHOICE) {
        mcqCount += row._count.id;
      }
    }

    return {
      items: rows.map((row) => mapAssessmentItemView(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      summary: {
        total: allTotal,
        mcqCount,
        clozeAndOtherCount: allTotal - mcqCount,
        coveredSkillsCount: skillGroups.length,
      },
    };
  }

  async createAssessmentItem(
    dto: CreateAdminAssessmentItemDto,
  ): Promise<AdminAssessmentItemView> {
    const itemType = dto.type ?? ItemType.MULTIPLE_CHOICE;
    if (itemType === ItemType.MULTIPLE_CHOICE) {
      const optionValues = extractOptionValues(dto.options);
      const correctOption = dto.correctOption?.trim();
      if (
        !Array.isArray(dto.options) ||
        dto.options.length < 2 ||
        !correctOption ||
        !optionValues.includes(correctOption)
      ) {
        throw new BadRequestException({
          code: 'ADMIN_INVALID_ASSESSMENT_ITEM',
          message:
            'Câu hỏi trắc nghiệm cần ít nhất 2 phương án và đáp án đúng phải khớp với một phương án.',
        });
      }
    }

    const externalId = dto.externalId?.trim() || undefined;
    if (externalId) {
      const dupExt = await this.prisma.assessmentItem.findUnique({
        where: { externalId },
        select: { id: true },
      });
      if (dupExt) {
        throw new ConflictException({
          code: 'ADMIN_ITEM_EXTERNAL_ID_EXISTS',
          message: `Mã Stable ID "${externalId}" đã tồn tại.`,
        });
      }
    }

    if (dto.groupId) {
      const group = await this.prisma.assessmentItemGroup.findUnique({
        where: { id: dto.groupId },
        select: { id: true },
      });
      if (!group) {
        throw new NotFoundException({
          code: 'ADMIN_GROUP_NOT_FOUND',
          message: 'Không tìm thấy nhóm câu hỏi đã chọn.',
        });
      }
    }

    const bankVersion = await resolveAdminPlacementBankVersion(
      {
        ...dto,
        type: itemType,
        usageScope: dto.usageScope ?? ItemUsageScope.ALL,
        options: (dto.options ?? null) as Prisma.JsonValue,
        correctOption: dto.correctOption?.trim() || null,
        passage: dto.passage?.trim() || null,
        audioUrl: dto.audioUrl?.trim() || null,
        irtA: dto.irtA ?? 1,
        irtB: dto.irtB ?? 0,
        irtC: dto.irtC ?? 0.25,
        groupId: dto.groupId ?? null,
      },
      this.mediaStorage,
    );

    const created = await this.prisma.assessmentItem.create({
      data: {
        ...(externalId ? { externalId } : {}),
        ...(dto.groupId !== undefined ? { groupId: dto.groupId } : {}),
        ...(dto.itemOrder !== undefined ? { itemOrder: dto.itemOrder } : {}),
        bankVersion,
        skill: dto.skill,
        skillCode: dto.skillCode.trim(),
        cefrLevel: dto.cefrLevel,
        type: itemType,
        usageScope: dto.usageScope ?? ItemUsageScope.ALL,
        passage: dto.passage?.trim() || null,
        prompt: dto.prompt.trim(),
        options:
          dto.options !== undefined
            ? (dto.options as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        correctOption: dto.correctOption?.trim() || null,
        explanation: dto.explanation?.trim() || null,
        audioUrl: dto.audioUrl?.trim() || null,
        rubricCriteria:
          dto.rubricCriteria !== undefined && dto.rubricCriteria !== null
            ? (dto.rubricCriteria as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        irtA: dto.irtA ?? 1.0,
        irtB: dto.irtB ?? 0.0,
        irtC: dto.irtC ?? 0.25,
      },
      include: ITEM_INCLUDE,
    });

    await this.assessmentMatrixService.invalidateCache();
    return mapAssessmentItemView(created);
  }

  async updateAssessmentItem(
    id: string,
    dto: UpdateAdminAssessmentItemDto,
  ): Promise<AdminAssessmentItemView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      await lockAssessmentItem(tx, id);
      const existing = await tx.assessmentItem.findUnique({
        where: { id },
        include: { _count: { select: { responses: true, currentSessions: true } } },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'ADMIN_ASSESSMENT_ITEM_NOT_FOUND',
          message: 'Không tìm thấy câu hỏi đánh giá.',
        });
      }

      const nextExternalId =
        dto.externalId !== undefined
          ? dto.externalId?.trim() || null
          : undefined;
      if (nextExternalId && nextExternalId !== existing.externalId) {
        const dup = await tx.assessmentItem.findUnique({
          where: { externalId: nextExternalId },
          select: { id: true },
        });
        if (dup && dup.id !== id) {
          throw new ConflictException({
            code: 'ADMIN_ITEM_EXTERNAL_ID_EXISTS',
            message: `Mã Stable ID "${nextExternalId}" đã tồn tại.`,
          });
        }
      }

      if (dto.groupId) {
        const group = await tx.assessmentItemGroup.findUnique({
          where: { id: dto.groupId },
          select: { id: true },
        });
        if (!group) {
          throw new NotFoundException({
            code: 'ADMIN_GROUP_NOT_FOUND',
            message: 'Không tìm thấy nhóm câu hỏi đã chọn.',
          });
        }
      }

      const nextType = dto.type ?? existing.type;
      const nextOptions =
        dto.options !== undefined ? dto.options : existing.options;
      const nextCorrectOption =
        dto.correctOption !== undefined
          ? dto.correctOption?.trim() || null
          : existing.correctOption?.trim() || null;

      if (nextType === ItemType.MULTIPLE_CHOICE) {
        const optionValues = extractOptionValues(nextOptions);
        if (
          !Array.isArray(nextOptions) ||
          nextOptions.length < 2 ||
          !nextCorrectOption ||
          !optionValues.includes(nextCorrectOption)
        ) {
          throw new BadRequestException({
            code: 'ADMIN_INVALID_ASSESSMENT_ITEM',
            message:
              'Câu hỏi trắc nghiệm cần ít nhất 2 phương án và đáp án đúng phải khớp với một phương án.',
          });
        }
      }

      const data = {
        ...(nextExternalId !== undefined ? { externalId: nextExternalId } : {}),
        ...(dto.groupId !== undefined ? { groupId: dto.groupId } : {}),
        ...(dto.itemOrder !== undefined ? { itemOrder: dto.itemOrder } : {}),
        ...(dto.skill !== undefined ? { skill: dto.skill } : {}),
        ...(dto.skillCode !== undefined
          ? { skillCode: dto.skillCode.trim() }
          : {}),
        ...(dto.cefrLevel !== undefined ? { cefrLevel: dto.cefrLevel } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.usageScope !== undefined ? { usageScope: dto.usageScope } : {}),
        ...(dto.passage !== undefined
          ? { passage: dto.passage?.trim() || null }
          : {}),
        ...(dto.prompt !== undefined ? { prompt: dto.prompt.trim() } : {}),
        ...(dto.options !== undefined
          ? {
              options:
                dto.options !== null
                  ? (dto.options as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
            }
          : {}),
        ...(dto.correctOption !== undefined
          ? { correctOption: dto.correctOption?.trim() || null }
          : {}),
        ...(dto.explanation !== undefined
          ? { explanation: dto.explanation?.trim() || null }
          : {}),
        ...(dto.audioUrl !== undefined
          ? { audioUrl: dto.audioUrl?.trim() || null }
          : {}),
        ...(dto.rubricCriteria !== undefined
          ? {
              rubricCriteria:
                dto.rubricCriteria !== null
                  ? (dto.rubricCriteria as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
            }
          : {}),
        ...(dto.irtA !== undefined ? { irtA: dto.irtA } : {}),
        ...(dto.irtB !== undefined ? { irtB: dto.irtB } : {}),
        ...(dto.irtC !== undefined ? { irtC: dto.irtC } : {}),
      };
      const next = {
        ...existing,
        ...data,
        options: (dto.options !== undefined
          ? dto.options
          : existing.options) as Prisma.JsonValue,
      };
      const bankVersion = await resolveAdminPlacementBankVersion(
        next,
        this.mediaStorage,
      );
      assertReferencedItemUnchanged(existing, { ...data, bankVersion });
      return tx.assessmentItem.update({
        where: { id },
        data: { ...data, bankVersion },
        include: ITEM_INCLUDE,
      });
    });

    await this.assessmentMatrixService.invalidateCache();
    return mapAssessmentItemView(updated);
  }

  async deleteAssessmentItem(
    id: string,
    force = false,
  ): Promise<{ id: string; action: 'DELETED' }> {
    await this.prisma.$transaction(async (tx) => {
      await lockAssessmentItem(tx, id);
      const item = await tx.assessmentItem.findUnique({
        where: { id },
        select: {
          id: true,
          _count: {
            select: {
              responses: true,
              currentSessions: true,
            },
          },
        },
      });

      if (!item) {
        throw new NotFoundException({
          code: 'ADMIN_ASSESSMENT_ITEM_NOT_FOUND',
          message: 'Không tìm thấy câu hỏi đánh giá.',
        });
      }

      const inUse =
        item._count.responses > 0 || item._count.currentSessions > 0;
      if (inUse && !force) {
        throw new ConflictException({
          code: 'ADMIN_ITEM_IN_USE',
          message:
            'Câu hỏi đã có lịch sử trả lời hoặc đang trong phiên kiểm tra. Xác nhận xoá cưỡng bức nếu muốn xoá kèm dữ liệu liên quan.',
        });
      }

      if (inUse) {
        await tx.placementSession.updateMany({
          where: {
            status: 'IN_PROGRESS',
            OR: [{ currentItemId: id }, { responses: { some: { itemId: id } } }],
          },
          data: {
            currentItemId: null,
            status: 'ABANDONED',
            version: { increment: 1 },
          },
        });
        await tx.assessmentResponse.deleteMany({ where: { itemId: id } });
        await tx.assessmentItem.delete({ where: { id } });
      } else {
        await tx.assessmentItem.delete({ where: { id } });
      }
    });

    await this.assessmentMatrixService.invalidateCache();
    return { id, action: 'DELETED' };
  }

  async listAssessmentGroups(
    query: AdminAssessmentGroupsQueryDto,
  ): Promise<PaginatedResult<AdminAssessmentGroupView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.AssessmentItemGroupWhereInput = {
      ...(query.skill ? { skill: query.skill } : {}),
      ...(query.cefrLevel ? { cefrLevel: query.cefrLevel } : {}),
      ...(query.usageScope ? { usageScope: query.usageScope } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { passage: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.assessmentItemGroup.count({ where }),
      this.prisma.assessmentItemGroup.findMany({
        where,
        orderBy: [{ cefrLevel: 'asc' }, { partNumber: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: {
            orderBy: [{ itemOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              externalId: true,
              itemOrder: true,
              skillCode: true,
              type: true,
              prompt: true,
            },
          },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return {
      items: rows.map((g) => ({
        id: g.id,
        skill: g.skill,
        title: g.title,
        cefrLevel: g.cefrLevel,
        partNumber: g.partNumber,
        passage: g.passage,
        audioUrl: g.audioUrl,
        transcript: g.transcript,
        usageScope: g.usageScope,
        itemsCount: g._count.items,
        items: g.items,
        createdAt: g.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async createAssessmentGroup(
    dto: CreateAssessmentItemGroupDto,
  ): Promise<AdminAssessmentGroupView> {
    const created = await this.prisma.$transaction(async (tx) => {
      const group = await tx.assessmentItemGroup.create({
        data: {
          skill: dto.skill,
          title: dto.title?.trim() || null,
          cefrLevel: dto.cefrLevel,
          partNumber: dto.partNumber,
          passage: dto.passage?.trim() || null,
          audioUrl: dto.audioUrl?.trim() || null,
          transcript: dto.transcript?.trim() || null,
          usageScope: dto.usageScope ?? ItemUsageScope.ALL,
        },
      });

      if (dto.itemIds?.length) {
        const uniqueIds = [...new Set(dto.itemIds)];
        for (let idx = 0; idx < uniqueIds.length; idx++) {
          await tx.assessmentItem.updateMany({
            where: { id: uniqueIds[idx] },
            data: { groupId: group.id, itemOrder: idx + 1, bankVersion: null },
          });
        }
      }

      return tx.assessmentItemGroup.findUniqueOrThrow({
        where: { id: group.id },
        include: {
          items: {
            orderBy: [{ itemOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              externalId: true,
              itemOrder: true,
              skillCode: true,
              type: true,
              prompt: true,
            },
          },
          _count: { select: { items: true } },
        },
      });
    });

    await this.assessmentMatrixService.invalidateCache();
    return {
      id: created.id,
      skill: created.skill,
      title: created.title,
      cefrLevel: created.cefrLevel,
      partNumber: created.partNumber,
      passage: created.passage,
      audioUrl: created.audioUrl,
      transcript: created.transcript,
      usageScope: created.usageScope,
      itemsCount: created._count.items,
      items: created.items,
      createdAt: created.createdAt,
    };
  }

  async updateAssessmentGroup(
    id: string,
    dto: UpdateAssessmentItemGroupDto,
  ): Promise<AdminAssessmentGroupView> {
    const existing = await this.prisma.assessmentItemGroup.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_GROUP_NOT_FOUND',
        message: 'Không tìm thấy nhóm đề luyện tập.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.assessmentItemGroup.update({
        where: { id },
        data: {
          ...(dto.skill !== undefined ? { skill: dto.skill } : {}),
          ...(dto.title !== undefined ? { title: dto.title?.trim() || null } : {}),
          ...(dto.cefrLevel !== undefined ? { cefrLevel: dto.cefrLevel } : {}),
          ...(dto.partNumber !== undefined ? { partNumber: dto.partNumber } : {}),
          ...(dto.passage !== undefined ? { passage: dto.passage?.trim() || null } : {}),
          ...(dto.audioUrl !== undefined ? { audioUrl: dto.audioUrl?.trim() || null } : {}),
          ...(dto.transcript !== undefined ? { transcript: dto.transcript?.trim() || null } : {}),
          ...(dto.usageScope !== undefined ? { usageScope: dto.usageScope } : {}),
        },
      });

      if (dto.itemIds !== undefined) {
        const uniqueIds = [...new Set(dto.itemIds)];
        await tx.assessmentItem.updateMany({
          where: { groupId: id, id: { notIn: uniqueIds } },
          data: { groupId: null, itemOrder: 1 },
        });
        for (let idx = 0; idx < uniqueIds.length; idx++) {
          await tx.assessmentItem.updateMany({
            where: { id: uniqueIds[idx] },
            data: { groupId: id, itemOrder: idx + 1, bankVersion: null },
          });
        }
      }

      return tx.assessmentItemGroup.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            orderBy: [{ itemOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              externalId: true,
              itemOrder: true,
              skillCode: true,
              type: true,
              prompt: true,
            },
          },
          _count: { select: { items: true } },
        },
      });
    });

    await this.assessmentMatrixService.invalidateCache();
    return {
      id: updated.id,
      skill: updated.skill,
      title: updated.title,
      cefrLevel: updated.cefrLevel,
      partNumber: updated.partNumber,
      passage: updated.passage,
      audioUrl: updated.audioUrl,
      transcript: updated.transcript,
      usageScope: updated.usageScope,
      itemsCount: updated._count.items,
      items: updated.items,
      createdAt: updated.createdAt,
    };
  }

  async deleteAssessmentGroup(
    id: string,
  ): Promise<{ id: string; action: 'DELETED'; detachedItemsCount: number }> {
    const existing = await this.prisma.assessmentItemGroup.findUnique({
      where: { id },
      select: { id: true, _count: { select: { items: true } } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_GROUP_NOT_FOUND',
        message: 'Không tìm thấy nhóm đề luyện tập.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      if (existing._count.items > 0) {
        await tx.assessmentItem.updateMany({
          where: { groupId: id },
          data: { groupId: null, itemOrder: 1 },
        });
      }
      await tx.assessmentItemGroup.delete({ where: { id } });
    });

    await this.assessmentMatrixService.invalidateCache();
    return { id, action: 'DELETED', detachedItemsCount: existing._count.items };
  }
}
