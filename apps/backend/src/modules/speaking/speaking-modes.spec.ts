import { SpeakingService } from './speaking.service';
import { SpeakingMode } from '@prisma/client';
import { seedSpeakingContent } from '../../../prisma/seed-speaking';

describe('Speaking mode catalogue', () => {
  const prompt = { id: 'prompt', text: 'Hello', title: 'Hello', mode: SpeakingMode.READ_ALOUD,
    contentVersion: 1, difficulty: 1, maxDurationSeconds: 30, hints: [], sampleAsset: null };
  let prisma: any;
  let service: SpeakingService;
  beforeEach(() => {
    prisma = { speakingPrompt: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(prompt) },
      speakingSubmission: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'submission' }) } };
    service = new SpeakingService(prisma, { speakingProfile: 'read-aloud-v2' } as any,
      { get: (key: string, fallback: string) => key === 'SPEAKING_ENABLED' ? 'true' : fallback } as any);
  });
  it('defaults old clients to read aloud and accepts an explicit mode', async () => {
    await service.prompts();
    expect(prisma.speakingPrompt.findMany.mock.calls[0][0].where.mode).toBe(SpeakingMode.READ_ALOUD);
    await service.prompts(SpeakingMode.TOPIC);
    expect(prisma.speakingPrompt.findMany.mock.calls[1][0].where.mode).toBe(SpeakingMode.TOPIC);
  });
  it('snapshots the recording limits and content metadata', async () => {
    await service.create('owner', { promptId: 'prompt', clientRequestId: 'request' });
    expect(prisma.speakingSubmission.create.mock.calls[0][0].data.promptSnapshot).toEqual({
      text: 'Hello', title: 'Hello', mode: 'READ_ALOUD', contentVersion: 1,
      difficulty: 1, maxDurationSeconds: 30, hints: [], sampleAsset: null, assessmentProfile: 'read-aloud-v2',
    });
  });
  it('prevents new modes from falling through to the scripted scorer', async () => {
    prisma.speakingPrompt.findFirst.mockResolvedValue({ ...prompt, mode: SpeakingMode.TOPIC });
    await expect(service.create('owner', { promptId: 'prompt', clientRequestId: 'request' })).rejects.toMatchObject({ status: 503 });
    expect(prisma.speakingSubmission.create).not.toHaveBeenCalled();
  });
  it('seeds the reading, topic and game prompts idempotently', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    await seedSpeakingContent({ speakingPrompt: { upsert } } as any);
    const rows = upsert.mock.calls.map(call => call[0]);
    expect(rows.filter(row => row.where.code.startsWith('read-aloud-'))).toHaveLength(9);
    expect(rows.filter(row => row.where.code.startsWith('topic-read-aloud-'))).toHaveLength(3);
    expect(rows.filter(row => row.create.mode === 'TOPIC')).toHaveLength(6);
    expect(rows.filter(row => row.create.mode === 'TONGUE_TWISTER')).toHaveLength(12);
    expect(new Set(rows.map(row => row.where.code)).size).toBe(30);
    expect(rows.filter(row => row.create.mode === 'TOPIC').every(row => row.create.maxDurationSeconds === 60)).toBe(true);
    await seedSpeakingContent({ speakingPrompt: { upsert } } as any);
    expect(upsert).toHaveBeenCalledTimes(60);
  });
});
