import {
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { randomBytes } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { LearningContent } from '../learning/learning.types';
import {
  listeningWaveDurationMs,
  validateListeningAudio,
} from '../learning/listening-media';

export interface MediaUploadResult {
  key: string;
  url: string;
  blobUrl?: string;
  storage: 'azure' | 'local';
  size: number;
}

export interface MediaByteRange {
  offset: number;
  count?: number;
}

export interface MediaBlobProperties {
  contentLength: number;
  contentType: string;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface MediaBlobStreamResult {
  stream: NodeJS.ReadableStream;
  contentLength?: number;
  contentType: string;
  etag?: string;
  lastModified?: Date;
}

interface MediaCacheEntry {
  exists: boolean;
  durationMs?: number;
  expiresAt: number;
}

const CACHE_MAX_ENTRIES = 500;
const CACHE_TTL_MS = 5 * 60 * 1000;
const LISTENING_V1_AUDIO_REGEX =
  /^\/media\/learning\/v1\/([a-z0-9]+(?:-[a-z0-9]+)*\.wav)$/;

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.wav': 'audio/wav',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export function backendMediaRoot(): string {
  return existsSync(join(process.cwd(), 'prisma', 'schema.prisma'))
    ? join(process.cwd(), 'media')
    : join(process.cwd(), 'apps', 'backend', 'media');
}

export function inferMediaContentType(key: string): string {
  return (
    CONTENT_TYPE_BY_EXT[extname(key).toLowerCase()] ??
    'application/octet-stream'
  );
}

function isAzureNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as {
    statusCode?: number;
    code?: string;
    details?: { errorCode?: string };
  };
  return (
    candidate.statusCode === 404 ||
    candidate.code === 'BlobNotFound' ||
    candidate.details?.errorCode === 'BlobNotFound'
  );
}

function tryNormalizeBlobKey(rawPathOrKey: string): string | null {
  if (typeof rawPathOrKey !== 'string') return null;
  const trimmed = rawPathOrKey.trim();
  if (
    !trimmed ||
    trimmed.includes('..') ||
    trimmed.includes('\\') ||
    /[\s\u0000-\u001f]/.test(trimmed)
  ) {
    return null;
  }

  let normalized = trimmed;
  if (normalized.startsWith('/media/')) {
    normalized = normalized.slice('/media/'.length);
  } else if (normalized.startsWith('media/')) {
    normalized = normalized.slice('media/'.length);
  } else if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.endsWith('/') ||
    normalized.includes('//')
  ) {
    return null;
  }

  const segments = normalized.split('/');
  if (
    segments.some(
      (seg) =>
        !seg || seg === '.' || seg === '..' || !/^[a-zA-Z0-9._-]+$/.test(seg),
    )
  ) {
    return null;
  }

  return normalized;
}

