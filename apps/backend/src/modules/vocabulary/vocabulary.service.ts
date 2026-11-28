import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, VocabularyDeck, VocabularyWord } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VocabularyCommandService } from './vocabulary-command.service';
import { VocabularyBatchWordItemDto, VocabularyCreateBatchWordsDto, VocabularyCreateDeckDto, VocabularyCreateWordDto, VocabularyListQuery, VocabularyUpdateDeckDto, VocabularyUpdateWordDto, VocabularyVersionDto } from './vocabulary.dto';
import { Db, vocabConflict, vocabInvalid, vocabMissing, wordView } from './vocabulary.types';

const READING_DECK_SYSTEM_KEY = 'READING_WORDS';
const READING_DECK_DEFAULT_NAME = 'Từ vựng Bài đọc';

const wordDedupeKey = (english: string, partOfSpeech: string): string =>
  JSON.stringify([english.trim().toLowerCase(), partOfSpeech.trim().toLowerCase()]);

type RawDeckStatsRow = {
  id: string;
  name: string;
  version: number;
  deletedAt: Date | string | null;
  createdAt: Date | string;
  totalWords: number;
  rememberedWords: number;
  reviewedWords: number;
  activeAttemptId: string | null;
};

@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService, private readonly commands: VocabularyCommandService) {}
  private async findReadingDeck(db: Db, userId: string) {
    return (
      await db.vocabularyDeck.findFirst({
        where: { userId, systemKey: READING_DECK_SYSTEM_KEY, deletedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      })
    ) ?? db.vocabularyDeck.findFirst({
      where: { userId, deletedAt: null, name: { equals: READING_DECK_DEFAULT_NAME, mode: 'insensitive' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }
  async ownedDeck(db: Db, userId: string, id: string, includeDeleted = false) {
    const deck = await db.vocabularyDeck.findFirst({ where: { id, userId, ...(!includeDeleted ? { deletedAt: null } : {}) } });
    if (!deck) vocabMissing();
    return deck;
  }
  async ownedWord(db: Db, userId: string, id: string, includeDeleted = false) {
    const word = await db.vocabularyWord.findFirst({ where: { id, deck: { userId, ...(!includeDeleted ? { deletedAt: null } : {}) }, ...(!includeDeleted ? { deletedAt: null } : {}) } });
    if (!word) vocabMissing();
    return word;
  }
  private async deckViews(db: Db, userId: string, decks: VocabularyDeck[]) {
    if (!decks.length) return [];
    const deckIds = decks.map(d => d.id);
    const activeDeckIds = decks.filter(d => !d.deletedAt).map(d => d.id);
    const [wordStats, activeAttempts] = await Promise.all([
      activeDeckIds.length
        ? db.$queryRaw<{ deckId: string; totalWords: number; rememberedWords: number; reviewedWords: number }[]>`
            SELECT
              deck_id AS "deckId",
              COUNT(*)::int AS "totalWords",
              COUNT(*) FILTER (WHERE learning_state = 'REMEMBERED')::int AS "rememberedWords",
              COUNT(*) FILTER (WHERE last_reviewed_at IS NOT NULL)::int AS "reviewedWords"
            FROM vocabulary_words
            WHERE deck_id IN (${Prisma.join(activeDeckIds.map(id => Prisma.sql`${id}::uuid`))})
              AND deleted_at IS NULL
            GROUP BY deck_id
          `
        : Promise.resolve([]),
      db.vocabularyReviewAttempt.findMany({
        where: { userId, deckId: { in: deckIds }, status: 'IN_PROGRESS' },
        select: { id: true, deckId: true },
      }),
    ]);
    const statsByDeck = new Map(wordStats.map(row => [row.deckId, row]));
    const activeByDeck = new Map(activeAttempts.map(row => [row.deckId, row.id]));
    return decks.map(deck =>
      this.buildDeckView(deck, statsByDeck.get(deck.id), activeByDeck.get(deck.id) ?? null),
    );
  }
  private buildDeckView(
    deck: {
      id: string;
      name: string;
      version: number;
      deletedAt: Date | string | null;
      createdAt: Date | string;
    },
    stats?: { totalWords?: number; rememberedWords?: number; reviewedWords?: number },
    activeAttemptId: string | null = null,
  ) {
    const totalWords = Number(stats?.totalWords ?? 0);
    const rememberedWords = Number(stats?.rememberedWords ?? 0);
    const reviewedWords = Number(stats?.reviewedWords ?? 0);
    return {
      id: deck.id,
      name: deck.name,
      version: Number(deck.version),
      deletedAt: deck.deletedAt ? new Date(deck.deletedAt) : null,
      createdAt: new Date(deck.createdAt),
      totalWords,
      rememberedWords,
      needsReviewWords: totalWords - rememberedWords,
      reviewedWords,
      activeAttemptId,
    };
  }
  private async deckView(db: Db, deck: VocabularyDeck) {
    return (await this.deckViews(db, deck.userId, [deck]))[0];
  }
  async deck(userId: string, id: string, includeDeleted = false) {
    const deck = await this.ownedDeck(this.prisma, userId, id, includeDeleted);
    return { deck: await this.deckView(this.prisma, deck) };
  }
  async decks(userId: string, query: VocabularyListQuery) {
    query.limit ??= 20;
    const limit = query.limit;
    const take = limit + 1;
    const cursor = query.cursor;
    const search = query.query?.trim();
    const likePattern = search ? `%${search}%` : null;
    const [row] = await this.prisma.$queryRaw<{
      cursorValid: boolean;
      hasMore: boolean;
      decks: RawDeckStatsRow[] | null;
    }[]>`
      WITH
      cursor_anchor AS (
        SELECT id, created_at
        FROM vocabulary_decks
        WHERE ${
          cursor
            ? Prisma.sql`id = ${cursor}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL`
            : Prisma.sql`FALSE`
        }
      ),
      fetched AS (
        SELECT
          d.id,
          d.name,
          d.version,
          d.deleted_at,
          d.created_at
        FROM vocabulary_decks d
        ${cursor ? Prisma.sql`JOIN cursor_anchor ca ON (d.created_at, d.id) >= (ca.created_at, ca.id)` : Prisma.empty}
        WHERE d.user_id = ${userId}::uuid
          AND d.deleted_at IS NULL
          ${likePattern ? Prisma.sql`AND d.name ILIKE ${likePattern}` : Prisma.empty}
        ORDER BY d.created_at ASC, d.id ASC
        LIMIT ${take}
        ${cursor ? Prisma.sql`OFFSET 1` : Prisma.empty}
      ),
      deck_rows AS (
        SELECT
          id,
          name,
          version,
          deleted_at,
          created_at,
          ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
        FROM fetched
        ORDER BY created_at ASC, id ASC
        LIMIT ${limit}
      ),
      deck_word_stats AS (
        SELECT
          w.deck_id,
          COUNT(*)::int AS total_words,
          COUNT(*) FILTER (WHERE w.learning_state = 'REMEMBERED')::int AS remembered_words,
          COUNT(*) FILTER (WHERE w.last_reviewed_at IS NOT NULL)::int AS reviewed_words
        FROM vocabulary_words w
        JOIN deck_rows dr ON dr.id = w.deck_id
        WHERE w.deleted_at IS NULL
        GROUP BY w.deck_id
      ),
      deck_active AS (
        SELECT DISTINCT ON (r.deck_id)
          r.deck_id,
          r.id AS active_attempt_id
        FROM vocabulary_review_attempts r
        JOIN deck_rows dr ON dr.id = r.deck_id
        WHERE r.user_id = ${userId}::uuid
          AND r.status = 'IN_PROGRESS'
        ORDER BY r.deck_id, r.started_at DESC, r.id DESC
      )
      SELECT
        (${cursor ? Prisma.sql`EXISTS (SELECT 1 FROM cursor_anchor)` : Prisma.sql`TRUE`}) AS "cursorValid",
        (SELECT COUNT(*) > ${limit} FROM fetched) AS "hasMore",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', dr.id,
                'name', dr.name,
                'version', dr.version,
                'deletedAt', (dr.deleted_at AT TIME ZONE 'UTC'),
                'createdAt', (dr.created_at AT TIME ZONE 'UTC'),
                'totalWords', COALESCE(dws.total_words, 0),
                'rememberedWords', COALESCE(dws.remembered_words, 0),
                'reviewedWords', COALESCE(dws.reviewed_words, 0),
                'activeAttemptId', da.active_attempt_id
              )
              ORDER BY dr.rn
            )
            FROM deck_rows dr
            LEFT JOIN deck_word_stats dws ON dws.deck_id = dr.id
            LEFT JOIN deck_active da ON da.deck_id = dr.id
          ),
          '[]'::json
        ) AS decks
    `;
    if (cursor && !row?.cursorValid) vocabMissing();
    const deckRows = Array.isArray(row?.decks) ? row.decks : [];
    const items = deckRows.map(deck => this.buildDeckView(deck, deck, deck.activeAttemptId ?? null));
    return {
      items,
      nextCursor: row?.hasMore && items.length > 0 ? items[items.length - 1].id : null,
    };
  }
  async words(userId: string, deckId: string, query: VocabularyListQuery) {
    query.limit ??= 20;
    const [, cursor] = await Promise.all([
      this.ownedDeck(this.prisma, userId, deckId),
      query.cursor ? this.ownedWord(this.prisma, userId, query.cursor) : Promise.resolve(null),
    ]);
    if (cursor && cursor.deckId !== deckId) vocabMissing();
    const search = query.query?.trim();
    const rows = await this.prisma.vocabularyWord.findMany({
      where: {
        deckId,
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { english: { contains: search, mode: 'insensitive' as const } },
                { meaning: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return {
      items: rows.slice(0, query.limit).map(w => ({ ...wordView(w), acceptedAnswers: w.acceptedAnswers })),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null,
    };
  }
  async createDeck(userId: string, dto: VocabularyCreateDeckDto) {
    const receipt = await this.commands.execute(userId, dto.commandId, 'CREATE_DECK', 'decks', dto, async db => {
      const deck = await db.vocabularyDeck.create({ data: { userId, name: dto.name } });
      return { targetId: deck.id, appliedVersion: deck.version, result: { deckId: deck.id } };
    });
    return { receipt: this.commands.view(receipt), ...await this.deck(userId, receipt.targetId, true) };
  }
  async updateDeck(userId: string, id: string, dto: VocabularyUpdateDeckDto | VocabularyVersionDto, remove = false) {
    const receipt = await this.commands.execute(userId, dto.commandId, remove ? 'DELETE_DECK' : 'UPDATE_DECK', id, dto, async db => {
      const deck = await this.ownedDeck(db, userId, id);
      if (deck.version !== dto.expectedVersion) vocabConflict('VOCAB_CONTENT_CONFLICT');
      const saved = await db.vocabularyDeck.update({ where: { id }, data: { ...(remove ? { deletedAt: new Date() } : { name: (dto as VocabularyUpdateDeckDto).name }), version: { increment: 1 } } });
      return { targetId: id, appliedVersion: saved.version, result: { deckId: id, deleted: remove } };
    });
    return { receipt: this.commands.view(receipt), ...await this.deck(userId, id, true) };
  }
  async deleteDeck(userId: string, id: string, dto: VocabularyVersionDto) {
    return this.updateDeck(userId, id, dto, true);
  }
  private wordData(dto: VocabularyCreateWordDto | VocabularyBatchWordItemDto, old?: VocabularyWord) {
    const english = dto.english.trim(), meaning = dto.meaning.trim();
    if (!english || !meaning) vocabInvalid('Nhập từ tiếng Anh và nghĩa.');
    const aliases = dto.acceptedAnswers ?? old?.acceptedAnswers.filter(a => a !== old.english) ?? [];
    if (aliases.some(a => !a.trim())) vocabInvalid('Đáp án thay thế không được rỗng.');
    const alternatives = [...new Set(aliases.map(a => a.trim()).filter(a => a !== english))];
    if (alternatives.length > 10) vocabInvalid('Chỉ thêm tối đa 10 đáp án thay thế.');
    return { english, meaning, phonetic: dto.phonetic ?? old?.phonetic ?? '', partOfSpeech: dto.partOfSpeech ?? old?.partOfSpeech ?? '',
      example: dto.example ?? old?.example ?? '', translation: dto.translation ?? old?.translation ?? '',
      imageUrl: dto.imageUrl ?? old?.imageUrl ?? null,
      acceptedAnswers: [english, ...alternatives] };
  }
  async createWord(userId: string, deckId: string, dto: VocabularyCreateWordDto) {
    const receipt = await this.commands.execute(userId, dto.commandId, 'CREATE_WORD', deckId, dto, async db => {
      await this.ownedDeck(db, userId, deckId);
      const data = this.wordData(dto);

      // Kiểm tra: 1 từ không được xuất hiện nhiều lần trong 1 collection nếu cùng loại từ
      const existing = await db.vocabularyWord.findFirst({
        where: {
          deckId,
          deletedAt: null,
          english: { equals: data.english, mode: 'insensitive' },
          partOfSpeech: { equals: data.partOfSpeech, mode: 'insensitive' },
        },
      });
      if (existing) {
        const posLabel = data.partOfSpeech ? ` (${data.partOfSpeech})` : '';
        vocabInvalid(`Từ "${data.english}"${posLabel} đã tồn tại trong bộ từ này.`);
      }

      const word = await db.vocabularyWord.create({ data: { deckId, ...data } });
      return { targetId: word.id, appliedVersion: word.version, result: { wordId: word.id } };
    });
    return { receipt: this.commands.view(receipt), word: await this.readWord(userId, receipt.targetId) };
  }
  async createBatchWords(userId: string, deckId: string, dto: VocabularyCreateBatchWordsDto) {
    const receipt = await this.commands.execute(userId, dto.commandId, 'CREATE_BATCH_WORDS', deckId, dto, async db => {
      await this.ownedDeck(db, userId, deckId);
      const candidates: Array<{
        data: ReturnType<typeof this.wordData>;
        key: string;
      }> = [];
      const seenInBatch = new Set<string>();

      for (const item of dto.words) {
        const data = this.wordData(item);
        const key = wordDedupeKey(data.english, data.partOfSpeech);
        if (seenInBatch.has(key)) {
          continue; // Tránh trùng lặp trong nội bộ batch
        }
        seenInBatch.add(key);
        candidates.push({ data, key });
      }

      const uniqueEnglish = [...new Set(candidates.map(c => c.data.english))];
      const existingRows = uniqueEnglish.length
        ? await db.$queryRaw<{ english: string; partOfSpeech: string }[]>`
            SELECT english, part_of_speech AS "partOfSpeech"
            FROM vocabulary_words
            WHERE deck_id = ${deckId}::uuid
              AND deleted_at IS NULL
              AND LOWER(english) IN (${Prisma.join(uniqueEnglish.map(word => Prisma.sql`LOWER(${word})`))})
          `
        : [];
      const existingKeys = new Set(
        existingRows.map(row => wordDedupeKey(row.english, row.partOfSpeech)),
      );

      const rowsToCreate = candidates
        .filter(candidate => !existingKeys.has(candidate.key))
        .map(candidate => ({
          id: randomUUID(),
          deckId,
          ...candidate.data,
        }));

      if (rowsToCreate.length > 0) {
        await db.vocabularyWord.createMany({ data: rowsToCreate });
      }

      const wordIds = rowsToCreate.map(w => w.id);
      return { targetId: deckId, appliedVersion: undefined, result: { count: wordIds.length, wordIds } };
    });

    const wordIds = (receipt.result as { wordIds: string[] }).wordIds;
    const rows = wordIds.length
      ? await this.prisma.vocabularyWord.findMany({
          where: { id: { in: wordIds } },
        })
      : [];
    const byId = new Map(rows.map(w => [w.id, w]));
    const items = wordIds
      .map(id => byId.get(id))
      .filter((w): w is VocabularyWord => Boolean(w));

    return {
      receipt: this.commands.view(receipt),
      words: items.map(w => ({ ...wordView(w), acceptedAnswers: w.acceptedAnswers })),
    };
  }
  private async readWord(userId: string, id: string) {
    const w = await this.ownedWord(this.prisma, userId, id, true);
    return { ...wordView(w), acceptedAnswers: w.acceptedAnswers };
  }
  async updateWord(userId: string, id: string, dto: VocabularyUpdateWordDto | VocabularyVersionDto, remove = false) {
    const receipt = await this.commands.execute(userId, dto.commandId, remove ? 'DELETE_WORD' : 'UPDATE_WORD', id, dto, async db => {
      const word = await this.ownedWord(db, userId, id);
      if (word.version !== dto.expectedVersion) vocabConflict('VOCAB_CONTENT_CONFLICT');
      const data = remove ? { deletedAt: new Date() } : this.wordData(dto as VocabularyUpdateWordDto, word);

      if (!remove) {
        const updateData = data as ReturnType<typeof this.wordData>;
        const existing = await db.vocabularyWord.findFirst({
          where: {
            deckId: word.deckId,
            id: { not: word.id },
            deletedAt: null,
            english: { equals: updateData.english, mode: 'insensitive' },
            partOfSpeech: { equals: updateData.partOfSpeech, mode: 'insensitive' },
          },
        });
        if (existing) {
          const posLabel = updateData.partOfSpeech ? ` (${updateData.partOfSpeech})` : '';
          vocabInvalid(`Từ "${updateData.english}"${posLabel} đã tồn tại trong bộ từ này.`);
        }
      }

      const changed = !remove && Object.entries(data).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(word[key as keyof VocabularyWord]));
      const saved = await db.vocabularyWord.update({ where: { id }, data: { ...data, version: { increment: 1 }, ...(changed ? { contentVersion: { increment: 1 }, learningState: 'NEEDS_REVIEW', lastReviewedAt: null, lastReviewItemId: null, lastPresentedAt: null } : {}) } });
      return { targetId: id, appliedVersion: saved.version, result: { wordId: id, deleted: remove } };
    });
    return { receipt: this.commands.view(receipt), word: await this.readWord(userId, id) };
  }
  async deleteWord(userId: string, id: string, dto: VocabularyVersionDto) {
    return this.updateWord(userId, id, dto, true);
  }
  async summary(userId: string) {
    const [row] = await this.prisma.$queryRaw<{
      totalWords: number;
      rememberedWords: number;
      reviewedWords: number;
      completedReviewCount: number;
      hasMoreDecks: boolean;
      decks: RawDeckStatsRow[] | null;
    }[]>`
      WITH
      word_totals AS (
        SELECT
          COUNT(*)::int AS total_words,
          COUNT(*) FILTER (WHERE w.learning_state = 'REMEMBERED')::int AS remembered_words,
          COUNT(*) FILTER (WHERE w.last_reviewed_at IS NOT NULL)::int AS reviewed_words
        FROM vocabulary_words w
        JOIN vocabulary_decks d ON d.id = w.deck_id
        WHERE d.user_id = ${userId}::uuid
          AND d.deleted_at IS NULL
          AND w.deleted_at IS NULL
      ),
      rev_done AS (
        SELECT COUNT(*)::int AS completed_review_count
        FROM vocabulary_review_attempts
        WHERE user_id = ${userId}::uuid
          AND status = 'COMPLETED'
      ),
      top3 AS (
        SELECT
          id,
          name,
          version,
          deleted_at,
          created_at,
          ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
        FROM vocabulary_decks
        WHERE user_id = ${userId}::uuid
          AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC
        LIMIT 3
      ),
      deck_rows AS (
        SELECT id, name, version, deleted_at, created_at, rn
        FROM top3
        WHERE rn <= 2
      ),
      deck_word_stats AS (
        SELECT
          w.deck_id,
          COUNT(*)::int AS total_words,
          COUNT(*) FILTER (WHERE w.learning_state = 'REMEMBERED')::int AS remembered_words,
          COUNT(*) FILTER (WHERE w.last_reviewed_at IS NOT NULL)::int AS reviewed_words
        FROM vocabulary_words w
        JOIN deck_rows dr ON dr.id = w.deck_id
        WHERE w.deleted_at IS NULL
        GROUP BY w.deck_id
      ),
      deck_active AS (
        SELECT DISTINCT ON (r.deck_id)
          r.deck_id,
          r.id AS active_attempt_id
        FROM vocabulary_review_attempts r
        JOIN deck_rows dr ON dr.id = r.deck_id
        WHERE r.user_id = ${userId}::uuid
          AND r.status = 'IN_PROGRESS'
        ORDER BY r.deck_id, r.started_at DESC, r.id DESC
      )
      SELECT
        wt.total_words AS "totalWords",
        wt.remembered_words AS "rememberedWords",
        wt.reviewed_words AS "reviewedWords",
        rd.completed_review_count AS "completedReviewCount",
        (SELECT COUNT(*) > 2 FROM top3) AS "hasMoreDecks",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', dr.id,
                'name', dr.name,
                'version', dr.version,
                'deletedAt', (dr.deleted_at AT TIME ZONE 'UTC'),
                'createdAt', (dr.created_at AT TIME ZONE 'UTC'),
                'totalWords', COALESCE(dws.total_words, 0),
                'rememberedWords', COALESCE(dws.remembered_words, 0),
                'reviewedWords', COALESCE(dws.reviewed_words, 0),
                'activeAttemptId', da.active_attempt_id
              )
              ORDER BY dr.rn
            )
            FROM deck_rows dr
            LEFT JOIN deck_word_stats dws ON dws.deck_id = dr.id
            LEFT JOIN deck_active da ON da.deck_id = dr.id
          ),
          '[]'::json
        ) AS decks
      FROM word_totals wt
      CROSS JOIN rev_done rd
    `;
    const totalWords = Number(row?.totalWords ?? 0);
    const rememberedWords = Number(row?.rememberedWords ?? 0);
    const reviewedWords = Number(row?.reviewedWords ?? 0);
    const completedReviewCount = Number(row?.completedReviewCount ?? 0);
    const deckRows = Array.isArray(row?.decks) ? row.decks : [];
    return {
      totals: {
        totalWords,
        rememberedWords,
        needsReviewWords: totalWords - rememberedWords,
        reviewedWords,
        completedReviewCount,
      },
      decks: deckRows.map(deck => this.buildDeckView(deck, deck, deck.activeAttemptId ?? null)),
      hasMoreDecks: Boolean(row?.hasMoreDecks),
    };
  }

  /** Returns active words stored in the account's stable Reading vocabulary deck. */
  async readingWords(userId: string) {
    const deck = await this.findReadingDeck(this.prisma, userId);
    if (!deck) return { deck: null, items: [] };
    const rows = await this.prisma.vocabularyWord.findMany({
      where: { deckId: deck.id, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return {
      deck: { id: deck.id, name: deck.name },
      items: rows.map(w => ({ ...wordView(w), acceptedAnswers: w.acceptedAnswers })),
    };
  }

  /** Atomically saves a reading-passage word into the user's Reading deck without duplicates. */
  async saveReadingWord(userId: string, dto: VocabularyCreateWordDto) {
    const normalized = this.wordData(dto);
    const receipt = await this.commands.execute(userId, dto.commandId, 'SAVE_READING_WORD', 'reading-deck', dto, async db => {
      let deck = await this.findReadingDeck(db, userId);
      if (!deck) {
        deck = await db.vocabularyDeck.create({
          data: { userId, name: READING_DECK_DEFAULT_NAME, systemKey: READING_DECK_SYSTEM_KEY },
        });
      } else if (deck.systemKey !== READING_DECK_SYSTEM_KEY) {
        deck = await db.vocabularyDeck.update({
          where: { id: deck.id },
          data: { systemKey: READING_DECK_SYSTEM_KEY },
        });
      }
      const existing = await db.vocabularyWord.findFirst({
        where: {
          deckId: deck.id,
          deletedAt: null,
          english: { equals: normalized.english, mode: 'insensitive' },
          meaning: { equals: normalized.meaning, mode: 'insensitive' },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (existing) {
        return {
          targetId: existing.id,
          appliedVersion: existing.version,
          result: { deckId: deck.id, wordId: existing.id, alreadyExisted: true },
        };
      }
      const word = await db.vocabularyWord.create({ data: { deckId: deck.id, ...normalized } });
      return {
        targetId: word.id,
        appliedVersion: word.version,
        result: { deckId: deck.id, wordId: word.id, alreadyExisted: false },
      };
    });
    const result = receipt.result as { deckId: string; alreadyExisted?: boolean };
    const deck = await this.ownedDeck(this.prisma, userId, result.deckId, true);
    return {
      receipt: this.commands.view(receipt),
      deck: await this.deckView(this.prisma, deck),
      word: await this.readWord(userId, receipt.targetId),
      alreadyExisted: Boolean(result.alreadyExisted),
    };
  }
}
