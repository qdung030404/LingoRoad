import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { VocabularyCommandService } from './vocabulary-command.service';
import { VocabularyService } from './vocabulary.service';
import { VocabularyListQuery, VocabularyReviewCommandDto, VocabularyStartDto } from './vocabulary.dto';
import { Db, normalizeVocabularyAnswer, Review, reviewView, vocabConflict, vocabInvalid, vocabMissing, wordView } from './vocabulary.types';

const withItems = { items: { orderBy: { initialOrdinal: 'asc' as const } } };
@Injectable()
export class VocabularyReviewService {
  constructor(private readonly prisma: PrismaService, private readonly commands: VocabularyCommandService, private readonly library: VocabularyService) {}
  private async owned(db: Db, userId: string, id: string): Promise<Review> {
    const attempt = await db.vocabularyReviewAttempt.findFirst({ where: { id, userId }, include: withItems });
    if (!attempt) vocabMissing();
    return attempt;
  }
  async attempt(userId: string, id: string) { return { attempt: reviewView(await this.owned(this.prisma, userId, id)) }; }
  async start(userId: string, deckId: string, dto: VocabularyStartDto) {
    dto.scope ??= 'NEEDS_REVIEW';
    const receipt = await this.commands.execute(userId, dto.commandId, 'START_REVIEW', deckId, dto, async db => {
      await this.library.ownedDeck(db, userId, deckId);
      const active = await db.vocabularyReviewAttempt.findFirst({ where: { userId, deckId, status: 'IN_PROGRESS' } });
      if (active) return { targetId: active.id, appliedVersion: active.version, result: { attemptId: active.id } };
      const words = await db.vocabularyWord.findMany({ where: { deckId, deletedAt: null, ...(dto.scope === 'ALL' ? {} : { learningState: 'NEEDS_REVIEW' }) },
        orderBy: [{ lastPresentedAt: { sort: 'asc', nulls: 'first' } }, { lastReviewedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }, { id: 'asc' }], take: 101 });
      if (!words.length) return { targetId: deckId, result: { attemptId: null, reason: 'NO_WORDS_TO_REVIEW' } };
      const eligible = await db.vocabularyWord.count({ where: { deckId, deletedAt: null, ...(dto.scope === 'ALL' ? {} : { learningState: 'NEEDS_REVIEW' }) } });
      const selected = words.slice(0, 100), ids = selected.map(() => randomUUID());
      const deck = await this.library.ownedDeck(db, userId, deckId);
      const attempt = await db.vocabularyReviewAttempt.create({ data: { userId, deckId, scope: dto.scope,
        deckSnapshot: { id: deck.id, name: deck.name }, queue: ids, remainingEligibleCount: eligible - selected.length,
        items: { create: selected.map((word, i) => ({ id: ids[i], wordId: word.id, initialOrdinal: i, wordContentVersion: word.contentVersion,
          wordSnapshot: { ...wordView(word), acceptedAnswers: word.acceptedAnswers } as unknown as Prisma.InputJsonValue })) } } });
      await db.vocabularyWord.updateMany({ where: { id: { in: selected.map(w => w.id) } }, data: { lastPresentedAt: new Date() } });
      return { targetId: attempt.id, appliedVersion: attempt.version, result: { attemptId: attempt.id } };
    });
    const result = receipt.result as { attemptId: string | null; reason?: string };
    return { receipt: this.commands.view(receipt), ...(result.attemptId ? await this.attempt(userId, result.attemptId) : { attempt: null, reason: result.reason }) };
  }
  async command(userId: string, id: string, dto: VocabularyReviewCommandDto) {
    const receipt = await this.commands.execute(userId, dto.commandId, dto.action, id, dto, async db => {
      const attempt = await this.owned(db, userId, id);
      if (attempt.version !== dto.expectedVersion) vocabConflict();
      if (attempt.status !== 'IN_PROGRESS') vocabInvalid('Lượt ôn đã kết thúc.');
      this.validatePayload(dto);
      const queue = [...attempt.queue], item = attempt.items.find(i => i.id === queue[0]);
      if (!['SUBMIT', 'ABANDON'].includes(dto.action) && (!item || item.id !== dto.itemId || item.state !== 'PENDING')) vocabConflict();
      let phase = attempt.phase;
      let status = attempt.status;
      let submittedAt: Date | undefined;
      if (dto.action === 'SUBMIT') {
        if (queue.length) vocabInvalid('Hãy hoàn thành hoặc bỏ qua các từ còn lại.');
        status = 'COMPLETED'; submittedAt = new Date();
      } else if (dto.action === 'ABANDON') { status = 'ABANDONED'; submittedAt = new Date(); }
      else if (item) {
        if (dto.action === 'SAVE_PROGRESS') {
          if (item.checkedAt && (dto.phase !== 'RECALL' || (dto.draft !== undefined && dto.draft !== item.draft))) vocabInvalid('Đáp án đã kiểm tra không thể sửa.');
          phase = dto.phase!;
          await db.vocabularyReviewItem.update({ where: { id: item.id }, data: { ...(dto.draft !== undefined ? { draft: dto.draft } : {}) } });
        } else if (dto.action === 'CHECK_RECALL') {
          if (phase !== 'RECALL') vocabInvalid('Mở phần điền từ trước khi kiểm tra.');
          if (item.checkedAt) vocabInvalid('Đáp án đã được kiểm tra.');
          const normalized = normalizeVocabularyAnswer(dto.answer!);
          if (!normalized) vocabInvalid('Nhập từ tiếng Anh trước khi kiểm tra.');
          const snapshot = item.wordSnapshot as { acceptedAnswers: string[] };
          const correct = snapshot.acceptedAnswers.some(a => normalizeVocabularyAnswer(a) === normalized);
          await db.vocabularyReviewItem.update({ where: { id: item.id }, data: { draft: dto.answer!, checkedAnswer: dto.answer,
            normalizedAnswer: normalized, normalizationVersion: 'v1', isCorrect: correct, checkedAt: new Date() } });
        } else if (dto.action === 'REQUEUE' || dto.action === 'SKIP') {
          if (item.checkedAt) vocabInvalid('Xác nhận kết quả đã kiểm tra trước khi chuyển từ.');
          queue.shift();
          if (dto.action === 'REQUEUE') queue.push(item.id);
          else await db.vocabularyReviewItem.update({ where: { id: item.id }, data: { state: 'SKIPPED', finalizedAt: new Date() } });
          phase = 'FRONT';
        } else {
          if (dto.action === 'ADVANCE' && !item.checkedAt) vocabInvalid('Kiểm tra đáp án trước khi tiếp tục.');
          if (dto.action === 'RATE' && phase === 'RECALL' && !item.checkedAt) vocabInvalid('Kiểm tra đáp án trước khi đánh giá.');
          const rating = dto.action === 'ADVANCE' ? (item.isCorrect === false ? 'HARD' : dto.rating ?? 'MEDIUM') : dto.rating!;
          if (item.isCorrect === false && rating !== 'HARD') vocabInvalid('Câu trả lời sai cần ôn lại.', 'VOCAB_INVALID_RATING');
          const now = new Date();
          await db.vocabularyReviewItem.update({ where: { id: item.id }, data: { state: 'REVIEWED', rating,
            resultSource: item.checkedAt ? 'RECALL_AFTER_REVEAL' : 'SELF_REPORT', finalizedAt: now } });
          // Content may have changed or been archived since the snapshot; preserve history without overwriting the new version.
          await db.vocabularyWord.updateMany({ where: { id: item.wordId, contentVersion: item.wordContentVersion, deletedAt: null, deck: { userId, deletedAt: null } },
            data: { learningState: rating === 'EASY' ? 'REMEMBERED' : 'NEEDS_REVIEW', lastReviewedAt: now, lastReviewItemId: item.id } });
          queue.shift(); phase = 'FRONT';
        }
      }
      const saved = await db.vocabularyReviewAttempt.update({ where: { id }, data: { queue, phase, status, submittedAt, version: { increment: 1 } } });
      return { targetId: id, appliedVersion: saved.version, result: { attemptId: id, action: dto.action } };
    });
    return { receipt: this.commands.view(receipt), ...await this.attempt(userId, id) };
  }
  private validatePayload(dto: VocabularyReviewCommandDto) {
    for (const key of ['phase', 'draft', 'answer', 'rating', 'itemId']) {
      if ((dto as unknown as Record<string, unknown>)[key] === null) vocabInvalid('Dữ liệu thao tác không được null.');
    }
    const allowed: Record<string, string[]> = { SAVE_PROGRESS: ['phase', 'draft'], CHECK_RECALL: ['answer'], RATE: ['rating'], ADVANCE: ['rating'], SKIP: [], REQUEUE: [], SUBMIT: [], ABANDON: [] };
    for (const key of ['phase', 'draft', 'answer', 'rating']) if ((dto as unknown as Record<string, unknown>)[key] !== undefined && !allowed[dto.action].includes(key)) vocabInvalid('Trường dữ liệu không phù hợp thao tác.');
    if (dto.action === 'SAVE_PROGRESS' && !dto.phase || dto.action === 'CHECK_RECALL' && dto.answer === undefined || dto.action === 'RATE' && !dto.rating) vocabInvalid('Thiếu dữ liệu thao tác ôn tập.');
    if (['SUBMIT', 'ABANDON'].includes(dto.action) && dto.itemId) vocabInvalid('Thao tác kết thúc không nhận itemId.');
  }
  async history(userId: string, query: VocabularyListQuery) {
    query.limit ??= 20;
    if (query.deckId) await this.library.ownedDeck(this.prisma, userId, query.deckId, true);
    if (query.cursor) { const cursor = await this.owned(this.prisma, userId, query.cursor); if (query.deckId && cursor.deckId !== query.deckId) vocabMissing(); }
    const rows = await this.prisma.vocabularyReviewAttempt.findMany({ where: { userId, ...(query.deckId ? { deckId: query.deckId } : {}) }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}), include: withItems });
    return { items: rows.slice(0, query.limit).map(reviewView), nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null };
  }
}
