import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ItemType, ItemUsageScope, Prisma } from '@prisma/client';
import { AssessmentMatrixService } from '../../assessment/services/assessment-matrix.service';
import { MediaStorageService } from '../../media/media-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminAssessmentGroupsQueryDto,
  AdminAssessmentItemsQueryDto,
  CreateAdminAssessmentItemDto,
  CreateAssessmentItemGroupDto,
  UpdateAdminAssessmentItemDto,
  UpdateAssessmentItemGroupDto,
} from '../dto/admin-content.dto';
import { PaginatedResult } from './admin-users.service';
import {
  AdminAssessmentGroupView,
  AdminAssessmentItemView,
  AssessmentItemsSummary,
  ITEM_INCLUDE,
  extractOptionValues,
  mapAssessmentItemView,
} from './admin-content.types';
import {
  assertReferencedItemUnchanged,
  lockAssessmentItem,
  resolveAdminPlacementBankVersion,
} from './assessment-item-integrity';

export interface AdminContentDeps {
  prisma: PrismaService;
  assessmentMatrixService: AssessmentMatrixService;
  mediaStorage?: MediaStorageService;
}

export async function listAssessmentItemsHelper(
  deps: AdminContentDeps,
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
    deps.prisma.assessmentItem.count({ where }),
    deps.prisma.assessmentItem.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: ITEM_INCLUDE,
    }),
    deps.prisma.assessmentItem.groupBy({ by: ['type'], _count: { id: true } }),
    deps.prisma.assessmentItem.groupBy({ by: ['skillCode'] }),
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

export async function createAssessmentItemHelper(
  deps: AdminContentDeps,
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
    const dupExt = await deps.prisma.assessmentItem.findUnique({
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
    const group = await deps.prisma.assessmentItemGroup.findUnique({
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
    deps.mediaStorage,
  );

  const created = await deps.prisma.assessmentItem.create({
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

  await deps.assessmentMatrixService.invalidateCache();
  return mapAssessmentItemView(created);
}

export async function updateAssessmentItemHelper(
  deps: AdminContentDeps,
  id: string,
  dto: UpdateAdminAssessmentItemDto,
): Promise<AdminAssessmentItemView> {
  const updated = await deps.prisma.$transaction(async (tx) => {
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
      dto.externalId !== undefined ? dto.externalId?.trim() || null : undefined;
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
    const nextOptions = dto.options !== undefined ? dto.options : existing.options;
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
      ...(dto.skillCode !== undefined ? { skillCode: dto.skillCode.trim() } : {}),
      ...(dto.cefrLevel !== undefined ? { cefrLevel: dto.cefrLevel } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.usageScope !== undefined ? { usageScope: dto.usageScope } : {}),
      ...(dto.passage !== undefined ? { passage: dto.passage?.trim() || null } : {}),
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
      deps.mediaStorage,
    );
    assertReferencedItemUnchanged(existing, { ...data, bankVersion });
    return tx.assessmentItem.update({
      where: { id },
      data: { ...data, bankVersion },
      include: ITEM_INCLUDE,
    });
  });

  await deps.assessmentMatrixService.invalidateCache();
  return mapAssessmentItemView(updated);
}

export async function deleteAssessmentItemHelper(
  deps: AdminContentDeps,
  id: string,
  force = false,
): Promise<{ id: string; action: 'DELETED' }> {
  await deps.prisma.$transaction(async (tx) => {
    await lockAssessmentItem(tx, id);
    const item = await tx.assessmentItem.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { responses: true, currentSessions: true } },
      },
    });
    if (!item) {
      throw new NotFoundException({
        code: 'ADMIN_ASSESSMENT_ITEM_NOT_FOUND',
        message: 'Không tìm thấy câu hỏi đánh giá.',
      });
    }

    const inUse = item._count.responses > 0 || item._count.currentSessions > 0;
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
        data: { currentItemId: null, status: 'ABANDONED', version: { increment: 1 } },
      });
      await tx.assessmentResponse.deleteMany({ where: { itemId: id } });
    }
    await tx.assessmentItem.delete({ where: { id } });
  });

  await deps.assessmentMatrixService.invalidateCache();
  return { id, action: 'DELETED' };
}

