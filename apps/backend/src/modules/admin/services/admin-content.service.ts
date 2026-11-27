import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { LearningKind, Prisma } from '@prisma/client';
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
  createAssessmentGroupHelper,
  createAssessmentItemHelper,
  deleteAssessmentGroupHelper,
  deleteAssessmentItemHelper,
  listAssessmentGroupsHelper,
  listAssessmentItemsHelper,
  updateAssessmentGroupHelper,
  updateAssessmentItemHelper,
} from './admin-content-assessment.helper';
import {
  AdminAssessmentGroupView,
  AdminAssessmentItemView,
  AdminLessonDetail,
  AdminLessonSummary,
  AdminUnitItem,
  AssessmentItemsSummary,
  LESSON_INCLUDE,
  LessonsListSummary,
  extractPrimarySkillCode,
  extractQuestionsCount,
} from './admin-content.types';

export {
  AdminAssessmentGroupView,
  AdminAssessmentItemView,
  AdminLessonDetail,
  AdminLessonSummary,
  AdminUnitItem,
  AssessmentItemsSummary,
  LessonsListSummary,
} from './admin-content.types';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assessmentMatrixService: AssessmentMatrixService,
    @Optional() private readonly mediaStorage?: MediaStorageService,
  ) {}

  private get assessmentDeps() {
    return {
      prisma: this.prisma,
      assessmentMatrixService: this.assessmentMatrixService,
      mediaStorage: this.mediaStorage,
    };
  }

  async listUnits(): Promise<AdminUnitItem[]> {
    const rows = await this.prisma.learningUnit.findMany({
      orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }],
      include: { _count: { select: { lessons: true } } },
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
        cefrLevel_orderIndex: { cefrLevel: dto.cefrLevel, orderIndex: dto.orderIndex },
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
      include: { _count: { select: { lessons: true } } },
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
        where: { cefrLevel_orderIndex: { cefrLevel: nextCefr, orderIndex: nextOrder } },
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
      include: { _count: { select: { lessons: true } } },
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
      select: { id: true, _count: { select: { lessons: true } } },
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
        await tx.learningLesson.updateMany({ where: { unitId: id }, data: { unitId: null } });
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
      ...(query.published !== undefined ? { published: query.published === 'true' } : {}),
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
      this.prisma.learningLesson.findMany({ select: { published: true, content: true } }),
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
      pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
      summary: {
        total: allLessons.length,
        published: publishedCount,
        drafts: allLessons.length - publishedCount,
        linkedQuestions,
      },
    };
  }

  async getLesson(id: string): Promise<AdminLessonDetail> {
    const row = await this.prisma.learningLesson.findUnique({ where: { id }, include: LESSON_INCLUDE });
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
        message: error instanceof Error ? error.message : 'Nội dung bài tập không hợp lệ.',
      });
    }

    const existing = await this.prisma.learningLesson.findUnique({ where: { code }, select: { id: true } });
    if (existing) {
      throw new ConflictException({
        code: 'ADMIN_LESSON_CODE_EXISTS',
        message: `Mã bài học "${code}" đã tồn tại.`,
      });
    }

    if (dto.unitId) {
      const unit = await this.prisma.learningUnit.findUnique({ where: { id: dto.unitId }, select: { id: true } });
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
      const maxRow = await this.prisma.learningLesson.aggregate({ _max: { sortOrder: true } });
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

  async updateLesson(id: string, dto: UpdateAdminLessonDto): Promise<AdminLessonDetail> {
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
          message: error instanceof Error ? error.message : 'Nội dung bài tập không hợp lệ.',
        });
      }
    }

    const nextCode = dto.code?.trim().toLowerCase();
    if (nextCode && nextCode !== current.code) {
      const duplicate = await this.prisma.learningLesson.findUnique({ where: { code: nextCode }, select: { id: true } });
      if (duplicate) {
        throw new ConflictException({
          code: 'ADMIN_LESSON_CODE_EXISTS',
          message: `Mã bài học "${nextCode}" đã tồn tại.`,
        });
      }
    }

    if (dto.unitId) {
      const unit = await this.prisma.learningUnit.findUnique({ where: { id: dto.unitId }, select: { id: true } });
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
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.estimatedMinutes !== undefined ? { estimatedMinutes: dto.estimatedMinutes } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
        ...(dto.unitId !== undefined ? { unitId: dto.unitId } : {}),
        ...nextGrammarTopicData,
        ...(dto.content !== undefined ? { content: dto.content as Prisma.InputJsonValue } : {}),
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
  ): Promise<{ id: string; action: 'DELETED' | 'UNPUBLISHED'; attemptsCount: number }> {
    const lesson = await this.prisma.learningLesson.findUnique({
      where: { id },
      select: { id: true, _count: { select: { attempts: true } } },
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
      await this.prisma.learningLesson.update({ where: { id }, data: { published: false } });
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
      tx.learningLesson.updateMany({ where: { id: { in: uniqueIds } }, data: { published: dto.published } }),
    );

    return { updatedCount: updated.count, published: dto.published, ids: uniqueIds };
  }

  listDescriptors(): readonly CanDoDescriptor[] {
    return CEFR_CAN_DO_DESCRIPTORS;
  }

  listAssessmentItems(
    query: AdminAssessmentItemsQueryDto,
  ): Promise<PaginatedResult<AdminAssessmentItemView, AssessmentItemsSummary>> {
    return listAssessmentItemsHelper(this.assessmentDeps, query);
  }

  createAssessmentItem(dto: CreateAdminAssessmentItemDto): Promise<AdminAssessmentItemView> {
    return createAssessmentItemHelper(this.assessmentDeps, dto);
  }

  updateAssessmentItem(id: string, dto: UpdateAdminAssessmentItemDto): Promise<AdminAssessmentItemView> {
    return updateAssessmentItemHelper(this.assessmentDeps, id, dto);
  }

  deleteAssessmentItem(id: string, force = false): Promise<{ id: string; action: 'DELETED' }> {
    return deleteAssessmentItemHelper(this.assessmentDeps, id, force);
  }

  listAssessmentGroups(
    query: AdminAssessmentGroupsQueryDto,
  ): Promise<PaginatedResult<AdminAssessmentGroupView>> {
    return listAssessmentGroupsHelper(this.assessmentDeps, query);
  }

  createAssessmentGroup(dto: CreateAssessmentItemGroupDto): Promise<AdminAssessmentGroupView> {
    return createAssessmentGroupHelper(this.assessmentDeps, dto);
  }

  updateAssessmentGroup(
    id: string,
    dto: UpdateAssessmentItemGroupDto,
  ): Promise<AdminAssessmentGroupView> {
    return updateAssessmentGroupHelper(this.assessmentDeps, id, dto);
  }

  deleteAssessmentGroup(
    id: string,
  ): Promise<{ id: string; action: 'DELETED'; detachedItemsCount: number }> {
    return deleteAssessmentGroupHelper(this.assessmentDeps, id);
  }
}
