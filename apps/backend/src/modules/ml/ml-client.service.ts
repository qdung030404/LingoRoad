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
import { ReadAloudResult } from '../speaking/speaking.dto';

@Injectable()
export class MlClientService {
  private readonly logger = new Logger(MlClientService.name);
  private readonly baseUrl: string;
  private readonly internalToken: string;
  private readonly defaultTimeoutMs: number;
  readonly speakingProfile: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly inProcessCatFallback: InProcessCatFallback,
  ) {
    this.speakingProfile = this.configService.get<string>('SPEAKING_SCORING_PROFILE', 'read-aloud-v2');
    if (!['read-aloud-v1', 'read-aloud-v2'].includes(this.speakingProfile)) {
      throw new Error('Invalid SPEAKING_SCORING_PROFILE');
    }
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
            timeout: 3000,
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

  async scoreTopic(audio: Buffer): Promise<Record<string, any>> {
    const form = new FormData();
    form.append('file', audio, { filename: 'recording.wav', contentType: 'audio/wav' });
    form.append('prompt_text', '');
    const response = await firstValueFrom(this.httpService.post(
      `${this.baseUrl}/speech/topic/score`, form, { headers: this.getHeaders(form.getHeaders()),
        timeout: 90000, maxBodyLength: 3 * 1024 * 1024, maxRedirects: 0 }));
    return response.data;
  }

  async scoreTopicContent(topic: string, hints: string[], transcript: string, durationSeconds: number): Promise<Record<string, any>> {
    const response = await firstValueFrom(this.httpService.post(`${this.baseUrl}/speech/topic/content`,
      { topic, hints, transcript, durationSeconds }, { headers: this.getHeaders(), timeout: 30000, maxRedirects: 0 }));
    return response.data;
  }

  async translateConversation(text: string): Promise<string> {
    const response = await firstValueFrom(this.httpService.post(`${this.baseUrl}/speech/conversation/translate`,
      { text }, { headers: this.getHeaders(), timeout: 30000, maxRedirects: 0 }));
    const translated = response.data?.translationVi;
    if (typeof translated !== 'string' || !translated.trim() || translated.length > 24000) throw new Error('Invalid translation');
    return translated.trim();
  }

  async scoreConversationAudio(audio: Buffer): Promise<Record<string, any>> {
    const response = await firstValueFrom(this.httpService.post(
      `${this.baseUrl}/speech/conversation/score`, audio,
      { headers: this.getHeaders({ 'Content-Type': 'audio/wav' }), timeout: 210000,
        maxBodyLength: 6 * 1024 * 1024, maxRedirects: 0 }));
    return response.data;
  }

  async scoreConversationContent(topic: string, turns: { itemId: string; role: string; transcript: string }[]): Promise<Record<string, any>> {
    const response = await firstValueFrom(this.httpService.post(
      `${this.baseUrl}/speech/conversation/content`, { topic, turns, perTurn: true },
      { headers: this.getHeaders(), timeout: 240000, maxRedirects: 0 }));
    return response.data;
  }

  async scoreReadAloud(audio: Buffer, promptText: string, profile = this.speakingProfile): Promise<ReadAloudResult> {
    const form = new FormData();
    form.append('file', audio, { filename: 'recording.wav', contentType: 'audio/wav' });
    form.append('prompt_text', promptText);
    const response = await firstValueFrom(this.httpService.post<ReadAloudResult>(
      `${this.baseUrl}/speech/read-aloud/score`, form, { headers: this.getHeaders({ ...form.getHeaders(), 'x-speaking-profile': profile }),
        timeout: 50000, maxBodyLength: 3 * 1024 * 1024, maxRedirects: 0 }));
    return response.data;
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
