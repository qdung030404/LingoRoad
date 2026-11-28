import {
  BadRequestException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { basename } from 'node:path';
import { listeningWaveDurationMs } from '../../learning/listening-media';
import { MediaStorageService } from '../../media/media-storage.service';
import { PrismaService } from '../../prisma/prisma.service';

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

export interface AdminOrphanMediaItem {
  key: string;
  url: string;
  size: number;
  lastModified: string | null;
}

export interface AdminOrphanMediaScanResult {
  scannedAt: string;
  storage: 'azure' | 'local';
  minAgeHours: number;
  totalBlobs: number;
  referencedCount: number;
  protectedRecentCount: number;
  orphanCount: number;
  orphanBytes: number;
  orphans: AdminOrphanMediaItem[];
}

export interface AdminOrphanMediaCleanupResult {
  cleanedAt: string;
  minAgeHours: number;
  deletedCount: number;
  deletedBytes: number;
  skippedCount: number;
  deletedKeys: string[];
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MANAGED_MEDIA_PREFIXES = ['learning/v1/', 'placement/'] as const;
const MAX_CLEANUP_BATCH = 500;
const MEDIA_KEY_EXTRACT_REGEX =
  /(?:^|\/)media\/((?:learning\/v1|placement)\/[a-zA-Z0-9/_.-]+)/g;

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

function normalizeManagedMediaKey(rawKey: string): string | null {
  const clean = rawKey.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean || clean.includes('..') || clean.includes('//')) {
    return null;
  }
  if (!MANAGED_MEDIA_PREFIXES.some((prefix) => clean.startsWith(prefix))) {
    return null;
  }
  const segments = clean.split('/');
  if (
    segments.some(
      (seg) => !seg || seg === '.' || seg === '..' || !/^[a-zA-Z0-9._-]+$/.test(seg),
    )
  ) {
    return null;
  }
  return clean;
}

export function extractMediaKeysFromUnknown(
  value: unknown,
  out: Set<string>,
  depth = 0,
): void {
  if (depth > 20 || value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    const direct = value.trim();
    if (
      direct.startsWith('learning/v1/') ||
      direct.startsWith('placement/') ||
      direct.startsWith('/learning/v1/') ||
      direct.startsWith('/placement/')
    ) {
      const normalizedDirect = normalizeManagedMediaKey(direct);
      if (normalizedDirect) out.add(normalizedDirect);
    }

    MEDIA_KEY_EXTRACT_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MEDIA_KEY_EXTRACT_REGEX.exec(value)) !== null) {
      const normalized = normalizeManagedMediaKey(match[1]);
      if (normalized) {
        out.add(normalized);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      extractMediaKeysFromUnknown(entry, out, depth + 1);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const val of Object.values(value as Record<string, unknown>)) {
      extractMediaKeysFromUnknown(val, out, depth + 1);
    }
  }
}

@Injectable()
export class AdminMediaService {
  private readonly storage: MediaStorageService;

