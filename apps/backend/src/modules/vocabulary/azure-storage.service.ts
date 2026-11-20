import { Injectable, Logger, BadRequestException, ServiceUnavailableException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import * as crypto from 'crypto';

export interface UploadedImageFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

interface DetectedImageType {
  mime: string;
  ext: string;
}

/**
 * Kiểm tra Magic Bytes thực tế trong Buffer để ngăn chặn MIME-type spoofing
 * và Stored XSS thông qua việc upload file HTML/SVG giả dạng ảnh.
 */
function detectImageMagicBytes(buffer: Buffer): DetectedImageType | null {
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

  // GIF: 47 49 46 38 ("GIF8")
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { mime: 'image/gif', ext: '.gif' };
  }

  // WEBP: "RIFF" .... "WEBP"
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

@Injectable()
export class AzureBlobStorageService implements OnModuleInit {
  private readonly logger = new Logger(AzureBlobStorageService.name);
  private blobServiceClient?: BlobServiceClient;
  private containerClient?: ContainerClient;
  private readonly containerName: string;
  private containerInitialized = false;

  constructor(private readonly configService: ConfigService) {
    this.containerName = this.configService.get<string>('AZURE_STORAGE_CONTAINER_NAME', 'vocabulary');
    this.initClients();
  }

  private initClients(): void {
    const connStr = this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING');
    if (connStr && !this.containerClient) {
      try {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
        this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      } catch (err) {
        this.logger.error(`Lỗi khởi tạo Azure Blob Service: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  /**
   * Khởi tạo và kiểm tra quyền container Azure Blob ngay lúc ứng dụng khởi động
   * nhằm loại bỏ độ trễ network round-trip (~50-100ms) ở mỗi request upload của user.
   */
  async onModuleInit(): Promise<void> {
    this.initClients();
    if (this.containerClient && !this.containerInitialized) {
      try {
        await this.containerClient.createIfNotExists({ access: 'blob' });
        this.containerInitialized = true;
      } catch (err) {
        this.logger.warn(`Không thể khởi tạo container Azure Blob lúc khởi động: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  async uploadImage(file?: UploadedImageFile): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn file ảnh để tải lên.');
    }

    // Tối đa 5MB
    const maxBytes = 5 * 1024 * 1024;
    const size = file.size ?? file.buffer.length;
    if (size > maxBytes) {
      throw new BadRequestException('Dung lượng ảnh không được vượt quá 5MB.');
    }

    // Xác thực định dạng dựa trên Magic Bytes thực tế thay vì client header
    const detected = detectImageMagicBytes(file.buffer);
    if (!detected) {
      throw new BadRequestException('Chỉ chấp nhận file ảnh hợp lệ định dạng JPG, PNG, WEBP hoặc GIF.');
    }

    if (!this.containerClient) {
      this.initClients();
      if (!this.containerClient) {
        throw new ServiceUnavailableException('Chưa cấu hình AZURE_STORAGE_CONNECTION_STRING.');
      }
    }

    // Sử dụng extension nghiêm ngặt từ detected type, loại bỏ nguy cơ Path Traversal / Extension spoofing
    const blobName = `${crypto.randomUUID()}${detected.ext}`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

    try {
      if (!this.containerInitialized) {
        await this.containerClient.createIfNotExists({ access: 'blob' });
        this.containerInitialized = true;
      }

      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: detected.mime,
        },
      });
      return blockBlobClient.url;
    } catch (err) {
      this.logger.error(`Lỗi khi tải ảnh lên Azure Blob: ${err instanceof Error ? err.message : err}`);
      throw new ServiceUnavailableException('Không thể tải ảnh lên dịch vụ lưu trữ đám mây.');
    }
  }
}
