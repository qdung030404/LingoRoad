import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssessmentSkill,
  AuthProvider,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
  Prisma,
  SpeakingMode,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssessmentMatrixService } from '../assessment/services/assessment-matrix.service';
import { MlClientService } from '../ml/ml-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../security/password.service';
import { SpeakingService } from '../speaking/speaking.service';
import { CuratedVocabularyService } from '../vocabulary/curated-vocabulary.service';
import { UpdateAdminAssessmentItemDto } from './dto/admin-content.dto';
import {
  CreateAdminSpeakingPromptDto,
  UpdateAdminSpeakingPromptDto,
} from './dto/admin-speaking.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { lastValueFrom, of } from 'rxjs';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminAuditService, redactSensitiveData } from './services/admin-audit.service';
import { AdminContentService } from './services/admin-content.service';
import { rowsToSafeCsv, sanitizeCsvCell } from './services/admin-export.service';
import { AdminImportService } from './services/admin-import.service';
import {
  AdminMediaService,
  buildSafeMediaStem,
  detectSafeAdminImage,
  extractMediaKeysFromUnknown,
} from './services/admin-media.service';
import { MediaStorageService } from '../media/media-storage.service';
import { AdminSpeakingService } from './services/admin-speaking.service';
import {
  AdminUsersService,
  extractSpeakingOverallScore,
} from './services/admin-users.service';
import { AdminVocabularyService } from './services/admin-vocabulary.service';

