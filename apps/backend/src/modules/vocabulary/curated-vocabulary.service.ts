import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

export interface CuratedTopicItem {
  id: string;
  slug: string;
  titleEn: string;
  titleVi: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  totalWords: number;
}

export interface CuratedWordItem {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi?: string;
  audioUrl: string | null;
}

export interface OnlineLookupMeaningItem {
  definition: string;
  pos?: string;
  example?: string | null;
}

export interface OnlineLookupResult {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meanings: OnlineLookupMeaningItem[];
  meaningsByPos: Record<string, Array<{ definition: string; example?: string | null }>>;
  availablePos: string[];
  audioUrl: string;
}

interface MinhqndMeaningItem {
  definition?: string;
  pos?: string;
  example?: string | null;
  definition_lang?: string;
}

interface MinhqndResultItem {
  lang_code?: string;
  lang_name?: string;
  audio?: string;
  meanings?: MinhqndMeaningItem[];
  pronunciations?: Array<{ ipa?: string; region?: string | null }>;
}

interface MinhqndApiResponse {
  exists?: boolean;
  word?: string;
  results?: MinhqndResultItem[];
}

export interface SuggestionItem {
  word: string;
  pos: string;
}

interface LookupCacheEntry {
  result: OnlineLookupResult | null;
  cachedAt: number;
}

interface SuggestCacheEntry {
  result: SuggestionItem[];
  cachedAt: number;
}

