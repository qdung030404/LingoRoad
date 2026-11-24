import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VocabularyCommandService } from './vocabulary-command.service';
import { VocabularyService } from './vocabulary.service';
import { VocabularyReviewService } from './vocabulary-review.service';
import { VocabularyReviewCommandDto } from './vocabulary.dto';
import { reviewView, Review } from './vocabulary.types';

interface MockWord {
  id: string;
  contentVersion: number;
  deletedAt: Date | null;
  learningState: string;
  lastReviewedAt?: Date;
  lastReviewItemId?: string;
}

interface MockItem {
  id: string;
  wordId: string;
  initialOrdinal?: number;
  wordContentVersion?: number;
  wordSnapshot?: {
    id: string;
    english: string;
    meaning: string;
    acceptedAnswers: string[];
  };
  state: string;
  draft?: string;
  checkedAt?: Date | null;
  checkedAnswer?: string | null;
  normalizedAnswer?: string | null;
  normalizationVersion?: string | null;
  isCorrect: boolean | null;
  rating?: string | null;
  resultSource?: string | null;
  finalizedAt?: Date | null;
}

interface MockAttemptState {
  id: string;
  userId: string;
  deckId: string;
  scope: string;
  status: string;
  version: number;
  phase: string;
  queue: string[];
  deckSnapshot: { id: string; name: string };
  remainingEligibleCount: number;
  startedAt: Date;
  items: MockItem[];
}

interface MockDb {
  vocabularyDeck: {
    findFirst: jest.Mock<Promise<{ id: string } | null>, [{ where: { id: string; userId: string; deletedAt: null } }]>;
  };
  vocabularyReviewAttempt: {
    findFirst: jest.Mock<Promise<MockAttemptState>, []>;
    update: jest.Mock<Promise<MockAttemptState>, [{ data: Partial<MockAttemptState> }]>;
  };
  vocabularyReviewItem: {
    update: jest.Mock<Promise<void>, [{ where: { id: string }; data: Partial<MockItem> }]>;
  };
  vocabularyWord: {
    updateMany: jest.Mock<
      Promise<{ count: number }>,
      [{ where: { id?: string | { in: string[] }; deckId?: string; contentVersion: number }; data: Partial<MockWord> }]
    >;
  };
}

type CommandExecutor = (db: MockDb) => Promise<unknown>;