@Injectable()
export class MediaStorageService implements OnModuleInit {
  private readonly logger = new Logger(MediaStorageService.name);
  private blobServiceClient?: BlobServiceClient;
  private containerClient?: ContainerClient;
  private containerInitialized = false;
  private readonly metadataCache = new Map<string, MediaCacheEntry>();

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.initClients();
  }

  private getEnv(key: string): string | undefined {
    return this.configService
      ? this.configService.get<string>(key)
      : process.env[key];
  }

  private getContainerName(): string {
    return this.getEnv('AZURE_STORAGE_CONTAINER_NAME')?.trim() || 'media';
  }

  isAzureConfigured(): boolean {
    const connStr = this.getEnv('AZURE_STORAGE_CONNECTION_STRING')?.trim();
    const accountName = this.getEnv('AZURE_STORAGE_ACCOUNT_NAME')?.trim();
    return Boolean(connStr || accountName);
  }

  isAzureRequired(): boolean {
    const requireFlag = this.getEnv('MEDIA_STORAGE_REQUIRE_AZURE')
      ?.trim()
      .toLowerCase();
    return requireFlag === 'true' || this.isAzureConfigured();
  }

  storageMode(): 'azure' | 'local' {
    return this.isAzureConfigured() ? 'azure' : 'local';
  }

  private initClients(): ContainerClient | undefined {
    if (this.containerClient) {
      return this.containerClient;
    }

    const connStr = this.getEnv('AZURE_STORAGE_CONNECTION_STRING')?.trim();
    const accountName = this.getEnv('AZURE_STORAGE_ACCOUNT_NAME')?.trim();
    const containerName = this.getContainerName();

    if (connStr) {
      try {
        this.blobServiceClient =
          BlobServiceClient.fromConnectionString(connStr);
        this.containerClient =
          this.blobServiceClient.getContainerClient(containerName);
        return this.containerClient;
      } catch (err) {
        this.logger.error(
          `Lỗi khởi tạo Azure Blob từ connection string: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return undefined;
      }
    }

    if (accountName) {
      if (!/^[a-zA-Z0-9-]+$/.test(accountName)) {
        this.logger.error('AZURE_STORAGE_ACCOUNT_NAME không hợp lệ.');
        return undefined;
      }
      try {
        const accountUrl = `https://${accountName}.blob.core.windows.net`;
        this.blobServiceClient = new BlobServiceClient(
          accountUrl,
          new DefaultAzureCredential(),
        );
        this.containerClient =
          this.blobServiceClient.getContainerClient(containerName);
        return this.containerClient;
      } catch (err) {
        this.logger.error(
          `Lỗi khởi tạo Azure Blob với DefaultAzureCredential: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return undefined;
      }
    }

    return undefined;
  }

  async onModuleInit(): Promise<void> {
    const client = this.initClients();
    if (client && !this.containerInitialized) {
      try {
        // Luôn tạo private container (không truyền { access: 'blob' }).
        await client.createIfNotExists();
        this.containerInitialized = true;
      } catch (err) {
        this.logger.warn(
          `Không thể khởi tạo private container Azure Blob lúc khởi động: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  private getCached(key: string): MediaCacheEntry | undefined {
    const entry = this.metadataCache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.metadataCache.delete(key);
      return undefined;
    }
    // Refresh LRU position
    this.metadataCache.delete(key);
    this.metadataCache.set(key, entry);
    return entry;
  }

  private setCached(
    key: string,
    value: { exists: boolean; durationMs?: number },
  ): void {
    if (this.metadataCache.has(key)) {
      this.metadataCache.delete(key);
    }
    while (this.metadataCache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = this.metadataCache.keys().next().value;
      if (oldestKey === undefined) break;
      this.metadataCache.delete(oldestKey);
    }
    this.metadataCache.set(key, {
      exists: value.exists,
      ...(value.durationMs !== undefined
        ? { durationMs: value.durationMs }
        : {}),
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  private resolveLocalPath(normalizedKey: string): string {
    const root = resolve(backendMediaRoot());
    const destination = resolve(root, normalizedKey);
    if (destination !== root && !destination.startsWith(`${root}${sep}`)) {
      throw new Error('Đường dẫn media cục bộ không hợp lệ.');
    }
    return destination;
  }

  private writeLocalAtomically(normalizedKey: string, buffer: Buffer): void {
    const destination = this.resolveLocalPath(normalizedKey);
    const parentDir = dirname(destination);
    mkdirSync(parentDir, { recursive: true });
    const tempPath = resolve(
      parentDir,
      `.${basename(destination)}.${randomBytes(4).toString('hex')}.tmp`,
    );
    writeFileSync(tempPath, buffer);
    renameSync(tempPath, destination);
  }

  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<MediaUploadResult> {
    const normalizedKey = tryNormalizeBlobKey(key);
    if (!normalizedKey) {
      throw new Error('Khóa tệp media không hợp lệ.');
    }

    let normalizedMeta: Record<string, string> | undefined;
    if (metadata) {
      normalizedMeta = {};
      for (const [k, v] of Object.entries(metadata)) {
        if (v !== undefined && v !== null) {
          normalizedMeta[k.toLowerCase()] = String(v);
        }
      }
    }

    const parsedDuration =
      normalizedMeta?.durationms !== undefined
        ? Number(normalizedMeta.durationms)
        : Number.NaN;
    const durationMs =
      Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : undefined;

    if (this.isAzureConfigured()) {
      const client = this.initClients();
      if (!client) {
        throw new ServiceUnavailableException({
          code: 'MEDIA_STORAGE_UNAVAILABLE',
          message: 'Không thể kết nối dịch vụ lưu trữ Azure Blob.',
        });
      }

      try {
        if (!this.containerInitialized) {
          await client.createIfNotExists();
          this.containerInitialized = true;
        }
        const blockBlobClient = client.getBlockBlobClient(normalizedKey);
        await blockBlobClient.uploadData(buffer, {
          blobHTTPHeaders: {
            blobContentType: contentType,
          },
          ...(normalizedMeta ? { metadata: normalizedMeta } : {}),
        });
        this.setCached(normalizedKey, { exists: true, durationMs });
        return {
          key: normalizedKey,
          url: `/media/${normalizedKey}`,
          blobUrl: blockBlobClient.url,
          storage: 'azure',
          size: buffer.length,
        };
      } catch (err) {
        this.logger.error(
          `Lỗi upload Azure Blob (${normalizedKey}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw new ServiceUnavailableException({
          code: 'MEDIA_STORAGE_UNAVAILABLE',
          message: 'Không thể tải tệp media lên dịch vụ lưu trữ đám mây.',
        });
      }
    }

    if (this.isAzureRequired()) {
      throw new ServiceUnavailableException({
        code: 'MEDIA_STORAGE_UNAVAILABLE',
        message: 'Hệ thống yêu cầu Azure Blob Storage nhưng chưa được cấu hình.',
      });
    }

    this.writeLocalAtomically(normalizedKey, buffer);
    this.setCached(normalizedKey, { exists: true, durationMs });
    return {
      key: normalizedKey,
      url: `/media/${normalizedKey}`,
      storage: 'local',
      size: buffer.length,
    };
  }

  async exists(mediaRelativePath: string): Promise<boolean> {
    const normalizedKey = tryNormalizeBlobKey(mediaRelativePath);
    if (!normalizedKey) return false;

    try {
      if (existsSync(this.resolveLocalPath(normalizedKey))) {
        return true;
      }
    } catch {
      return false;
    }

    const cached = this.getCached(normalizedKey);
    if (cached?.exists) {
      return true;
    }

    if (!this.isAzureConfigured()) {
      return false;
    }

    const client = this.initClients();
    if (!client) {
      return false;
    }

    try {
      const found = await client.getBlockBlobClient(normalizedKey).exists();
      if (found) {
        this.setCached(normalizedKey, { exists: true });
      }
      return found;
    } catch (err) {
      this.logger.warn(
        `Không thể kiểm tra tồn tại Blob (${normalizedKey}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  async verifyListeningAudio(
    content: LearningContent,
    mediaRoot = join(backendMediaRoot(), 'learning'),
  ): Promise<void> {
    if (content.listeningVersion !== 1) return;

    const match = LISTENING_V1_AUDIO_REGEX.exec(content.audioUrl ?? '');
    if (!match) {
      throw new Error('Invalid Listening curriculum audio path.');
    }

    const filename = match[1];
    const localFile = join(mediaRoot, 'v1', filename);
    if (existsSync(localFile)) {
      validateListeningAudio(content, mediaRoot);
      return;
    }

    const key = `learning/v1/${filename}`;
    const cached = this.getCached(key);
    let durationMs = cached?.durationMs;

    if (durationMs === undefined) {
      if (!this.isAzureConfigured()) {
        throw new Error('Listening curriculum audio file not found.');
      }

      const client = this.initClients();
      if (!client) {
        throw new Error('Azure Blob Storage client is unavailable.');
      }

      const blockBlobClient = client.getBlockBlobClient(key);
      let props: Awaited<ReturnType<typeof blockBlobClient.getProperties>>;
      try {
        props = await blockBlobClient.getProperties();
      } catch (err) {
        if (isAzureNotFoundError(err)) {
          throw new Error('Listening curriculum audio file not found.');
        }
        throw err;
      }

      const rawMetaDuration =
        props.metadata?.durationms ?? props.metadata?.durationMs;
      const parsedMetaDuration =
        rawMetaDuration !== undefined ? Number(rawMetaDuration) : Number.NaN;

      if (Number.isFinite(parsedMetaDuration) && parsedMetaDuration > 0) {
        durationMs = parsedMetaDuration;
      } else {
        // Fallback 1 lần tải buffer cho tệp được tải lên ngoài luồng CMS chưa có metadata.
        const downloaded = await blockBlobClient.downloadToBuffer();
        durationMs = listeningWaveDurationMs(downloaded);
      }

      this.setCached(key, { exists: true, durationMs });
    }

    if (
      typeof content.audioDurationMs !== 'number' ||
      !Number.isFinite(content.audioDurationMs) ||
      durationMs < 30000 ||
      durationMs > 90000 ||
      Math.abs(durationMs - content.audioDurationMs) > 250
    ) {
      throw new Error('Listening audio duration does not match content.');
    }
  }

  async getBlobProperties(key: string): Promise<MediaBlobProperties | null> {
    const normalizedKey = tryNormalizeBlobKey(key);
    if (!normalizedKey) return null;

    if (this.isAzureConfigured()) {
      const client = this.initClients();
      if (!client) {
        throw new ServiceUnavailableException({
          code: 'MEDIA_STORAGE_UNAVAILABLE',
          message: 'Không thể kết nối dịch vụ lưu trữ media.',
        });
      }

      try {
        const props = await client
          .getBlockBlobClient(normalizedKey)
          .getProperties();
        return {
          contentLength: props.contentLength ?? 0,
          contentType:
            props.contentType || inferMediaContentType(normalizedKey),
          etag: props.etag,
          lastModified: props.lastModified,
          metadata: props.metadata,
        };
      } catch (err) {
        if (isAzureNotFoundError(err)) return null;
        this.logger.error(
          `Lỗi đọc thuộc tính Blob (${normalizedKey}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw new ServiceUnavailableException({
          code: 'MEDIA_STORAGE_UNAVAILABLE',
          message: 'Dịch vụ lưu trữ media tạm thời không khả dụng.',
        });
      }
    }

    const localPath = this.resolveLocalPath(normalizedKey);
    if (!existsSync(localPath)) return null;
    const stat = statSync(localPath);
    if (!stat.isFile()) return null;

    return {
      contentLength: stat.size,
      contentType: inferMediaContentType(normalizedKey),
      etag: `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`,
      lastModified: stat.mtime,
    };
  }

  async getBlobStream(
    key: string,
    range?: MediaByteRange,
    abortSignal?: AbortSignal,
  ): Promise<MediaBlobStreamResult | null> {
    const normalizedKey = tryNormalizeBlobKey(key);
    if (!normalizedKey) return null;

    if (this.isAzureConfigured()) {
      const client = this.initClients();
      if (!client) {
        throw new ServiceUnavailableException({
          code: 'MEDIA_STORAGE_UNAVAILABLE',
          message: 'Không thể kết nối dịch vụ lưu trữ media.',
        });
      }

      try {
        const response = await client
          .getBlockBlobClient(normalizedKey)
          .download(
            range?.offset ?? 0,
            range?.count,
            abortSignal ? { abortSignal } : undefined,
          );
        if (!response.readableStreamBody) {
          throw new ServiceUnavailableException({
            code: 'MEDIA_STORAGE_UNAVAILABLE',
            message: 'Không thể đọc luồng dữ liệu media.',
          });
        }
        return {
          stream: response.readableStreamBody,
          contentLength: response.contentLength,
          contentType:
            response.contentType || inferMediaContentType(normalizedKey),
          etag: response.etag,
          lastModified: response.lastModified,
        };
      } catch (err) {
        if (err instanceof ServiceUnavailableException) throw err;
        if (isAzureNotFoundError(err)) return null;
        this.logger.error(
          `Lỗi đọc luồng Blob (${normalizedKey}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw new ServiceUnavailableException({
          code: 'MEDIA_STORAGE_UNAVAILABLE',
          message: 'Dịch vụ lưu trữ media tạm thời không khả dụng.',
        });
      }
    }

    const localPath = this.resolveLocalPath(normalizedKey);
    if (!existsSync(localPath)) return null;
    const stat = statSync(localPath);
    if (!stat.isFile()) return null;

    const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const contentType = inferMediaContentType(normalizedKey);

    if (stat.size === 0) {
      return {
        stream: Readable.from([]),
        contentLength: 0,
        contentType,
        etag,
        lastModified: stat.mtime,
      };
    }

    const start = range?.offset ?? 0;
    const end =
      range?.count !== undefined
        ? Math.min(start + range.count - 1, stat.size - 1)
        : stat.size - 1;

    return {
      stream: createReadStream(localPath, { start, end }),
      contentLength: end - start + 1,
      contentType,
      etag,
      lastModified: stat.mtime,
    };
  }
}
