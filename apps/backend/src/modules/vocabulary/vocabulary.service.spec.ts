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

  it('escapes LIKE wildcards and escape character when searching decks', async () => {
    const queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      expect(Array.isArray(strings)).toBe(true);
      const allValues = collectSqlValues(Prisma.sql(strings, ...values));
      expect(allValues).toContain('%100#%#_##test%');
      return Promise.resolve([{ cursorValid: true, hasMore: false, decks: [] }]);
    });
    const { service } = makeService({ $queryRaw: queryRaw });

    const result = await service.decks(userId, { limit: 20, query: '  100%_#test  ' });
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
});
