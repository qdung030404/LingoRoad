import { HttpException } from '@nestjs/common';

export interface AudioSegment { itemId: string; offsetMs: number; durationMs: number }
export interface ConversationTurn { itemId: string; role: string; transcript: string }

export function conversationAnswers(turns: ConversationTurn[]) {
  let question = '';
  return turns.flatMap(turn => {
    if (turn.role === 'ASSISTANT') { question = turn.transcript; return []; }
    return turn.role === 'USER' && turn.transcript.trim() ? [{ itemId: turn.itemId, question, answer: turn.transcript }] : [];
  });
}

export function parseAudioSegments(value: unknown, durationMs: number): AudioSegment[] {
  const fail = () => { throw new HttpException({ code: 'invalid_audio_segments', message: 'Chưa xác định được từng lượt thu âm.' }, 422); };
  if (value === undefined) return [];
  let parsed: unknown;
  try { parsed = typeof value === 'string' ? JSON.parse(value) : value; } catch { return fail(); }
  if (!Array.isArray(parsed) || parsed.length > 128) return fail();
  let previousEnd = 0;
  return parsed.map(item => {
    if (!item || typeof item.itemId !== 'string' || !item.itemId || item.itemId.length > 200 ||
        !Number.isFinite(item.offsetMs) || !Number.isFinite(item.durationMs) || item.durationMs <= 0 ||
        item.offsetMs < previousEnd || item.offsetMs + item.durationMs > durationMs ||
        !Number.isInteger(item.offsetMs * 16) || !Number.isInteger(item.durationMs * 16)) return fail();
    previousEnd = item.offsetMs + item.durationMs;
    return { itemId: item.itemId, offsetMs: item.offsetMs, durationMs: item.durationMs };
  });
}

/** The input WAV has already passed full PCM validation. Slice on sample boundaries. */
export function splitConversationAudio(audio: Buffer, segments: AudioSegment[]): Map<string, Buffer> {
  let offset = 12;
  let pcm: Buffer = Buffer.alloc(0);
  while (offset + 8 <= audio.length) {
    const size = audio.readUInt32LE(offset + 4);
    if (audio.toString('ascii', offset, offset + 4) === 'data') pcm = audio.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + size % 2;
  }
  const groups = new Map<string, Buffer[]>();
  for (const segment of segments) {
    const chunks = groups.get(segment.itemId) ?? [];
    chunks.push(pcm.subarray(segment.offsetMs * 32, (segment.offsetMs + segment.durationMs) * 32));
    groups.set(segment.itemId, chunks);
  }
  return new Map([...groups].map(([id, chunks]) => {
    const samples = Buffer.concat(chunks);
    const wav = Buffer.alloc(44 + samples.length);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(samples.length, 40); samples.copy(wav, 44);
    return [id, wav];
  }));
}

export function conversationPronunciation(replies: Record<string, any>[]): Record<string, any> | null {
  const scored = replies.filter(reply => reply.pronunciation);
  if (!scored.length) return null;
  const results = scored.map(reply => reply.pronunciation);
  const duration = (result: any) => Array.isArray(result.utterances) && result.utterances.length
    ? result.utterances.reduce((sum: number, item: any) => sum + item.durationSeconds, 0) : result.durationSeconds;
  const total = results.reduce((sum, result) => sum + duration(result), 0);
  const scores: Record<string, any> = {};
  for (const key of ['accuracy', 'fluency', 'prosody']) {
    scores[key] = results.some(result => result[key] === null) ? null
      : results.reduce((sum, result) => sum + result[key] * duration(result), 0) / total;
  }
  scores.overall = scores.prosody === null ? null : (40 * scores.accuracy + 25 * scores.fluency + 25 * scores.prosody) / 90;
  return { ...results[0], ...scores, words: [], transcript: '',
    assessmentCompleteness: scored.length === replies.length && scores.prosody !== null ? 'full' : 'partial',
    aggregation: 'speech-duration-weighted', assessedTurnCount: scored.length, totalTurnCount: replies.length };
}