const GROUP_INCLUDE = {
  items: {
    orderBy: [{ itemOrder: 'asc' as const }, { createdAt: 'asc' as const }],
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
};

async function syncAssessmentGroupItems(
  tx: Prisma.TransactionClient,
  groupId: string,
  itemIds: string[],
  detachExisting: boolean,
): Promise<void> {
  const uniqueIds = [...new Set(itemIds)];

  if (detachExisting) {
    const candidates = await tx.assessmentItem.findMany({
      where: {
        groupId,
        ...(uniqueIds.length > 0 ? { id: { notIn: uniqueIds } } : {}),
      },
      select: { id: true },
    });
    if (candidates.length > 0) {
      const detachIds = candidates.map((c) => c.id).sort();
      for (const itemId of detachIds) {
        await lockAssessmentItem(tx, itemId);
      }
      const lockedDetach = await tx.assessmentItem.findMany({
        where: { id: { in: detachIds } },
        select: {
          id: true,
          _count: { select: { responses: true, currentSessions: true } },
        },
      });
      const inUse = lockedDetach.find(
        (item) => item._count.responses > 0 || item._count.currentSessions > 0,
      );
      if (inUse) {
        throw new ConflictException({
          code: 'ADMIN_ITEM_IN_USE',
          message:
            'Không thể gỡ câu hỏi đã có lịch sử trả lời hoặc đang trong phiên kiểm tra khỏi nhóm.',
        });
      }
      await tx.assessmentItem.updateMany({
        where: { id: { in: detachIds } },
        data: { groupId: null, itemOrder: 1 },
      });
    }
  }

  if (uniqueIds.length === 0) return;

  for (const itemId of [...uniqueIds].sort()) {
    await lockAssessmentItem(tx, itemId);
  }

  const foundItems = await tx.assessmentItem.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      groupId: true,
      itemOrder: true,
      bankVersion: true,
      _count: { select: { responses: true, currentSessions: true } },
    },
  });
  if (foundItems.length !== uniqueIds.length) {
    throw new NotFoundException({
      code: 'ADMIN_ASSESSMENT_ITEM_NOT_FOUND',
      message: 'Một hoặc nhiều câu hỏi trong danh sách không tồn tại.',
    });
  }

  const foundById = new Map(foundItems.map((item) => [item.id, item]));
  const itemsToUpdate: Array<{ id: string; itemOrder: number }> = [];
  for (let idx = 0; idx < uniqueIds.length; idx++) {
    const itemId = uniqueIds[idx];
    const existing = foundById.get(itemId)!;
    const nextOrder = idx + 1;
    const changed =
      existing.groupId !== groupId ||
      existing.itemOrder !== nextOrder ||
      existing.bankVersion !== null;
    if (!changed) continue;
    if (existing._count.responses > 0 || existing._count.currentSessions > 0) {
      throw new ConflictException({
        code: 'ADMIN_ITEM_IN_USE',
        message:
          'Câu hỏi đã được sử dụng trong bài kiểm tra không thể chuyển nhóm hoặc thay đổi thứ tự.',
      });
    }
    itemsToUpdate.push({ id: itemId, itemOrder: nextOrder });
  }

  for (const entry of itemsToUpdate) {
    await tx.assessmentItem.updateMany({
      where: { id: entry.id },
      data: { groupId, itemOrder: entry.itemOrder, bankVersion: null },
    });
  }
}

export async function listAssessmentGroupsHelper(
  deps: AdminContentDeps,
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
    deps.prisma.assessmentItemGroup.count({ where }),
    deps.prisma.assessmentItemGroup.findMany({
      where,
      orderBy: [{ cefrLevel: 'asc' }, { partNumber: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: GROUP_INCLUDE,
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
    pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
  };
}

export async function createAssessmentGroupHelper(
  deps: AdminContentDeps,
  dto: CreateAssessmentItemGroupDto,
): Promise<AdminAssessmentGroupView> {
  const created = await deps.prisma.$transaction(async (tx) => {
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
      await syncAssessmentGroupItems(tx, group.id, dto.itemIds, false);
    }
    return tx.assessmentItemGroup.findUniqueOrThrow({ where: { id: group.id }, include: GROUP_INCLUDE });
  });

  await deps.assessmentMatrixService.invalidateCache();
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

export async function updateAssessmentGroupHelper(
  deps: AdminContentDeps,
  id: string,
  dto: UpdateAssessmentItemGroupDto,
): Promise<AdminAssessmentGroupView> {
  const existing = await deps.prisma.assessmentItemGroup.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new NotFoundException({
      code: 'ADMIN_GROUP_NOT_FOUND',
      message: 'Không tìm thấy nhóm đề luyện tập.',
    });
  }

  const updated = await deps.prisma.$transaction(async (tx) => {
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
      await syncAssessmentGroupItems(tx, id, dto.itemIds, true);
    }
    return tx.assessmentItemGroup.findUniqueOrThrow({ where: { id }, include: GROUP_INCLUDE });
  });

  await deps.assessmentMatrixService.invalidateCache();
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

export async function deleteAssessmentGroupHelper(
  deps: AdminContentDeps,
  id: string,
): Promise<{ id: string; action: 'DELETED'; detachedItemsCount: number }> {
  const existing = await deps.prisma.assessmentItemGroup.findUnique({
    where: { id },
    select: { id: true, _count: { select: { items: true } } },
  });
  if (!existing) {
    throw new NotFoundException({
      code: 'ADMIN_GROUP_NOT_FOUND',
      message: 'Không tìm thấy nhóm đề luyện tập.',
    });
  }

  await deps.prisma.$transaction(async (tx) => {
    if (existing._count.items > 0) {
      await tx.assessmentItem.updateMany({
        where: { groupId: id },
        data: { groupId: null, itemOrder: 1 },
      });
    }
    await tx.assessmentItemGroup.delete({ where: { id } });
  });

  await deps.assessmentMatrixService.invalidateCache();
  return { id, action: 'DELETED', detachedItemsCount: existing._count.items };
}