@Injectable()
export class CuratedVocabularyService {
  private readonly lookupCache = new Map<string, LookupCacheEntry>();
  private readonly suggestCache = new Map<string, SuggestCacheEntry>();
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 giờ
  private static readonly MAX_CACHE_SIZE = 1000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Danh sách toàn bộ chủ đề kèm số lượng từ vựng
   */
  async listTopics(): Promise<{ topics: CuratedTopicItem[] }> {
    const topics = await this.prisma.curatedTopic.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { words: true },
        },
      },
    });

    return {
      topics: topics.map((t) => ({
        id: t.id,
        slug: t.slug,
        titleEn: t.titleEn,
        titleVi: t.titleVi,
        description: t.description,
        icon: t.icon,
        displayOrder: t.displayOrder,
        totalWords: t._count.words,
      })),
    };
  }

  /**
   * Lấy danh sách từ vựng theo chủ đề (có phân trang và tìm kiếm)
   */
  async getTopicWords(
    slug: string,
    page = 1,
    limit = 50,
    search?: string,
  ): Promise<{
    topic: { id: string; slug: string; titleEn: string; titleVi: string; description: string | null };
    items: CuratedWordItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const topic = await this.prisma.curatedTopic.findUnique({
      where: { slug },
    });

    if (!topic) {
      throw new NotFoundException(`Không tìm thấy chủ đề với mã: ${slug}`);
    }

    const whereClause = {
      topicId: topic.id,
      ...(search?.trim()
        ? {
            OR: [
              { word: { contains: search.trim(), mode: 'insensitive' as const } },
              { meaningVi: { contains: search.trim(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, words] = await Promise.all([
      this.prisma.curatedTopicWord.count({ where: whereClause }),
      this.prisma.curatedTopicWord.findMany({
        where: whereClause,
        orderBy: { word: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      topic: {
        id: topic.id,
        slug: topic.slug,
        titleEn: topic.titleEn,
        titleVi: topic.titleVi,
        description: topic.description,
      },
      items: words.map((w) => ({
        id: w.id,
        word: w.word,
        phonetic: w.phonetic,
        partOfSpeech: w.partOfSpeech,
        meaningVi: w.meaningVi,
        exampleEn: w.exampleEn,
        exampleVi: w.exampleVi,
        audioUrl: w.audioUrl,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Clone/Nhập toàn bộ từ của chủ đề vào Bộ từ cá nhân (VocabularyDeck) của User
   * Giúp user có thể ngay lập tức học và ôn tập bằng thuật toán Spaced Repetition hiện có
   * Sử dụng Database Transaction để đảm bảo tính toàn vẹn (ACID)
   */
  async cloneTopicToUserDeck(
    userId: string,
    slug: string,
  ): Promise<{ deckId: string; deckName: string; importedWordsCount: number }> {
    const topic = await this.prisma.curatedTopic.findUnique({
      where: { slug },
      include: { words: true },
    });

    if (!topic) {
      throw new NotFoundException(`Không tìm thấy chủ đề với mã: ${slug}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Tạo bộ từ mới cho user
      const deck = await tx.vocabularyDeck.create({
        data: {
          userId,
          name: topic.titleVi.slice(0, 60),
        },
      });

      // Tạo các từ trong bộ từ của user (loại bỏ trùng lặp nếu có cùng loại từ)
      const uniqueTopicWords = [];
      const seen = new Set<string>();
      for (const w of topic.words) {
        const key = `${w.word.trim().toLowerCase()}:::${w.partOfSpeech.trim().toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueTopicWords.push(w);
        }
      }

      if (uniqueTopicWords.length > 0) {
        await tx.vocabularyWord.createMany({
          data: uniqueTopicWords.map((w) => ({
            deckId: deck.id,
            english: w.word,
            meaning: w.meaningVi,
            phonetic: w.phonetic,
            partOfSpeech: w.partOfSpeech,
            example: w.exampleEn,
            translation: w.exampleVi || '',
            acceptedAnswers: [w.word.toLowerCase()],
          })),
        });
      }

      return {
        deckId: deck.id,
        deckName: deck.name,
        importedWordsCount: uniqueTopicWords.length,
      };
    });
  }

  /**
   * Tra cứu từ điển trực tuyến mở rộng qua API dict.minhqnd.com
   * Có tích hợp bộ nhớ đệm (In-memory Cache) và kiểm tra định dạng an toàn
   */
  async lookupOnline(word: string): Promise<OnlineLookupResult | null> {
    const cleanWord = word.trim().toLowerCase();
    // Validate: chỉ chấp nhận từ tiếng Anh độ dài 1-60 ký tự
    if (!cleanWord || cleanWord.length > 60 || !/^[a-z\s\-']{1,60}$/.test(cleanWord)) {
      return null;
    }

    // Kiểm tra cache
    const cached = this.lookupCache.get(cleanWord);
    if (cached && Date.now() - cached.cachedAt < CuratedVocabularyService.CACHE_TTL_MS) {
      return cached.result;
    }

    try {
      const url = `https://dict.minhqnd.com/api/v1/lookup?word=${encodeURIComponent(cleanWord)}&lang=en&def_lang=vi`;
      const res = await axios.get<MinhqndApiResponse>(url, { timeout: 5000 });

      if (!res.data?.exists || !res.data.results?.[0]) {
        this.cacheResult(cleanWord, null);
        return null;
      }

      const primary = res.data.results[0];
      const meanings = (primary.meanings || []).map((m: MinhqndMeaningItem) => ({
        definition: m.definition || '',
        pos: m.pos || 'Từ vựng',
        example: m.example || null,
      }));

      const ipa = primary.pronunciations?.[0]?.ipa || '';

      const meaningsByPos: Record<string, Array<{ definition: string; example?: string | null }>> = {};
      const posSet = new Set<string>();

      for (const m of meanings) {
        const pos = m.pos || 'Từ vựng';
        posSet.add(pos);
        if (!meaningsByPos[pos]) {
          meaningsByPos[pos] = [];
        }
        meaningsByPos[pos].push({
          definition: m.definition,
          example: m.example,
        });
      }

      const availablePos = Array.from(posSet);

      const lookupResult: OnlineLookupResult = {
        word: cleanWord,
        phonetic: ipa,
        partOfSpeech: availablePos[0] || 'Từ vựng',
        meanings,
        meaningsByPos,
        availablePos,
        audioUrl: `https://dict.minhqnd.com/api/v1/tts?word=${encodeURIComponent(cleanWord)}&lang=en`,
      };

      this.cacheResult(cleanWord, lookupResult);
      return lookupResult;
    } catch {
      return null;
    }
  }

  /**
   * Gợi ý từ nhanh (Autocomplete) qua API dict.minhqnd.com
   */
  async suggestOnline(query: string): Promise<SuggestionItem[]> {
    const clean = query.trim().toLowerCase();
    if (!clean || clean.length > 60 || !/^[a-z\s\-']{1,60}$/.test(clean)) {
      return [];
    }

    const cached = this.suggestCache.get(clean);
    if (cached && Date.now() - cached.cachedAt < CuratedVocabularyService.CACHE_TTL_MS) {
      return cached.result;
    }

    try {
      const url = `https://dict.minhqnd.com/api/v1/suggest?q=${encodeURIComponent(clean)}&limit=5`;
      const res = await axios.get<{ suggestions?: string[] }>(url, { timeout: 4000 });
      const words = res.data?.suggestions || [];

      const suggestions: SuggestionItem[] = await Promise.all(
        words.slice(0, 5).map(async (w) => {
          try {
            const lookup = await this.lookupOnline(w);
            return {
              word: w,
              pos: lookup?.partOfSpeech || '',
            };
          } catch {
            return { word: w, pos: '' };
          }
        }),
      );

      this.cacheSuggest(clean, suggestions);
      return suggestions;
    } catch {
      return [];
    }
  }

  private cacheSuggest(query: string, result: SuggestionItem[]): void {
    if (this.suggestCache.size >= CuratedVocabularyService.MAX_CACHE_SIZE) {
      const oldestKey = this.suggestCache.keys().next().value;
      if (oldestKey) {
        this.suggestCache.delete(oldestKey);
      }
    }
    this.suggestCache.set(query, { result, cachedAt: Date.now() });
  }

  private cacheResult(word: string, result: OnlineLookupResult | null): void {
    if (this.lookupCache.size >= CuratedVocabularyService.MAX_CACHE_SIZE) {
      const oldestKey = this.lookupCache.keys().next().value;
      if (oldestKey) {
        this.lookupCache.delete(oldestKey);
      }
    }
    this.lookupCache.set(word, { result, cachedAt: Date.now() });
  }
}
