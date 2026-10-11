import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import {
  AdvisorPathEntry,
  AdvisorResponse,
  AweResponse,
  CatCandidate,
  CatHistoryEntry,
  CatSelectResponse,
  ExerciseResponse,
  KtEvent,
  KtPredictResponse,
  SpeechScoreResponse,
} from './interfaces/ml-client.interface';
import { InProcessCatFallback } from './fallbacks/in-process-cat.fallback';

@Injectable()
export class MlClientService {
  private readonly logger = new Logger(MlClientService.name);
  private readonly baseUrl: string;
  private readonly internalToken: string;
  private readonly defaultTimeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly inProcessCatFallback: InProcessCatFallback,
  ) {
    this.baseUrl = this.configService.get<string>(
      'ML_SERVICE_URL',
      'http://localhost:8001',
    );
    this.internalToken = this.configService.get<string>(
      'ML_INTERNAL_TOKEN',
      '',
    );
    this.defaultTimeoutMs = this.configService.get<number>(
      'ML_SERVICE_TIMEOUT_MS',
      15000,
    );
  }

  private getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...customHeaders };
    if (this.internalToken) {
      headers['x-internal-token'] = this.internalToken;
    }
    return headers;
  }

  /**
   * Check ML Microservice Health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/health`, {
          timeout: 3000,
        }),
      );
      return res.status === 200 && res.data?.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Check ML Component Readiness
   */
  async checkReady(): Promise<Record<string, unknown> | null> {
    try {
      const res = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/ready`, {
          timeout: 5000,
        }),
      );
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * CAT (Computerized Adaptive Testing) Selection & EAP Theta Estimation
   */
  async selectNextCatItem(
    history: CatHistoryEntry[],
    candidates: CatCandidate[],
  ): Promise<CatSelectResponse> {
    try {
      const res = await firstValueFrom(
        this.httpService.post<CatSelectResponse>(
          `${this.baseUrl}/cat/select`,
          { history, candidates },
          {
            headers: this.getHeaders({ 'Content-Type': 'application/json' }),
            timeout: this.defaultTimeoutMs,
          },
        ),
      );
      return res.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `ML microservice /cat/select failed (${message}). Activating In-Process CAT EAP Fallback.`,
      );
      return this.inProcessCatFallback.select(history, candidates);
    }
  }

  /**
   * Speech Pronunciation Scoring via Faster-Whisper & Gemini Feedback
   */
  async scoreSpeaking(
    audioBuffer: Buffer,
    filename: string,
    promptText: string,
    contentType: string = 'audio/wav',
  ): Promise<SpeechScoreResponse> {
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename,
      contentType,
    });
    form.append('prompt_text', promptText);

    const res = await firstValueFrom(
      this.httpService.post<SpeechScoreResponse>(
        `${this.baseUrl}/speech/score`,
        form,
        {
          headers: this.getHeaders(form.getHeaders()),
          timeout: Math.max(this.defaultTimeoutMs, 30000),
          maxBodyLength: 15 * 1024 * 1024,
        },
      ),
    );
    return res.data;
  }

  /**
   * AI Learning Advisor Consultation
   */
  async askAdvisor(
    question: string,
    path: AdvisorPathEntry[],
    locale: string = 'vi',
  ): Promise<AdvisorResponse> {
    const res = await firstValueFrom(
      this.httpService.post<AdvisorResponse>(
        `${this.baseUrl}/llm/advisor`,
        { question, path, locale },
        {
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          timeout: Math.max(this.defaultTimeoutMs, 25000),
        },
      ),
    );
    return res.data;
  }

  /**
   * Dynamic Exercise Generation
   */
  async generateExercises(
    skillCode: string,
    skillName: string,
    cefr: string,
    type: string = 'mcq',
    count: number = 3,
  ): Promise<ExerciseResponse> {
    const res = await firstValueFrom(
      this.httpService.post<ExerciseResponse>(
        `${this.baseUrl}/llm/exercises`,
        {
          skill_code: skillCode,
          skill_name: skillName,
          cefr,
          type,
          count,
        },
        {
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          timeout: Math.max(this.defaultTimeoutMs, 25000),
        },
      ),
    );
    return res.data;
  }

  /**
   * Automated Writing Evaluation (AWE)
   */
  async evaluateWriting(
    taskPrompt: string,
    essay: string,
  ): Promise<AweResponse> {
    const res = await firstValueFrom(
      this.httpService.post<AweResponse>(
        `${this.baseUrl}/llm/awe`,
        { task_prompt: taskPrompt, essay },
        {
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          timeout: Math.max(this.defaultTimeoutMs, 25000),
        },
      ),
    );
    return res.data;
  }

  /**
   * Knowledge Tracing Next Probability Prediction
   */
  async predictKt(sequence: KtEvent[]): Promise<KtPredictResponse> {
    const res = await firstValueFrom(
      this.httpService.post<KtPredictResponse>(
        `${this.baseUrl}/kt/predict`,
        { sequence },
        {
          headers: this.getHeaders({ 'Content-Type': 'application/json' }),
          timeout: this.defaultTimeoutMs,
        },
      ),
    );
    return res.data;
  }
}
