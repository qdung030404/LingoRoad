import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SpeakingMode } from '@prisma/client';
import { isSafeImageUrl } from '../../learning/learning.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminSpeakingQueryDto,
  CreateAdminSpeakingPromptDto,
  UpdateAdminSpeakingPromptDto,
} from '../dto/admin-speaking.dto';
import { PaginatedResult } from './admin-users.service';

export interface AdminSpeakingPromptView {
  id: string;
  code: string;
  mode: SpeakingMode;
  title: string;
  text: string;
  difficulty: number;
  maxDurationSeconds: number;
  hints: string[];
  sampleAsset: string | null;
  imageUrl: string | null;
  visualContext: string | null;
  preparation: Prisma.JsonValue | null;
  linkedReadAloudCodes: string[];
  contentVersion: number;
  sortOrder: number;
  published: boolean;
  submissionsCount: number;
}

export interface SpeakingPromptsSummary {
  total: number;
  published: number;
  readAloud: number;
  topic: number;
  pictureDescription: number;
  tongueTwister: number;
}

function normalizeHints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function validatePreparation(raw: Record<string, unknown>): Record<string, unknown> {
  const goal = typeof raw.goal === 'string' ? raw.goal.trim() : '';
  const sceneImageUrl =
    typeof raw.sceneImageUrl === 'string' && raw.sceneImageUrl.trim()
      ? raw.sceneImageUrl.trim()
      : undefined;
  if (sceneImageUrl && !isSafeImageUrl(sceneImageUrl)) {
    throw new BadRequestException({
      code: 'ADMIN_INVALID_SPEAKING_PREP',
      message: 'sceneImageUrl trong preparation không hợp lệ.',
    });
  }

  const vocabulary = Array.isArray(raw.vocabulary)
    ? raw.vocabulary
        .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === 'object'))
        .map((v) => {
          const img = typeof v.imageUrl === 'string' && v.imageUrl.trim() ? v.imageUrl.trim() : undefined;
          if (img && !isSafeImageUrl(img)) {
            throw new BadRequestException({
              code: 'ADMIN_INVALID_SPEAKING_PREP',
              message: 'Ảnh từ vựng trong preparation không hợp lệ.',
            });
          }
          return {
            word: String(v.word ?? '').trim(),
            meaningVi: String(v.meaningVi ?? '').trim(),
            example: String(v.example ?? '').trim(),
            ...(img ? { imageUrl: img } : {}),
          };
        })
        .filter((v) => v.word && v.meaningVi)
    : [];

  const phrases = Array.isArray(raw.phrases)
    ? raw.phrases
        .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
        .map((p) => ({
          text: String(p.text ?? '').trim(),
          meaningVi: String(p.meaningVi ?? '').trim(),
        }))
        .filter((p) => p.text && p.meaningVi)
    : [];

  return {
    ...(goal ? { goal } : {}),
    ...(sceneImageUrl ? { sceneImageUrl } : {}),
    vocabulary,
    phrases,
  };
}

@Injectable()
export class AdminSpeakingService {
  constructor(private readonly prisma: PrismaService) {}

  async listPrompts(
    query: AdminSpeakingQueryDto,
  ): Promise<PaginatedResult<AdminSpeakingPromptView, SpeakingPromptsSummary>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.SpeakingPromptWhereInput = {
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.published !== undefined ? { published: query.published === 'true' } : {}),
      ...(query.difficulty !== undefined ? { difficulty: query.difficulty } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
              { text: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows, modeGroups, publishedCount] = await Promise.all([
      this.prisma.speakingPrompt.count({ where }),
      this.prisma.speakingPrompt.findMany({
        where,
        orderBy: [{ mode: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { submissions: true } } },
      }),
      this.prisma.speakingPrompt.groupBy({
        by: ['mode'],
        _count: { id: true },
      }),
      this.prisma.speakingPrompt.count({ where: { published: true } }),
    ]);

    const byMode = new Map<SpeakingMode, number>(
      modeGroups.map((g) => [g.mode, g._count.id]),
    );
    const allTotal = modeGroups.reduce((sum, g) => sum + g._count.id, 0);

    return {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        mode: row.mode,
        title: row.title,
        text: row.text,
        difficulty: row.difficulty,
        maxDurationSeconds: row.maxDurationSeconds,
        hints: normalizeHints(row.hints),
        sampleAsset: row.sampleAsset,
        imageUrl: row.imageUrl,
        visualContext: row.visualContext,
        preparation: row.preparation ?? null,
        linkedReadAloudCodes: row.linkedReadAloudCodes ?? [],
        contentVersion: row.contentVersion,
        sortOrder: row.sortOrder,
        published: row.published,
        submissionsCount: row._count.submissions,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      summary: {
        total: allTotal,
        published: publishedCount,
        readAloud: byMode.get(SpeakingMode.READ_ALOUD) ?? 0,
        topic: byMode.get(SpeakingMode.TOPIC) ?? 0,
        pictureDescription: byMode.get(SpeakingMode.PICTURE_DESCRIPTION) ?? 0,
        tongueTwister: byMode.get(SpeakingMode.TONGUE_TWISTER) ?? 0,
      },
    };
  }

