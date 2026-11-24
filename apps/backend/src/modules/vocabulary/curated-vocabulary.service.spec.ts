import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { CuratedVocabularyService } from './curated-vocabulary.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CuratedVocabularyService', () => {
  let service: CuratedVocabularyService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
      curatedTopic: {
        findMany: jest.fn(async () => [
          {
            id: 't-1',
            slug: 'travel',
            titleEn: 'Travel & Tourism',
            titleVi: 'Du lịch & Lữ hành',
            description: 'Từ vựng du lịch',
            icon: 'airplane',
            displayOrder: 1,
            _count: { words: 5 },
          },
        ]),
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.slug === 'travel') {
            return {
              id: 't-1',
              slug: 'travel',
              titleEn: 'Travel & Tourism',
              titleVi: 'Du lịch & Lữ hành',
              description: 'Từ vựng du lịch',
              words: [
                {
                  id: 'w-1',
                  word: 'transport',
                  phonetic: '/træns.ˈpɔrt/',
                  partOfSpeech: 'Danh từ',
                  meaningVi: 'Sự chuyên chở, sự vận tải.',
                  exampleEn: 'the transport of passengers',
                  exampleVi: '',
                  imageUrl: 'https://example.com/img.jpg',
                  audioUrl: 'https://dict.minhqnd.com/api/v1/tts?word=transport&lang=en',
                },
              ],
            };
          }
          if (where.slug === 'empty-topic') {
            return {
              id: 't-2',
              slug: 'empty-topic',
              titleEn: 'Empty Topic',
              titleVi: 'Chủ đề trống',
              description: 'Không có từ',
              words: [],
            };
          }
          return null;
        }),
      },
      curatedTopicWord: {
        count: jest.fn(async () => 1),
        findMany: jest.fn(async () => [
          {
            id: 'w-1',
            word: 'transport',
            phonetic: '/træns.ˈpɔrt/',
            partOfSpeech: 'Danh từ',
            meaningVi: 'Sự chuyên chở, sự vận tải.',
            exampleEn: 'the transport of passengers',
            exampleVi: '',
            imageUrl: 'https://example.com/img.jpg',
            audioUrl: 'https://dict.minhqnd.com/api/v1/tts?word=transport&lang=en',
          },
        ]),
      },
      vocabularyDeck: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }: any) => ({
          id: 'deck-123',
          userId: data.userId,
          name: data.name,
          version: 0,
        })),
      },
      vocabularyWord: {
        createMany: jest.fn(async ({ data }: any) => ({ count: data.length })),
      },
    };

    service = new CuratedVocabularyService(mockPrisma as unknown as PrismaService);
  });

  it('lists curated topics with total words count and caches result on subsequent calls', async () => {
    const res1 = await service.listTopics();
    expect(res1.topics).toHaveLength(1);
    expect(res1.topics[0].slug).toBe('travel');
    expect(res1.topics[0].totalWords).toBe(5);
    expect(mockPrisma.curatedTopic.findMany).toHaveBeenCalledTimes(1);

    // Lần thứ 2 gọi listTopics phải lấy từ cache, không gọi DB thêm lần nào
    const res2 = await service.listTopics();
    expect(res2.topics).toHaveLength(1);
    expect(mockPrisma.curatedTopic.findMany).toHaveBeenCalledTimes(1);
  });

  it('gets words of a topic with pagination and search filter', async () => {
    const res = await service.getTopicWords('travel', 1, 10, 'transport');
    expect(res.topic.slug).toBe('travel');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].word).toBe('transport');
    expect(res.items[0].imageUrl).toBe('https://example.com/img.jpg');
    expect(res.pagination.total).toBe(1);
    expect(res.pagination.totalPages).toBe(1);
    expect(mockPrisma.curatedTopicWord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          topicId: 't-1',
          OR: [
            { word: { contains: 'transport', mode: 'insensitive' } },
            { meaningVi: { contains: 'transport', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('returns totalPages = 0 when total words is 0', async () => {
    mockPrisma.curatedTopicWord.count.mockResolvedValueOnce(0);
    mockPrisma.curatedTopicWord.findMany.mockResolvedValueOnce([]);

    const res = await service.getTopicWords('travel', 1, 10);
    expect(res.items).toHaveLength(0);
    expect(res.pagination.total).toBe(0);
    expect(res.pagination.totalPages).toBe(0);
  });

  it('returns empty items and 0 pages when search is whitespace-only', async () => {
    const res = await service.getTopicWords('travel', 1, 10, '   ');
    expect(res.items).toHaveLength(0);
    expect(res.pagination.total).toBe(0);
    expect(res.pagination.totalPages).toBe(0);
  });

  it('throws NotFoundException if topic does not exist', async () => {
    await expect(service.getTopicWords('non-existing-topic')).rejects.toThrow(NotFoundException);
  });

  it('clones a curated topic into a user personal vocabulary deck inside a transaction', async () => {
    const res = await service.cloneTopicToUserDeck('user-1', 'travel');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.vocabularyDeck.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        sourceTopicId: 't-1',
        name: 'Du lịch & Lữ hành',
      },
    });
    expect(mockPrisma.vocabularyWord.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          deckId: 'deck-123',
          english: 'transport',
          meaning: 'Sự chuyên chở, sự vận tải.',
          acceptedAnswers: ['transport'],
          imageUrl: 'https://example.com/img.jpg',
        }),
      ],
    });
    expect(res.deckId).toBe('deck-123');
    expect(res.importedWordsCount).toBe(1);
  });

  it('throws BadRequestException if topic has 0 words to clone', async () => {
    await expect(service.cloneTopicToUserDeck('user-1', 'empty-topic')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws ConflictException if user already has a deck with identical name', async () => {
    mockPrisma.vocabularyDeck.findFirst.mockResolvedValueOnce({ id: 'existing-deck' });
    await expect(service.cloneTopicToUserDeck('user-1', 'travel')).rejects.toThrow(
      ConflictException,
    );
  });

  it('lookups word online successfully and uses in-memory cache', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        exists: true,
        results: [
          {
            meanings: [{ definition: 'Quả táo', pos: 'Danh từ', example: 'an apple a day' }],
            pronunciations: [{ ipa: '/ˈæp.əl/' }],
          },
        ],
      },
    });

    const res = await service.lookupOnline('apple');
    expect(res).not.toBeNull();
    expect(res?.word).toBe('apple');
    expect(res?.phonetic).toBe('/ˈæp.əl/');
    expect(res?.meanings[0]?.definition).toBe('Quả táo');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);

    // Lần gọi thứ 2 phải lấy từ cache, không gọi lại axios
    const cachedRes = await service.lookupOnline('apple');
    expect(cachedRes?.word).toBe('apple');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('normalizes whitespace (including tabs and double spaces) in word lookup', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        exists: true,
        results: [
          {
            meanings: [{ definition: 'Bánh táo', pos: 'Danh từ' }],
            pronunciations: [{ ipa: '/ˈæp.əl paɪ/' }],
          },
        ],
      },
    });

    const res = await service.lookupOnline('  apple \t pie  ');
    expect(res?.word).toBe('apple pie');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('word=apple%20pie'),
      expect.any(Object),
    );
  });

  it('normalizes unicode homoglyphs like modifier letter apostrophe into standard apostrophe', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        exists: true,
        results: [
          {
            meanings: [{ definition: 'Không thể', pos: 'Động từ' }],
            pronunciations: [{ ipa: '/kænt/' }],
          },
        ],
      },
    });

    // U+02BC (ʼ) gets normalized to ' (U+0027) via NFKC
    const res = await service.lookupOnline('can\u02BCt');
    expect(res?.word).toBe("can't");
  });

  it('returns null when lookup word is invalid or not found', async () => {
    expect(await service.lookupOnline('')).toBeNull();
    expect(await service.lookupOnline('   ')).toBeNull();
    expect(await service.lookupOnline('word-with-special-$#@!')).toBeNull();
    expect(await service.lookupOnline('a'.repeat(61))).toBeNull();

    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
    expect(await service.lookupOnline('unknownword')).toBeNull();
  });

  it('suggests words without making secondary lookup HTTP calls', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        suggestions: ['apple', 'application'],
      },
    });

    const suggestions = await service.suggestOnline('app');
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].word).toBe('apple');
    // Chỉ có đúng 1 request HTTP cho suggest API, không có request phụ cho lookup
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });
});
