import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssessmentItem, AssessmentSkill, CefrLevel, ItemUsageScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MlClientService } from '../../ml/ml-client.service';
import { InProcessCatFallback } from '../../ml/fallbacks/in-process-cat.fallback';
import { DemoPlacementService, provisionalCefr } from './demo-placement.service';

jest.mock('fs', () => ({ ...jest.requireActual('fs'), existsSync: jest.fn(() => true) }));

function item(id: string, skill: AssessmentSkill = AssessmentSkill.READING, cefrLevel: CefrLevel = CefrLevel.A2): AssessmentItem {
  return {
    id, groupId: null, itemOrder: 1, externalId: id, bankVersion: 'demo-v1', skill, cefrLevel, type: 'MULTIPLE_CHOICE',
    passage: skill === 'READING' ? 'A short original passage.' : null,
    prompt: 'Choose the correct answer.', options: ['Yes', 'No', 'Maybe', 'Never'],
    correctOption: 'Yes', explanation: 'A clear explanation.', skillCode: `${skill.toLowerCase()}.general`,
    audioUrl: skill === 'LISTENING' ? '/media/placement/demo.wav' : null,
    rubricCriteria: null, usageScope: ItemUsageScope.PLACEMENT, irtA: 1, irtB: 0, irtC: 0.25, createdAt: new Date(),
  };
}

function state(index = 0) {
  const currentItem = item(`item-${index}`, index < 5 ? 'READING' : 'LISTENING');
  return {
    id: 'session', userId: 'owner', status: 'IN_PROGRESS', currentItemIndex: index,
    currentItemId: currentItem.id, currentItem, version: index, totalItems: 10, correctCount: index,
    bankVersion: 'demo-v1', testVersion: 'READING_LISTENING_V1', estimatedCefr: null,
    confidenceScore: null, skillResults: null, completedAt: null, startedAt: new Date(),
    responses: Array.from({ length: index }, (_, i) => ({
      id: `response-${i}`, sessionId: 'session', itemId: `item-${i}`, itemIndex: i,
      selectedOption: 'Yes', isCorrect: true, responseTimeMs: null, createdAt: new Date(),
      item: item(`item-${i}`, i < 5 ? 'READING' : 'LISTENING'),
    })),
  };
}

