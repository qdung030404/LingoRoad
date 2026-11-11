import { conversationAnswers, parseAudioSegments, splitConversationAudio } from './conversation-assessment';
describe('Conversation turn boundaries', () => {
  it('pairs each reply with its own preceding question', () => {
    expect(conversationAnswers([
      { itemId: 'q1', role: 'ASSISTANT', transcript: 'Name?' },
      { itemId: 'a1', role: 'USER', transcript: 'Anna.' },
      { itemId: 'q2', role: 'ASSISTANT', transcript: 'Age?' },
      { itemId: 'a2', role: 'USER', transcript: 'Twenty.' },
    ])).toEqual([{ itemId: 'a1', question: 'Name?', answer: 'Anna.' }, { itemId: 'a2', question: 'Age?', answer: 'Twenty.' }]);
  });
  it('extracts independent PCM slices and rejects overlapping ranges', () => {
    const wav = Buffer.alloc(44 + 6400);
    wav.write('data', 36); wav.writeUInt32LE(6400, 40);
    wav.fill(1, 44, 3244); wav.fill(2, 3244);
    const segments = parseAudioSegments([{ itemId: 'a1', offsetMs: 0, durationMs: 100 }, { itemId: 'a2', offsetMs: 100, durationMs: 100 }], 200);
    const clips = splitConversationAudio(wav, segments);
    expect(clips.get('a1')!.subarray(44).every(v => v === 1)).toBe(true);
    expect(clips.get('a2')!.subarray(44).every(v => v === 2)).toBe(true);
    expect(() => parseAudioSegments([{ itemId: 'a1', offsetMs: 0, durationMs: 150 }, { itemId: 'a2', offsetMs: 100, durationMs: 100 }], 200)).toThrow();
  });
});
