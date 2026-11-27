import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  imageUrl?: string | null;
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
  private topicsCache: { topics: CuratedTopicItem[]; cachedAt: number } | null = null;
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 giờ
  private static readonly TOPICS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút cache cho danh sách chủ đề
  private static readonly MAX_CACHE_SIZE = 1000;
  private static readonly DICT_BASE_URL = process.env.DICTIONARY_API_URL?.replace(/\/+$/, '') || 'https://dict.minhqnd.com/api/v1';

  constructor(private readonly prisma: PrismaService) { }

  invalidateTopicsCache(): void {
    this.topicsCache = null;
  }

  /**
   * Chuẩn hóa và kiểm tra hợp lệ chuỗi truy vấn từ vựng:
   * - Áp dụng chuẩn Unicode NFKC để chuẩn hóa các ký tự homoglyph (như ʼ U+02BC thành ' U+0027).
   * - Loại bỏ khoảng trắng đầu/cuối.
   * - Gom các ký tự khoảng trắng thừa (kể cả tab \t, xuống dòng \r, \n) thành 1 dấu cách duy nhất.
   * - Chặn các chuỗi rỗng, vượt quá 60 ký tự, hoặc chứa ký tự đặc biệt ngoài [a-z '-].
   */
  private normalizeWordQuery(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    const clean = input
      .normalize('NFKC')
      .replace(/[\u2018\u2019\u02BC\u02BB]/g, "'")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!clean || clean.length > 60 || !/^[a-z '-]{1,60}$/.test(clean)) {
      return null;
    }
    return clean;
  }

  /**
   * Danh sách toàn bộ chủ đề kèm số lượng từ vựng
   * Tối ưu hiệu năng: Tích hợp bộ nhớ đệm (In-memory Cache) với TTL 5 phút
   */
  async listTopics(): Promise<{ topics: CuratedTopicItem[] }> {
    if (
      this.topicsCache &&
      Date.now() - this.topicsCache.cachedAt < CuratedVocabularyService.TOPICS_CACHE_TTL_MS
    ) {
      return { topics: this.topicsCache.topics };
    }

    const topics = await this.prisma.curatedTopic.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { words: true },
        },
      },
    });

    const mappedTopics: CuratedTopicItem[] = topics.map((t) => ({
      id: t.id,
      slug: t.slug,
      titleEn: t.titleEn,
      titleVi: t.titleVi,
      description: t.description,
      icon: t.icon,
      displayOrder: t.displayOrder,
      totalWords: t._count.words,
    }));

    this.topicsCache = {
      topics: mappedTopics,
      cachedAt: Date.now(),
    };

    return { topics: mappedTopics };
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

    const hasExplicitSearch = typeof search === 'string';
    const cleanSearch = search?.trim();

    // M4: Nếu người dùng chủ động truyền search nhưng chỉ có khoảng trắng, trả về 0 kết quả
    if (hasExplicitSearch && !cleanSearch) {
      return {
        topic: {
          id: topic.id,
          slug: topic.slug,
          titleEn: topic.titleEn,
          titleVi: topic.titleVi,
          description: topic.description,
        },
        items: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const whereClause = {
      topicId: topic.id,
      ...(cleanSearch
        ? {
          OR: [
            { word: { contains: cleanSearch, mode: 'insensitive' as const } },
            { meaningVi: { contains: cleanSearch, mode: 'insensitive' as const } },
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
        imageUrl: w.imageUrl ?? null,
        audioUrl: w.audioUrl,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
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

    if (!topic.words || topic.words.length === 0) {
      throw new BadRequestException('Chủ đề chưa có từ vựng để sao chép.');
    }

    const deckName = topic.titleVi.slice(0, 60);

    return await this.prisma.$transaction(async (tx) => {
      // H4/H5: Kiểm tra xem user đã sở hữu bộ từ được clone từ chủ đề này chưa dựa trên sourceTopicId
      const existingDeck = await tx.vocabularyDeck.findFirst({
        where: {
          userId,
          sourceTopicId: topic.id,
          deletedAt: null,
        },
      });

      if (existingDeck) {
        throw new ConflictException(`Bạn đã sao chép chủ đề "${topic.titleVi}" trước đó.`);
      }

      // Tạo bộ từ mới cho user
      const deck = await tx.vocabularyDeck.create({
        data: {
          userId,
          sourceTopicId: topic.id,
          name: deckName,
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
            imageUrl: w.imageUrl ?? null,
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
   * Có tích hợp bộ nhớ đệm (In-memory LRU Cache) và kiểm tra định dạng an toàn
   */
  async lookupOnline(word: string): Promise<OnlineLookupResult | null> {
    const cleanWord = this.normalizeWordQuery(word);
    if (!cleanWord) {
      return null;
    }

    // Kiểm tra cache với cơ chế làm mới vị trí LRU
    const cached = this.lookupCache.get(cleanWord);
    if (cached) {
      if (Date.now() - cached.cachedAt < CuratedVocabularyService.CACHE_TTL_MS) {
        this.lookupCache.delete(cleanWord);
        this.lookupCache.set(cleanWord, cached);
        return cached.result;
      }
      this.lookupCache.delete(cleanWord);
    }

    try {
      const url = `${CuratedVocabularyService.DICT_BASE_URL}/lookup?word=${encodeURIComponent(cleanWord)}&lang=en&def_lang=vi`;
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
        audioUrl: `${CuratedVocabularyService.DICT_BASE_URL}/tts?word=${encodeURIComponent(cleanWord)}&lang=en`,
      };

      this.cacheResult(cleanWord, lookupResult);
      return lookupResult;
    } catch {
      return null;
    }
  }

  /**
   * Gợi ý từ nhanh (Autocomplete) qua API dict.minhqnd.com
   * Tối ưu hiệu năng: không gọi N+1 lookup HTTP song song;
   * Nếu từ đã có trong lookupCache thì tận dụng pos, nếu chưa có thì trả về pos rỗng.
   */
  async suggestOnline(query: string): Promise<SuggestionItem[]> {
    const clean = this.normalizeWordQuery(query);
    if (!clean) {
      return [];
    }

    // Kiểm tra cache với cơ chế làm mới vị trí LRU
    const cached = this.suggestCache.get(clean);
    if (cached) {
      if (Date.now() - cached.cachedAt < CuratedVocabularyService.CACHE_TTL_MS) {
        this.suggestCache.delete(clean);
        this.suggestCache.set(clean, cached);
        return cached.result;
      }
      this.suggestCache.delete(clean);
    }

    try {
      const url = `${CuratedVocabularyService.DICT_BASE_URL}/suggest?q=${encodeURIComponent(clean)}&limit=5`;
      const res = await axios.get<{ suggestions?: string[] }>(url, { timeout: 4000 });
      const words = res.data?.suggestions || [];

      // Map danh sách từ gợi ý trực tiếp mà không kích hoạt 5 HTTP requests lookupOnline phụ
      const suggestions: SuggestionItem[] = words.slice(0, 5).map((w) => {
        const wClean = w.trim().toLowerCase();
        const cachedLookup = this.lookupCache.get(wClean);
        return {
          word: w,
          pos: cachedLookup?.result?.partOfSpeech || '',
        };
      });

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
