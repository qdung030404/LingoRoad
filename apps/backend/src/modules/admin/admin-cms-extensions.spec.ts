import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AssessmentSkill,
  CefrLevel,
  ItemUsageScope,
  LearningKind,
  SpeakingMode,
} from '@prisma/client';
import { AssessmentMatrixService } from '../assessment/services/assessment-matrix.service';
import { PrismaService } from '../prisma/prisma.service';
import { CuratedVocabularyService } from '../vocabulary/curated-vocabulary.service';
import { redactSensitiveData } from './services/admin-audit.service';
import { AdminContentService } from './services/admin-content.service';
import { rowsToSafeCsv, sanitizeCsvCell } from './services/admin-export.service';
import { AdminImportService } from './services/admin-import.service';
import {
  buildSafeMediaStem,
  detectSafeAdminImage,
} from './services/admin-media.service';
import { AdminSpeakingService } from './services/admin-speaking.service';
import { AdminVocabularyService } from './services/admin-vocabulary.service';

describe('Admin CMS Extensions (P0 + P1 + P2)', () => {
  describe('AdminMediaService helpers', () => {
    it('nhận diện đúng magic bytes JPG, PNG, WEBP và chặn SVG / file giả mạo', () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
      const webp = Buffer.from('RIFF1234WEBPxxxx');
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

      expect(detectSafeAdminImage(png)).toEqual({ ext: '.png', mime: 'image/png' });
      expect(detectSafeAdminImage(jpg)).toEqual({ ext: '.jpg', mime: 'image/jpeg' });
      expect(detectSafeAdminImage(webp)).toEqual({ ext: '.webp', mime: 'image/webp' });
      expect(detectSafeAdminImage(svg)).toBeNull();
    });

    it('chuẩn hóa slug an toàn và ngăn chặn path traversal', () => {
      const stem = buildSafeMediaStem('../../etc/passwd', 'My Banner!.PNG');
      expect(stem).not.toContain('..');
      expect(stem).not.toContain('/');
      expect(stem).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe('AdminAuditService redaction & AdminExportService CSV Injection protection', () => {
    it('ẩn hoàn toàn các khóa nhạy cảm ở mọi độ sâu lồng nhau', () => {
      const cleaned = redactSensitiveData({
        email: 'admin@lingoroad.local',
        password: 'SuperSecretPassword!',
        nested: {
          refreshToken: 'tok-123',
          apiKey: 'key-abc',
          safeField: 'hello',
        },
      }) as Record<string, unknown>;

      expect(cleaned.email).toBe('admin@lingoroad.local');
      expect(cleaned.password).toBe('[REDACTED]');
      expect((cleaned.nested as Record<string, unknown>).refreshToken).toBe('[REDACTED]');
      expect((cleaned.nested as Record<string, unknown>).apiKey).toBe('[REDACTED]');
      expect((cleaned.nested as Record<string, unknown>).safeField).toBe('hello');
    });

    it('trung hòa công thức OWASP CSV Injection và xuất UTF-8 BOM', () => {
      expect(sanitizeCsvCell('=HYPERLINK("http://evil","click")')).toBe(
        `"'=HYPERLINK(""http://evil"",""click"")"`,
      );
      expect(sanitizeCsvCell('+cmd|\' /C calc\'!A0')).toContain(`"'+cmd`);
      expect(sanitizeCsvCell('-2+3')).toBe(`"'-2+3"`);
      expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe(`"'@SUM(A1:A2)"`);
      expect(sanitizeCsvCell('＝1+1')).toBe(`"'＝1+1"`);
      expect(sanitizeCsvCell('Tiếng Việt bình thường')).toBe('"Tiếng Việt bình thường"');

      const csv = rowsToSafeCsv(['col1', 'col2'], [['=1+1', 'An toàn']]);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain(`"'=1+1"`);
    });
  });

  describe('AdminContentService Units CRUD, Grammar Link & Groups CRUD', () => {
    const tx = {
      learningLesson: { updateMany: jest.fn() },
      learningUnit: { delete: jest.fn() },
      assessmentItem: { updateMany: jest.fn() },
      assessmentItemGroup: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    const prisma = {
      learningUnit: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      grammarTopic: { findUnique: jest.fn() },
      learningLesson: { findUnique: jest.fn(), aggregate: jest.fn(), create: jest.fn() },
      assessmentItemGroup: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const matrix = { invalidateCache: jest.fn(async () => undefined) };

    const service = new AdminContentService(
      prisma as unknown as PrismaService,
      matrix as unknown as AssessmentMatrixService,
    );

    beforeEach(() => jest.clearAllMocks());

    it('chặn xóa LearningUnit còn bài học nếu detach = false, và gỡ liên kết khi detach = true', async () => {
      prisma.learningUnit.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        _count: { lessons: 2 },
      });
      await expect(service.deleteUnit('u-1', false)).rejects.toBeInstanceOf(ConflictException);

      prisma.learningUnit.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        _count: { lessons: 2 },
      });
      const res = await service.deleteUnit('u-1', true);
      expect(res).toEqual({ id: 'u-1', action: 'DELETED', detachedLessonsCount: 2 });
      expect(tx.learningLesson.updateMany).toHaveBeenCalledWith({
        where: { unitId: 'u-1' },
        data: { unitId: null },
      });
    });

    it('từ chối gắn grammarTopicId không phải cấu trúc lá (isLeaf = false)', async () => {
      prisma.learningLesson.findUnique.mockResolvedValue(null);
      prisma.grammarTopic.findUnique.mockResolvedValue({ id: 'g-1', isLeaf: false });

      await expect(
        service.createLesson({
          code: 'grammar-test-01',
          kind: LearningKind.GRAMMAR,
          title: 'Test',
          description: 'Desc',
          estimatedMinutes: 5,
          grammarTopicId: 'g-1',
          content: {
            steps: [{ id: 's-1', title: 'S', body: 'Body' }],
            questions: [1, 2, 3].map((n) => ({
              id: `q-${n}`,
              type: 'MULTIPLE_CHOICE',
              prompt: `Q${n}?`,
              options: [
                { id: 'A', text: '1' },
                { id: 'B', text: '2' },
                { id: 'C', text: '3' },
                { id: 'D', text: '4' },
              ],
              correctOptionId: 'A',
              explanation: 'Exp',
            })),
          },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('tạo và xoá AssessmentItemGroup gọi invalidateCache()', async () => {
      const savedGroup = {
        id: 'grp-1',
        skill: AssessmentSkill.READING,
        title: 'Part 5',
        cefrLevel: CefrLevel.B1,
        partNumber: 5,
        passage: 'A passage text',
        audioUrl: null,
        transcript: null,
        usageScope: ItemUsageScope.MOCK_EXAM,
        createdAt: new Date(),
        _count: { items: 0 },
        items: [],
      };
      tx.assessmentItemGroup.create.mockResolvedValue({ id: 'grp-1' });
      tx.assessmentItemGroup.findUniqueOrThrow.mockResolvedValue(savedGroup);

      const created = await service.createAssessmentGroup({
        skill: AssessmentSkill.READING,
        title: 'Part 5',
        cefrLevel: CefrLevel.B1,
        partNumber: 5,
        passage: 'A passage text',
        usageScope: ItemUsageScope.MOCK_EXAM,
      });
      expect(created.id).toBe('grp-1');
      expect(matrix.invalidateCache).toHaveBeenCalledTimes(1);

      prisma.assessmentItemGroup.findUnique.mockResolvedValue({
        id: 'grp-1',
        _count: { items: 3 },
      });
      const deleted = await service.deleteAssessmentGroup('grp-1');
      expect(deleted.detachedItemsCount).toBe(3);
      expect(tx.assessmentItem.updateMany).toHaveBeenCalledWith({
        where: { groupId: 'grp-1' },
        data: { groupId: null, itemOrder: 1 },
      });
      expect(matrix.invalidateCache).toHaveBeenCalledTimes(2);
    });
  });

  describe('AdminVocabularyService & AdminSpeakingService', () => {
    it('AdminVocabularyService vô hiệu hóa cache khi tạo/xoá chủ đề', async () => {
      const prisma = {
        curatedTopic: {
          findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
            id: 't-1',
            _count: { words: 5 },
          }),
          aggregate: jest.fn().mockResolvedValue({ _max: { displayOrder: 2 } }),
          create: jest.fn().mockResolvedValue({
            id: 't-1',
            slug: 'travel',
            titleEn: 'Travel',
            titleVi: 'Du lịch',
            description: null,
            icon: null,
            displayOrder: 3,
            createdAt: new Date(),
            _count: { words: 0 },
          }),
          delete: jest.fn(),
        },
      };
      const vocabCache = { invalidateTopicsCache: jest.fn() };
      const service = new AdminVocabularyService(
        prisma as unknown as PrismaService,
        vocabCache as unknown as CuratedVocabularyService,
      );

      const created = await service.createTopic({
        slug: 'travel',
        titleEn: 'Travel',
        titleVi: 'Du lịch',
      });
      expect(created.displayOrder).toBe(3);
      expect(vocabCache.invalidateTopicsCache).toHaveBeenCalledTimes(1);

      const deleted = await service.deleteTopic('t-1');
      expect(deleted.deletedWordsCount).toBe(5);
      expect(vocabCache.invalidateTopicsCache).toHaveBeenCalledTimes(2);
    });

    it('AdminSpeakingService bắt buộc ảnh cho PICTURE_DESCRIPTION và ẩn an toàn khi đã có bài nộp', async () => {
      const prisma = {
        speakingPrompt: {
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'sp-1', _count: { submissions: 4 } }),
          update: jest.fn(),
        },
      };
      const service = new AdminSpeakingService(prisma as unknown as PrismaService);

      await expect(
        service.createPrompt({
          code: 'pic-no-img',
          mode: SpeakingMode.PICTURE_DESCRIPTION,
          title: 'Describe park',
          text: 'Describe what you see',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const res = await service.deletePrompt('sp-1', false);
      expect(res).toEqual({ id: 'sp-1', action: 'UNPUBLISHED', submissionsCount: 4 });
      expect(prisma.speakingPrompt.update).toHaveBeenCalledWith({
        where: { id: 'sp-1' },
        data: { published: false },
      });
    });
  });

  describe('AdminImportService merge mode & extended entities', () => {
    it('chế độ topicWordsMode=merge chỉ thêm từ mới và không gọi deleteMany', async () => {
      const tx = {
        curatedTopic: { upsert: jest.fn().mockResolvedValue({ id: 'topic-1' }) },
        curatedTopicWord: {
          findMany: jest.fn().mockResolvedValue([{ word: 'Apple', partOfSpeech: 'noun' }]),
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
      };
      const prisma = {
        learningUnit: { findMany: jest.fn().mockResolvedValue([]) },
        curatedTopic: { findMany: jest.fn().mockResolvedValue([{ slug: 'fruits' }]) },
        $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const matrix = { invalidateCache: jest.fn(async () => undefined) };
      const vocab = { invalidateTopicsCache: jest.fn() };
      const service = new AdminImportService(
        prisma as unknown as PrismaService,
        matrix as unknown as AssessmentMatrixService,
        vocab as unknown as CuratedVocabularyService,
      );

      await service.applyBundle(
        {
          topics: [
            {
              slug: 'fruits',
              titleEn: 'Fruits',
              titleVi: 'Trái cây',
              words: [
                { word: 'apple', partOfSpeech: 'noun', meaningVi: 'Táo' },
                { word: 'banana', partOfSpeech: 'noun', meaningVi: 'Chuối' },
              ],
            },
          ],
        },
        { topicWordsMode: 'merge' },
      );

      expect(tx.curatedTopicWord.deleteMany).not.toHaveBeenCalled();
      expect(tx.curatedTopicWord.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            topicId: 'topic-1',
            word: 'banana',
            meaningVi: 'Chuối',
          }),
        ],
      });
    });
  });
});
