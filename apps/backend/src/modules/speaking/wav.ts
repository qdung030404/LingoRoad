import { HttpException } from '@nestjs/common';
export const MAX_SPEAKING_BYTES = 2 * 1024 * 1024;
export function validateSpeakingWav(data: Buffer, maxSeconds = 30, maxBytes = MAX_SPEAKING_BYTES): number {
  const fail = () => { throw new HttpException({ code: 'invalid_audio', message: `Bản thu phải là WAV PCM 16-bit, mono, 16 kHz, tối đa ${maxSeconds} giây.` }, 422); };
  if (data.length > maxBytes) throw new HttpException({ code: 'audio_too_large', message: 'Bản thu vượt quá dung lượng cho phép.' }, 413);
  if (data.length < 44 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE' || data.readUInt32LE(4) + 8 !== data.length) return fail();
  let format = false, samples: Buffer | undefined;
  let offset = 12;
  for (; offset + 8 <= data.length;) {
    const type = data.toString('ascii', offset, offset + 4), size = data.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > data.length) return fail();
    if (type === 'fmt ') {
      if (format || size < 16 || data.readUInt16LE(start) !== 1 || data.readUInt16LE(start + 2) !== 1 || data.readUInt32LE(start + 4) !== 16000 || data.readUInt32LE(start + 8) !== 32000 || data.readUInt16LE(start + 12) !== 2 || data.readUInt16LE(start + 14) !== 16) return fail();
      format = true;
    }
    if (type === 'data') { if (samples) return fail(); samples = data.subarray(start, start + size); }
    offset = start + size + (size % 2);
    if (offset > data.length) return fail();
  }
  if (offset !== data.length || !format || !samples?.length || samples.length % 2 || samples.length > maxSeconds * 32000) return fail();
  let energy = 0;
  for (let i = 0; i < samples.length; i += 2) energy += samples.readInt16LE(i) ** 2;
  if (Math.sqrt(energy / (samples.length / 2)) < 10) throw new HttpException({ code: 'audio_silent', message: 'Chưa nghe thấy giọng nói. Vui lòng ghi lại.' }, 422);
  return samples.length / 32000;
}
