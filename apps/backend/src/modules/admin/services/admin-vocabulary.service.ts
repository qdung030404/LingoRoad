import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CuratedVocabularyService } from '../../vocabulary/curated-vocabulary.service';
import {
  AdminVocabularyWordsQueryDto,
  CreateAdminCuratedTopicDto,
  CreateAdminCuratedWordDto,
  UpdateAdminCuratedTopicDto,
  UpdateAdminCuratedWordDto,
} from '../dto/admin-vocabulary.dto';
import { PaginatedResult } from './admin-users.service';

export interface AdminCuratedTopicView {
  id: string;
  slug: string;
  titleEn: string;
  titleVi: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  wordsCount: number;
  createdAt: Date;
}

export interface AdminCuratedWordView {
  id: string;
  topicId: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  imageUrl: string | null;
  audioUrl: string | null;
  createdAt: Date;
}

function isSafeUrl(url: string): boolean {
  if (!url || url.length > 500 || url.includes('..') || /[\s\u0000-\u001f]/.test(url)) {
    return false;
  }
  return (
    /^https?:\/\/[^\s]+$/i.test(url) ||
    /^\/media\/[a-z0-9/_.-]+$/i.test(url) ||
    /^assets\/[a-z0-9/_.-]+$/i.test(url)
  );
}

