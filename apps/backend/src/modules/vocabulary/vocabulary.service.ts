import { Injectable } from '@nestjs/common';
import { Prisma, VocabularyDeck, VocabularyWord } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VocabularyCommandService } from './vocabulary-command.service';
import { VocabularyCreateDeckDto, VocabularyCreateWordDto, VocabularyListQuery, VocabularyUpdateDeckDto, VocabularyUpdateWordDto, VocabularyVersionDto } from './vocabulary.dto';
import { Db, vocabConflict, vocabInvalid, vocabMissing, wordView } from './vocabulary.types';

@Injectable()
export class VocabularyService {
  constructor(private readonly prisma: PrismaService, private readonly commands: VocabularyCommandService) {}
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
  private async deckView(db: Db, deck: VocabularyDeck) {
    const words = deck.deletedAt ? [] : await db.vocabularyWord.findMany({ where: { deckId: deck.id, deletedAt: null }, select: { learningState: true, lastReviewedAt: true } });
    const active = await db.vocabularyReviewAttempt.findFirst({ where: { deckId: deck.id, userId: deck.userId, status: 'IN_PROGRESS' }, select: { id: true } });
    const rememberedWords = words.filter(w => w.learningState === 'REMEMBERED').length;
    return { id: deck.id, name: deck.name, version: deck.version, deletedAt: deck.deletedAt, createdAt: deck.createdAt,
      totalWords: words.length, rememberedWords, needsReviewWords: words.length - rememberedWords,
      reviewedWords: words.filter(w => w.lastReviewedAt != null).length, activeAttemptId: active?.id ?? null };
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
      return { items: await Promise.all(rows.slice(0, query.limit).map(d => this.deckView(db, d))), nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null };
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
  private wordData(dto: VocabularyCreateWordDto, old?: VocabularyWord) {
    const english = dto.english.trim(), meaning = dto.meaning.trim();
    if (!english || !meaning) vocabInvalid('Nhập từ tiếng Anh và nghĩa.');
    const aliases = dto.acceptedAnswers ?? old?.acceptedAnswers.filter(a => a !== old.english) ?? [];
    if (aliases.some(a => !a.trim())) vocabInvalid('Đáp án thay thế không được rỗng.');
    const alternatives = [...new Set(aliases.map(a => a.trim()).filter(a => a !== english))];
    if (alternatives.length > 10) vocabInvalid('Chỉ thêm tối đa 10 đáp án thay thế.');
    return { english, meaning, phonetic: dto.phonetic ?? old?.phonetic ?? '', partOfSpeech: dto.partOfSpeech ?? old?.partOfSpeech ?? '',
      example: dto.example ?? old?.example ?? '', translation: dto.translation ?? old?.translation ?? '', acceptedAnswers: [english, ...alternatives] };
  }
  async createWord(userId: string, deckId: string, dto: VocabularyCreateWordDto) {
    const receipt = await this.commands.execute(userId, dto.commandId, 'CREATE_WORD', deckId, dto, async db => {
      await this.ownedDeck(db, userId, deckId);
      const word = await db.vocabularyWord.create({ data: { deckId, ...this.wordData(dto) } });
      return { targetId: word.id, appliedVersion: word.version, result: { wordId: word.id } };
    });
    return { receipt: this.commands.view(receipt), word: await this.readWord(userId, receipt.targetId) };
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
      const changed = !remove && Object.entries(data).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(word[key as keyof VocabularyWord]));
      const saved = await db.vocabularyWord.update({ where: { id }, data: { ...data, version: { increment: 1 }, ...(changed ? { contentVersion: { increment: 1 }, learningState: 'NEEDS_REVIEW', lastReviewedAt: null, lastReviewItemId: null, lastPresentedAt: null } : {}) } });
      return { targetId: id, appliedVersion: saved.version, result: { wordId: id, deleted: remove } };
    });
    return { receipt: this.commands.view(receipt), word: await this.readWord(userId, id) };
  }
  async summary(userId: string) {
    return this.prisma.$transaction(async db => {
      const words = await db.vocabularyWord.findMany({ where: { deletedAt: null, deck: { userId, deletedAt: null } }, select: { learningState: true, lastReviewedAt: true } });
      const rememberedWords = words.filter(w => w.learningState === 'REMEMBERED').length;
      const decks = await db.vocabularyDeck.findMany({ where: { userId, deletedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 3 });
      const completedReviewCount = await db.vocabularyReviewAttempt.count({ where: { userId, status: 'COMPLETED' } });
      return { totals: { totalWords: words.length, rememberedWords, needsReviewWords: words.length - rememberedWords,
        reviewedWords: words.filter(w => w.lastReviewedAt != null).length, completedReviewCount },
        decks: await Promise.all(decks.slice(0, 2).map(d => this.deckView(db, d))), hasMoreDecks: decks.length > 2 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