  async createPrompt(dto: CreateAdminSpeakingPromptDto): Promise<AdminSpeakingPromptView> {
    const code = dto.code.trim().toLowerCase();
    const existing = await this.prisma.speakingPrompt.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ADMIN_SPEAKING_CODE_EXISTS',
        message: `Mã đề luyện nói "${code}" đã tồn tại.`,
      });
    }

    const imageUrl = dto.imageUrl?.trim() || null;
    if (imageUrl && !isSafeImageUrl(imageUrl)) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_SPEAKING_IMAGE',
        message: 'Đường dẫn ảnh minh họa không hợp lệ.',
      });
    }
    if (dto.mode === SpeakingMode.PICTURE_DESCRIPTION && !imageUrl) {
      throw new BadRequestException({
        code: 'ADMIN_PICTURE_IMAGE_REQUIRED',
        message: 'Chế độ Mô tả tranh (PICTURE_DESCRIPTION) bắt buộc có ảnh minh họa.',
      });
    }

    const prep = dto.preparation ? validatePreparation(dto.preparation) : null;

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxRow = await this.prisma.speakingPrompt.aggregate({
        where: { mode: dto.mode },
        _max: { sortOrder: true },
      });
      sortOrder = (maxRow._max.sortOrder ?? 0) + 1;
    }

    const created = await this.prisma.speakingPrompt.create({
      data: {
        code,
        mode: dto.mode,
        title: dto.title.trim(),
        text: dto.text.trim(),
        difficulty: dto.difficulty ?? 1,
        maxDurationSeconds:
          dto.maxDurationSeconds ??
          (dto.mode === SpeakingMode.TOPIC || dto.mode === SpeakingMode.PICTURE_DESCRIPTION
            ? 60
            : 30),
        hints: normalizeHints(dto.hints),
        sampleAsset: dto.sampleAsset?.trim() || null,
        imageUrl,
        visualContext: dto.visualContext?.trim() || null,
        preparation: prep ? (prep as Prisma.InputJsonValue) : Prisma.JsonNull,
        linkedReadAloudCodes: (dto.linkedReadAloudCodes ?? [])
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean),
        sortOrder,
        published: dto.published ?? true,
      },
      include: { _count: { select: { submissions: true } } },
    });

    return {
      id: created.id,
      code: created.code,
      mode: created.mode,
      title: created.title,
      text: created.text,
      difficulty: created.difficulty,
      maxDurationSeconds: created.maxDurationSeconds,
      hints: normalizeHints(created.hints),
      sampleAsset: created.sampleAsset,
      imageUrl: created.imageUrl,
      visualContext: created.visualContext,
      preparation: created.preparation ?? null,
      linkedReadAloudCodes: created.linkedReadAloudCodes ?? [],
      contentVersion: created.contentVersion,
      sortOrder: created.sortOrder,
      published: created.published,
      submissionsCount: created._count.submissions,
    };
  }

  async updatePrompt(
    id: string,
    dto: UpdateAdminSpeakingPromptDto,
  ): Promise<AdminSpeakingPromptView> {
    const existing = await this.prisma.speakingPrompt.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_SPEAKING_NOT_FOUND',
        message: 'Không tìm thấy đề luyện nói.',
      });
    }

    const nextCode = dto.code?.trim().toLowerCase();
    if (nextCode && nextCode !== existing.code) {
      const dup = await this.prisma.speakingPrompt.findUnique({
        where: { code: nextCode },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException({
          code: 'ADMIN_SPEAKING_CODE_EXISTS',
          message: `Mã đề luyện nói "${nextCode}" đã tồn tại.`,
        });
      }
    }

    const nextMode = dto.mode ?? existing.mode;
    const nextImageUrl =
      dto.imageUrl !== undefined ? dto.imageUrl?.trim() || null : existing.imageUrl;
    if (nextImageUrl && !isSafeImageUrl(nextImageUrl)) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_SPEAKING_IMAGE',
        message: 'Đường dẫn ảnh minh họa không hợp lệ.',
      });
    }
    if (nextMode === SpeakingMode.PICTURE_DESCRIPTION && !nextImageUrl) {
      throw new BadRequestException({
        code: 'ADMIN_PICTURE_IMAGE_REQUIRED',
        message: 'Chế độ Mô tả tranh (PICTURE_DESCRIPTION) bắt buộc có ảnh minh họa.',
      });
    }

    const nextPrep =
      dto.preparation !== undefined
        ? dto.preparation
          ? (validatePreparation(dto.preparation) as Prisma.InputJsonValue)
          : Prisma.JsonNull
        : undefined;

    const contentChanged =
      dto.text !== undefined ||
      dto.hints !== undefined ||
      dto.visualContext !== undefined ||
      dto.preparation !== undefined ||
      dto.imageUrl !== undefined ||
      dto.mode !== undefined;

    const updated = await this.prisma.speakingPrompt.update({
      where: { id },
      data: {
        ...(nextCode ? { code: nextCode } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.text !== undefined ? { text: dto.text.trim() } : {}),
        ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
        ...(dto.maxDurationSeconds !== undefined
          ? { maxDurationSeconds: dto.maxDurationSeconds }
          : {}),
        ...(dto.hints !== undefined ? { hints: normalizeHints(dto.hints) } : {}),
        ...(dto.sampleAsset !== undefined
          ? { sampleAsset: dto.sampleAsset?.trim() || null }
          : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: nextImageUrl } : {}),
        ...(dto.visualContext !== undefined
          ? { visualContext: dto.visualContext?.trim() || null }
          : {}),
        ...(nextPrep !== undefined ? { preparation: nextPrep } : {}),
        ...(dto.linkedReadAloudCodes !== undefined
          ? {
              linkedReadAloudCodes: dto.linkedReadAloudCodes
                .map((c) => c.trim().toLowerCase())
                .filter(Boolean),
            }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
        ...(contentChanged ? { contentVersion: { increment: 1 } } : {}),
      },
      include: { _count: { select: { submissions: true } } },
    });

    return {
      id: updated.id,
      code: updated.code,
      mode: updated.mode,
      title: updated.title,
      text: updated.text,
      difficulty: updated.difficulty,
      maxDurationSeconds: updated.maxDurationSeconds,
      hints: normalizeHints(updated.hints),
      sampleAsset: updated.sampleAsset,
      imageUrl: updated.imageUrl,
      visualContext: updated.visualContext,
      preparation: updated.preparation ?? null,
      linkedReadAloudCodes: updated.linkedReadAloudCodes ?? [],
      contentVersion: updated.contentVersion,
      sortOrder: updated.sortOrder,
      published: updated.published,
      submissionsCount: updated._count.submissions,
    };
  }

  async deletePrompt(
    id: string,
    force = false,
  ): Promise<{ id: string; action: 'DELETED' | 'UNPUBLISHED'; submissionsCount: number }> {
    const existing = await this.prisma.speakingPrompt.findUnique({
      where: { id },
      select: { id: true, _count: { select: { submissions: true } } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_SPEAKING_NOT_FOUND',
        message: 'Không tìm thấy đề luyện nói.',
      });
    }

    const submissionsCount = existing._count.submissions;
    if (submissionsCount === 0) {
      await this.prisma.speakingPrompt.delete({ where: { id } });
      return { id, action: 'DELETED', submissionsCount: 0 };
    }

    if (!force) {
      await this.prisma.speakingPrompt.update({
        where: { id },
        data: { published: false },
      });
      return { id, action: 'UNPUBLISHED', submissionsCount };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.speakingSubmission.deleteMany({ where: { promptId: id } });
      await tx.speakingPrompt.delete({ where: { id } });
    });

    return { id, action: 'DELETED', submissionsCount };
  }
}
