import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import * as crypto from 'crypto';
import * as path from 'path';

export interface UploadedImageFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

@Injectable()
export class AzureBlobStorageService {
  private readonly logger = new Logger(AzureBlobStorageService.name);
  private blobServiceClient?: BlobServiceClient;
  private containerClient?: ContainerClient;
  private readonly containerName: string;

  constructor(private readonly configService: ConfigService) {
    this.containerName = this.configService.get<string>('AZURE_STORAGE_CONTAINER_NAME', 'vocabulary');
    const connStr = this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING');
    if (connStr) {
      try {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
        this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      } catch (err) {
        this.logger.error(`Lỗi khởi tạo Azure Blob Service: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  async uploadImage(file?: UploadedImageFile): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn file ảnh để tải lên.');
    }

    if (!this.containerClient) {
      const connStr = this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING');
      if (!connStr) {
        throw new ServiceUnavailableException('Chưa cấu hình AZURE_STORAGE_CONNECTION_STRING.');
      }
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    }

    // Kiểm tra định dạng hợp lệ
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const mime = (file.mimetype || 'image/jpeg').toLowerCase();
    if (!allowedMimeTypes.includes(mime)) {
      throw new BadRequestException('Chỉ chấp nhận file ảnh định dạng JPG, PNG, WEBP hoặc GIF.');
    }

    // Tối đa 5MB
    const maxBytes = 5 * 1024 * 1024;
    const size = file.size ?? file.buffer.length;
    if (size > maxBytes) {
      throw new BadRequestException('Dung lượng ảnh không được vượt quá 5MB.');
    }

    const origName = file.originalname || 'image.jpg';
    const ext = path.extname(origName) || '.jpg';
    const blobName = `${crypto.randomUUID()}${ext.toLowerCase()}`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

    try {
      await this.containerClient.createIfNotExists({ access: 'blob' });
      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: mime,
        },
      });
      return blockBlobClient.url;
    } catch (err) {
      this.logger.error(`Lỗi khi tải ảnh lên Azure Blob: ${err instanceof Error ? err.message : err}`);
      throw new ServiceUnavailableException('Không thể tải ảnh lên dịch vụ lưu trữ đám mây.');
    }
  }
}
