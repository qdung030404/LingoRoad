import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AzureBlobStorageService } from './azure-storage.service';

describe('AzureBlobStorageService', () => {
  let service: AzureBlobStorageService;
  let mockConfigService: any;
  let mockBlockBlobClient: any;
  let mockContainerClient: any;

  beforeEach(() => {
    mockBlockBlobClient = {
      uploadData: jest.fn(async () => ({})),
      url: 'https://testaccount.blob.core.windows.net/vocabulary/test-image.jpg',
    };

    mockContainerClient = {
      createIfNotExists: jest.fn(async () => ({})),
      getBlockBlobClient: jest.fn(() => mockBlockBlobClient),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'AZURE_STORAGE_CONTAINER_NAME') return 'vocabulary';
        if (key === 'AZURE_STORAGE_CONNECTION_STRING') {
          return 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dummy;EndpointSuffix=core.windows.net';
        }
        return defaultVal;
      }),
    };

    service = new AzureBlobStorageService(mockConfigService as ConfigService);
    // Inject mock containerClient
    (service as any).containerClient = mockContainerClient;
  });

  it('initializes and verifies private container existence on module startup (onModuleInit)', async () => {
    await service.onModuleInit();
    expect(mockContainerClient.createIfNotExists).toHaveBeenCalledWith();
  });

  it('throws BadRequestException if no file or buffer is provided', async () => {
    await expect(service.uploadImage(undefined)).rejects.toThrow(BadRequestException);
    await expect(service.uploadImage({ buffer: undefined as any })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException if file exceeds 5MB', async () => {
    const hugeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1);
    await expect(service.uploadImage({ buffer: hugeBuffer, size: hugeBuffer.length })).rejects.toThrow(
      'Dung lượng ảnh không được vượt quá 5MB.',
    );
  });

  it('blocks MIME spoofing: throws BadRequestException when file has fake MIME but non-image magic bytes', async () => {
    // Kẻ tấn công gửi text/svg giả dạng image/jpeg
    const fakeImageBuffer = Buffer.from('<svg onload=alert(1)>Malicious code</svg>');
    await expect(
      service.uploadImage({
        buffer: fakeImageBuffer,
        mimetype: 'image/jpeg',
        originalname: 'innocent.jpg',
      }),
    ).rejects.toThrow('Chỉ chấp nhận file ảnh hợp lệ định dạng JPG, PNG, WEBP hoặc GIF.');

    expect(mockBlockBlobClient.uploadData).not.toHaveBeenCalled();
  });

  it('successfully uploads valid JPEG based on true magic bytes', async () => {
    // Valid JPEG magic bytes: FF D8 FF E0 ...
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const url = await service.uploadImage({
      buffer: jpegBuffer,
      originalname: '../../../attempt_traversal.php',
    });

    expect(url).toContain('https://testaccount.blob.core.windows.net');
    expect(mockBlockBlobClient.uploadData).toHaveBeenCalledWith(
      jpegBuffer,
      expect.objectContaining({
        blobHTTPHeaders: { blobContentType: 'image/jpeg' },
      }),
    );
    // Đảm bảo đuôi file là .jpg từ magic bytes và lưu dưới prefix vocabulary/
    const generatedBlobName = mockContainerClient.getBlockBlobClient.mock.calls[0][0];
    expect(generatedBlobName).toMatch(/^vocabulary\/[0-9a-f-]+\.jpg$/);
  });

  it('successfully uploads valid PNG based on true magic bytes and returns proxy URL when PUBLIC_API_BASE_URL is set', async () => {
    // Valid PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    mockConfigService.get.mockImplementation((key: string, defaultVal?: string) => {
      if (key === 'PUBLIC_API_BASE_URL') return 'https://api.lingoroad.app/';
      if (key === 'AZURE_STORAGE_CONTAINER_NAME') return 'media';
      if (key === 'AZURE_STORAGE_CONNECTION_STRING') {
        return 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dummy;EndpointSuffix=core.windows.net';
      }
      return defaultVal;
    });

    const url = await service.uploadImage({
      buffer: pngBuffer,
      originalname: 'test.png',
    });

    const generatedBlobName = mockContainerClient.getBlockBlobClient.mock.calls[0][0];
    expect(generatedBlobName).toMatch(/^vocabulary\/[0-9a-f-]+\.png$/);
    expect(url).toBe(`https://api.lingoroad.app/media/${generatedBlobName}`);
  });
});
