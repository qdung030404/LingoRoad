import { HttpException } from '@nestjs/common';
import { VoiceConversationsService } from './voice-conversations.service';

describe('Voice conversations account boundaries and replay', () => {
  let service: VoiceConversationsService;
  let prisma: any;
  let ml: any;
  const row = { id: 'session-a', userId: 'user-a', topicId: 'topic-a', status: 'CREATED',
    activeUserId: 'user-a', topicSnapshot: { text: 'My family' }, turns: [] };

  beforeEach(() => {
    prisma = {
      voiceConversation: {
        findFirst: jest.fn().mockResolvedValue(row),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      speakingPrompt: { findFirst: jest.fn().mockResolvedValue({ id: 'topic-a', text: 'My family', title: 'My family', hints: [], contentVersion: 1 }) },
      $queryRaw: jest.fn(),
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    prisma.voiceConversationTurn = { findFirst: jest.fn().mockResolvedValue({ id: 'turn', transcript: 'Hello', translationVi: null }), update: jest.fn() };
    ml = { translateConversation: jest.fn().mockResolvedValue('Xin chào') };
    service = new VoiceConversationsService(prisma, {
      readiness: () => ({ enabled: true }), read: () => ({ model: 'gpt-4o', voice: 'test' }),
    } as any, {} as any, ml);
  });

  it('translates only assistant turns owned by the current account', async () => {
    expect(await service.translate('user-a', 'session-a', 'item')).toEqual({ translationVi: 'Xin chào' });
    expect(prisma.voiceConversationTurn.findFirst).toHaveBeenCalledWith({ where: { conversationId: 'session-a', providerItemId: 'item', role: 'ASSISTANT' } });
    expect(prisma.voiceConversationTurn.update).toHaveBeenCalledWith({ where: { id: 'turn' }, data: { translationVi: 'Xin chào' } });
    prisma.voiceConversation.findFirst.mockResolvedValue(null);
    await expect(service.translate('user-b', 'session-a', 'item')).rejects.toBeInstanceOf(HttpException);
    expect(ml.translateConversation).toHaveBeenCalledTimes(1);
  });

  it('reuses a saved translation and retries after a provider failure', async () => {
    prisma.voiceConversationTurn.findFirst.mockResolvedValueOnce({ id: 'turn', translationVi: 'Đã lưu' });
    expect(await service.translate('user-a', 'session-a', 'item')).toEqual({ translationVi: 'Đã lưu' });
    expect(ml.translateConversation).not.toHaveBeenCalled();
    ml.translateConversation.mockRejectedValueOnce(new Error('timeout'));
    await expect(service.translate('user-a', 'session-a', 'item')).rejects.toBeInstanceOf(HttpException);
    expect(await service.translate('user-a', 'session-a', 'item')).toEqual({ translationVi: 'Xin chào' });
  });

  it('restricts detail to the authenticated account and hides active ownership lock', async () => {
    const detail = await service.detail('user-a', 'session-a');
    expect(prisma.voiceConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'session-a', userId: 'user-a' } }));
    expect(detail).not.toHaveProperty('activeUserId');
  });

  it('rejects another account before finishing anything', async () => {
    prisma.voiceConversation.findFirst.mockResolvedValue(null);
    await expect(service.finish('user-b', 'session-a')).rejects.toBeInstanceOf(HttpException);
    expect(prisma.voiceConversation.updateMany).not.toHaveBeenCalled();
  });

  it('creates a snapshot with a single-use connection ticket', async () => {
    const result = await service.create('user-a', 'topic-a', 'request-a');
    expect(result.connectTicket).toHaveLength(43);
    expect(prisma.voiceConversation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-a', activeUserId: 'user-a',
        topicSnapshot: expect.objectContaining({ text: 'My family', maxDurationSeconds: 180 }) }),
    }));
    expect(JSON.stringify(result)).not.toContain('api-key');
  });

  it('replays a create without creating a second row', async () => {
    prisma.voiceConversation.findUnique.mockResolvedValue(row);
    await service.create('user-a', 'topic-a', 'request-a');
    expect(prisma.voiceConversation.create).not.toHaveBeenCalled();
  });

  it('rejects a reused request id with a different topic', async () => {
    prisma.voiceConversation.findUnique.mockResolvedValue(row);
    await expect(service.create('user-a', 'other-topic', 'request-a')).rejects.toBeInstanceOf(HttpException);
  });

  it('never reconnects a completed session on replay', async () => {
    prisma.voiceConversation.findUnique.mockResolvedValue({ ...row, status: 'ENDED' });
    prisma.voiceConversation.findFirst.mockResolvedValue({ ...row, status: 'ENDED' });
    expect((await service.create('user-a', 'topic-a', 'request-a')).connectTicket).toBeNull();
  });

  it('enforces the daily quota before creating a provider session', async () => {
    prisma.voiceConversation.count.mockResolvedValue(10);
    await expect(service.create('user-a', 'topic-a', 'request-a')).rejects.toBeInstanceOf(HttpException);
    expect(prisma.voiceConversation.create).not.toHaveBeenCalled();
  });

  it('rejects an untrusted cursor before querying history', async () => {
    prisma.voiceConversation.findFirst.mockResolvedValue(null);
    await expect(service.history('user-b', 'session-a')).rejects.toBeInstanceOf(HttpException);
    expect(prisma.voiceConversation.findMany).not.toHaveBeenCalled();
  });
});