describe('DemoPlacementService', () => {
  let session: ReturnType<typeof state>;
  let service: DemoPlacementService;
  let prisma: {
    placementSession: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
    assessmentItem: { findMany: jest.Mock }; assessmentResponse: { create: jest.Mock }; $transaction: jest.Mock;
  };
  let ml: { selectNextCatItem: jest.Mock };
  let inProcessCat: InProcessCatFallback;
  let events: { emit: jest.Mock };
  const dto = (index = 0, selectedOption = 'Yes') => ({ itemId: `item-${index}`, itemIndex: index, selectedOption });

  beforeEach(() => {
    session = state();
    prisma = {
      placementSession: { findUnique: jest.fn(async () => session), findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
      assessmentItem: { findMany: jest.fn(async () => [session.currentItem, item('next'), item('listening', 'LISTENING')]) },
      assessmentResponse: { create: jest.fn() }, $transaction: jest.fn(),
    };
    ml = { selectNextCatItem: jest.fn(async (_h, candidates) => ({ next_item_id: candidates[0].item_id })) };
    inProcessCat = new InProcessCatFallback();
    events = { emit: jest.fn() };
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.placementSession.updateMany.mockImplementation(async ({ data }) => {
      Object.assign(session, data, { version: session.version + 1 });
      session.currentItem = item(data.currentItemId ?? 'unused', session.currentItemIndex < 5 ? 'READING' : 'LISTENING');
      return { count: 1 };
    });
    prisma.assessmentResponse.create.mockImplementation(async ({ data }) => {
      session.responses.push({ ...data, id: 'saved', item: item(data.itemId, data.itemIndex < 5 ? 'READING' : 'LISTENING'), createdAt: new Date() });
    });
    service = new DemoPlacementService(
      prisma as unknown as PrismaService,
      ml as unknown as MlClientService,
      events as unknown as EventEmitter2,
      undefined,
      inProcessCat,
    );
  });

  it.each(['answer', 'result', 'review'] as const)('rejects another account for %s', async (method) => {
    await expect(method === 'answer' ? service.answer('session', 'other', dto()) : service[method]('session', 'other')).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('resumes the persisted question without running CAT again', async () => {
    prisma.placementSession.findFirst.mockResolvedValue(session);
    const selectSpy = jest.spyOn(inProcessCat, 'select');
    const result = await service.start('owner');
    expect(result.firstItem.id).toBe('item-0');
    expect(result.firstItem).not.toHaveProperty('correctOption');
    expect(selectSpy).not.toHaveBeenCalled();
    expect(ml.selectNextCatItem).not.toHaveBeenCalled();
  });

  it('refuses an undelivered item and invalid choices', async () => {
    await expect(service.answer('session', 'owner', { ...dto(), itemId: 'forged' })).rejects.toThrow(ConflictException);
    await expect(service.answer('session', 'owner', dto(0, 'forged'))).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('leaves the original question and response history untouched when CAT fails', async () => {
    jest.spyOn(inProcessCat, 'select').mockImplementationOnce(() => {
      throw new Error('In-process CAT failure');
    });
    await expect(service.answer('session', 'owner', dto())).rejects.toThrow(ServiceUnavailableException);
    expect(session.currentItemIndex).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(ml.selectNextCatItem).not.toHaveBeenCalled();
  });

  it('commits a valid answer and treats identical retry as idempotent', async () => {
    const first = await service.answer('session', 'owner', dto());
    const replay = await service.answer('session', 'owner', dto());
    expect(replay).toEqual(first);
    expect(session.currentItemIndex).toBe(1);
    expect(prisma.assessmentResponse.create).toHaveBeenCalledTimes(1);
    expect(prisma.assessmentItem.findMany).toHaveBeenCalledWith({
      where: { bankVersion: 'demo-v1', groupId: null, usageScope: { in: ['PLACEMENT', 'ALL'] } },
      orderBy: { externalId: 'asc' },
    });
    expect(ml.selectNextCatItem).not.toHaveBeenCalled();
    await expect(service.answer('session', 'owner', dto(0, 'No'))).rejects.toThrow(ConflictException);
  });

  it('resolves an optimistic-lock loser from the winning answer', async () => {
    prisma.placementSession.updateMany.mockImplementation(async () => {
      session = state(1);
      return { count: 0 };
    });
    const result = await service.answer('session', 'owner', dto());
    expect(result.nextItem?.index).toBe(1);
    expect(prisma.assessmentResponse.create).not.toHaveBeenCalled();
  });

  it('starts Listening at A2 with an empty skill-specific CAT history using in-process IRT without ML HTTP call', async () => {
    const selectSpy = jest.spyOn(inProcessCat, 'select');
    session = state(4);
    await service.answer('session', 'owner', dto(4));
    expect(ml.selectNextCatItem).not.toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy.mock.calls[0][0]).toEqual([]);
    expect(selectSpy.mock.calls[0][1]).toEqual([expect.objectContaining({ item_id: 'listening' })]);
  });

  it('caches placement bank items across repeated answers and invalidates on admin.data.mutated', async () => {
    const readingItems = Array.from({ length: 5 }, (_, i) => ({
      ...item(`item-${i}`, 'READING', CefrLevel.A2),
      irtA: 1.4,
      irtB: (i - 2) * 0.8,
    }));
    const listeningItems = Array.from({ length: 5 }, (_, i) => ({
      ...item(`item-${i + 5}`, 'LISTENING', CefrLevel.A2),
      irtA: 1.4,
      irtB: (i - 2) * 0.8,
    }));
    prisma.assessmentItem.findMany.mockResolvedValue([...readingItems, ...listeningItems]);
    session.currentItem = readingItems[0];

    await service.answer('session', 'owner', { itemId: 'item-0', itemIndex: 0, selectedOption: 'Yes' });
    const secondItemId = session.currentItemId!;
    await service.answer('session', 'owner', { itemId: secondItemId, itemIndex: 1, selectedOption: 'Yes' });
    expect(prisma.assessmentItem.findMany).toHaveBeenCalledTimes(1);
    expect(ml.selectNextCatItem).not.toHaveBeenCalled();

    service.handleAdminDataMutated();
    const thirdItemId = session.currentItemId!;
    await service.answer('session', 'owner', { itemId: thirdItemId, itemIndex: 2, selectedOption: 'Yes' });
    expect(prisma.assessmentItem.findMany).toHaveBeenCalledTimes(2);
  });

  it('preserves 3PL IRT EAP adaptation in-process (higher difficulty after correct, lower after wrong)', async () => {
    const baseItem = item('item-0', 'READING', CefrLevel.A2);
    const easy = { ...item('easy', 'READING', CefrLevel.B1), irtA: 1.5, irtB: -1.5, irtC: 0.2 };
    const hard = { ...item('hard', 'READING', CefrLevel.B2), irtA: 1.5, irtB: 1.2, irtC: 0.2 };
    prisma.assessmentItem.findMany.mockResolvedValue([baseItem, easy, hard]);

    // Answering item-0 correctly shifts theta positive -> selects hard item.
    const afterCorrect = await service.answer('session', 'owner', dto(0, 'Yes'));
    expect(afterCorrect.nextItem?.id).toBe('hard');

    // Reset session and answer wrongly -> shifts theta negative -> selects easy item.
    session = state(0);
    service.invalidateBankCache();
    const afterWrong = await service.answer('session', 'owner', dto(0, 'No'));
    expect(afterWrong.nextItem?.id).toBe('easy');
    expect(ml.selectNextCatItem).not.toHaveBeenCalled();
  });

  it('hides correctness and explanations while the test is in progress', async () => {
    session = state(2);
    const result = await service.review('session', 'owner');
    expect(result.items).toHaveLength(2);
    for (const answer of result.items) {
      expect(answer).not.toHaveProperty('correctOption');
      expect(answer).not.toHaveProperty('isCorrect');
      expect(answer).not.toHaveProperty('explanation');
    }
  });

  it('saves separate provisional skill scores and emits completion only once', async () => {
    session = state(9);
    const result = await service.answer('session', 'owner', dto(9));
    expect(result.isFinished).toBe(true);
    expect(result.result).toMatchObject({ confidenceScore: null, completionRate: 1, resultStatus: 'PROVISIONAL', scoringMethod: 'PROVISIONAL_RATIO_V1', correctCount: 10 });
    expect(result.result?.skills).toMatchObject({ reading: { correctCount: 5, totalItems: 5, estimatedCefr: 'B2' }, listening: { correctCount: 5, totalItems: 5, estimatedCefr: 'B2' }, speaking: { status: 'NOT_ASSESSED' }, writing: { status: 'NOT_ASSESSED' } });
    await service.answer('session', 'owner', dto(9));
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect((await service.review('session', 'owner')).items[0]).toHaveProperty('correctOption', 'Yes');
  });

  it('does not create a session with an incomplete bank', async () => {
    prisma.placementSession.findFirst.mockResolvedValue(null);
    await expect(service.start('owner')).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.placementSession.create).not.toHaveBeenCalled();
  });

  it('allows starting a new retake session when a completed session already exists and preserves completed metadata in status()', async () => {
    const readingItems = Array.from({ length: 5 }, (_, i) => item(`read-${i}`, 'READING', CefrLevel.A2));
    const listeningItems = Array.from({ length: 5 }, (_, i) => item(`listen-${i}`, 'LISTENING', CefrLevel.A2));
    prisma.assessmentItem.findMany.mockResolvedValue([...readingItems, ...listeningItems]);
    (prisma as any).$queryRaw = jest.fn(async () => [{ id: 'owner' }]);
    prisma.placementSession.findFirst.mockResolvedValue(null);
    const retakeSession = { ...state(0), id: 'retake-session', currentItem: readingItems[0], currentItemId: readingItems[0].id };
    prisma.placementSession.create.mockResolvedValue(retakeSession);

    const started = await service.start('owner');
    expect(started.sessionId).toBe('retake-session');
    expect(prisma.placementSession.create).toHaveBeenCalledTimes(1);

    const completedSummary = {
      id: 'completed-session',
      status: 'COMPLETED',
      currentItemIndex: 10,
      totalItems: 10,
      estimatedCefr: CefrLevel.B1,
      skillResults: { reading: { estimatedCefr: 'B1' }, listening: { estimatedCefr: 'A2' } },
    };
    prisma.placementSession.findFirst
      .mockResolvedValueOnce({ id: 'retake-session', status: 'IN_PROGRESS', currentItemIndex: 2, totalItems: 10, estimatedCefr: null })
      .mockResolvedValueOnce(completedSummary);

    const midRetakeStatus = await service.status('owner');
    expect(midRetakeStatus).toEqual({
      hasCompleted: true,
      currentSessionId: 'retake-session',
      completedSessionId: 'completed-session',
      status: 'IN_PROGRESS',
      currentIndex: 2,
      totalItems: 10,
      estimatedCefr: CefrLevel.B1,
      skillResults: completedSummary.skillResults,
    });
  });

  it.each([[0, 'A1'], [39, 'A1'], [40, 'A2'], [64, 'A2'], [65, 'B1'], [84, 'B1'], [85, 'B2'], [100, 'B2']])('maps %s percent to %s', (correct, expected) => {
    expect(provisionalCefr(correct as number, 100)).toBe(expected);
  });
});
