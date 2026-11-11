import { EventEmitter } from 'events';
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
    expect(prisma.voiceConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'session-a', userId: 'user-a', historyStatus: { not: 'DISCARDED' } } }));
    expect(detail).not.toHaveProperty('activeUserId');
  });

  it('rejects another account before finishing anything', async () => {
    prisma.voiceConversation.findFirst.mockResolvedValue(null);
    await expect(service.finish('user-b', 'session-a')).rejects.toBeInstanceOf(HttpException);
    expect(prisma.voiceConversation.updateMany).not.toHaveBeenCalled();
  });

  it('persists queued final transcripts and normal completion before closing the sockets', async () => {
    const events: string[] = [];
    const provider = Object.assign(new EventEmitter(), {
      readyState: 1, send: jest.fn<void, [string]>(), close: jest.fn(() => events.push('provider-closed')),
    });
    const client = Object.assign(new EventEmitter(), {
      readyState: 1, send: jest.fn(), close: jest.fn(() => events.push('client-closed')),
    });
    const socket = jest.spyOn(require('ws'), 'WebSocket').mockImplementation(() => provider);
    Object.assign(socket, { OPEN: 1 });
    const cfg = { readiness: () => ({ enabled: true }),
      read: () => ({ endpoint: 'https://fixture.services.ai.azure.com', apiVersion: 'test' }) };
    service = new VoiceConversationsService(prisma, cfg as any, {} as any, ml);
    let current: any = { ...row, status: 'ACTIVE', turns: [], topicSnapshot: {
      ...row.topicSnapshot, voice: 'en-US-AvaMultilingualNeural', speechRate: '0.85', silenceDurationMs: 1200,
    } };
    prisma.voiceConversation.findUniqueOrThrow = jest.fn().mockResolvedValue(current);
    prisma.voiceConversation.findFirst.mockImplementation(async () => current);
    prisma.voiceConversation.updateMany.mockImplementation(async ({ data }: any) => {
      current = { ...current, ...data };
      if (data.status === 'ENDED') events.push('ended');
      return { count: 1 };
    });
    let releaseWrite!: () => void;
    prisma.voiceConversationTurn.upsert = jest.fn(async ({ create }: any) => {
      await new Promise<void>(resolve => { releaseWrite = resolve; });
      current.turns.push(create);
      events.push('transcript');
    });
    service['tickets'].set('fixture', { id: row.id, expires: Date.now() + 1000 });

    try {
      await service['connect'](client as any, JSON.stringify({ ticket: 'fixture', sdp: 'fixture' }));
      provider.emit('open');
      expect(JSON.parse(provider.send.mock.calls[0][0])).toMatchObject({
        type: 'rtc.call.sdp.create',
        session: {
          voice: { type: 'azure-standard', name: 'en-US-AvaMultilingualNeural', rate: '0.85' },
          turn_detection: { type: 'server_vad', silence_duration_ms: 1200 },
        },
      });
      const update = (requestId: string, turnPause: string) =>
        client.emit('message', JSON.stringify({ type: 'settings.update', requestId, turnPause, speechRate: 'slow' }));
      const confirmed = '00000000-0000-4000-8000-000000000001';
      const rejected = '00000000-0000-4000-8000-000000000002';
      const invalid = '00000000-0000-4000-8000-000000000003';
      client.emit('message', JSON.stringify({ type: 'ready' }));
      update(confirmed, 'normal');
      expect(JSON.parse(provider.send.mock.calls[2][0])).toEqual({
        type: 'session.update', event_id: 'settings:' + confirmed,
        session: {
          voice: { type: 'azure-standard', name: 'en-US-AvaMultilingualNeural', rate: '0.85' },
          turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 700 },
        },
      });
      expect(client.send).not.toHaveBeenCalled();
      provider.emit('message', JSON.stringify({ type: 'session.updated', session: {
        voice: { rate: '0.85' },
        turn_detection: { type: 'server_vad', silence_duration_ms: 700 },
      } }));
      await new Promise(resolve => setImmediate(resolve));
      expect(client.send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'settings.updated', requestId: confirmed }));
      update(rejected, 'long');
      provider.emit('message', JSON.stringify({ type: 'error', error: { event_id: 'settings:' + rejected } }));
      await new Promise(resolve => setImmediate(resolve));
      expect(client.send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'settings.rejected', requestId: rejected }));
      update(invalid, 'arbitrary');
      expect(provider.send).toHaveBeenCalledTimes(4);
      expect(client.send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'settings.rejected', requestId: invalid }));
      expect(events).toEqual([]);
      provider.emit('message', Buffer.from(JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed', item_id: 'last', transcript: 'Final reply',
      })));
      const finished = service.finish('user-a', 'session-a');
      await new Promise(resolve => setImmediate(resolve));
      expect(events).toEqual([]);
      releaseWrite();
      expect((await finished).endReason).toBe('user_finished');
      expect(current.turns).toHaveLength(1);
      expect(events).toEqual(['transcript', 'ended', 'provider-closed', 'client-closed']);
    } finally {
      socket.mockRestore();
    }
  });

  it('creates a snapshot with a single-use connection ticket', async () => {
    const result = await service.create('user-a', 'topic-a', 'request-a');
    expect(result.connectTicket).toHaveLength(43);
    expect(prisma.voiceConversation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-a', activeUserId: 'user-a',
        topicSnapshot: expect.objectContaining({
          text: 'My family', maxDurationSeconds: 180, voice: 'test', speechRate: '1.0', silenceDurationMs: 700,
        }) }),
    }));
    expect(JSON.stringify(result)).not.toContain('api-key');
  });

  it('stores the selected Azure voice, rate and turn pause for a new call', async () => {
    await service.create('user-a', 'topic-a', 'request-a', true, {
      voice: 'brian', speechRate: 'fast', turnPause: 'long',
    });
    expect(prisma.voiceConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        historyStatus: 'PENDING',
        topicSnapshot: expect.objectContaining({
          voice: 'en-US-BrianMultilingualNeural', speechRate: '1.15', silenceDurationMs: 1200,
        }),
      }),
    });
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

  it('rejects scoring during an active call and another account before any provider call', async () => {
    await expect(service.assess('user-a', 'session-a')).rejects.toBeInstanceOf(HttpException);
    prisma.voiceConversation.findFirst.mockResolvedValue(null);
    await expect(service.assess('user-b', 'session-a')).rejects.toBeInstanceOf(HttpException);
    expect(prisma.voiceConversation.updateMany).not.toHaveBeenCalled();
  });

  it('keeps saved results and refuses a different microphone recording', async () => {
    const saved = { ...row, status: 'ENDED', assessmentStatus: 'READY', assessmentAudioHash: 'saved', assessment: { content: {} } };
    prisma.voiceConversation.findFirst.mockResolvedValue(saved);
    expect((await service.assess('user-a', 'session-a')).assessment).toEqual(saved.assessment);
    await expect(service.assess('user-a', 'session-a', Buffer.from('different'))).rejects.toBeInstanceOf(HttpException);
    expect(prisma.voiceConversation.updateMany).not.toHaveBeenCalled();
  });

  it('claims an assessment atomically and uses only USER transcripts as evidence', async () => {
    const turns = [{ role: 'ASSISTANT', transcript: 'Question from AI' }, { role: 'USER', transcript: 'My answer' }];
    const ended = { ...row, status: 'ENDED', assessmentStatus: 'UNASSESSED', turns };
    let current = ended;
    prisma.voiceConversation.findFirst.mockImplementation(async () => current);
    prisma.voiceConversation.updateMany.mockImplementation(async ({ data }: any) => {
      current = { ...current, ...data };
      return { count: 1 };
    });
    ml.scoreConversationContent = jest.fn().mockResolvedValue({ status: 'succeeded', rubricVersion: 'conversation-content-v1',
      vocabulary: 90, grammar: 90, topic: 90, overall: 90, strengths: [],
      improvements: [{ quote: 'Question from AI', explanationVi: 'invalid', suggestion: 'invalid' }] });
    await service.assess('user-a', 'session-a');
    await new Promise(resolve => setImmediate(resolve));
    expect(prisma.voiceConversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'session-a', userId: 'user-a', historyStatus: { not: 'DISCARDED' }, assessmentStatus: 'UNASSESSED' },
    }));
    expect((current as any).assessment.content.status).toBe('unavailable');
    await service.assess('user-a', 'session-a');
    expect(ml.scoreConversationContent).toHaveBeenCalledTimes(1);
  });

  it('keeps a segmented result partial when content retry succeeds but one reply has no score', async () => {
    const pronunciation = { accuracy: 90, fluency: 85, prosody: 80, durationSeconds: 2, words: [] };
    const turns = [
      { providerItemId: 'a', role: 'USER', transcript: 'First reply.' },
      { providerItemId: 'b', role: 'USER', transcript: 'Second reply.' },
    ];
    let current: any = { ...row, status: 'ENDED', assessmentStatus: 'PARTIAL', turns,
      assessment: { schemaVersion: 2, pronunciation, turns: [
        { itemId: 'a', pronunciation }, { itemId: 'b', pronunciation: null },
      ], content: { status: 'unavailable' } } };
    prisma.voiceConversation.findFirst.mockImplementation(async () => current);
    prisma.voiceConversation.updateMany.mockImplementation(async ({ data }: any) => {
      current = { ...current, ...data };
      return { count: 1 };
    });
    ml.scoreConversationContent = jest.fn().mockResolvedValue({
      status: 'succeeded', rubricVersion: 'conversation-content-v1', assessmentScope: 'whole_conversation',
      vocabulary: 80, grammar: 80, topic: 80, overall: 80, strengths: [], improvements: [],
    });

    await service.retryContent('user-a', 'session-a');
    await new Promise(resolve => setImmediate(resolve));

    expect(current.assessmentStatus).toBe('PARTIAL');
    expect(current.assessment.content.status).toBe('succeeded');
    expect(current.assessment.turns[0].pronunciation).toEqual(pronunciation);
    expect(current.assessment.turns[1].pronunciation).toBeNull();
    current.assessmentStatus = 'READY';
    expect((await service.detail('user-a', 'session-a')).assessmentStatus).toBe('PARTIAL');
  });

  it('marks stale processing as unknown without calling the provider again', async () => {
    prisma.voiceConversation.findFirst.mockResolvedValue({ ...row, status: 'ENDED', assessmentStatus: 'PROCESSING',
      assessmentStartedAt: new Date(Date.now() - 950000), assessmentAudioHash: null });
    expect((await service.assess('user-a', 'session-a')).assessmentStatus).toBe('UNKNOWN');
  });

  it('summary excludes raw turns and chat loading checks ownership', async () => {
    prisma.voiceConversation.findFirst.mockResolvedValue({ ...row, turns: undefined, _count: { turns: 2 } });
    const result = await service.summary('user-a', 'session-a');
    expect(result.hasUserTurns).toBe(true);
    expect(prisma.voiceConversation.findFirst.mock.calls[0][0].include).not.toHaveProperty('turns');
    prisma.voiceConversationTurn.findMany = jest.fn().mockResolvedValue([{ transcript: 'Hello' }]);
    expect((await service.transcript('user-a', 'session-a')).items).toEqual([{ transcript: 'Hello' }]);
    prisma.voiceConversation.findFirst.mockResolvedValue(null);
    await expect(service.transcript('user-b', 'session-a')).rejects.toBeInstanceOf(HttpException);
    expect(prisma.voiceConversationTurn.findMany).toHaveBeenCalledTimes(1);
  });
});
