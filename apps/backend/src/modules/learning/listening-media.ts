import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningContent } from './learning.types';

/** Parse all RIFF chunks; the header size is not necessarily 44 bytes. */
export function listeningWaveDurationMs(wave: Buffer): number {
  if (wave.length < 12 || wave.toString('ascii', 0, 4) !== 'RIFF'
    || wave.toString('ascii', 8, 12) !== 'WAVE' || wave.readUInt32LE(4) + 8 !== wave.length) {
    throw new Error('Invalid Listening WAV container.');
  }
  let byteRate = 0, sampleRate = 0, dataSize = 0, offset = 12, formatSeen = false;
  while (offset + 8 <= wave.length) {
    const id = wave.toString('ascii', offset, offset + 4);
    const size = wave.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > wave.length) throw new Error('Truncated Listening WAV chunk.');
    if (id === 'fmt ') {
      if (formatSeen || size < 16 || wave.readUInt16LE(start) !== 1
        || wave.readUInt16LE(start + 2) !== 1 || wave.readUInt16LE(start + 12) !== 2
        || wave.readUInt16LE(start + 14) !== 16) throw new Error('Expected mono 16-bit PCM Listening WAV.');
      sampleRate = wave.readUInt32LE(start + 4);
      byteRate = wave.readUInt32LE(start + 8);
      if (!sampleRate || byteRate !== sampleRate * 2) throw new Error('Invalid Listening WAV format rates.');
      formatSeen = true;
    }
    if (id === 'data') {
      if (size % 2 !== 0) throw new Error('Invalid Listening PCM sample boundary.');
      dataSize += size;
    }
    offset = start + size + (size % 2);
  }
  if (offset !== wave.length || !formatSeen || !dataSize) throw new Error('Incomplete Listening WAV.');
  return dataSize / byteRate * 1000;
}

/** New profile uses only local, versioned curriculum files; legacy audio is unchanged. */
export function validateListeningAudio(content: LearningContent, mediaRoot: string): void {
  if (content.listeningVersion !== 1) return;
  const match = /^\/media\/learning\/v1\/([a-z0-9]+(?:-[a-z0-9]+)*\.wav)$/.exec(content.audioUrl ?? '');
  if (!match) throw new Error('Invalid Listening curriculum audio path.');
  const duration = listeningWaveDurationMs(readFileSync(join(mediaRoot, 'v1', match[1])));
  if (duration < 30000 || duration > 90000 || Math.abs(duration - content.audioDurationMs!) > 250) {
    throw new Error('Listening audio duration does not match content.');
  }
}