describe('Vocabulary review state transitions', () => {
  let service: VocabularyReviewService;
  let state: MockAttemptState;
  let word: MockWord;
  let db: MockDb;
  const request = (action: string, fields: Record<string, unknown> = {}) => ({ commandId: 'command', expectedVersion: state.version, itemId: state.queue[0], action, ...fields } as VocabularyReviewCommandDto);
  beforeEach(() => {
    word = { id: 'word', contentVersion: 1, deletedAt: null, learningState: 'NEEDS_REVIEW' };
    state = { id: 'attempt', userId: 'owner', deckId: 'deck', scope: 'ALL', status: 'IN_PROGRESS', version: 0, phase: 'FRONT', queue: ['item'], deckSnapshot: { id: 'deck', name: 'Work' }, remainingEligibleCount: 0,
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      items: [{ id: 'item', wordId: 'word', initialOrdinal: 0, wordContentVersion: 1, wordSnapshot: { id: 'word', english: "don't", meaning: 'đừng', acceptedAnswers: ["don't"] },
        state: 'PENDING', draft: '', checkedAt: null, isCorrect: null, rating: null, resultSource: null, finalizedAt: null }] };
    db = {
      vocabularyDeck: {
        findFirst: jest.fn(async (_args: { where: { id: string; userId: string; deletedAt: null } }) => ({ id: 'deck' })),
      },
      vocabularyReviewAttempt: {
        findFirst: jest.fn(async () => structuredClone(state)),
        update: jest.fn(async ({ data }: { data: Partial<MockAttemptState> }) => {
          const version = state.version + 1;
          state = { ...state, ...data, version };
          return state;
        }),
      },
      vocabularyReviewItem: {
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<MockItem> }) => {
          const target = state.items.find(item => item.id === where.id);
          if (target) Object.assign(target, data);
        }),
      },
      vocabularyWord: {
        updateMany: jest.fn(async ({ where, data }: { where: { id?: string | { in: string[] }; deckId?: string; contentVersion: number }; data: Partial<MockWord> }) => {
          if (where.contentVersion === word.contentVersion && !word.deletedAt) {
            Object.assign(word, data);
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
    };
    const commands = { execute: async (_u: string, _c: string, _a: string, _t: string, _p: unknown, fn: CommandExecutor) => fn(db), view: (r: unknown) => r };
    service = new VocabularyReviewService(db as unknown as PrismaService, commands as unknown as VocabularyCommandService, {} as VocabularyService);
  });
  it('self rating preserves null correctness and finalizes only once', async () => {
    await service.command('owner', 'attempt', request('RATE', { rating: 'EASY' }));
    expect(word.learningState).toBe('REMEMBERED');
    expect(state.items[0]).toMatchObject({ state: 'REVIEWED', isCorrect: null, resultSource: 'SELF_REPORT' });
    expect(reviewView(state as unknown as Review).counts).toMatchObject({ reviewedCount: 1, checkedCount: 0 });
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
    expect(reviewView(state as unknown as Review).counts).toMatchObject({ skippedCount: 1, reviewedCount: 0, checkedCount: 0 });
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
  it('batchSubmit final completes attempt and updates word learning states', async () => {
    const res = await service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-1',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY' }],
    });
    expect(word.learningState).toBe('REMEMBERED');
    expect(state.status).toBe('COMPLETED');
    expect(state.items[0]).toMatchObject({ state: 'REVIEWED', rating: 'EASY', resultSource: 'SELF_REPORT' });
    expect(state.queue).toEqual([]);
    expect(res.receipt).toBeDefined();
  });
  it('batchSubmit checkpoint keeps attempt IN_PROGRESS', async () => {
    await service.batchSubmit('owner', 'attempt', {
      commandId: 'checkpoint-1',
      expectedVersion: state.version,
      isFinal: false,
      results: [{ itemId: 'item', rating: 'HARD' }],
    });
    expect(word.learningState).toBe('NEEDS_REVIEW');
    expect(state.status).toBe('IN_PROGRESS');
    expect(state.items[0].rating).toBe('HARD');
    expect(state.queue).toEqual([]);
  });
  it('batchSubmit rejects on version mismatch', async () => {
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-conflict',
      expectedVersion: 999,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY' }],
    })).rejects.toBeInstanceOf(ConflictException);
  });
  it('batchSubmit rejects wrong recall being promoted to EASY', async () => {
    state.items[0].isCorrect = false;
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-wrong-promote',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY' }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('batchSubmit rejects final completion when queue still has unreviewed items', async () => {
    state.queue = ['item', 'other-item'];
    state.items.push({ id: 'other-item', wordId: 'word2', state: 'PENDING', isCorrect: null });
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-incomplete-final',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY' }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('batchSubmit preserves RECALL_AFTER_REVEAL when item was already checked on server', async () => {
    state.items[0].checkedAt = new Date();
    state.items[0].checkedAnswer = "don't";
    state.items[0].isCorrect = true;
    await service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-checked-preserve',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'MEDIUM' }],
    });
    expect(state.items[0]).toMatchObject({
      state: 'REVIEWED',
      rating: 'MEDIUM',
      checkedAnswer: "don't",
      resultSource: 'RECALL_AFTER_REVEAL',
    });
  });
  it('batchSubmit rejects overwriting a SKIPPED item without incrementing version', async () => {
    state.items[0].state = 'SKIPPED';
    state.queue = [];
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-skipped',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY' }],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(state.version).toBe(0);
    expect(state.items[0].state).toBe('SKIPPED');
  });
  it('batchSubmit rejects an already REVIEWED item', async () => {
    state.items[0].state = 'REVIEWED';
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-reviewed',
      expectedVersion: state.version,
      isFinal: false,
      results: [{ itemId: 'item', rating: 'EASY' }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('batchSubmit rejects foreign itemId without incrementing version', async () => {
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-foreign',
      expectedVersion: state.version,
      isFinal: false,
      results: [{ itemId: 'non-existent-item', rating: 'EASY' }],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(state.version).toBe(0);
  });
  it('batchSubmit rejects duplicate itemId in the same batch', async () => {
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-dup',
      expectedVersion: state.version,
      isFinal: true,
      results: [
        { itemId: 'item', rating: 'EASY' },
        { itemId: 'item', rating: 'HARD' },
      ],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.vocabularyReviewItem.update).not.toHaveBeenCalled();
  });
  it('batchSubmit rejects already COMPLETED or ABANDONED attempt', async () => {
    state.status = 'COMPLETED';
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-completed',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY' }],
    })).rejects.toBeInstanceOf(BadRequestException);

    state.status = 'ABANDONED';
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-abandoned',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY' }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('batchSubmit validates client-supplied checkedAnswer against acceptedAnswers on unchecked items', async () => {
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-unchecked-wrong-easy',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY', checkedAnswer: 'wrong' }],
    })).rejects.toBeInstanceOf(BadRequestException);

    await service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-unchecked-wrong-hard',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'HARD', checkedAnswer: 'wrong' }],
    });
    expect(state.items[0]).toMatchObject({
      state: 'REVIEWED',
      rating: 'HARD',
      checkedAnswer: 'wrong',
      normalizedAnswer: 'wrong',
      isCorrect: false,
      resultSource: 'RECALL_AFTER_REVEAL',
    });
    expect(state.items[0].checkedAt).toBeInstanceOf(Date);

    // Reset item for valid correct recall check
    state.status = 'IN_PROGRESS';
    state.queue = ['item'];
    state.items[0] = {
      ...state.items[0],
      state: 'PENDING',
      checkedAt: null,
      checkedAnswer: null,
      normalizedAnswer: null,
      isCorrect: null,
      rating: null,
      resultSource: null,
    };
    await service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-unchecked-right-easy',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY', checkedAnswer: 'DON’T' }],
    });
    expect(state.items[0]).toMatchObject({
      state: 'REVIEWED',
      rating: 'EASY',
      isCorrect: true,
      resultSource: 'RECALL_AFTER_REVEAL',
    });
  });
  it('batchSubmit rejects altering checkedAnswer on an already server-checked item', async () => {
    state.items[0].checkedAt = new Date();
    state.items[0].checkedAnswer = "don't";
    state.items[0].isCorrect = true;
    await expect(service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-tamper-checked',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY', checkedAnswer: 'tampered' }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('batchSubmit clamps backdated finalizedAt before attempt.startedAt to server now', async () => {
    await service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-backdated',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY', finalizedAt: '1970-01-01T00:00:00.000Z' }],
    });
    expect(state.items[0].finalizedAt).toBeInstanceOf(Date);
    expect(state.items[0].finalizedAt!.getTime()).toBeGreaterThanOrEqual(state.startedAt.getTime());
    expect(word.lastReviewedAt!.getTime()).toBeGreaterThanOrEqual(state.startedAt.getTime());
  });
  it('batchSubmit preserves attempt history without updating word when deck is soft-deleted', async () => {
    db.vocabularyDeck.findFirst.mockResolvedValueOnce(null);
    await service.batchSubmit('owner', 'attempt', {
      commandId: 'batch-deleted-deck',
      expectedVersion: state.version,
      isFinal: true,
      results: [{ itemId: 'item', rating: 'EASY' }],
    });
    expect(state.status).toBe('COMPLETED');
    expect(db.vocabularyWord.updateMany).not.toHaveBeenCalled();
    expect(word.learningState).toBe('NEEDS_REVIEW');
  });
});
