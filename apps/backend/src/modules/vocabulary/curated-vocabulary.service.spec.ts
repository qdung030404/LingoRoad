import { NotFoundException } from '@nestjs/common';
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
                  audioUrl: 'https://dict.minhqnd.com/api/v1/tts?word=transport&lang=en',
                },
              ],
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
            audioUrl: 'https://dict.minhqnd.com/api/v1/tts?word=transport&lang=en',
          },
        ]),
      },
      vocabularyDeck: {
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

  it('lists curated topics with total words count', async () => {
    const res = await service.listTopics();
    expect(res.topics).toHaveLength(1);
    expect(res.topics[0].slug).toBe('travel');
    expect(res.topics[0].totalWords).toBe(5);
  });

  it('gets words of a topic with pagination and search filter', async () => {
    const res = await service.getTopicWords('travel', 1, 10, 'transport');
    expect(res.topic.slug).toBe('travel');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].word).toBe('transport');
    expect(res.pagination.total).toBe(1);
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

  it('throws NotFoundException if topic does not exist', async () => {
    await expect(service.getTopicWords('non-existing-topic')).rejects.toThrow(NotFoundException);
  });

  it('clones a curated topic into a user personal vocabulary deck inside a transaction', async () => {
    const res = await service.cloneTopicToUserDeck('user-1', 'travel');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.vocabularyDeck.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
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
        }),
      ],
    });
    expect(res.deckId).toBe('deck-123');
    expect(res.importedWordsCount).toBe(1);
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

  it('returns null when lookup word is invalid or not found', async () => {
    expect(await service.lookupOnline('')).toBeNull();
    expect(await service.lookupOnline('word-with-special-$#@!')).toBeNull();
    expect(await service.lookupOnline('a'.repeat(61))).toBeNull();

    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
    expect(await service.lookupOnline('unknownword')).toBeNull();
  });
});
