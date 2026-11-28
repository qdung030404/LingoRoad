import { PrismaService } from '../prisma/prisma.service';
import { VocabularyCommandService } from './vocabulary-command.service';
import { VocabularyReviewService } from './vocabulary-review.service';
import { VocabularyService } from './vocabulary.service';

describe('Vocabulary active review resolution across all decks', () => {
  it('returns latest IN_PROGRESS review ordered by startedAt DESC, id DESC even when on 3rd deck while preserving summary contract', async () => {
    const startedAt = new Date('2026-11-28T06:00:00.000Z');
    const deck3Attempt = {
      id: '00000000-0000-4000-8000-000000000303',
      userId: '00000000-0000-4000-8000-000000000001',
      deckId: '00000000-0000-4000-8000-0000000000d3',
      scope: 'NEEDS_REVIEW' as const,
      status: 'IN_PROGRESS' as const,
      phase: 'FRONT' as const,
      version: 0,
      deckSnapshot: { id: '00000000-0000-4000-8000-0000000000d3', name: 'Deck 3' },
      queue: ['00000000-0000-4000-8000-000000000901'],
      remainingEligibleCount: 0,
      startedAt,
      updatedAt: startedAt,
      submittedAt: null,
      items: [
        {
          id: '00000000-0000-4000-8000-000000000901',
          attemptId: '00000000-0000-4000-8000-000000000303',
          wordId: '00000000-0000-4000-8000-000000000801',
          initialOrdinal: 0,
          wordContentVersion: 1,
          wordSnapshot: {
            id: '00000000-0000-4000-8000-000000000801',
            english: 'resilient',
            meaning: 'kiên cường',
            contentVersion: 1,
          },
          state: 'PENDING' as const,
          draft: '',
          checkedAnswer: null,
          normalizedAnswer: null,
          normalizationVersion: null,
          isCorrect: null,
          checkedAt: null,
          rating: null,
          resultSource: null,
          finalizedAt: null,
        },
      ],
    };

    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          totalWords: 3,
          rememberedWords: 0,
          reviewedWords: 0,
          completedReviewCount: 0,
          hasMoreDecks: true,
          decks: [
            {
              id: '00000000-0000-4000-8000-0000000000d1',
              name: 'Deck 1',
              version: 0,
              deletedAt: null,
              createdAt: startedAt,
              totalWords: 1,
              rememberedWords: 0,
              reviewedWords: 0,
              activeAttemptId: null,
            },
            {
              id: '00000000-0000-4000-8000-0000000000d2',
              name: 'Deck 2',
              version: 0,
              deletedAt: null,
              createdAt: startedAt,
              totalWords: 1,
              rememberedWords: 0,
              reviewedWords: 0,
              activeAttemptId: '00000000-0000-4000-8000-000000000101',
            },
          ],
        },
      ]),
      vocabularyReviewAttempt: {
        findFirst: jest.fn().mockResolvedValue(deck3Attempt),
      },
    };

    const commands = {} as VocabularyCommandService;
    const library = new VocabularyService(prisma as unknown as PrismaService, commands);
    const reviews = new VocabularyReviewService(
      prisma as unknown as PrismaService,
      commands,
      library,
    );

    const summary = await library.summary(deck3Attempt.userId);
    expect(summary.decks).toHaveLength(2);
    expect(summary.hasMoreDecks).toBe(true);
    expect('activeAttemptId' in summary).toBe(false);

    const active = await reviews.active(deck3Attempt.userId);
    expect(prisma.vocabularyReviewAttempt.findFirst).toHaveBeenCalledWith({
      where: { userId: deck3Attempt.userId, status: 'IN_PROGRESS' },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      include: { items: { orderBy: { initialOrdinal: 'asc' } } },
    });
    expect(active.attempt?.id).toBe(deck3Attempt.userId ? deck3Attempt.id : '');
    expect(active.attempt?.deckId).toBe(deck3Attempt.deckId);
  });
});
