import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VocabularyCommandService } from './vocabulary-command.service';
import { VocabularyService } from './vocabulary.service';
import { VocabularyReviewService } from './vocabulary-review.service';
import { VocabularyReviewCommandDto } from './vocabulary.dto';
import { reviewView, Review } from './vocabulary.types';

describe('Vocabulary review state transitions', () => {
  let service: VocabularyReviewService;
  let state: any;
  let word: any;
  let db: any;
  const request = (action: string, fields: Record<string, unknown> = {}) => ({ commandId: 'command', expectedVersion: state.version, itemId: state.queue[0], action, ...fields } as VocabularyReviewCommandDto);
  beforeEach(() => {
    word = { id: 'word', contentVersion: 1, deletedAt: null, learningState: 'NEEDS_REVIEW' };
    state = { id: 'attempt', userId: 'owner', deckId: 'deck', scope: 'ALL', status: 'IN_PROGRESS', version: 0, phase: 'FRONT', queue: ['item'], deckSnapshot: { id: 'deck', name: 'Work' }, remainingEligibleCount: 0,
      items: [{ id: 'item', wordId: 'word', initialOrdinal: 0, wordContentVersion: 1, wordSnapshot: { id: 'word', english: "don't", meaning: 'đừng', acceptedAnswers: ["don't"] },
        state: 'PENDING', draft: '', checkedAt: null, isCorrect: null, rating: null, resultSource: null, finalizedAt: null }] };
    db = {
      vocabularyReviewAttempt: { findFirst: jest.fn(async () => structuredClone(state)), update: jest.fn(async ({ data }: any) => { const version = state.version + 1; state = { ...state, ...data, version }; return state; }) },
      vocabularyReviewItem: { update: jest.fn(async ({ where, data }: any) => { Object.assign(state.items.find((item: any) => item.id === where.id), data); }) },
      vocabularyWord: { updateMany: jest.fn(async ({ where, data }: any) => { if (where.contentVersion === word.contentVersion && !word.deletedAt) { Object.assign(word, data); return { count: 1 }; } return { count: 0 }; }) },
    };
    const commands = { execute: async (_u: string, _c: string, _a: string, _t: string, _p: unknown, fn: any) => fn(db), view: (r: unknown) => r };
    service = new VocabularyReviewService(db as PrismaService, commands as unknown as VocabularyCommandService, {} as VocabularyService);
  });
  it('self rating preserves null correctness and finalizes only once', async () => {
    await service.command('owner', 'attempt', request('RATE', { rating: 'EASY' }));
    expect(word.learningState).toBe('REMEMBERED');
    expect(state.items[0]).toMatchObject({ state: 'REVIEWED', isCorrect: null, resultSource: 'SELF_REPORT' });
    expect(reviewView(state as Review).counts).toMatchObject({ reviewedCount: 1, checkedCount: 0 });
    await expect(service.command('owner', 'attempt', request('RATE', { itemId: 'item', rating: 'EASY' }))).rejects.toBeInstanceOf(ConflictException);
  });
  it('requeues the sole word without duplicating it or finalizing', async () => {
    await service.command('owner', 'attempt', request('REQUEUE'));
    expect(state.queue).toEqual(['item']); expect(word.lastReviewedAt).toBeUndefined();
  });
  it('all skipped can submit with zero reviewed and no fake score', async () => {
    await service.command('owner', 'attempt', request('SKIP'));
    await service.command('owner', 'attempt', request('SUBMIT', { itemId: undefined }));
    expect(state.status).toBe('COMPLETED');
    expect(reviewView(state as Review).counts).toMatchObject({ skippedCount: 1, reviewedCount: 0, checkedCount: 0 });
  });
  it('checks on server but applies labels only when confirmed', async () => {
    await service.command('owner', 'attempt', request('SAVE_PROGRESS', { phase: 'RECALL', draft: 'DON’T' }));
    await service.command('owner', 'attempt', request('CHECK_RECALL', { answer: 'DON’T' }));
    expect(state.items[0].isCorrect).toBe(true); expect(word.lastReviewedAt).toBeUndefined();
    await service.command('owner', 'attempt', request('ADVANCE'));
    expect(word.learningState).toBe('NEEDS_REVIEW');
    expect(state.items[0]).toMatchObject({ rating: 'MEDIUM', resultSource: 'RECALL_AFTER_REVEAL' });
  });
  it('wrong recall cannot be promoted to easy', async () => {
    await service.command('owner', 'attempt', request('SAVE_PROGRESS', { phase: 'RECALL' }));
    await service.command('owner', 'attempt', request('CHECK_RECALL', { answer: 'dont' }));
    await expect(service.command('owner', 'attempt', request('RATE', { rating: 'EASY' }))).rejects.toBeInstanceOf(BadRequestException);
    await service.command('owner', 'attempt', request('ADVANCE'));
    expect(word.learningState).toBe('NEEDS_REVIEW'); expect(state.items[0].rating).toBe('HARD');
  });
  it('does not overwrite edited or deleted content with an old snapshot result', async () => {
    word.contentVersion = 2;
    await service.command('owner', 'attempt', request('RATE', { rating: 'EASY' }));
    expect(word.learningState).toBe('NEEDS_REVIEW'); expect(state.items[0].rating).toBe('EASY');
  });
  it('requires correct stage, immutable checked answers, and matching version', async () => {
    await expect(service.command('owner', 'attempt', request('CHECK_RECALL', { answer: 'dont' }))).rejects.toBeInstanceOf(BadRequestException);
    await service.command('owner', 'attempt', request('SAVE_PROGRESS', { phase: 'RECALL' }));
    await service.command('owner', 'attempt', request('CHECK_RECALL', { answer: 'dont' }));
    await expect(service.command('owner', 'attempt', request('CHECK_RECALL', { answer: "don't" }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.command('owner', 'attempt', request('SKIP'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.command('owner', 'attempt', request('ADVANCE', { expectedVersion: 0 }))).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects null/irrelevant payload rather than allowing persistence errors', async () => {
    await expect(service.command('owner', 'attempt', request('SAVE_PROGRESS', { phase: 'RECALL', draft: null }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.command('owner', 'attempt', request('REQUEUE', { answer: 'x' }))).rejects.toBeInstanceOf(BadRequestException);
  });
});
