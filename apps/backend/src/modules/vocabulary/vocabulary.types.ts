import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, VocabularyReviewAttempt, VocabularyReviewItem, VocabularyWord } from '@prisma/client';
export type Db = Prisma.TransactionClient;
export type Review = VocabularyReviewAttempt & { items: VocabularyReviewItem[] };
export const normalizeVocabularyAnswer = (text: string) => text.normalize('NFKC').replace(/[‘’]/g, "'").trim().replace(/\s+/gu, ' ').toLowerCase();
export function vocabMissing(): never { throw new NotFoundException({ code: 'VOCAB_NOT_FOUND', message: 'Không tìm thấy dữ liệu từ vựng.' }); }
export function vocabInvalid(message: string, code = 'VOCAB_INVALID_INPUT'): never { throw new BadRequestException({ code, message }); }
export function vocabConflict(code = 'VOCAB_REVIEW_CONFLICT'): never { throw new ConflictException({ code, message: 'Dữ liệu đã thay đổi. Hãy tải lại trước khi tiếp tục.' }); }
export function wordView(word: VocabularyWord) {
  return { id: word.id, deckId: word.deckId, english: word.english, meaning: word.meaning, phonetic: word.phonetic,
    partOfSpeech: word.partOfSpeech, example: word.example, translation: word.translation,
    contentVersion: word.contentVersion, version: word.version, learningState: word.learningState,
    lastReviewedAt: word.lastReviewedAt, deletedAt: word.deletedAt, createdAt: word.createdAt };
}
export function reviewView(review: Review) {
  const items = review.items.map(item => {
    const snapshot = item.wordSnapshot as Record<string, Prisma.JsonValue>;
    const { acceptedAnswers: _answers, ...word } = snapshot;
    return { id: item.id, wordId: item.wordId, initialOrdinal: item.initialOrdinal, wordContentVersion: item.wordContentVersion, word,
      state: item.state, draft: item.draft, checkedAnswer: item.checkedAnswer, isCorrect: item.isCorrect,
      checkedAt: item.checkedAt, rating: item.rating, resultSource: item.resultSource, answerExposed: true, finalizedAt: item.finalizedAt };
  });
  const reviewed = items.filter(item => item.state === 'REVIEWED');
  const checked = reviewed.filter(item => item.checkedAt != null);
  return { id: review.id, deckId: review.deckId, deckSnapshot: review.deckSnapshot, scope: review.scope,
    status: review.status, version: review.version, phase: review.phase, queue: review.queue,
    currentItemId: review.queue[0] ?? null, currentItem: items.find(item => item.id === review.queue[0]) ?? null, items,
    selectedCount: items.length, remainingEligibleCount: review.remainingEligibleCount,
    counts: { totalCount: items.length, reviewedCount: reviewed.length, skippedCount: items.filter(item => item.state === 'SKIPPED').length,
      uncheckedCount: items.filter(item => item.state === 'PENDING').length, correctCount: checked.filter(item => item.isCorrect).length, checkedCount: checked.length },
    startedAt: review.startedAt, submittedAt: review.submittedAt };
}
