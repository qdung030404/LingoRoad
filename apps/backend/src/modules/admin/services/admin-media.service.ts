import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { basename } from 'node:path';
import { listeningWaveDurationMs } from '../../learning/listening-media';
import { MediaStorageService } from '../../media/media-storage.service';

export interface UploadedAdminFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

export interface AdminImageUploadResult {
  url: string;
  mime: string;
  size: number;
  storage: 'azure' | 'local';
}

export interface AdminAudioUploadResult {
  url: string;
  durationMs: number;
  size: number;
  scope: 'learning' | 'placement';
  storage: 'azure' | 'local';
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

interface DetectedImage {
  mime: string;
  ext: '.jpg' | '.png' | '.webp';
}

/**
 * Xác thực định dạng ảnh raster theo Magic Bytes thực tế.
 * Tuyệt đối không chấp nhận SVG/HTML để ngăn Stored XSS và khớp isSafeImageUrl().
 */
export function detectSafeAdminImage(buffer: Buffer): DetectedImage | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }

  return null;
}

export function buildSafeMediaStem(hint?: string, fallback = 'media'): string {
  const base = basename(hint?.trim() || '').replace(/\.[^.]+$/, '');
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const stem = slug || fallback;
  const suffix = randomBytes(3).toString('hex');
  return `${stem}-${suffix}`;
}

@Injectable()
export class AdminMediaService {
  private readonly storage: MediaStorageService;

  constructor(@Optional() mediaStorage?: MediaStorageService) {
    this.storage = mediaStorage ?? new MediaStorageService();
  }

  async uploadImage(
    file?: UploadedAdminFile,
    slugHint?: string,
  ): Promise<AdminImageUploadResult> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'ADMIN_IMAGE_REQUIRED',
        message: 'Vui lòng chọn tệp ảnh để tải lên.',
      });
    }

    const size = file.size ?? file.buffer.length;
    if (size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException({
        code: 'ADMIN_IMAGE_TOO_LARGE',
        message: 'Dung lượng ảnh không được vượt quá 5 MB.',
      });
    }

    const detected = detectSafeAdminImage(file.buffer);
    if (!detected) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_IMAGE',
        message: 'Chỉ chấp nhận tệp ảnh JPG, PNG hoặc WEBP hợp lệ (không hỗ trợ SVG).',
      });
    }

    const filename = `${buildSafeMediaStem(slugHint || file.originalname, 'img')}${detected.ext}`;
    const key = `learning/v1/images/${filename}`;
    const uploaded = await this.storage.uploadBuffer(
      key,
      file.buffer,
      detected.mime,
    );

    return {
      url: `/media/${uploaded.key}`,
      mime: detected.mime,
      size: file.buffer.length,
      storage: uploaded.storage,
    };
  }

  async uploadAudio(
    file?: UploadedAdminFile,
    scope: 'learning' | 'placement' = 'learning',
    slugHint?: string,
  ): Promise<AdminAudioUploadResult> {
    if (scope !== 'learning' && scope !== 'placement') {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_AUDIO_SCOPE',
        message: 'Phạm vi audio phải là "learning" hoặc "placement".',
      });
    }

    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'ADMIN_AUDIO_REQUIRED',
        message: 'Vui lòng chọn tệp âm thanh .wav để tải lên.',
      });
    }

    const size = file.size ?? file.buffer.length;
    if (size > MAX_AUDIO_BYTES || file.buffer.length > MAX_AUDIO_BYTES) {
      throw new BadRequestException({
        code: 'ADMIN_AUDIO_TOO_LARGE',
        message: 'Dung lượng tệp âm thanh không được vượt quá 10 MB.',
      });
    }

    let rawDurationMs: number;
    try {
      rawDurationMs = listeningWaveDurationMs(file.buffer);
    } catch (error) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_AUDIO',
        message:
          error instanceof Error
            ? `Tệp WAV không hợp lệ (${error.message}). Yêu cầu chuẩn WAV PCM 16-bit mono.`
            : 'Tệp WAV không đúng định dạng PCM 16-bit mono.',
      });
    }

    const durationMs = Math.round(rawDurationMs);
    if (scope === 'learning' && (durationMs < 30000 || durationMs > 90000)) {
      throw new BadRequestException({
        code: 'ADMIN_INVALID_AUDIO_DURATION',
        message: `Audio bài Listening v1 phải có thời lượng từ 30 đến 90 giây (tệp hiện tại: ${(durationMs / 1000).toFixed(1)}s).`,
      });
    }

    const filename = `${buildSafeMediaStem(slugHint || file.originalname, scope === 'learning' ? 'listening' : 'placement')}.wav`;
    const key =
      scope === 'learning'
        ? `learning/v1/${filename}`
        : `placement/${filename}`;
    const uploaded = await this.storage.uploadBuffer(
      key,
      file.buffer,
      'audio/wav',
      {
        durationms: String(durationMs),
        scope,
      },
    );

    return {
      url: `/media/${uploaded.key}`,
      durationMs,
      size: file.buffer.length,
      scope,
      storage: uploaded.storage,
    };
  }
}