  constructor(
    @Optional() mediaStorage?: MediaStorageService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
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

  private clampMinAgeHours(raw?: number): number {
    if (raw === undefined || raw === null || !Number.isFinite(raw)) {
      return 24;
    }
    return Math.min(720, Math.max(1, Math.floor(raw)));
  }

  async collectReferencedMediaKeys(): Promise<Set<string>> {
    if (!this.prisma) {
      throw new ServiceUnavailableException({
        code: 'MEDIA_DB_UNAVAILABLE',
        message: 'Không thể đối chiếu tham chiếu media do thiếu kết nối cơ sở dữ liệu.',
      });
    }

    const [
      users,
      lessons,
      attempts,
      items,
      groups,
      vocabWords,
      learnerVocabWords,
      vocabReviewItems,
      speakingPrompts,
      speakingSubmissions,
      voiceConversations,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { avatarUrl: { not: null } },
        select: { avatarUrl: true },
      }),
      this.prisma.learningLesson.findMany({
        select: { content: true },
      }),
      this.prisma.learningAttempt.findMany({
        select: { lessonSnapshot: true, contentSnapshot: true },
      }),
      this.prisma.assessmentItem.findMany({
        select: { audioUrl: true, options: true, rubricCriteria: true },
      }),
      this.prisma.assessmentItemGroup.findMany({
        where: { audioUrl: { not: null } },
        select: { audioUrl: true },
      }),
      this.prisma.curatedTopicWord.findMany({
        select: { imageUrl: true, audioUrl: true },
      }),
      this.prisma.vocabularyWord.findMany({
        where: { imageUrl: { not: null } },
        select: { imageUrl: true },
      }),
      this.prisma.vocabularyReviewItem.findMany({
        select: { wordSnapshot: true },
      }),
      this.prisma.speakingPrompt.findMany({
        select: { imageUrl: true, sampleAsset: true, preparation: true },
      }),
      this.prisma.speakingSubmission.findMany({
        select: { promptSnapshot: true, result: true },
      }),
      this.prisma.voiceConversation.findMany({
        select: { topicSnapshot: true, assessment: true },
      }),
    ]);

    const referenced = new Set<string>();
    extractMediaKeysFromUnknown(users, referenced);
    extractMediaKeysFromUnknown(lessons, referenced);
    extractMediaKeysFromUnknown(attempts, referenced);
    extractMediaKeysFromUnknown(items, referenced);
    extractMediaKeysFromUnknown(groups, referenced);
    extractMediaKeysFromUnknown(vocabWords, referenced);
    extractMediaKeysFromUnknown(learnerVocabWords, referenced);
    extractMediaKeysFromUnknown(vocabReviewItems, referenced);
    extractMediaKeysFromUnknown(speakingPrompts, referenced);
    extractMediaKeysFromUnknown(speakingSubmissions, referenced);
    extractMediaKeysFromUnknown(voiceConversations, referenced);
    return referenced;
  }

  async scanOrphanMedia(
    rawMinAgeHours?: number,
  ): Promise<AdminOrphanMediaScanResult> {
    const minAgeHours = this.clampMinAgeHours(rawMinAgeHours);
    const cutoffMs = Date.now() - minAgeHours * 3600_000;

    const [blobs, referenced] = await Promise.all([
      this.storage.listManagedBlobs(MANAGED_MEDIA_PREFIXES),
      this.collectReferencedMediaKeys(),
    ]);

    let referencedCount = 0;
    let protectedRecentCount = 0;
    let orphanBytes = 0;
    const orphans: AdminOrphanMediaItem[] = [];

    for (const blob of blobs) {
      const normalized = normalizeManagedMediaKey(blob.key);
      if (!normalized) continue;

      if (referenced.has(normalized)) {
        referencedCount += 1;
        continue;
      }

      if (!blob.lastModified || blob.lastModified.getTime() > cutoffMs) {
        protectedRecentCount += 1;
        continue;
      }

      orphanBytes += blob.size;
      orphans.push({
        key: normalized,
        url: `/media/${normalized}`,
        size: blob.size,
        lastModified: blob.lastModified.toISOString(),
      });
    }

    orphans.sort((a, b) => a.key.localeCompare(b.key));

    return {
      scannedAt: new Date().toISOString(),
      storage: this.storage.storageMode(),
      minAgeHours,
      totalBlobs: referencedCount + protectedRecentCount + orphans.length,
      referencedCount,
      protectedRecentCount,
      orphanCount: orphans.length,
      orphanBytes,
      orphans,
    };
  }

  async cleanupOrphanMedia(
    input: { keys?: string[]; minAgeHours?: number } = {},
  ): Promise<AdminOrphanMediaCleanupResult> {
    const scan = await this.scanOrphanMedia(input.minAgeHours);
    const eligibleByKey = new Map<string, AdminOrphanMediaItem>(
      scan.orphans.map((item) => [item.key, item]),
    );

    let skippedCount = 0;
    const targets: AdminOrphanMediaItem[] = [];

    if (Array.isArray(input.keys) && input.keys.length > 0) {
      const seen = new Set<string>();
      for (const rawKey of input.keys) {
        if (targets.length >= MAX_CLEANUP_BATCH) {
          skippedCount += 1;
          continue;
        }
        const normalized =
          typeof rawKey === 'string'
            ? normalizeManagedMediaKey(rawKey.replace(/^\/media\//, ''))
            : null;
        if (!normalized) {
          skippedCount += 1;
          continue;
        }
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        const match = eligibleByKey.get(normalized);
        if (!match) {
          skippedCount += 1;
          continue;
        }
        targets.push(match);
      }
    } else {
      for (const item of scan.orphans) {
        if (targets.length >= MAX_CLEANUP_BATCH) {
          skippedCount += 1;
          continue;
        }
        targets.push(item);
      }
    }

    let deletedCount = 0;
    let deletedBytes = 0;
    const deletedKeys: string[] = [];

    for (const target of targets) {
      const removed = await this.storage.deleteBlob(target.key);
      if (removed) {
        deletedCount += 1;
        deletedBytes += target.size;
        deletedKeys.push(target.key);
      } else {
        skippedCount += 1;
      }
    }

    return {
      cleanedAt: new Date().toISOString(),
      minAgeHours: scan.minAgeHours,
      deletedCount,
      deletedBytes,
      skippedCount,
      deletedKeys,
    };
  }
}
