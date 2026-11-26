import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
import { validateLearningContent } from '../../learning/learning.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminAssessmentItemsQueryDto,
  AdminLessonsQueryDto,
  CreateAdminAssessmentItemDto,
  CreateAdminLessonDto,
  CreateLearningUnitDto,
  UpdateAdminAssessmentItemDto,
  UpdateAdminLessonDto,
} from '../dto/admin-content.dto';
import { PaginatedResult } from './admin-users.service';

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
  irtA: number;
  irtB: number;
  irtC: number;
  responsesCount: number;
  createdAt: Date;
}

export interface AssessmentItemsSummary {
  total: number;
  mcqCount: number;
  clozeAndOtherCount: number;
  coveredSkillsCount: number;
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

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentMatrixService: AssessmentMatrixService,
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
        include: {
          unit: {
            select: {
              id: true,
              code: true,
              title: true,
              cefrLevel: true,
            },
          },
          _count: {
            select: { attempts: true },
          },
        },
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
      include: {
        unit: {
          select: {
            id: true,
            code: true,
            title: true,
            cefrLevel: true,
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
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
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async createLesson(dto: CreateAdminLessonDto): Promise<AdminLessonDetail> {
    const code = dto.code.trim().toLowerCase();
    try {
      validateLearningContent(dto.content, dto.kind);
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
        content: dto.content as Prisma.InputJsonValue,
      },
      include: {
        unit: {
          select: {
            id: true,
            code: true,
            title: true,
            cefrLevel: true,
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
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
      select: { id: true, code: true, kind: true },
    });
    if (!current) {
      throw new NotFoundException({
        code: 'ADMIN_LESSON_NOT_FOUND',
        message: 'Không tìm thấy bài tập.',
      });
    }

    const nextKind = dto.kind ?? current.kind;
    if (dto.content !== undefined) {
      try {
        validateLearningContent(dto.content, nextKind);
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
        ...(dto.content !== undefined
          ? {
              content: dto.content as Prisma.InputJsonValue,
              contentVersion: { increment: 1 },
            }
          : {}),
      },
      include: {
        unit: {
          select: {
            id: true,
            code: true,
            title: true,
            cefrLevel: true,
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
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
        include: {
          _count: {
            select: { responses: true },
          },
        },
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
      items: rows.map((row) => ({
        id: row.id,
        externalId: row.externalId,
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
        irtA: row.irtA,
        irtB: row.irtB,
        irtC: row.irtC,
        responsesCount: row._count.responses,
        createdAt: row.createdAt,
      })),
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

    const created = await this.prisma.assessmentItem.create({
      data: {
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
        irtA: dto.irtA ?? 1.0,
        irtB: dto.irtB ?? 0.0,
        irtC: dto.irtC ?? 0.25,
      },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    });

    await this.assessmentMatrixService.invalidateCache();

    return {
      id: created.id,
      externalId: created.externalId,
      skill: created.skill,
      skillCode: created.skillCode,
      cefrLevel: created.cefrLevel,
      type: created.type,
      usageScope: created.usageScope,
      passage: created.passage,
      prompt: created.prompt,
      options: created.options,
      correctOption: created.correctOption,
      explanation: created.explanation,
      audioUrl: created.audioUrl,
      irtA: created.irtA,
      irtB: created.irtB,
      irtC: created.irtC,
      responsesCount: created._count.responses,
      createdAt: created.createdAt,
    };
  }

  async updateAssessmentItem(
    id: string,
    dto: UpdateAdminAssessmentItemDto,
  ): Promise<AdminAssessmentItemView> {
    const existing = await this.prisma.assessmentItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_ASSESSMENT_ITEM_NOT_FOUND',
        message: 'Không tìm thấy câu hỏi đánh giá.',
      });
    }

    const nextType = dto.type ?? existing.type;
    const nextOptions =
      dto.options !== undefined ? dto.options : existing.options;
    const nextCorrectOption =
      dto.correctOption !== undefined
        ? dto.correctOption.trim()
        : existing.correctOption?.trim();

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

    const updated = await this.prisma.assessmentItem.update({
      where: { id },
      data: {
        ...(dto.skill !== undefined ? { skill: dto.skill } : {}),
        ...(dto.skillCode !== undefined
          ? { skillCode: dto.skillCode.trim() }
          : {}),
        ...(dto.cefrLevel !== undefined ? { cefrLevel: dto.cefrLevel } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.usageScope !== undefined ? { usageScope: dto.usageScope } : {}),
        ...(dto.passage !== undefined
          ? { passage: dto.passage.trim() || null }
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
          ? { correctOption: dto.correctOption.trim() || null }
          : {}),
        ...(dto.explanation !== undefined
          ? { explanation: dto.explanation.trim() || null }
          : {}),
        ...(dto.audioUrl !== undefined
          ? { audioUrl: dto.audioUrl.trim() || null }
          : {}),
        ...(dto.irtA !== undefined ? { irtA: dto.irtA } : {}),
        ...(dto.irtB !== undefined ? { irtB: dto.irtB } : {}),
        ...(dto.irtC !== undefined ? { irtC: dto.irtC } : {}),
      },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    });

    await this.assessmentMatrixService.invalidateCache();

    return {
      id: updated.id,
      externalId: updated.externalId,
      skill: updated.skill,
      skillCode: updated.skillCode,
      cefrLevel: updated.cefrLevel,
      type: updated.type,
      usageScope: updated.usageScope,
      passage: updated.passage,
      prompt: updated.prompt,
      options: updated.options,
      correctOption: updated.correctOption,
      explanation: updated.explanation,
      audioUrl: updated.audioUrl,
      irtA: updated.irtA,
      irtB: updated.irtB,
      irtC: updated.irtC,
      responsesCount: updated._count.responses,
      createdAt: updated.createdAt,
    };
  }

  async deleteAssessmentItem(
    id: string,
    force = false,
  ): Promise<{ id: string; action: 'DELETED' }> {
    const item = await this.prisma.assessmentItem.findUnique({
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
          'Câu hỏi đã có lịch sử trả lời. Xác nhận xoá cưỡng bức nếu muốn xoá kèm dữ liệu liên quan.',
      });
    }

    if (inUse) {
      await this.prisma.$transaction(async (tx) => {
        await tx.placementSession.updateMany({
          where: { currentItemId: id },
          data: { currentItemId: null },
        });
        await tx.assessmentResponse.deleteMany({ where: { itemId: id } });
        await tx.assessmentItem.delete({ where: { id } });
      });
    } else {
      await this.prisma.assessmentItem.delete({ where: { id } });
    }

    await this.assessmentMatrixService.invalidateCache();

    return { id, action: 'DELETED' };
  }
}
