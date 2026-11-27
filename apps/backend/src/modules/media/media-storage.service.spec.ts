import {
  INestApplication,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AssessmentItem,
  AssessmentSkill,
  CefrLevel,
  ItemUsageScope,
  LearningLesson,
  Prisma,
} from '@prisma/client';
import { Readable } from 'node:stream';
import * as request from 'supertest';
import { HealthController } from '../../health.controller';
import { AdminMediaService } from '../admin/services/admin-media.service';
import { resolveAdminPlacementBankVersion } from '../admin/services/assessment-item-integrity';
import { LearningService } from '../learning/learning.service';
import { LearningContent } from '../learning/learning.types';
import { MlClientService } from '../ml/ml-client.service';
import { DemoPlacementService } from '../placement/services/demo-placement.service';
import { PrismaService } from '../prisma/prisma.service';
import { MediaProxyController, parseByteRange } from './media-proxy.controller';
import { MediaStorageService } from './media-storage.service';

function makeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string, defaultVal?: string) =>
      values[key] !== undefined ? values[key] : defaultVal,
    ),
  } as unknown as ConfigService;
}

function buildMono16kWav(durationSeconds: number): Buffer {
  const dataSize = durationSeconds * 32000;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(16000, 24);
  buf.writeUInt32LE(32000, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

function makeListeningContent(audioUrl: string, audioDurationMs: number): LearningContent {
  return {
    listeningVersion: 1,
    steps: [],
    audioUrl,
    audioDurationMs,
    preparation: {
      situation: 'A quick dialogue at the station.',
      objective: 'Catch the departure time and gate.',
    },
    keyVocabulary: [
      { id: 'v1', word: 'platform', meaning: 'sân ga' },
      { id: 'v2', word: 'departure', meaning: 'khởi hành' },
      { id: 'v3', word: 'ticket', meaning: 'vé' },
    ],
    transcript: 'Hello. The train leaves at nine.',
    transcriptSegments: [
      {
        id: 's1',
        speaker: 'Staff',
        startMs: 0,
        endMs: Math.min(15000, audioDurationMs),
        text: 'Hello.',
        translationVi: 'Xin chào.',
      },
      {
        id: 's2',
        speaker: 'Staff',
        startMs: Math.min(15000, audioDurationMs),
        endMs: audioDurationMs,
        text: 'The train leaves at nine.',
        translationVi: 'Tàu rời bến lúc chín giờ.',
      },
    ],
    questions: [
      {
        id: 'q1',
        skillCode: 'listening.gist',
        prompt: 'What is this announcement about?',
        options: [
          { id: 'A', text: 'Train schedule' },
          { id: 'B', text: 'Weather alert' },
          { id: 'C', text: 'Cafe menu' },
          { id: 'D', text: 'Library hours' },
        ],
        correctOptionId: 'A',
        explanation: 'Mentions train departure.',
        evidenceSegmentIds: ['s2'],
      },
      {
        id: 'q2',
        skillCode: 'listening.specific_information',
        prompt: 'When does the train leave?',
        options: [
          { id: 'A', text: 'At nine' },
          { id: 'B', text: 'At ten' },
          { id: 'C', text: 'At eight' },
          { id: 'D', text: 'At seven' },
        ],
        correctOptionId: 'A',
        explanation: 'Leaves at nine.',
        evidenceSegmentIds: ['s2'],
      },
      {
        id: 'q3',
        skillCode: 'listening.detail',
        prompt: 'Who is speaking?',
        options: [
          { id: 'A', text: 'Staff' },
          { id: 'B', text: 'Passenger' },
          { id: 'C', text: 'Doctor' },
          { id: 'D', text: 'Teacher' },
        ],
        correctOptionId: 'A',
        explanation: 'Station staff speaks.',
        evidenceSegmentIds: ['s1'],
      },
      {
        id: 'q4',
        skillCode: 'listening.detail',
        prompt: 'How does the speaker open?',
        options: [
          { id: 'A', text: 'Hello' },
          { id: 'B', text: 'Goodbye' },
          { id: 'C', text: 'Sorry' },
          { id: 'D', text: 'Thanks' },
        ],
        correctOptionId: 'A',
        explanation: 'Says hello.',
        evidenceSegmentIds: ['s1'],
      },
      {
        id: 'q5',
        skillCode: 'listening.specific_information',
        prompt: 'What vehicle is mentioned?',
        options: [
          { id: 'A', text: 'Train' },
          { id: 'B', text: 'Bus' },
          { id: 'C', text: 'Ferry' },
          { id: 'D', text: 'Plane' },
        ],
        correctOptionId: 'A',
        explanation: 'Mentions train.',
        evidenceSegmentIds: ['s2'],
      },
    ],
  };
}

describe('MediaStorageService, MediaProxyController & HealthController', () => {
  describe('MediaStorageService', () => {
    function createAzureMockService(env: Record<string, string | undefined>) {
      const mockBlockBlobClient = {
        url: 'https://teststorage.blob.core.windows.net/media/test-key',
        uploadData: jest.fn(async () => ({})),
        exists: jest.fn(async () => true),
        getProperties: jest.fn(async () => ({
          contentLength: 100,
          contentType: 'audio/wav',
          etag: '"etag-1"',
          lastModified: new Date('2026-11-27T00:00:00Z'),
          metadata: { durationms: '45000', scope: 'learning' } as Record<
            string,
            string
          >,
        })),
        downloadToBuffer: jest.fn(async () => buildMono16kWav(45)),
        download: jest.fn(async () => ({
          readableStreamBody: Readable.from([Buffer.from('hello')]),
          contentLength: 5,
          contentType: 'audio/wav',
          etag: '"etag-1"',
        })),
      };

      const mockContainerClient = {
        createIfNotExists: jest.fn(async () => ({})),
        getBlockBlobClient: jest.fn(() => mockBlockBlobClient),
      };

      const service = new MediaStorageService(makeConfig(env));
      (service as unknown as { containerClient: unknown }).containerClient =
        mockContainerClient;

      return { service, mockContainerClient, mockBlockBlobClient };
    }

    it('supports Managed Identity config (AZURE_STORAGE_ACCOUNT_NAME) and creates private container without public access', async () => {
      const { service, mockContainerClient } = createAzureMockService({
        AZURE_STORAGE_ACCOUNT_NAME: 'lingoroadprod',
      });

      expect(service.isAzureConfigured()).toBe(true);
      expect(service.isAzureRequired()).toBe(true);
      expect(service.storageMode()).toBe('azure');

      await service.onModuleInit();
      expect(mockContainerClient.createIfNotExists).toHaveBeenCalledTimes(1);
      expect(mockContainerClient.createIfNotExists).toHaveBeenCalledWith();
    });

    it('uploads image & WAV with lowercased metadata and primes in-memory cache for verifyListeningAudio', async () => {
      const { service, mockContainerClient, mockBlockBlobClient } =
        createAzureMockService({
          AZURE_STORAGE_ACCOUNT_NAME: 'lingoroadprod',
          AZURE_STORAGE_CONTAINER_NAME: 'media',
        });

      const jpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      ]);
      const adminMedia = new AdminMediaService(service);
      const imageResult = await adminMedia.uploadImage(
        { buffer: jpegBuffer, originalname: 'Unit Cover.jpg' },
        'unit-cover',
      );
      expect(imageResult.storage).toBe('azure');
      expect(imageResult.url).toMatch(
        /^\/media\/learning\/v1\/images\/unit-cover-[a-f0-9]{6}\.jpg$/,
      );
      expect(mockContainerClient.createIfNotExists).toHaveBeenCalledWith();

      const wav45s = buildMono16kWav(45);
      const audioResult = await adminMedia.uploadAudio(
        { buffer: wav45s, originalname: 'station.wav' },
        'learning',
        'station-dialogue',
      );
      expect(audioResult.storage).toBe('azure');
      expect(audioResult.durationMs).toBe(45000);
      expect(audioResult.url).toMatch(
        /^\/media\/learning\/v1\/station-dialogue-[a-f0-9]{6}\.wav$/,
      );
      expect(mockBlockBlobClient.uploadData).toHaveBeenLastCalledWith(
        wav45s,
        expect.objectContaining({
          blobHTTPHeaders: { blobContentType: 'audio/wav' },
          metadata: { durationms: '45000', scope: 'learning' },
        }),
      );

      // Because uploadBuffer primed the bounded cache, verifyListeningAudio must not hit Blob getProperties()
      const content = makeListeningContent(audioResult.url, 45000);
      await expect(
        service.verifyListeningAudio(content, '/non-existent-media-root'),
      ).resolves.toBeUndefined();
      expect(mockBlockBlobClient.getProperties).not.toHaveBeenCalled();

      // And exists() hits cache without calling remote exists()
      await expect(service.exists(audioResult.url)).resolves.toBe(true);
      expect(mockBlockBlobClient.exists).not.toHaveBeenCalled();
    });

    it('fails closed with 503 MEDIA_STORAGE_UNAVAILABLE when Azure upload fails or Azure is required without config', async () => {
      // Case 1: Azure configured, upload throws -> must fail-closed 503 (never fallback to local disk)
      const { service: azureSvc, mockBlockBlobClient } = createAzureMockService({
        AZURE_STORAGE_CONNECTION_STRING:
          'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dummy;EndpointSuffix=core.windows.net',
      });
      mockBlockBlobClient.uploadData.mockRejectedValueOnce(
        new Error('Azure transient network outage'),
      );

      const adminMedia = new AdminMediaService(azureSvc);
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);

      let caughtErr: unknown;
      try {
        await adminMedia.uploadImage({ buffer: pngBuffer, originalname: 'a.png' });
      } catch (err) {
        caughtErr = err;
      }
      expect(caughtErr).toBeInstanceOf(ServiceUnavailableException);
      expect((caughtErr as ServiceUnavailableException).getResponse()).toEqual(
        expect.objectContaining({ code: 'MEDIA_STORAGE_UNAVAILABLE' }),
      );

      // Case 2: MEDIA_STORAGE_REQUIRE_AZURE=true without credentials -> fail-closed 503
      const requiredOnlySvc = new MediaStorageService(
        makeConfig({ MEDIA_STORAGE_REQUIRE_AZURE: 'true' }),
      );
      expect(requiredOnlySvc.isAzureConfigured()).toBe(false);
      expect(requiredOnlySvc.isAzureRequired()).toBe(true);

      await expect(
        requiredOnlySvc.uploadBuffer(
          'learning/v1/images/test-123456.png',
          pngBuffer,
          'image/png',
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'MEDIA_STORAGE_UNAVAILABLE' }),
      });
    });

    it('verifies listening audio via Blob metadata, caches it, and falls back to 1-time buffer download when metadata missing', async () => {
      const { service, mockBlockBlobClient } = createAzureMockService({
        AZURE_STORAGE_ACCOUNT_NAME: 'lingoroadprod',
      });

      const remoteUrl = '/media/learning/v1/cloud-only-track-v1.wav';
      const content = makeListeningContent(remoteUrl, 45100); // within ±250ms of 45000

      // First call queries Blob getProperties() -> reads metadata.durationms
      await expect(
        service.verifyListeningAudio(content, '/non-existent-media-root'),
      ).resolves.toBeUndefined();
      expect(mockBlockBlobClient.getProperties).toHaveBeenCalledTimes(1);
      expect(mockBlockBlobClient.downloadToBuffer).not.toHaveBeenCalled();

      // Second call uses bounded cache -> no additional Blob calls
      await expect(
        service.verifyListeningAudio(content, '/non-existent-media-root'),
      ).resolves.toBeUndefined();
      expect(mockBlockBlobClient.getProperties).toHaveBeenCalledTimes(1);

      // Duration mismatch (>250ms) fails validation even from cache
      const mismatched = makeListeningContent(remoteUrl, 46000);
      await expect(
        service.verifyListeningAudio(mismatched, '/non-existent-media-root'),
      ).rejects.toThrow('Listening audio duration does not match content.');

      // Out-of-band upload without metadata -> 1-time downloadToBuffer() fallback, then cached
      const oobUrl = '/media/learning/v1/out-of-band-v1.wav';
      mockBlockBlobClient.getProperties.mockResolvedValueOnce({
        contentLength: 1000,
        contentType: 'audio/wav',
        etag: '"oob-1"',
        lastModified: new Date(),
        metadata: {},
      });
      mockBlockBlobClient.downloadToBuffer.mockResolvedValueOnce(
        buildMono16kWav(40),
      );

      await expect(
        service.verifyListeningAudio(
          makeListeningContent(oobUrl, 40000),
          '/non-existent-media-root',
        ),
      ).resolves.toBeUndefined();
      expect(mockBlockBlobClient.downloadToBuffer).toHaveBeenCalledTimes(1);

      // Cached after 1-time download
      await expect(
        service.verifyListeningAudio(
          makeListeningContent(oobUrl, 40000),
          '/non-existent-media-root',
        ),
      ).resolves.toBeUndefined();
      expect(mockBlockBlobClient.downloadToBuffer).toHaveBeenCalledTimes(1);

      // Invalid path / traversal rejected before hitting Azure
      await expect(
        service.verifyListeningAudio(
          makeListeningContent('/media/learning/v1/../evil.wav', 45000),
          '/non-existent-media-root',
        ),
      ).rejects.toThrow('Invalid Listening curriculum audio path.');
    });

    it('validates listening audio BEFORE acquiring user row lock in LearningService.start and supports async placement checks', async () => {
      const order: string[] = [];
      const listening = makeListeningContent(
        '/media/learning/v1/cloud-lock-order-v1.wav',
        45000,
      );
      const lesson: LearningLesson & { unit?: { cefrLevel: string } | null } = {
        id: 'l-cloud',
        code: 'cloud-listening',
        kind: 'LISTENING',
        title: 'Cloud Listening',
        description: 'Desc',
        estimatedMinutes: 5,
        sortOrder: 1,
        published: true,
        contentVersion: 1,
        unitId: null,
        grammarTopicId: null,
        content: listening as unknown as Prisma.JsonValue,
        createdAt: new Date(),
        updatedAt: new Date(),
        unit: null,
      };
      const db = {
        learningLesson: {
          findFirst: jest.fn(async () => lesson),
        },
        learningAttempt: {
          deleteMany: jest.fn(async () => ({ count: 0 })),
          findFirst: jest.fn(async () => null),
          create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            id: 'att-1',
            userId: 'u-1',
            lessonId: 'l-cloud',
            status: 'IN_PROGRESS',
            version: 0,
            phase: 'QUIZ',
            positionIndex: 0,
            contentVersion: 1,
            eligibleForLevelEval: true,
            totalQuestions: 5,
            correctCount: null,
            lessonSnapshot: data.lessonSnapshot,
            contentSnapshot: data.contentSnapshot,
            startedAt: new Date(),
            updatedAt: new Date(),
            submittedAt: null,
            historyHiddenAt: null,
            answers: [],
          })),
        },
        learningAnswerExposure: {
          findUnique: jest.fn(async () => null),
        },
        $queryRaw: jest.fn(async () => {
          order.push('row_lock');
          return [];
        }),
        $transaction: jest.fn(),
      };
      db.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<unknown>) => cb(db),
      );
      const mediaMock = {
        verifyListeningAudio: jest.fn(async () => {
          order.push('verify_listening_audio');
        }),
        exists: jest.fn(async (path: string) =>
          path.endsWith('cloud-placement.wav'),
        ),
      } as unknown as MediaStorageService;

      const learningService = new LearningService(
        db as unknown as PrismaService,
        undefined,
        undefined,
        mediaMock,
      );
      await learningService.start('u-1', 'l-cloud');
      expect(order).toEqual(['verify_listening_audio', 'row_lock']);

      // Async placement item check via resolveAdminPlacementBankVersion & DemoPlacementService
      const listeningItem: AssessmentItem = {
        id: 'p-1',
        groupId: null,
        itemOrder: 1,
        externalId: 'p-1',
        bankVersion: 'demo-v1',
        skill: AssessmentSkill.LISTENING,
        cefrLevel: CefrLevel.A2,
        type: 'MULTIPLE_CHOICE',
        passage: null,
        prompt: 'What time does the train leave?',
        options: ['9:00', '10:00', '11:00', '12:00'],
        correctOption: '9:00',
        explanation: null,
        skillCode: 'listening.general',
        audioUrl: '/media/placement/cloud-placement.wav',
        rubricCriteria: null,
        usageScope: ItemUsageScope.PLACEMENT,
        irtA: 1,
        irtB: 0,
        irtC: 0.25,
        createdAt: new Date(),
      };

      await expect(
        resolveAdminPlacementBankVersion(listeningItem, mediaMock),
      ).resolves.toBe('demo-v1');
      await expect(
        resolveAdminPlacementBankVersion(
          { ...listeningItem, audioUrl: '/media/placement/missing.wav' },
          mediaMock,
        ),
      ).rejects.toThrow();

      const placementPrisma = {
        placementSession: {
          findFirst: jest.fn(async () => ({
            id: 's-1',
            userId: 'u-1',
            status: 'IN_PROGRESS',
            currentItemIndex: 5,
            currentItemId: 'p-1',
            currentItem: listeningItem,
            version: 0,
            totalItems: 10,
            correctCount: 5,
            bankVersion: 'demo-v1',
            testVersion: 'READING_LISTENING_V1',
            estimatedCefr: null,
            confidenceScore: null,
            skillResults: null,
            completedAt: null,
            startedAt: new Date(),
            responses: [],
          })),
        },
      };
      const placementService = new DemoPlacementService(
        placementPrisma as unknown as PrismaService,
        {} as MlClientService,
        {} as EventEmitter2,
        mediaMock,
      );
      const startedPlacement = await placementService.start('u-1');
      expect(startedPlacement.firstItem.id).toBe('p-1');
      expect(mediaMock.exists).toHaveBeenCalledWith(
        '/media/placement/cloud-placement.wav',
      );
    });
  });

  describe('MediaProxyController (HTTP streaming, Range, ETag, HEAD & traversal guard)', () => {
    const payload = Buffer.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); // 26 bytes
    let app: INestApplication;
    let mediaStorageMock: {
      getBlobProperties: jest.Mock;
      getBlobStream: jest.Mock;
    };

    beforeAll(async () => {
      mediaStorageMock = {
        getBlobProperties: jest.fn(async (key: string) => {
          if (key.includes('missing')) return null;
          return {
            contentLength: payload.length,
            contentType: key.endsWith('.wav') ? 'audio/wav' : 'image/jpeg',
            etag: '"v1-etag-abc"',
            lastModified: new Date('2026-11-27T00:00:00Z'),
          };
        }),
        getBlobStream: jest.fn(
          async (
            key: string,
            range?: { offset: number; count?: number },
          ) => {
            if (key.includes('missing')) return null;
            const start = range?.offset ?? 0;
            const end =
              range?.count !== undefined
                ? start + range.count
                : payload.length;
            const slice = payload.subarray(start, end);
            return {
              stream: Readable.from([slice]),
              contentLength: slice.length,
              contentType: key.endsWith('.wav') ? 'audio/wav' : 'image/jpeg',
              etag: '"v1-etag-abc"',
            };
          },
        ),
      };

      const moduleRef = await Test.createTestingModule({
        controllers: [MediaProxyController],
        providers: [
          { provide: MediaStorageService, useValue: mediaStorageMock },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('streams 200 OK with required security & caching headers across whitelisted routes', async () => {
      const res = await request(app.getHttpServer())
        .get('/media/learning/v1/campus-cafe-v1.wav')
        .expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(res.headers['content-disposition']).toBe('inline');
      expect(res.headers['cache-control']).toBe(
        'public, max-age=31536000, immutable',
      );
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.headers['etag']).toBe('"v1-etag-abc"');
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(res.body).toEqual(payload);
    });

    it('supports HEAD returning properties only without opening a stream', async () => {
      const res = await request(app.getHttpServer())
        .head('/media/learning/v1/images/hero-banner.jpg')
        .expect(200);

      expect(res.headers['content-length']).toBe(String(payload.length));
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(mediaStorageMock.getBlobProperties).toHaveBeenCalledWith(
        'learning/v1/images/hero-banner.jpg',
      );
      expect(mediaStorageMock.getBlobStream).not.toHaveBeenCalled();
    });

    it('supports If-None-Match returning 304 Not Modified without opening a stream', async () => {
      await request(app.getHttpServer())
        .get('/media/vocabulary/a1b2c3-d4e5.jpg')
        .set('If-None-Match', '"v1-etag-abc"')
        .expect(304);

      expect(mediaStorageMock.getBlobProperties).toHaveBeenCalledWith(
        'vocabulary/a1b2c3-d4e5.jpg',
      );
      expect(mediaStorageMock.getBlobStream).not.toHaveBeenCalled();
    });

    it('supports Range 206 Partial Content and rejects invalid Range with 416', async () => {
      const partial = await request(app.getHttpServer())
        .get('/media/placement/demo-listening-a1-01.wav')
        .set('Range', 'bytes=0-9')
        .expect(206);

      expect(partial.headers['content-range']).toBe('bytes 0-9/26');
      expect(partial.headers['content-length']).toBe('10');
      expect(partial.body).toEqual(Buffer.from('ABCDEFGHIJ'));

      const badRange = await request(app.getHttpServer())
        .get('/media/placement/demo-listening-a1-01.wav')
        .set('Range', 'bytes=100-200')
        .expect(416);

      expect(badRange.headers['content-range']).toBe('bytes */26');
      expect(mediaStorageMock.getBlobStream).toHaveBeenCalledTimes(1);
    });

    it('rejects path traversal, disallowed extensions, and non-whitelisted prefixes', async () => {
      // Encoded traversal -> decoded :filename contains ../ -> 400
      await request(app.getHttpServer())
        .get('/media/placement/..%2Fsecret.wav')
        .expect(400);
      // Double dots inside placement filename -> 400
      await request(app.getHttpServer())
        .get('/media/placement/foo..bar.wav')
        .expect(400);
      // Disallowed extension (.html / .js) -> 400
      await request(app.getHttpServer())
        .get('/media/learning/v1/images/xss.html')
        .expect(400);
      await request(app.getHttpServer())
        .get('/media/vocabulary/evil.svg')
        .expect(400);
      // Non-whitelisted prefix -> 404 (no open wildcard)
      await request(app.getHttpServer())
        .get('/media/private/secrets.json')
        .expect(404);
      // Missing blob -> 404
      await request(app.getHttpServer())
        .get('/media/learning/v1/missing-track.wav')
        .expect(404);
    });

    it('destroys stream and aborts upstream download if client disconnects prematurely', async () => {
      const destroySpy = jest.fn();
      const fakeStream = Object.assign(new Readable({ read() {} }), {
        destroy: destroySpy,
        pipe: jest.fn(),
      });
      let capturedSignal: AbortSignal | undefined;
      const customStorage = {
        getBlobProperties: jest.fn(async () => ({
          contentLength: 100,
          contentType: 'audio/wav',
          etag: '"etag-abort"',
        })),
        getBlobStream: jest.fn(
          async (
            _key: string,
            _range?: { offset: number; count?: number },
            signal?: AbortSignal,
          ) => {
            capturedSignal = signal;
            return {
              stream: fakeStream,
              contentLength: 100,
              contentType: 'audio/wav',
            };
          },
        ),
      } as unknown as MediaStorageService;

      const controller = new MediaProxyController(customStorage);
      let closeHandler: (() => void) | undefined;
      const req = {
        headers: {},
        on: jest.fn((event: string, cb: () => void) => {
          if (event === 'close') closeHandler = cb;
        }),
      } as unknown as import('express').Request;
      const res = {
        writableEnded: false,
        headersSent: false,
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
      } as unknown as import('express').Response;

      await controller.getLearningAudio('campus-cafe-v1.wav', req, res);
      expect(closeHandler).toBeDefined();
      expect(capturedSignal?.aborted).toBe(false);

      closeHandler!();
      expect(capturedSignal?.aborted).toBe(true);
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it('parses byte ranges cleanly across edge cases', () => {
      expect(parseByteRange(undefined, 100)).toEqual({ kind: 'none' });
      expect(parseByteRange('bytes=0-9', 100)).toEqual({
        kind: 'valid',
        start: 0,
        end: 9,
      });
      expect(parseByteRange('bytes=90-', 100)).toEqual({
        kind: 'valid',
        start: 90,
        end: 99,
      });
      expect(parseByteRange('bytes=-10', 100)).toEqual({
        kind: 'valid',
        start: 90,
        end: 99,
      });
      expect(parseByteRange('bytes=50-10', 100)).toEqual({ kind: 'invalid' });
      expect(parseByteRange('bytes=100-110', 100)).toEqual({ kind: 'invalid' });
      expect(parseByteRange('bytes=0-5, 10-15', 100)).toEqual({
        kind: 'invalid',
      });
    });
  });

  describe('HealthController', () => {
    it('returns service, version, storage, database, schema, and timestamp', async () => {
      const prisma = {
        $queryRaw: jest.fn(async () => [{ ok: 1 }]),
      } as unknown as PrismaService;
      const config = makeConfig({ APP_VERSION: '2.4.1' });
      const azureStorage = new MediaStorageService(
        makeConfig({ AZURE_STORAGE_ACCOUNT_NAME: 'lingoroadprod' }),
      );

      const controller = new HealthController(prisma, config, azureStorage);
      const result = await controller.health();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        status: 'ok',
        service: 'backend',
        version: '2.4.1',
        storage: 'azure',
        database: 'ready',
        schema: 'ready',
      });
      expect(typeof result.data.timestamp).toBe('string');
      expect(Number.isNaN(Date.parse(result.data.timestamp))).toBe(false);

      // Defaults when ConfigService / MediaStorageService omitted
      const prevVersion = process.env.APP_VERSION;
      delete process.env.APP_VERSION;
      try {
        const defaultController = new HealthController(prisma);
        const defaultRes = await defaultController.health();
        expect(defaultRes.data).toMatchObject({
          status: 'ok',
          service: 'backend',
          version: '1.0.0',
          storage: 'local',
        });
      } finally {
        if (prevVersion !== undefined) {
          process.env.APP_VERSION = prevVersion;
        }
      }
    });
  });
});
