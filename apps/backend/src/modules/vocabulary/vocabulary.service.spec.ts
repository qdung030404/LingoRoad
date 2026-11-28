import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VocabularyCommandService } from './vocabulary-command.service';
import { VocabularyService } from './vocabulary.service';

function collectSqlValues(arg: unknown, values: unknown[] = []): unknown[] {
  if (arg && typeof arg === 'object' && Array.isArray((arg as { values?: unknown[] }).values)) {
    for (const val of (arg as { values: unknown[] }).values) {
      if (val && typeof val === 'object' && Array.isArray((val as { strings?: unknown[] }).strings)) {
        collectSqlValues(val, values);
      } else {
        values.push(val);
      }
    }
  }
  return values;
}

describe('VocabularyService batched queries', () => {
  const now = new Date('2026-11-24T00:00:00Z');
  const userId = '11111111-1111-4111-8111-111111111111';
  const deckRow = (id: string, name: string, deletedAt: Date | null = null) => ({
    id,
    userId,
    sourceTopicId: null,
    name,
    systemKey: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt,
  });
  const rawDeckRow = (
    id: string,
    name: string,
    stats: Partial<{ totalWords: number; rememberedWords: number; reviewedWords: number; activeAttemptId: string | null }> = {},
  ) => ({
    id,
    name,
    version: 1,
    deletedAt: null,
    createdAt: now.toISOString(),
    totalWords: stats.totalWords ?? 0,
    rememberedWords: stats.rememberedWords ?? 0,
    reviewedWords: stats.reviewedWords ?? 0,
    activeAttemptId: stats.activeAttemptId ?? null,
  });

  function makeService(overrides: Record<string, any> = {}) {
    const db: Record<string, any> = {
      vocabularyDeck: {
        findMany: jest.fn(async () => []),
        findFirst: jest.fn(async () => null),
      },
      vocabularyWord: {
        findMany: jest.fn(async () => {
          throw new Error('Should not load full word rows for deck counts or summary');
        }),
      },
      vocabularyReviewAttempt: {
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
      },
      $queryRaw: jest.fn(async () => []),
      ...overrides,
    };
    db.$transaction = jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(db));
    const commands = {} as VocabularyCommandService;
    return { db, service: new VocabularyService(db as unknown as PrismaService, commands) };
  }

  it('batches paginated deck stats and active review lookup into a single parameterized CTE query', async () => {
    const decks = Array.from({ length: 20 }, (_, i) =>
      rawDeckRow(
        `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        `Deck ${i + 1}`,
        i === 0
          ? { totalWords: 12, rememberedWords: 5, reviewedWords: 8, activeAttemptId: 'att-1' }
          : i === 4
            ? { totalWords: 3, rememberedWords: 3, reviewedWords: 3, activeAttemptId: 'att-5' }
            : {},
      ),
    );
    const queryRaw = jest.fn().mockResolvedValueOnce([{ cursorValid: true, hasMore: true, decks }]);
    const { db, service } = makeService({ $queryRaw: queryRaw });

    const result = await service.decks(userId, { limit: 20 });

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe(decks[19].id);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.vocabularyDeck.findMany).not.toHaveBeenCalled();
    expect(db.vocabularyDeck.findFirst).not.toHaveBeenCalled();
    expect(db.vocabularyWord.findMany).not.toHaveBeenCalled();
    expect(db.vocabularyReviewAttempt.findMany).not.toHaveBeenCalled();

    expect(result.items[0].createdAt).toBeInstanceOf(Date);
    expect(result.items[0].createdAt.toISOString()).toBe('2026-11-24T00:00:00.000Z');
    expect(result.items[0]).toMatchObject({
      id: decks[0].id,
      totalWords: 12,
      rememberedWords: 5,
      needsReviewWords: 7,
      reviewedWords: 8,
      activeAttemptId: 'att-1',
    });
    expect(result.items[1]).toMatchObject({
      id: decks[1].id,
      totalWords: 0,
      rememberedWords: 0,
      needsReviewWords: 0,
      reviewedWords: 0,
      activeAttemptId: null,
    });
    expect(result.items[4]).toMatchObject({
      id: decks[4].id,
      totalWords: 3,
      rememberedWords: 3,
      needsReviewWords: 0,
      reviewedWords: 3,
      activeAttemptId: 'att-5',
    });
  });

  it('returns empty list and null cursor when user has no decks in a single query', async () => {
    const queryRaw = jest.fn().mockResolvedValueOnce([{ cursorValid: true, hasMore: false, decks: [] }]);
    const { db, service } = makeService({ $queryRaw: queryRaw });

    const result = await service.decks(userId, { limit: 20 });

    expect(result).toEqual({ items: [], nextCursor: null });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.vocabularyReviewAttempt.findMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when decks cursor does not resolve to an active owned deck', async () => {
    const queryRaw = jest.fn().mockResolvedValueOnce([{ cursorValid: false, hasMore: false, decks: [] }]);
    const { db, service } = makeService({ $queryRaw: queryRaw });

    await expect(
      service.decks(userId, { limit: 20, cursor: '00000000-0000-4000-8000-000000000404' }),
    ).rejects.toThrow(NotFoundException);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('passes trimmed parameterized ILIKE pattern preserving native wildcards and backslash semantics', async () => {
    const queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      expect(Array.isArray(strings)).toBe(true);
      const sql = Prisma.sql(strings, ...values);
      const allValues = collectSqlValues(sql);
      expect(allValues).toContain('%A_B%\\test%');
      expect(strings.join(' ').toUpperCase()).not.toContain('ESCAPE');
      return Promise.resolve([{ cursorValid: true, hasMore: false, decks: [] }]);
    });
    const { service } = makeService({ $queryRaw: queryRaw });

    const result = await service.decks(userId, { limit: 20, query: '  A_B%\\test  ' });
    expect(result).toEqual({ items: [], nextCursor: null });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns zero word counts for a soft-deleted deck while preserving activeAttemptId', async () => {
    const deleted = deckRow('00000000-0000-4000-8000-000000000099', 'Deleted Deck', now);
    const { db, service } = makeService({
      vocabularyDeck: { findFirst: jest.fn(async () => deleted) },
      vocabularyReviewAttempt: {
        findMany: jest.fn(async () => [{ id: 'att-old', deckId: deleted.id }]),
      },
    });

    const result = await service.deck(deleted.userId, deleted.id, true);
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(result.deck).toMatchObject({
      id: deleted.id,
      deletedAt: now,
      totalWords: 0,
      rememberedWords: 0,
      needsReviewWords: 0,
      reviewedWords: 0,
      activeAttemptId: 'att-old',
    });
  });

  it('aggregates summary in a single parameterized CTE query without opening a transaction or loading word rows', async () => {
    const queryRaw = jest.fn().mockResolvedValueOnce([
      {
        totalWords: 25,
        rememberedWords: 11,
        reviewedWords: 18,
        completedReviewCount: 6,
        hasMoreDecks: true,
        decks: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Deck 1',
            version: 1,
            deletedAt: null,
            createdAt: '2026-11-24T00:00:00.000Z',
            totalWords: 10,
            rememberedWords: 4,
            reviewedWords: 7,
            activeAttemptId: null,
          },
          {
            id: '00000000-0000-4000-8000-000000000002',
            name: 'Deck 2',
            version: 2,
            deletedAt: null,
            createdAt: '2026-11-24T00:01:00.000Z',
            totalWords: 8,
            rememberedWords: 5,
            reviewedWords: 6,
            activeAttemptId: 'att-2',
          },
        ],
      },
    ]);
    const { db, service } = makeService({ $queryRaw: queryRaw });

    const result = await service.summary('11111111-1111-4111-8111-111111111111');

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.vocabularyDeck.findMany).not.toHaveBeenCalled();
    expect(db.vocabularyWord.findMany).not.toHaveBeenCalled();
    expect(db.vocabularyReviewAttempt.count).not.toHaveBeenCalled();
    expect(db.vocabularyReviewAttempt.findMany).not.toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.totals).toEqual({
      totalWords: 25,
      rememberedWords: 11,
      needsReviewWords: 14,
      reviewedWords: 18,
      completedReviewCount: 6,
    });
    expect(result.hasMoreDecks).toBe(true);
    expect(result.decks).toHaveLength(2);
    expect(result.decks[0].createdAt).toBeInstanceOf(Date);
    expect(result.decks[0].createdAt.toISOString()).toBe('2026-11-24T00:00:00.000Z');
    expect(result.decks[0]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      totalWords: 10,
      needsReviewWords: 6,
      reviewedWords: 7,
      deletedAt: null,
      activeAttemptId: null,
    });
    expect(result.decks[1]).toMatchObject({
      id: '00000000-0000-4000-8000-000000000002',
      version: 2,
      totalWords: 8,
      rememberedWords: 5,
      needsReviewWords: 3,
      reviewedWords: 6,
      activeAttemptId: 'att-2',
    });
  });

  it('returns zero totals and empty deck preview for an empty account in a single query', async () => {
    const queryRaw = jest.fn().mockResolvedValueOnce([
      {
        totalWords: 0,
        rememberedWords: 0,
        reviewedWords: 0,
        completedReviewCount: 0,
        hasMoreDecks: false,
        decks: [],
      },
    ]);
    const { db, service } = makeService({ $queryRaw: queryRaw });

    const result = await service.summary('11111111-1111-4111-8111-111111111111');

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      totals: {
        totalWords: 0,
        rememberedWords: 0,
        needsReviewWords: 0,
        reviewedWords: 0,
        completedReviewCount: 0,
      },
      decks: [],
      hasMoreDecks: false,
    });
  });

  it('batches createBatchWords deduplication and createMany while preserving receipt.result.wordIds order across commandId replay', async () => {
    const deckId = '00000000-0000-4000-8000-000000000010';
    const commandId = '22222222-2222-4222-8222-222222222222';
    const owned = deckRow(deckId, 'Mixed Batch Deck');
    const receipts: any[] = [];
    const storedWords: any[] = [
      {
        id: '00000000-0000-4000-8000-000000000901',
        deckId,
        english: 'apple',
        meaning: 'quả táo sẵn có',
        phonetic: '',
        partOfSpeech: 'noun',
        example: '',
        translation: '',
        imageUrl: null,
        acceptedAnswers: ['apple'],
        contentVersion: 1,
        version: 0,
        learningState: 'NEEDS_REVIEW',
        lastPresentedAt: null,
        lastReviewedAt: null,
        lastReviewItemId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000902',
        deckId,
        english: 'run',
        meaning: 'chạy (động từ sẵn có)',
        phonetic: '',
        partOfSpeech: 'verb',
        example: '',
        translation: '',
        imageUrl: null,
        acceptedAnswers: ['run'],
        contentVersion: 1,
        version: 0,
        learningState: 'NEEDS_REVIEW',
        lastPresentedAt: null,
        lastReviewedAt: null,
        lastReviewItemId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000903',
        deckId,
        english: 'ghost',
        meaning: 'từ đã xóa mềm',
        phonetic: '',
        partOfSpeech: 'noun',
        example: '',
        translation: '',
        imageUrl: null,
        acceptedAnswers: ['ghost'],
        contentVersion: 1,
        version: 1,
        learningState: 'NEEDS_REVIEW',
        lastPresentedAt: null,
        lastReviewedAt: null,
        lastReviewItemId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      },
    ];

    const findFirstWord = jest.fn();
    const createSingleWord = jest.fn();
    const createManyWords = jest.fn(async ({ data }: { data: any[] }) => {
      for (const row of data) {
        storedWords.push({
          ...row,
          contentVersion: 1,
          version: 0,
          learningState: 'NEEDS_REVIEW',
          lastPresentedAt: null,
          lastReviewedAt: null,
          lastReviewItemId: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
      }
      return { count: data.length };
    });
    // Deliberately return rows in reversed order to verify service re-orders strictly by receipt.result.wordIds
    const findManyWords = jest.fn(async ({ where }: any) => {
      const idSet = new Set<string>(where.id.in);
      return storedWords.filter(w => idSet.has(w.id)).reverse();
    });
    const queryRaw = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sqlText = strings.join(' ');
      if (sqlText.includes('FOR UPDATE')) {
        return [{ id: userId }];
      }
      const sql = Prisma.sql(strings, ...values);
      const bound = collectSqlValues(sql).map(v => String(v).toLowerCase());
      return storedWords
        .filter(w => w.deckId === deckId && w.deletedAt === null && bound.includes(w.english.toLowerCase()))
        .map(w => ({ english: w.english, partOfSpeech: w.partOfSpeech }));
    });

    const db: Record<string, any> = {
      vocabularyDeck: {
        findFirst: jest.fn(async () => owned),
      },
      vocabularyWord: {
        findFirst: findFirstWord,
        create: createSingleWord,
        createMany: createManyWords,
        findMany: findManyWords,
      },
      vocabularyCommandReceipt: {
        findUnique: jest.fn(
          async ({ where }: any) =>
            receipts.find(
              r => r.userId === where.userId_commandId.userId && r.commandId === where.userId_commandId.commandId,
            ) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const saved = { id: 'rcpt-1', createdAt: now, ...data };
          receipts.push(saved);
          return saved;
        }),
      },
      $queryRaw: queryRaw,
    };
    db.$transaction = jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(db));

    const commands = new VocabularyCommandService(db as unknown as PrismaService);
    const service = new VocabularyService(db as unknown as PrismaService, commands);

    const payload = {
      commandId,
      words: [
        { english: 'zebra', meaning: 'ngựa vằn', partOfSpeech: 'noun' },
        { english: 'APPLE', meaning: 'táo trùng khác hoa thường với bộ từ', partOfSpeech: 'NOUN' },
        { english: 'mango', meaning: 'quả xoài', partOfSpeech: 'noun' },
        { english: 'ZEBRA', meaning: 'ngựa vằn trùng trong lô', partOfSpeech: 'Noun' },
        { english: 'apple', meaning: 'táo trùng y hệt bộ từ', partOfSpeech: 'noun' },
        { english: 'Run', meaning: 'cuộc chạy (khác loại từ với verb đã có)', partOfSpeech: 'NOUN' },
        { english: 'Ghost', meaning: 'bóng ma (từ cũ đã xóa mềm nên được thêm lại)', partOfSpeech: 'noun' },
        { english: 'apricot', meaning: 'quả mơ', partOfSpeech: 'noun' },
        { english: 'mAnGo', meaning: 'xoài trùng lần 2', partOfSpeech: 'NOUN' },
      ],
    };

    const first = await service.createBatchWords(userId, deckId, payload);
    const firstResult = first.receipt.result as { count: number; wordIds: string[] };
    const activeCountAfterFirst = storedWords.filter(w => w.deletedAt === null).length;

    expect(findFirstWord).not.toHaveBeenCalled();
    expect(createSingleWord).not.toHaveBeenCalled();
    expect(createManyWords).toHaveBeenCalledTimes(1);
    expect(firstResult.count).toBe(5);
    expect(firstResult.wordIds).toHaveLength(5);
    expect(first.words.map(w => w.id)).toEqual(firstResult.wordIds);
    expect(first.words.map(w => [w.english, w.partOfSpeech])).toEqual([
      ['zebra', 'noun'],
      ['mango', 'noun'],
      ['Run', 'NOUN'],
      ['Ghost', 'noun'],
      ['apricot', 'noun'],
    ]);
    expect(activeCountAfterFirst).toBe(7);

    // Replay with the exact same commandId: zero extra DB writes and exact same wordIds order
    const replay = await service.createBatchWords(userId, deckId, payload);
    const replayResult = replay.receipt.result as { count: number; wordIds: string[] };

    expect(createManyWords).toHaveBeenCalledTimes(1);
    expect(storedWords.filter(w => w.deletedAt === null)).toHaveLength(activeCountAfterFirst);
    expect(replayResult).toEqual(firstResult);
    expect(replay.words.map(w => w.id)).toEqual(firstResult.wordIds);
    expect(replay.words).toEqual(first.words);
  });

  it('prevents delimiter collisions between (english, partOfSpeech) pairs across existing words, batch items, and commandId replay', async () => {
    const deckId = '00000000-0000-4000-8000-000000000011';
    const commandId = '33333333-3333-4333-8333-333333333333';
    const owned = deckRow(deckId, 'Delimiter Collision Deck');
    const receipts: any[] = [];
    const storedWords: any[] = [
      {
        id: '00000000-0000-4000-8000-000000000950',
        deckId,
        english: 'a:::b',
        meaning: 'mục đã có sẵn trong bộ từ',
        phonetic: '',
        partOfSpeech: 'c',
        example: '',
        translation: '',
        imageUrl: null,
        acceptedAnswers: ['a:::b'],
        contentVersion: 1,
        version: 0,
        learningState: 'NEEDS_REVIEW',
        lastPresentedAt: null,
        lastReviewedAt: null,
        lastReviewItemId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ];

    const createManyWords = jest.fn(async ({ data }: { data: any[] }) => {
      for (const row of data) {
        storedWords.push({
          ...row,
          contentVersion: 1,
          version: 0,
          learningState: 'NEEDS_REVIEW',
          lastPresentedAt: null,
          lastReviewedAt: null,
          lastReviewItemId: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
      }
      return { count: data.length };
    });
    const findManyWords = jest.fn(async ({ where }: any) => {
      const idSet = new Set<string>(where.id.in);
      return storedWords.filter(w => idSet.has(w.id)).reverse();
    });
    const queryRaw = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sqlText = strings.join(' ');
      if (sqlText.includes('FOR UPDATE')) {
        return [{ id: userId }];
      }
      const sql = Prisma.sql(strings, ...values);
      const bound = collectSqlValues(sql).map(v => String(v).toLowerCase());
      return storedWords
        .filter(w => w.deckId === deckId && w.deletedAt === null && bound.includes(w.english.toLowerCase()))
        .map(w => ({ english: w.english, partOfSpeech: w.partOfSpeech }));
    });

    const db: Record<string, any> = {
      vocabularyDeck: { findFirst: jest.fn(async () => owned) },
      vocabularyWord: {
        createMany: createManyWords,
        findMany: findManyWords,
      },
      vocabularyCommandReceipt: {
        findUnique: jest.fn(
          async ({ where }: any) =>
            receipts.find(
              r => r.userId === where.userId_commandId.userId && r.commandId === where.userId_commandId.commandId,
            ) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const saved = { id: 'rcpt-delim', createdAt: now, ...data };
          receipts.push(saved);
          return saved;
        }),
      },
      $queryRaw: queryRaw,
    };
    db.$transaction = jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(db));

    const commands = new VocabularyCommandService(db as unknown as PrismaService);
    const service = new VocabularyService(db as unknown as PrismaService, commands);

    const payload = {
      commandId,
      words: [
        { english: 'a', meaning: 'mục mới thứ nhất', partOfSpeech: 'b:::c' },
        { english: 'a:::b', meaning: 'mục mới thứ hai', partOfSpeech: 'verb' },
      ],
    };

    const first = await service.createBatchWords(userId, deckId, payload);
    const firstResult = first.receipt.result as { count: number; wordIds: string[] };

    expect(createManyWords).toHaveBeenCalledTimes(1);
    expect(firstResult.count).toBe(2);
    expect(firstResult.wordIds).toHaveLength(2);
    expect(first.words.map(w => w.id)).toEqual(firstResult.wordIds);
    expect(first.words.map(w => [w.english, w.partOfSpeech])).toEqual([
      ['a', 'b:::c'],
      ['a:::b', 'verb'],
    ]);

    const replay = await service.createBatchWords(userId, deckId, payload);
    const replayResult = replay.receipt.result as { count: number; wordIds: string[] };

    expect(createManyWords).toHaveBeenCalledTimes(1);
    expect(storedWords).toHaveLength(3);
    expect(replayResult.wordIds).toEqual(firstResult.wordIds);
    expect(replay.words.map(w => w.id)).toEqual(firstResult.wordIds);
    expect(replay.words).toEqual(first.words);
  });

  it('executes deck(), words(), and readingWords() directly without RepeatableRead $transaction overhead', async () => {
    const deckId = '00000000-0000-4000-8000-000000000020';
    const otherDeckId = '00000000-0000-4000-8000-000000000021';
    const deck = deckRow(deckId, 'Reading Deck');
    const words = [
      {
        id: '00000000-0000-4000-8000-000000000101',
        deckId,
        english: 'focus',
        meaning: 'tập trung',
        phonetic: '/ˈfəʊkəs/',
        partOfSpeech: 'noun',
        example: '',
        translation: '',
        imageUrl: null,
        acceptedAnswers: ['focus'],
        contentVersion: 1,
        version: 1,
        learningState: 'NEEDS_REVIEW',
        lastPresentedAt: null,
        lastReviewedAt: null,
        lastReviewItemId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000102',
        deckId,
        english: 'clarity',
        meaning: 'rõ ràng',
        phonetic: '/ˈklærəti/',
        partOfSpeech: 'noun',
        example: '',
        translation: '',
        imageUrl: null,
        acceptedAnswers: ['clarity'],
        contentVersion: 1,
        version: 1,
        learningState: 'REMEMBERED',
        lastPresentedAt: now,
        lastReviewedAt: now,
        lastReviewItemId: 'rev-1',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ];
    const { db, service } = makeService({
      vocabularyDeck: {
        findFirst: jest.fn(async () => deck),
      },
      vocabularyWord: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.id === 'cursor-other-deck') {
            return { ...words[0], id: 'cursor-other-deck', deckId: otherDeckId };
          }
          if (where.id === words[0].id) {
            return words[0];
          }
          return null;
        }),
        findMany: jest.fn(async ({ cursor }: any) => (cursor ? [words[1]] : words)),
      },
      $queryRaw: jest.fn(async () => [
        { deckId, totalWords: 2, rememberedWords: 1, reviewedWords: 1 },
      ]),
    });

    const singleDeck = await service.deck(userId, deckId);
    expect(singleDeck.deck).toMatchObject({ id: deckId, totalWords: 2, rememberedWords: 1 });
    expect(db.$transaction).not.toHaveBeenCalled();

    const page = await service.words(userId, deckId, { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe(words[0].id);
    expect(db.$transaction).not.toHaveBeenCalled();

    const nextPage = await service.words(userId, deckId, { limit: 1, cursor: words[0].id });
    expect(nextPage.items.map(w => w.id)).toEqual([words[1].id]);
    expect(nextPage.nextCursor).toBeNull();
    expect(db.$transaction).not.toHaveBeenCalled();

    await expect(
      service.words(userId, deckId, { limit: 1, cursor: 'cursor-other-deck' }),
    ).rejects.toThrow(NotFoundException);

    const reading = await service.readingWords(userId);
    expect(reading.deck).toEqual({ id: deckId, name: 'Reading Deck' });
    expect(reading.items.map(w => w.id)).toEqual([words[0].id, words[1].id]);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