jest.mock('firebase-admin/app', () => ({}));
jest.mock('firebase-admin/auth', () => ({}));

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
  for (let i = 44; i < buf.length; i += 2) {
    buf.writeInt16LE(1000, i);
  }
  return buf;
}

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

    it('đồng bộ GRAMMAR_CODE_REGEX khớp grammar-admin.dto và giới hạn Speaking ML khi validateBundle', async () => {
      const prisma = {
        learningUnit: { findMany: jest.fn().mockResolvedValue([]) },
        grammarTopic: { findMany: jest.fn().mockResolvedValue([]) },
        speakingPrompt: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const service = new AdminImportService(
        prisma as unknown as PrismaService,
        { invalidateCache: jest.fn(async () => undefined) } as unknown as AssessmentMatrixService,
        { invalidateTopicsCache: jest.fn() } as unknown as CuratedVocabularyService,
      );

      const validGrammar = await service.validateBundle({
        grammarTopics: [
          {
            code: 'grammar',
            cefrLevel: 'A1',
            isLeaf: false,
            titleEn: 'Grammar Root',
            titleVi: 'Ngữ pháp gốc',
          },
          {
            code: 'grammar.present_simple',
            parentCode: 'grammar',
            cefrLevel: 'A1',
            isLeaf: true,
            titleEn: 'Present Simple',
            titleVi: 'Hiện tại đơn',
            summaryVi: 'Thì hiện tại đơn',
            formulas: [
              { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + V(s/es)' },
            ],
            usageNotes: [{ useCaseVi: 'Thói quen' }],
            examples: [{ sentenceEn: 'I walk.', translationVi: 'Tôi đi bộ.' }],
          },
        ],
      });
      expect(validGrammar.isValid).toBe(true);

      const invalidGrammar = await service.validateBundle({
        grammarTopics: [
          {
            code: 'grammar.present-simple',
            cefrLevel: 'A1',
            isLeaf: false,
            titleEn: 'Bad Hyphen',
            titleVi: 'Sai dấu gạch ngang',
          },
          {
            code: 'grammar.tense2',
            cefrLevel: 'A1',
            isLeaf: false,
            titleEn: 'Bad Digit',
            titleVi: 'Sai chứa số',
          },
        ],
      });
      expect(invalidGrammar.isValid).toBe(false);
      expect(invalidGrammar.errors.map((e) => e.path)).toEqual([
        'grammarTopics[0].code',
        'grammarTopics[1].code',
      ]);

      const invalidSpeaking = await service.validateBundle({
        speakingPrompts: [
          {
            code: 'ra-over-limit',
            mode: 'READ_ALOUD',
            title: 'Too long read aloud',
            text: 'a'.repeat(1001),
            maxDurationSeconds: 31,
            hints: ['h1', 'h2', 'h3', 'h4'],
            visualContext: 'v'.repeat(2001),
          },
          {
            code: 'topic-over-limit',
            mode: 'TOPIC',
            title: 'Too long topic',
            text: 'Talk about your hometown.',
            maxDurationSeconds: 61,
            hints: ['h1', 'h2', 'h3'],
          },
        ],
      });
      expect(invalidSpeaking.isValid).toBe(false);
      expect(invalidSpeaking.errors.map((e) => e.path)).toEqual(
        expect.arrayContaining([
          'speakingPrompts[0].text',
          'speakingPrompts[0].maxDurationSeconds',
          'speakingPrompts[0].hints',
          'speakingPrompts[0].visualContext',
          'speakingPrompts[1].maxDurationSeconds',
        ]),
      );

      const validSpeaking = await service.validateBundle({
        speakingPrompts: [
          {
            code: 'ra-ok',
            mode: 'READ_ALOUD',
            title: 'Valid Read Aloud',
            text: 'a'.repeat(1000),
            maxDurationSeconds: 30,
            hints: ['h1', 'h2', 'h3'],
            visualContext: 'v'.repeat(2000),
          },
          {
            code: 'topic-ok',
            mode: 'TOPIC',
            title: 'Valid Topic',
            text: 'Talk about travel.',
            maxDurationSeconds: 60,
            hints: ['Where', 'Who', 'Why'],
          },
        ],
      });
      expect(validSpeaking.isValid).toBe(true);
    });
  });

  describe('Wave 1 P0: Speaking scores, AssessmentItem clear-to-null, Speaking ML limits & contentVersion', () => {
    it('extractSpeakingOverallScore ưu tiên overall -> pronunciation -> overallScore -> score', () => {
      expect(
        extractSpeakingOverallScore({
          overall: 86.4,
          pronunciation: 72,
          overallScore: 65,
          score: 50,
        }),
      ).toBe(86.4);
      expect(
        extractSpeakingOverallScore({ overall: null, pronunciation: 73.6 }),
      ).toBe(73.6);
      expect(extractSpeakingOverallScore({ overallScore: 81 })).toBe(81);
      expect(extractSpeakingOverallScore({ score: '92.5' })).toBe(92.5);
      expect(extractSpeakingOverallScore({ overall: '84' })).toBe(84);
      expect(extractSpeakingOverallScore({ overall: 0 })).toBe(0);
      expect(
        extractSpeakingOverallScore({ overall: Number.NaN, pronunciation: 75 }),
      ).toBe(75);
      expect(
        extractSpeakingOverallScore({ overall: 'not-a-num', score: '68.5' }),
      ).toBe(68.5);
      expect(extractSpeakingOverallScore({ overall: '' })).toBeNull();
      expect(extractSpeakingOverallScore({ overall: Number.POSITIVE_INFINITY })).toBeNull();
      expect(extractSpeakingOverallScore(null)).toBeNull();
      expect(extractSpeakingOverallScore([])).toBeNull();
    });

    it('AdminUsersService.getUserDetail ánh xạ recentSpeaking[].overallScore bằng extractSpeakingOverallScore', async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'u-1',
            email: 'learner@example.com',
            name: 'Learner',
            avatarUrl: null,
            provider: AuthProvider.LOCAL,
            role: UserRole.LEARNER,
            status: UserStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            profile: { targetCefr: CefrLevel.B1, dailyGoalMinutes: 15, learningPurpose: null },
            _count: {
              learningAttempts: 0,
              placementSessions: 0,
              vocabularyDecks: 0,
              speakingSubmissions: 2,
            },
          }),
        },
        learningAttempt: { findMany: jest.fn().mockResolvedValue([]) },
        placementSession: { findMany: jest.fn().mockResolvedValue([]) },
        speakingSubmission: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'sub-1',
              status: 'SUCCEEDED',
              promptSnapshot: { title: 'Read Aloud 1' },
              result: { overall: 88.25, pronunciation: 80 },
              createdAt: new Date(),
            },
            {
              id: 'sub-2',
              status: 'SUCCEEDED',
              promptSnapshot: { title: 'Read Aloud Partial' },
              result: { overall: null, pronunciation: 74.5 },
              createdAt: new Date(),
            },
          ]),
        },
      };

      const usersService = new AdminUsersService(
        prisma as unknown as PrismaService,
        {} as PasswordService,
      );
      const detail = await usersService.getUserDetail('u-1');
      expect(detail.recentSpeaking.map((s) => s.overallScore)).toEqual([88.25, 74.5]);
    });

    it('AdminAnalyticsService.getDashboard dùng SQL ưu tiên overall -> pronunciation -> overallScore -> score ở cả 2 nhánh timeframe', async () => {
      const capturedSpeakingSqls: string[] = [];
      const prisma = {
        user: {
          count: jest.fn().mockResolvedValue(1),
          findMany: jest.fn().mockResolvedValue([]),
        },
        learningLesson: {
          count: jest.fn().mockResolvedValue(0),
          groupBy: jest.fn().mockResolvedValue([]),
        },
        learningUnit: { count: jest.fn().mockResolvedValue(0) },
        assessmentItem: {
          count: jest.fn().mockResolvedValue(0),
          groupBy: jest.fn().mockResolvedValue([]),
        },
        speakingPrompt: { count: jest.fn().mockResolvedValue(0) },
        curatedTopic: { count: jest.fn().mockResolvedValue(0) },
        grammarTopic: { count: jest.fn().mockResolvedValue(0) },
        learningAttempt: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
        placementSession: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
        $queryRaw: jest.fn(async (sql: Prisma.Sql) => {
          const text = sql.strings.join('?');
          if (text.includes('speaking_submissions')) {
            capturedSpeakingSqls.push(text);
            return [{ avg_score: 84.6, sample_count: BigInt(3) }];
          }
          return [];
        }),
      };

      const analytics = new AdminAnalyticsService(prisma as unknown as PrismaService);
      const dash30d = await analytics.getDashboard('30_DAYS', true);
      const dashAll = await analytics.getDashboard('ALL_TIME', true);

      expect(dash30d.masteryBySkill.find((m) => m.group === 'speaking')).toEqual({
        group: 'speaking',
        sampleCount: 3,
        accuracyPercent: 85,
      });
      expect(dashAll.masteryBySkill.find((m) => m.group === 'speaking')).toEqual({
        group: 'speaking',
        sampleCount: 3,
        accuracyPercent: 85,
      });

      expect(capturedSpeakingSqls).toHaveLength(2);
      expect(capturedSpeakingSqls[0]).toContain('ss.created_at >=');
      expect(capturedSpeakingSqls[1]).not.toContain('ss.created_at >=');
      for (const sql of capturedSpeakingSqls) {
        const idxOverall = sql.indexOf("ss.result->>'overall'");
        const idxPron = sql.indexOf("ss.result->>'pronunciation'");
        const idxOverallScore = sql.indexOf("ss.result->>'overallScore'");
        const idxScore = sql.indexOf("ss.result->>'score'");
        expect(idxOverall).toBeGreaterThan(-1);
        expect(idxPron).toBeGreaterThan(idxOverall);
        expect(idxOverallScore).toBeGreaterThan(idxPron);
        expect(idxScore).toBeGreaterThan(idxOverallScore);
        expect(sql).toContain("^[0-9]+(\\.[0-9]+)?$");
      }
    });

    it('UpdateAdminAssessmentItemDto chấp nhận null và updateAssessmentItem xoá trường tuỳ chọn về null không lỗi', async () => {
      const validDto = plainToInstance(UpdateAdminAssessmentItemDto, {
        passage: null,
        correctOption: null,
        explanation: null,
        audioUrl: null,
      });
      expect(await validate(validDto)).toHaveLength(0);

      const invalidDto = plainToInstance(UpdateAdminAssessmentItemDto, {
        passage: 12345,
      });
      expect((await validate(invalidDto)).length).toBeGreaterThan(0);

      const existingEssay = {
        id: 'item-essay-1',
        externalId: null,
        groupId: null,
        itemOrder: 1,
        bankVersion: null,
        skill: AssessmentSkill.WRITING,
        skillCode: 'writing.essay',
        cefrLevel: CefrLevel.B1,
        type: ItemType.ESSAY,
        usageScope: ItemUsageScope.MOCK_EXAM,
        passage: 'Old passage',
        prompt: 'Write about education.',
        options: null,
        correctOption: 'Old anchor',
        explanation: 'Old explanation',
        audioUrl: '/media/learning/v1/old.wav',
        rubricCriteria: { grammar: 25, taskResponse: 25 },
        irtA: 1,
        irtB: 0,
        irtC: 0.25,
        createdAt: new Date(),
        _count: { responses: 0, currentSessions: 0 },
      };
      const tx = {
        $queryRaw: jest.fn(async () => []),
        assessmentItem: {
          findUnique: jest.fn().mockResolvedValue(existingEssay),
          update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            ...existingEssay,
            ...data,
          })),
        },
      };
      const prisma = {
        $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
      };
      const matrix = { invalidateCache: jest.fn(async () => undefined) };
      const contentService = new AdminContentService(
        prisma as unknown as PrismaService,
        matrix as unknown as AssessmentMatrixService,
      );

      const updated = await contentService.updateAssessmentItem('item-essay-1', {
        passage: null,
        correctOption: null,
        explanation: null,
        audioUrl: null,
      });
      expect(updated.passage).toBeNull();
      expect(updated.correctOption).toBeNull();
      expect(updated.explanation).toBeNull();
      expect(updated.audioUrl).toBeNull();
      expect(updated.rubricCriteria).toEqual({ grammar: 25, taskResponse: 25 });
      expect(tx.assessmentItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passage: null,
            correctOption: null,
            explanation: null,
            audioUrl: null,
          }),
        }),
      );

      tx.assessmentItem.findUnique.mockResolvedValueOnce({
        ...existingEssay,
        id: 'item-mcq-1',
        skill: AssessmentSkill.READING,
        type: ItemType.MULTIPLE_CHOICE,
        options: ['A', 'B', 'C', 'D'],
        correctOption: 'A',
      });
      await expect(
        contentService.updateAssessmentItem('item-mcq-1', { correctOption: null }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Speaking DTO, AdminSpeakingService ML limits và không tăng contentVersion khi chỉ sửa metadata', async () => {
      const badCreate = plainToInstance(CreateAdminSpeakingPromptDto, {
        code: 'sp-limit-test',
        mode: SpeakingMode.TOPIC,
        title: 'Test',
        text: 'x'.repeat(1001),
        maxDurationSeconds: 61,
        hints: ['1', '2', '3', '4'],
        visualContext: 'v'.repeat(2001),
      });
      const createErrors = await validate(badCreate);
      expect(createErrors.map((e) => e.property)).toEqual(
        expect.arrayContaining(['text', 'maxDurationSeconds', 'hints', 'visualContext']),
      );

      const badUpdate = plainToInstance(UpdateAdminSpeakingPromptDto, {
        text: 'x'.repeat(1001),
        maxDurationSeconds: 61,
        hints: ['1', '2', '3', '4'],
        visualContext: 'v'.repeat(2001),
      });
      const updateErrors = await validate(badUpdate);
      expect(updateErrors.map((e) => e.property)).toEqual(
        expect.arrayContaining(['text', 'maxDurationSeconds', 'hints', 'visualContext']),
      );

      const existingPrompt = {
        id: 'sp-10',
        code: 'tt-01',
        mode: SpeakingMode.TONGUE_TWISTER,
        title: 'Old title',
        text: 'She sells seashells by the seashore.',
        difficulty: 2,
        maxDurationSeconds: 25,
        hints: ['Focus on sh', 'Keep steady pace'],
        sampleAsset: null,
        imageUrl: null,
        visualContext: null,
        preparation: { goal: 'Practice /s/ and /sh/', vocabulary: [], phrases: [] },
        linkedReadAloudCodes: [],
        contentVersion: 3,
        sortOrder: 1,
        published: true,
        _count: { submissions: 0 },
      };

      const prisma = {
        speakingPrompt: {
          findUnique: jest.fn(),
          aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 1 } }),
          create: jest.fn(),
          update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            ...existingPrompt,
            ...data,
            contentVersion:
              data.contentVersion !== undefined
                ? existingPrompt.contentVersion + 1
                : existingPrompt.contentVersion,
            _count: { submissions: 0 },
          })),
        },
      };
      const speakingAdmin = new AdminSpeakingService(prisma as unknown as PrismaService);

      prisma.speakingPrompt.findUnique.mockResolvedValueOnce(null);
      await expect(
        speakingAdmin.createPrompt({
          code: 'ra-too-long',
          mode: SpeakingMode.READ_ALOUD,
          title: 'Too long',
          text: 'Hello world',
          maxDurationSeconds: 31,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ADMIN_INVALID_SPEAKING_DURATION' }),
      });

      prisma.speakingPrompt.findUnique.mockResolvedValueOnce(existingPrompt);
      await expect(
        speakingAdmin.updatePrompt('sp-10', { maxDurationSeconds: 45 }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ADMIN_INVALID_SPEAKING_DURATION' }),
      });

      // Metadata-only edit (even when unchanged content fields are sent by modal) does NOT bump contentVersion
      prisma.speakingPrompt.findUnique.mockResolvedValueOnce(existingPrompt);
      const metaRes = await speakingAdmin.updatePrompt('sp-10', {
        title: 'Updated title only',
        sortOrder: 5,
        difficulty: 3,
        published: false,
        linkedReadAloudCodes: ['ra-01'],
        text: 'She sells seashells by the seashore.',
        mode: SpeakingMode.TONGUE_TWISTER,
        hints: ['Focus on sh', 'Keep steady pace'],
        visualContext: null,
        imageUrl: null,
        preparation: { goal: 'Practice /s/ and /sh/', vocabulary: [], phrases: [] },
      });
      expect(metaRes.contentVersion).toBe(3);
      expect(prisma.speakingPrompt.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ contentVersion: expect.anything() }),
        }),
      );

      // Actual content change DOES bump contentVersion
      prisma.speakingPrompt.findUnique.mockResolvedValueOnce(existingPrompt);
      const contentRes = await speakingAdmin.updatePrompt('sp-10', {
        text: 'Peter Piper picked a peck of pickled peppers.',
      });
      expect(contentRes.contentVersion).toBe(4);
      expect(prisma.speakingPrompt.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contentVersion: { increment: 1 } }),
        }),
      );
    });

    it('SpeakingService.upload áp dụng clamp maxDurationSeconds từ promptSnapshot', async () => {
      const prisma = {
        speakingSubmission: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn(),
        },
      };
      const config = { get: jest.fn(() => 'true') };
      const speakingService = new SpeakingService(
        prisma as unknown as PrismaService,
        {} as MlClientService,
        config as unknown as ConfigService,
      );

      prisma.speakingSubmission.findFirst.mockResolvedValueOnce({
        id: 'sub-10s',
        userId: 'u-1',
        promptId: 'p-1',
        status: 'CREATED',
        audioHash: null,
        promptSnapshot: {
          text: 'Hello',
          mode: SpeakingMode.READ_ALOUD,
          maxDurationSeconds: 10,
        },
      });
      await expect(
        speakingService.upload('u-1', 'sub-10s', buildMono16kWav(11)),
      ).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({
          code: 'invalid_audio',
          message: expect.stringContaining('10 giây'),
        }),
      });

      prisma.speakingSubmission.findFirst.mockResolvedValueOnce({
        id: 'sub-clamp-high',
        userId: 'u-1',
        promptId: 'p-1',
        status: 'CREATED',
        audioHash: null,
        promptSnapshot: {
          text: 'Hello',
          mode: SpeakingMode.READ_ALOUD,
          maxDurationSeconds: 120,
        },
      });
      await expect(
        speakingService.upload('u-1', 'sub-clamp-high', buildMono16kWav(31)),
      ).rejects.toBeInstanceOf(HttpException);

      prisma.speakingSubmission.findFirst.mockResolvedValueOnce({
        id: 'sub-clamp-high-msg',
        userId: 'u-1',
        promptId: 'p-1',
        status: 'CREATED',
        audioHash: null,
        promptSnapshot: {
          text: 'Hello',
          mode: SpeakingMode.READ_ALOUD,
          maxDurationSeconds: 120,
        },
      });
      await expect(
        speakingService.upload('u-1', 'sub-clamp-high-msg', buildMono16kWav(31)),
      ).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({
          code: 'invalid_audio',
          message: expect.stringContaining('30 giây'),
        }),
      });

      prisma.speakingSubmission.findFirst.mockResolvedValueOnce({
        id: 'sub-clamp-low',
        userId: 'u-1',
        promptId: 'p-1',
        status: 'CREATED',
        audioHash: null,
        promptSnapshot: {
          text: 'Hello',
          mode: SpeakingMode.READ_ALOUD,
          maxDurationSeconds: 2,
        },
      });
      await expect(
        speakingService.upload('u-1', 'sub-clamp-low', buildMono16kWav(6)),
      ).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({
          code: 'invalid_audio',
          message: expect.stringContaining('5 giây'),
        }),
      });
    });
  });

  describe('Orphan Media Dry-run & Cleanup + Audit Metadata', () => {
    it('extractMediaKeysFromUnknown trích xuất chuẩn mọi tham chiếu /media/... lồng sâu và bỏ qua đường dẫn nguy hiểm', () => {
      const keys = new Set<string>();
      extractMediaKeysFromUnknown(
        {
          avatarUrl: '/media/learning/v1/images/admin-avatar-112233.png',
          fullCloudUrl:
            'https://lingoroad-api-wfpi3gzq.azurewebsites.net/media/placement/listen-b1-01.wav',
          directKey: 'learning/v1/dialog-a2-99.wav',
          nestedLesson: {
            steps: [
              {
                options: [
                  { imageUrl: '/media/learning/v1/images/opt-a-001122.webp' },
                ],
              },
            ],
          },
          unsafeTraversal: '/media/learning/v1/../secrets/key.png',
          unmanagedPrefix: '/media/other-bucket/file.png',
        },
        keys,
      );

      expect(Array.from(keys).sort()).toEqual([
        'learning/v1/dialog-a2-99.wav',
        'learning/v1/images/admin-avatar-112233.png',
        'learning/v1/images/opt-a-001122.webp',
        'placement/listen-b1-01.wav',
      ]);
    });

    it('scanOrphanMedia & cleanupOrphanMedia bảo vệ file đang tham chiếu, file < 24h, và tái kiểm tra DB ngay lúc xóa', async () => {
      const now = Date.now();
      const twoDaysAgo = new Date(now - 48 * 3600_000);
      const twoHoursAgo = new Date(now - 2 * 3600_000);

      const blobs = [
        {
          key: 'learning/v1/images/in-lesson-111.png',
          size: 1200,
          lastModified: twoDaysAgo,
        },
        {
          key: 'learning/v1/images/in-submission-snapshot-222.jpg',
          size: 2400,
          lastModified: twoDaysAgo,
        },
        {
          key: 'learning/v1/images/recent-upload-333.webp',
          size: 3600,
          lastModified: twoHoursAgo,
        },
        {
          key: 'learning/v1/orphan-old-444.wav',
          size: 5000,
          lastModified: twoDaysAgo,
        },
        {
          key: 'placement/orphan-race-555.wav',
          size: 7000,
          lastModified: twoDaysAgo,
        },
      ];

      let raceBlobReferenced = false;
      const prisma = {
        user: { findMany: jest.fn(async () => []) },
        learningLesson: {
          findMany: jest.fn(async () => [
            {
              content: {
                coverImageUrl: '/media/learning/v1/images/in-lesson-111.png',
              },
            },
          ]),
        },
        learningAttempt: { findMany: jest.fn(async () => []) },
        assessmentItem: {
          findMany: jest.fn(async () =>
            raceBlobReferenced
              ? [
                  {
                    audioUrl: '/media/placement/orphan-race-555.wav',
                    options: null,
                    rubricCriteria: null,
                  },
                ]
              : [],
          ),
        },
        assessmentItemGroup: { findMany: jest.fn(async () => []) },
        curatedTopicWord: { findMany: jest.fn(async () => []) },
        vocabularyWord: { findMany: jest.fn(async () => []) },
        vocabularyReviewItem: { findMany: jest.fn(async () => []) },
        speakingPrompt: { findMany: jest.fn(async () => []) },
        speakingSubmission: {
          findMany: jest.fn(async () => [
            {
              promptSnapshot: {
                imageUrl:
                  '/media/learning/v1/images/in-submission-snapshot-222.jpg',
              },
              result: null,
            },
          ]),
        },
        voiceConversation: { findMany: jest.fn(async () => []) },
      };

      const storage = {
        storageMode: jest.fn(() => 'azure' as const),
        listManagedBlobs: jest.fn(async () => blobs),
        deleteBlob: jest.fn(async () => true),
      };

      const mediaService = new AdminMediaService(
        storage as unknown as MediaStorageService,
        prisma as unknown as PrismaService,
      );

      const dryRun = await mediaService.scanOrphanMedia(24);
      expect(dryRun.totalBlobs).toBe(5);
      expect(dryRun.referencedCount).toBe(2);
      expect(dryRun.protectedRecentCount).toBe(1);
      expect(dryRun.orphanCount).toBe(2);
      expect(dryRun.orphanBytes).toBe(12000);
      expect(dryRun.orphans.map((o) => o.key)).toEqual([
        'learning/v1/orphan-old-444.wav',
        'placement/orphan-race-555.wav',
      ]);
      expect(storage.deleteBlob).not.toHaveBeenCalled();

      // Simulate Admin saving an AssessmentItem referencing orphan-race-555.wav right before cleanup!
      raceBlobReferenced = true;

      const cleaned = await mediaService.cleanupOrphanMedia({
        keys: [
          'learning/v1/orphan-old-444.wav',
          'placement/orphan-race-555.wav',
        ],
        minAgeHours: 24,
      });
      expect(cleaned.deletedCount).toBe(1);
      expect(cleaned.deletedBytes).toBe(5000);
      expect(cleaned.skippedCount).toBe(1);
      expect(cleaned.deletedKeys).toEqual(['learning/v1/orphan-old-444.wav']);
      expect(storage.deleteBlob).toHaveBeenCalledTimes(1);
      expect(storage.deleteBlob).toHaveBeenCalledWith(
        'learning/v1/orphan-old-444.wav',
      );
    });

    it('AdminAuditInterceptor ghi nhận ADMIN_UPDATE_PROFILE và CLEANUP_ORPHAN_MEDIA nhưng bỏ qua GET /admin/media/orphans', async () => {
      const record = jest.fn(async () => undefined);
      const emit = jest.fn();
      const interceptor = new AdminAuditInterceptor(
        {
          record,
          computeCompactDiff: () => ({ diff: {} }),
        } as unknown as AdminAuditService,
        { emit } as unknown as EventEmitter2,
      );

      const runHttp = async (
        method: string,
        originalUrl: string,
        body: unknown,
        responseData: unknown,
      ) => {
        const req = {
          method,
          originalUrl,
          url: originalUrl,
          ip: '203.0.113.10',
          user: {
            sub: 'admin-1',
            email: 'admin@lingoroad.local',
            role: UserRole.ADMIN,
          },
          body,
          query: {},
          params: {},
        };
        const ctx = {
          getType: () => 'http',
          switchToHttp: () => ({
            getRequest: () => req,
            getResponse: () => ({ statusCode: 200 }),
          }),
        };
        await lastValueFrom(
          interceptor.intercept(ctx as never, {
            handle: () => of({ success: true, data: responseData }),
          }),
        );
      };

      // 1. Read-only Dry-run GET must NOT write audit log
      await runHttp('GET', '/admin/media/orphans?minAgeHours=24', undefined, {
        orphanCount: 2,
      });
      expect(record).not.toHaveBeenCalled();

      // 2. PATCH /admin/auth/me logs ADMIN_UPDATE_PROFILE (AUTH)
      await runHttp(
        'PATCH',
        '/admin/auth/me',
        { name: 'New Admin' },
        { id: 'admin-1', name: 'New Admin' },
      );
      expect(record).toHaveBeenLastCalledWith(
        expect.objectContaining({
          action: 'ADMIN_UPDATE_PROFILE',
          resourceType: 'AUTH',
          resourceId: 'admin-1',
        }),
      );

      // 3. POST /admin/media/orphans/cleanup logs CLEANUP_ORPHAN_MEDIA with summary snapshot
      await runHttp(
        'POST',
        '/admin/media/orphans/cleanup',
        { minAgeHours: 24 },
        {
          minAgeHours: 24,
          deletedCount: 2,
          deletedBytes: 8192,
          skippedCount: 0,
          deletedKeys: ['learning/v1/a.wav', 'placement/b.wav'],
        },
      );
      expect(record).toHaveBeenLastCalledWith(
        expect.objectContaining({
          action: 'CLEANUP_ORPHAN_MEDIA',
          resourceType: 'MEDIA',
          payloadSnapshot: {
            minAgeHours: 24,
            deletedCount: 2,
            deletedBytes: 8192,
            skippedCount: 0,
            deletedKeys: ['learning/v1/a.wav', 'placement/b.wav'],
          },
        }),
      );
      expect(emit).not.toHaveBeenCalled();
    });
  });
});
