import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { MlClientService } from './ml-client.service';
import { InProcessCatFallback } from './fallbacks/in-process-cat.fallback';
import {
  CatCandidate,
  CatHistoryEntry,
  CatSelectResponse,
} from './interfaces/ml-client.interface';

describe('MlClientService & InProcessCatFallback', () => {
  let service: MlClientService;
  let fallback: InProcessCatFallback;
  let httpService: HttpService;

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: unknown) => {
      if (key === 'ML_SERVICE_URL') return 'http://localhost:8001';
      if (key === 'ML_INTERNAL_TOKEN') return 'test_secret_token';
      if (key === 'ML_SERVICE_TIMEOUT_MS') return 5000;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MlClientService,
        InProcessCatFallback,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MlClientService>(MlClientService);
    fallback = module.get<InProcessCatFallback>(InProcessCatFallback);
    httpService = module.get<HttpService>(HttpService);
  });

  describe('InProcessCatFallback', () => {
    it('should compute initial theta near 0 for empty history', () => {
      const candidates: CatCandidate[] = [
        { item_id: 'item1', a: 1.0, b: 0.0, c: 0.25 },
        { item_id: 'item2', a: 1.5, b: 2.0, c: 0.25 },
      ];
      const result = fallback.select([], candidates);

      expect(result.theta).toBeCloseTo(0.0, 1);
      expect(result.se).toBeGreaterThan(0.5);
      expect(result.next_item_id).toBe('item1'); // b=0.0 has highest info at theta=0
    });

    it('should increase theta when answers are correct', () => {
      const history: CatHistoryEntry[] = [
        { a: 1.2, b: 0.0, c: 0.25, correct: true },
        { a: 1.5, b: 1.0, c: 0.25, correct: true },
        { a: 1.8, b: 1.5, c: 0.25, correct: true },
      ];
      const candidates: CatCandidate[] = [
        { item_id: 'easy_item', a: 1.0, b: -1.0, c: 0.25 },
        { item_id: 'hard_item', a: 1.5, b: 1.8, c: 0.25 },
      ];
      const result = fallback.select(history, candidates);

      expect(result.theta).toBeGreaterThan(0.8);
      expect(result.next_item_id).toBe('hard_item'); // Higher difficulty matches higher theta
    });
  });

  describe('MlClientService', () => {
    it('sends the selected speaking profile and returns decimal scores verbatim', async () => {
      const config = { get: (key: string, fallback: unknown) => key === 'SPEAKING_SCORING_PROFILE' ? 'read-aloud-v2' : fallback };
      const client = new MlClientService(httpService, config as ConfigService, fallback);
      const result = { pronunciation: 41.375, prosody: 40.125 };
      mockHttpService.post.mockReturnValue(of({ data: result }));
      expect(await client.scoreReadAloud(Buffer.from('audio'), 'Hello!')).toBe(result);
      expect(mockHttpService.post.mock.calls[0][2].headers['x-speaking-profile']).toBe('read-aloud-v2');
    });
    it('enables the complete assessment profile by default', () => {
      const config = { get: (_key: string, fallback: unknown) => fallback };
      const client = new MlClientService(httpService, config as ConfigService, fallback);
      expect(client.speakingProfile).toBe('read-aloud-v2');
    });
    it('rejects unknown scoring profiles at startup', () => {
      const config = { get: () => 'unknown-profile' };
      expect(() => new MlClientService(httpService, config as unknown as ConfigService, fallback)).toThrow('Invalid SPEAKING_SCORING_PROFILE');
    });
    it('should check health successfully', async () => {
      const response: AxiosResponse = {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.get.mockReturnValue(of(response));

      const isHealthy = await service.checkHealth();
      expect(isHealthy).toBe(true);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'http://localhost:8001/health',
        expect.any(Object),
      );
    });

    it('should return CAT selection from ML service on HTTP 200', async () => {
      const mlResponse: CatSelectResponse = {
        theta: 0.85,
        se: 0.35,
        next_item_id: 'q_advanced',
      };
      const response: AxiosResponse = {
        data: mlResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValue(of(response));

      const history: CatHistoryEntry[] = [{ a: 1.0, b: 0.0, c: 0.2, correct: true }];
      const candidates: CatCandidate[] = [{ item_id: 'q_advanced', a: 1.5, b: 0.8, c: 0.2 }];

      const result = await service.selectNextCatItem(history, candidates);
      expect(result).toEqual(mlResponse);
    });

    it('should gracefully fallback to InProcessCatFallback when ML service fails', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Connection refused')),
      );

      const history: CatHistoryEntry[] = [
        { a: 1.0, b: 0.0, c: 0.25, correct: true },
      ];
      const candidates: CatCandidate[] = [
        { item_id: 'cand_1', a: 1.0, b: 0.5, c: 0.25 },
      ];

      const result = await service.selectNextCatItem(history, candidates);

      expect(result).toBeDefined();
      expect(result.next_item_id).toBe('cand_1');
      expect(result.theta).toBeGreaterThan(0.0);
    });

    it('should evaluate CEFR writing successfully via ML service', async () => {
      const mockResult = {
        level_evaluation: {
          status: 'MEETS_EXPECTATIONS' as const,
          summary_vi: 'Bài viết đạt yêu cầu.',
          encouragement_vi: 'Cố gắng phát huy!',
        },
        grammar_checklist: [
          {
            grammar_point: 'Thì tương lai đơn',
            status: 'ATTEMPTED_WITH_ERRORS' as const,
            evidence_sentence: 'I will going to school.',
            feedback_vi: 'Sai cấu trúc thì tương lai đơn.',
          },
        ],
        improvement_steps: ['Ôn tập lại thì tương lai đơn.'],
        feedback: [
          {
            original_sentence: 'I will going to school.',
            issue_vi: 'Sai cấu trúc thì tương lai đơn.',
            suggestion: 'I will go to school.',
            explanation_vi: 'Sau will là động từ nguyên mẫu.',
          },
        ],
        overall_comment_vi: 'Bài viết đạt yêu cầu.',
      };

      const response: AxiosResponse = {
        data: mockResult,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockHttpService.post.mockReturnValue(of(response));

      const result = await service.evaluateCefrWriting({
        task_type: 'TASK_2',
        task_prompt: 'Write an essay about technology.',
        essay: 'Technology has transformed our daily lives in numerous aspects...',
        target_cefr: 'B2',
      });

      expect(result).toEqual(mockResult);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:8001/ml/awe/evaluate-cefr',
        {
          task_type: 'TASK_2',
          task_prompt: 'Write an essay about technology.',
          essay: 'Technology has transformed our daily lives in numerous aspects...',
          target_cefr: 'B2',
          target_grammars: [],
        },
        expect.any(Object),
      );
    });
  });
});
