import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DemoContentItem {
  externalId: string;
  skill: 'READING' | 'LISTENING';
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2';
  prompt: string;
  options: string[];
  correctOption: string;
  explanation: string;
  passage?: string;
  transcript?: string;
}

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
const SKILLS = ['READING', 'LISTENING'] as const;
export const DEMO_AUDIO_DIRECTORY = join(__dirname, '../../media/placement');

/** Parse RIFF chunks, including optional metadata, rather than assuming a 44-byte header. */
export function waveDurationSeconds(wave: Buffer): number {
  if (wave.length < 12 || wave.toString('ascii', 0, 4) !== 'RIFF' || wave.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Invalid WAV container.');
  }
  if (wave.readUInt32LE(4) + 8 !== wave.length) throw new Error('Truncated WAV container.');
  let byteRate = 0;
  let dataSize = 0;
  for (let offset = 12; offset + 8 <= wave.length;) {
    const id = wave.toString('ascii', offset, offset + 4);
    const size = wave.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > wave.length) throw new Error('Truncated WAV chunk.');
    if (id === 'fmt ') {
      if (size < 16 || wave.readUInt16LE(start) !== 1) throw new Error('Expected PCM WAV audio.');
      if (wave.readUInt16LE(start + 2) !== 1 || wave.readUInt16LE(start + 14) !== 16) {
        throw new Error('Expected mono, 16-bit WAV audio.');
      }
      byteRate = wave.readUInt32LE(start + 8);
    }
    if (id === 'data') dataSize += size;
    offset = start + size + (size % 2);
  }
  if (!byteRate || !dataSize) throw new Error('Empty WAV audio.');
  return dataSize / byteRate;
}

/** Validate before any database writes; does not need a database connection. */
export function validateDemoContent(items: DemoContentItem[]): { itemCount: number; audioDurations: number[] } {
  if (!Array.isArray(items) || items.length !== 40) throw new Error('Demo bank must contain exactly 40 items.');
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const audioDurations: number[] = [];
  for (const item of items) {
    if (!SKILLS.includes(item.skill) || !LEVELS.includes(item.cefrLevel)) throw new Error('Invalid skill or CEFR.');
    const prefix = `demo-${item.skill.toLowerCase()}-${item.cefrLevel.toLowerCase()}-`;
    if (!new RegExp(`^${prefix}0[1-5]$`).test(item.externalId) || seen.has(item.externalId)) {
      throw new Error(`Invalid or duplicate externalId: ${item.externalId}`);
    }
    seen.add(item.externalId);
    const group = `${item.skill}:${item.cefrLevel}`;
    counts.set(group, (counts.get(group) ?? 0) + 1);
    for (const field of ['prompt', 'correctOption', 'explanation'] as const) {
      if (typeof item[field] !== 'string' || !item[field].trim()) throw new Error(`${item.externalId}: missing ${field}`);
    }
    if (!Array.isArray(item.options) || item.options.length !== 4 || new Set(item.options).size !== 4 ||
        item.options.some((option) => typeof option !== 'string' || !option.trim()) || !item.options.includes(item.correctOption)) {
      throw new Error(`${item.externalId}: expected four distinct options including the correct answer`);
    }
    if (item.skill === 'READING') {
      if (!item.passage?.trim() || item.transcript !== undefined) throw new Error(`${item.externalId}: invalid reading source`);
    } else {
      if (!item.transcript?.trim() || item.passage !== undefined) throw new Error(`${item.externalId}: invalid listening source`);
      const duration = waveDurationSeconds(readFileSync(join(DEMO_AUDIO_DIRECTORY, `${item.externalId}.wav`)));
      if (duration < 15 || duration > 45) throw new Error(`${item.externalId}: audio must last 15–45 seconds (got ${duration.toFixed(2)})`);
      audioDurations.push(duration);
    }
  }
  for (const skill of SKILLS) {
    for (const level of LEVELS) {
      if (counts.get(`${skill}:${level}`) !== 5) throw new Error(`Expected five ${skill} items at ${level}.`);
    }
  }
  return { itemCount: items.length, audioDurations };
}

if (require.main === module) {
  const items: DemoContentItem[] = JSON.parse(readFileSync(join(__dirname, 'items.json'), 'utf8'));
  const result = validateDemoContent(items);
  console.log(JSON.stringify({
    itemCount: result.itemCount,
    perSkill: 20,
    perSkillAndLevel: 5,
    audioCount: result.audioDurations.length,
    minAudioSeconds: Math.min(...result.audioDurations).toFixed(2),
    maxAudioSeconds: Math.max(...result.audioDurations).toFixed(2),
  }, null, 2));
}