@Injectable()
export class AdminVocabularyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curatedVocabularyService: CuratedVocabularyService,
  ) {}

  async listTopics(search?: string): Promise<AdminCuratedTopicView[]> {
    const clean = search?.trim();
    const rows = await this.prisma.curatedTopic.findMany({
      where: clean
        ? {
            OR: [
              { slug: { contains: clean, mode: 'insensitive' } },
              { titleEn: { contains: clean, mode: 'insensitive' } },
              { titleVi: { contains: clean, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { words: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      titleEn: row.titleEn,
      titleVi: row.titleVi,
      description: row.description,
      icon: row.icon,
      displayOrder: row.displayOrder,
      wordsCount: row._count.words,
      createdAt: row.createdAt,
    }));
  }

  async createTopic(dto: CreateAdminCuratedTopicDto): Promise<AdminCuratedTopicView> {
    const slug = dto.slug.trim().toLowerCase();
    const dup = await this.prisma.curatedTopic.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException({
        code: 'ADMIN_TOPIC_SLUG_EXISTS',
        message: `Slug chủ đề "${slug}" đã tồn tại.`,
      });
    }

    let displayOrder = dto.displayOrder;
    if (displayOrder === undefined) {
      const maxRow = await this.prisma.curatedTopic.aggregate({
        _max: { displayOrder: true },
      });
      displayOrder = (maxRow._max.displayOrder ?? 0) + 1;
    }

    const created = await this.prisma.curatedTopic.create({
      data: {
        slug,
        titleEn: dto.titleEn.trim(),
        titleVi: dto.titleVi.trim(),
        description: dto.description?.trim() || null,
        icon: dto.icon?.trim() || null,
        displayOrder,
      },
      include: { _count: { select: { words: true } } },
    });

    this.curatedVocabularyService.invalidateTopicsCache();
    return {
      id: created.id,
      slug: created.slug,
      titleEn: created.titleEn,
      titleVi: created.titleVi,
      description: created.description,
      icon: created.icon,
      displayOrder: created.displayOrder,
      wordsCount: created._count.words,
      createdAt: created.createdAt,
    };
  }

  async updateTopic(
    id: string,
    dto: UpdateAdminCuratedTopicDto,
  ): Promise<AdminCuratedTopicView> {
    const existing = await this.prisma.curatedTopic.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_TOPIC_NOT_FOUND',
        message: 'Không tìm thấy chủ đề từ vựng.',
      });
    }

    const nextSlug = dto.slug?.trim().toLowerCase();
    if (nextSlug && nextSlug !== existing.slug) {
      const dup = await this.prisma.curatedTopic.findUnique({
        where: { slug: nextSlug },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException({
          code: 'ADMIN_TOPIC_SLUG_EXISTS',
          message: `Slug chủ đề "${nextSlug}" đã tồn tại.`,
        });
      }
    }

    const updated = await this.prisma.curatedTopic.update({
      where: { id },
      data: {
        ...(nextSlug ? { slug: nextSlug } : {}),
        ...(dto.titleEn !== undefined ? { titleEn: dto.titleEn.trim() } : {}),
        ...(dto.titleVi !== undefined ? { titleVi: dto.titleVi.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon?.trim() || null } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
      },
      include: { _count: { select: { words: true } } },
    });

    this.curatedVocabularyService.invalidateTopicsCache();
    return {
      id: updated.id,
      slug: updated.slug,
      titleEn: updated.titleEn,
      titleVi: updated.titleVi,
      description: updated.description,
      icon: updated.icon,
      displayOrder: updated.displayOrder,
      wordsCount: updated._count.words,
      createdAt: updated.createdAt,
    };
  }

  async deleteTopic(id: string): Promise<{ id: string; action: 'DELETED'; deletedWordsCount: number }> {
    const existing = await this.prisma.curatedTopic.findUnique({
      where: { id },
      select: { id: true, _count: { select: { words: true } } },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_TOPIC_NOT_FOUND',
        message: 'Không tìm thấy chủ đề từ vựng.',
      });
    }

    await this.prisma.curatedTopic.delete({ where: { id } });
    this.curatedVocabularyService.invalidateTopicsCache();
    return { id, action: 'DELETED', deletedWordsCount: existing._count.words };
  }

  async listTopicWords(
    topicId: string,
    query: AdminVocabularyWordsQueryDto,
  ): Promise<PaginatedResult<AdminCuratedWordView>> {
    const topic = await this.prisma.curatedTopic.findUnique({
      where: { id: topicId },
      select: { id: true },
    });
    if (!topic) {
      throw new NotFoundException({
        code: 'ADMIN_TOPIC_NOT_FOUND',
        message: 'Không tìm thấy chủ đề từ vựng.',
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.CuratedTopicWordWhereInput = {
      topicId,
      ...(search
        ? {
            OR: [
              { word: { contains: search, mode: 'insensitive' } },
              { meaningVi: { contains: search, mode: 'insensitive' } },
              { exampleEn: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.curatedTopicWord.count({ where }),
      this.prisma.curatedTopicWord.findMany({
        where,
        orderBy: [{ word: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async createWord(
    topicId: string,
    dto: CreateAdminCuratedWordDto,
  ): Promise<AdminCuratedWordView> {
    const topic = await this.prisma.curatedTopic.findUnique({
      where: { id: topicId },
      select: { id: true },
    });
    if (!topic) {
      throw new NotFoundException({
        code: 'ADMIN_TOPIC_NOT_FOUND',
        message: 'Không tìm thấy chủ đề từ vựng.',
      });
    }

    const imageUrl = dto.imageUrl?.trim() || null;
    const audioUrl = dto.audioUrl?.trim() || null;
    if (imageUrl && !isSafeUrl(imageUrl)) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_MEDIA_URL',
        message: 'Đường dẫn ảnh minh họa không hợp lệ.',
      });
    }
    if (audioUrl && !isSafeUrl(audioUrl)) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_MEDIA_URL',
        message: 'Đường dẫn audio phát âm không hợp lệ.',
      });
    }

    const created = await this.prisma.curatedTopicWord.create({
      data: {
        topicId,
        word: dto.word.trim(),
        phonetic: dto.phonetic?.trim() ?? '',
        partOfSpeech: dto.partOfSpeech?.trim() ?? '',
        meaningVi: dto.meaningVi.trim(),
        exampleEn: dto.exampleEn?.trim() ?? '',
        exampleVi: dto.exampleVi?.trim() ?? '',
        imageUrl,
        audioUrl,
      },
    });

    this.curatedVocabularyService.invalidateTopicsCache();
    return created;
  }

  async updateWord(
    topicId: string,
    wordId: string,
    dto: UpdateAdminCuratedWordDto,
  ): Promise<AdminCuratedWordView> {
    const existing = await this.prisma.curatedTopicWord.findFirst({
      where: { id: wordId, topicId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_WORD_NOT_FOUND',
        message: 'Không tìm thấy từ vựng trong chủ đề này.',
      });
    }

    const nextImage =
      dto.imageUrl !== undefined ? dto.imageUrl?.trim() || null : undefined;
    const nextAudio =
      dto.audioUrl !== undefined ? dto.audioUrl?.trim() || null : undefined;
    if (nextImage && !isSafeUrl(nextImage)) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_MEDIA_URL',
        message: 'Đường dẫn ảnh minh họa không hợp lệ.',
      });
    }
    if (nextAudio && !isSafeUrl(nextAudio)) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_MEDIA_URL',
        message: 'Đường dẫn audio phát âm không hợp lệ.',
      });
    }

    const updated = await this.prisma.curatedTopicWord.update({
      where: { id: wordId },
      data: {
        ...(dto.word !== undefined ? { word: dto.word.trim() } : {}),
        ...(dto.phonetic !== undefined ? { phonetic: dto.phonetic.trim() } : {}),
        ...(dto.partOfSpeech !== undefined ? { partOfSpeech: dto.partOfSpeech.trim() } : {}),
        ...(dto.meaningVi !== undefined ? { meaningVi: dto.meaningVi.trim() } : {}),
        ...(dto.exampleEn !== undefined ? { exampleEn: dto.exampleEn.trim() } : {}),
        ...(dto.exampleVi !== undefined ? { exampleVi: dto.exampleVi.trim() } : {}),
        ...(nextImage !== undefined ? { imageUrl: nextImage } : {}),
        ...(nextAudio !== undefined ? { audioUrl: nextAudio } : {}),
      },
    });

    this.curatedVocabularyService.invalidateTopicsCache();
    return updated;
  }

  async deleteWord(topicId: string, wordId: string): Promise<{ id: string; action: 'DELETED' }> {
    const existing = await this.prisma.curatedTopicWord.findFirst({
      where: { id: wordId, topicId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'ADMIN_WORD_NOT_FOUND',
        message: 'Không tìm thấy từ vựng trong chủ đề này.',
      });
    }

    await this.prisma.curatedTopicWord.delete({ where: { id: wordId } });
    this.curatedVocabularyService.invalidateTopicsCache();
    return { id: wordId, action: 'DELETED' };
  }
}
