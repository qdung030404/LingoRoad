import { Injectable } from '@nestjs/common';
import { Prisma, VocabularyDeck, VocabularyWord } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VocabularyCommandService } from './vocabulary-command.service';
import { VocabularyBatchWordItemDto, VocabularyCreateBatchWordsDto, VocabularyCreateDeckDto, VocabularyCreateWordDto, VocabularyListQuery, VocabularyUpdateDeckDto, VocabularyUpdateWordDto, VocabularyVersionDto } from './vocabulary.dto';
import { Db, vocabConflict, vocabInvalid, vocabMissing, wordView } from './vocabulary.types';

const READING_DECK_SYSTEM_KEY = 'READING_WORDS';
const READING_DECK_DEFAULT_NAME = 'Từ vựng Bài đọc';

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
    return decks.map(deck => {
      const stats = statsByDeck.get(deck.id);
      const totalWords = Number(stats?.totalWords ?? 0);
      const rememberedWords = Number(stats?.rememberedWords ?? 0);
      const reviewedWords = Number(stats?.reviewedWords ?? 0);
      return {
        id: deck.id, name: deck.name, version: deck.version, deletedAt: deck.deletedAt, createdAt: deck.createdAt,
        totalWords, rememberedWords, needsReviewWords: totalWords - rememberedWords,
        reviewedWords, activeAttemptId: activeByDeck.get(deck.id) ?? null,
      };
    });
  }
  private async deckView(db: Db, deck: VocabularyDeck) {
    return (await this.deckViews(db, deck.userId, [deck]))[0];
  }
  async deck(userId: string, id: string, includeDeleted = false) {
    return { deck: await this.prisma.$transaction(async db => this.deckView(db, await this.ownedDeck(db, userId, id, includeDeleted)), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }) };
  }
  async decks(userId: string, query: VocabularyListQuery) {
    query.limit ??= 20;
    return this.prisma.$transaction(async db => {
      if (query.cursor) await this.ownedDeck(db, userId, query.cursor);
      const rows = await db.vocabularyDeck.findMany({ where: { userId, deletedAt: null, ...(query.query?.trim() ? { name: { contains: query.query.trim(), mode: 'insensitive' as const } } : {}) },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: query.limit + 1, ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}) });
      return { items: await this.deckViews(db, userId, rows.slice(0, query.limit)), nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async words(userId: string, deckId: string, query: VocabularyListQuery) {
    query.limit ??= 20;
    return this.prisma.$transaction(async db => {
      await this.ownedDeck(db, userId, deckId);
      if (query.cursor) { const cursor = await this.ownedWord(db, userId, query.cursor); if (cursor.deckId !== deckId) vocabMissing(); }
      const search = query.query?.trim();
      const rows = await db.vocabularyWord.findMany({ where: { deckId, deletedAt: null, ...(search ? { OR: [{ english: { contains: search, mode: 'insensitive' as const } }, { meaning: { contains: search, mode: 'insensitive' as const } }] } : {}) },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: query.limit + 1, ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}) });
      return { items: rows.slice(0, query.limit).map(w => ({ ...wordView(w), acceptedAnswers: w.acceptedAnswers })), nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
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
      const createdWords = [];
      const seenInBatch = new Set<string>();

      for (const item of dto.words) {
        const data = this.wordData(item);
        const key = `${data.english.trim().toLowerCase()}:::${data.partOfSpeech.trim().toLowerCase()}`;
        if (seenInBatch.has(key)) {
          continue; // Tránh trùng lặp trong nội bộ batch
        }
        seenInBatch.add(key);

        const existing = await db.vocabularyWord.findFirst({
          where: {
            deckId,
            deletedAt: null,
            english: { equals: data.english, mode: 'insensitive' },
            partOfSpeech: { equals: data.partOfSpeech, mode: 'insensitive' },
          },
        });
        if (existing) {
          continue; // Đã có trong collection này thì bỏ qua
        }

        const word = await db.vocabularyWord.create({ data: { deckId, ...data } });
        createdWords.push(word);
      }
      return { targetId: deckId, appliedVersion: undefined, result: { count: createdWords.length, wordIds: createdWords.map(w => w.id) } };
    });
    const wordIds = (receipt.result as { wordIds: string[] }).wordIds;
    const items = await this.prisma.vocabularyWord.findMany({
      where: { id: { in: wordIds } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
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
    return this.prisma.$transaction(async db => {
      const [totalsRows, decks, completedReviewCount] = await Promise.all([
        db.$queryRaw<{ totalWords: number; rememberedWords: number; reviewedWords: number }[]>`
          SELECT
            COUNT(*)::int AS "totalWords",
            COUNT(*) FILTER (WHERE w.learning_state = 'REMEMBERED')::int AS "rememberedWords",
            COUNT(*) FILTER (WHERE w.last_reviewed_at IS NOT NULL)::int AS "reviewedWords"
          FROM vocabulary_words w
          JOIN vocabulary_decks d ON d.id = w.deck_id
          WHERE d.user_id = ${userId}::uuid
            AND d.deleted_at IS NULL
            AND w.deleted_at IS NULL
        `,
        db.vocabularyDeck.findMany({ where: { userId, deletedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 3 }),
        db.vocabularyReviewAttempt.count({ where: { userId, status: 'COMPLETED' } }),
      ]);
      const totalsRow = totalsRows[0];
      const totalWords = Number(totalsRow?.totalWords ?? 0);
      const rememberedWords = Number(totalsRow?.rememberedWords ?? 0);
      const reviewedWords = Number(totalsRow?.reviewedWords ?? 0);
      return {
        totals: {
          totalWords, rememberedWords, needsReviewWords: totalWords - rememberedWords,
          reviewedWords, completedReviewCount,
        },
        decks: await this.deckViews(db, userId, decks.slice(0, 2)), hasMoreDecks: decks.length > 2,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  /** Returns active words stored in the account's stable Reading vocabulary deck. */
  async readingWords(userId: string) {
    return this.prisma.$transaction(async db => {
      const deck = await this.findReadingDeck(db, userId);
      if (!deck) return { deck: null, items: [] };
      const rows = await db.vocabularyWord.findMany({
        where: { deckId: deck.id, deletedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      return {
        deck: { id: deck.id, name: deck.name },
        items: rows.map(w => ({ ...wordView(w), acceptedAnswers: w.acceptedAnswers })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
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
