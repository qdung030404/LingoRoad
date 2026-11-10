import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SpeakingMode } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MlClientService } from '../ml/ml-client.service';
import { CreateSpeakingDto, ReadAloudResult } from './speaking.dto';
import { validateSpeakingWav } from './wav';

@Injectable()
export class SpeakingService {
  private readonly logger = new Logger(SpeakingService.name);
  constructor(private readonly prisma: PrismaService, private readonly ml: MlClientService, private readonly config: ConfigService) {}
  private enabled() { return String(this.config.get('SPEAKING_ENABLED', 'false')).toLowerCase() === 'true'; }
  private modeEnabled(mode: SpeakingMode) {
    const flag = mode === SpeakingMode.TOPIC ? 'SPEAKING_TOPIC_ENABLED' : mode === SpeakingMode.TONGUE_TWISTER ? 'SPEAKING_GAME_ENABLED' : 'SPEAKING_READ_ALOUD_ENABLED';
    return this.enabled() && String(this.config.get(flag, mode === SpeakingMode.READ_ALOUD ? 'true' : 'false')).toLowerCase() === 'true';
  }
  private requireEnabled() { if (!this.enabled()) throw new HttpException({ code: 'speaking_disabled', message: 'Tính năng nộp bài nói đang tạm đóng.' }, 503); }
  private conflict() { throw new HttpException({ code: 'speaking_conflict', message: 'Yêu cầu này đã gắn với nội dung khác.' }, 409); }
  private missing(): never { throw new HttpException({ code: 'speaking_not_found', message: 'Không tìm thấy bài nói.' }, 404); }
  async prompts(mode: SpeakingMode = SpeakingMode.READ_ALOUD) {
    return { enabled: this.modeEnabled(mode), assessmentProfile: this.ml.speakingProfile ?? 'read-aloud-v1', items: await this.prisma.speakingPrompt.findMany({ where: { published: true, mode }, orderBy: { sortOrder: 'asc' } }) };
  }
  async create(userId: string, dto: CreateSpeakingDto) {
    this.requireEnabled();
    const old = await this.prisma.speakingSubmission.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId: dto.clientRequestId } } });
    if (old) { if (old.promptId !== dto.promptId) this.conflict(); return this.detail(userId, old.id); }
    const prompt = await this.prisma.speakingPrompt.findFirst({ where: { id: dto.promptId, published: true } });
    if (!prompt) this.missing();
    if (!this.modeEnabled(prompt.mode)) {
      throw new HttpException({ code: 'speaking_mode_unavailable', message: 'Chế độ luyện nói này đang được chuẩn bị.' }, 503);
    }
    if (prompt.mode === SpeakingMode.TONGUE_TWISTER) await this.requireUnlocked(userId, prompt.id);
    try {
      return await this.prisma.speakingSubmission.create({ data: { userId, promptId: prompt.id, clientRequestId: dto.clientRequestId,
        promptSnapshot: { text: prompt.text, title: prompt.title, mode: prompt.mode, difficulty: prompt.difficulty, hints: prompt.hints, maxDurationSeconds: prompt.maxDurationSeconds, sampleAsset: prompt.sampleAsset, contentVersion: prompt.contentVersion, assessmentProfile: prompt.mode === SpeakingMode.TOPIC ? 'topic-speaking-v1' : prompt.mode === SpeakingMode.TONGUE_TWISTER ? 'read-aloud-v2' : this.ml.speakingProfile } } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.speakingSubmission.findUniqueOrThrow({ where: { userId_clientRequestId: { userId, clientRequestId: dto.clientRequestId } } });
        if (winner.promptId !== dto.promptId) this.conflict();
        return this.detail(userId, winner.id);
      }
      throw error;
    }
  }
  private async expire(userId: string) {
    const candidates = await this.prisma.speakingSubmission.findMany({ where: { userId, status: 'PROCESSING',
      processingAt: { lt: new Date(Date.now() - 120000) } }, select: { id: true, processingAt: true, promptSnapshot: true, result: true } });
    const expired = candidates.filter(row => (row.promptSnapshot as { mode?: string }).mode !== 'TOPIC' ||
      (row.processingAt && row.processingAt.getTime() < Date.now() - 180000));
    for (const row of expired) {
      const result = row.result as Record<string, any> | null;
      const interrupted = result?.content?.status === 'processing'
        ? { ...result, content: { status: 'unavailable', errorCode: 'content_interrupted' } } : undefined;
      await this.prisma.speakingSubmission.updateMany({ where: { id: row.id, userId, status: 'PROCESSING' },
        data: { status: 'UNKNOWN', errorCode: 'processing_expired', completedAt: new Date(),
          ...(interrupted ? { result: interrupted as Prisma.InputJsonValue } : {}) } });
    }
  }
  async detail(userId: string, id: string) {
    await this.expire(userId);
    const row = await this.prisma.speakingSubmission.findFirst({ where: { id, userId } });
    return row ?? this.missing();
  }
  async history(userId: string, cursor?: string, mode?: SpeakingMode) {
    await this.expire(userId);
    const anchor = cursor ? await this.prisma.speakingSubmission.findFirst({ where: { id: cursor, userId } }) : null;
    if (cursor && !anchor) this.missing();
    if (anchor && mode && ((anchor.promptSnapshot as { mode?: SpeakingMode }).mode ?? SpeakingMode.READ_ALOUD) !== mode) this.missing();
    const rows = await this.prisma.speakingSubmission.findMany({ where: { userId, ...(mode ? { prompt: { mode } } : {}), ...(anchor ? { OR: [
      { createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } },
    ] } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21 });
    const items = rows.slice(0, 20);
    return { items, nextCursor: rows.length > 20 ? items[19].id : null };
  }
  async upload(userId: string, id: string, audio?: Buffer) {
    let row = await this.detail(userId, id);
    if (!audio) throw new HttpException({ code: 'audio_required', message: 'Vui lòng gửi bản thu.' }, 422);
    const hash = createHash('sha256').update(audio).digest('hex');
    if (row.audioHash) { if (row.audioHash !== hash) this.conflict(); return row; }
    this.requireEnabled();
    const snapshot = row.promptSnapshot as { text: string; mode?: SpeakingMode; hints?: string[]; contentVersion?: number; assessmentProfile?: string };
    const mode = snapshot.mode ?? SpeakingMode.READ_ALOUD;
    if (!this.modeEnabled(mode)) throw new HttpException({ code: 'speaking_disabled' }, 503);
    validateSpeakingWav(audio, mode === SpeakingMode.TOPIC ? 60 : 30);
    const claimed = await this.prisma.speakingSubmission.updateMany({ where: { id, userId, status: 'CREATED', audioHash: null },
      data: { status: 'PROCESSING', audioHash: hash, processingAt: new Date() } });
    if (!claimed.count) {
      row = await this.detail(userId, id);
      if (row.audioHash !== hash) this.conflict();
      return row;
    }
    const started = Date.now();
    this.logger.log(JSON.stringify({ event: 'speaking_provider_call', submissionId: id, count: 1, assessmentProfile: snapshot.assessmentProfile ?? this.ml.speakingProfile ?? 'read-aloud-v1' }));
    try {
      if (mode === SpeakingMode.TOPIC) {
        await this.processTopic(userId, id, audio, hash, snapshot.text, snapshot.hints ?? []);
        this.logResult(id, started, (await this.detail(userId, id)).status, undefined, undefined, 'topic-speaking-v1');
        return this.detail(userId, id);
      }
      const result = await this.ml.scoreReadAloud(audio, snapshot.text, snapshot.assessmentProfile);
      if (!validReadAloudResult(result) ||
          ((result.assessmentProfile ?? 'read-aloud-v1') !== (snapshot.assessmentProfile ?? this.ml.speakingProfile ?? 'read-aloud-v1')) ||
          (result.schemaVersion === 2 && (result.audioHash !== hash || result.referenceText !== snapshot.text))) throw new Error('invalid_provider_result');
      const scored = applySpeakingWeights(result);
      const saved = await this.prisma.$transaction(async tx => {
        const updated = await tx.speakingSubmission.updateMany({ where: { id, userId, status: 'PROCESSING' }, data: {
          status: 'SUCCEEDED', result: (mode === SpeakingMode.READ_ALOUD ? scored : { ...scored, mode }) as unknown as Prisma.InputJsonValue, adapterVersion: result.adapterVersion, completedAt: new Date(),
        } });
        if (updated.count && mode === SpeakingMode.TONGUE_TWISTER && scored.overall !== null && scored.overall !== undefined) {
          const stars = scored.overall >= 90 ? 3 : scored.overall >= 80 ? 2 : scored.overall >= 60 ? 1 : 0;
          const cleared = stars >= 1 && scored.completeness >= 80;
          const version = snapshot.contentVersion ?? 1;
          await tx.$executeRaw`INSERT INTO "speaking_game_progress" ("user_id", "prompt_id", "content_version", "stars", "best_score", "cleared", "updated_at")
            VALUES (${userId}::uuid, ${row.promptId}::uuid, ${version}, ${stars}, ${scored.overall}, ${cleared}, NOW())
            ON CONFLICT ("user_id", "prompt_id", "content_version") DO UPDATE SET
              "stars" = GREATEST("speaking_game_progress"."stars", EXCLUDED."stars"),
              "best_score" = GREATEST("speaking_game_progress"."best_score", EXCLUDED."best_score"),
              "cleared" = "speaking_game_progress"."cleared" OR EXCLUDED."cleared", "updated_at" = NOW()`;
        }
        return updated;
      });
      this.logResult(id, started, saved.count ? 'SUCCEEDED' : (await this.detail(userId, id)).status, undefined, result.assessmentCompleteness, snapshot.assessmentProfile);
    } catch (error: unknown) {
      const known = this.providerFailure(error);
      const saved = await this.prisma.speakingSubmission.updateMany({ where: { id, status: 'PROCESSING' }, data: {
        status: known.uncertain ? 'UNKNOWN' : 'FAILED', errorCode: known.code, completedAt: new Date(),
      } });
      this.logResult(id, started, saved.count ? (known.uncertain ? 'UNKNOWN' : 'FAILED') : (await this.detail(userId, id)).status, known.code);
    }
    return this.detail(userId, id);
  }
  async gameProgress(userId: string) {
    const prompts = await this.prisma.speakingPrompt.findMany({ where: { mode: SpeakingMode.TONGUE_TWISTER, published: true }, orderBy: { sortOrder: 'asc' } });
    const progress = await this.prisma.speakingGameProgress.findMany({ where: { userId } });
    let unlocked = true;
    return { enabled: this.modeEnabled(SpeakingMode.TONGUE_TWISTER), items: prompts.map(prompt => {
      const record = progress.find(item => item.promptId === prompt.id && item.contentVersion === prompt.contentVersion);
      const item = { ...prompt, unlocked, stars: record?.stars ?? 0, bestScore: record?.bestScore ?? null, cleared: record?.cleared ?? false };
      unlocked = unlocked && item.cleared;
      return item;
    }) };
  }
  private async requireUnlocked(userId: string, promptId: string) {
    const progress = await this.gameProgress(userId);
    if (!progress.items.find(item => item.id === promptId)?.unlocked) throw new HttpException({ code: 'speaking_level_locked', message: 'Hoàn thành màn trước để mở thử thách này.' }, 403);
  }
  private async processTopic(userId: string, id: string, audio: Buffer, hash: string, topic: string, hints: string[]) {
    const result = await this.ml.scoreTopic(audio);
    if (!validTopicResult(result, hash)) throw new Error('invalid_provider_result');
    const partial = { ...result, content: { status: 'processing' } };
    const stored = await this.prisma.speakingSubmission.updateMany({ where: { id, userId, status: 'PROCESSING' },
      data: { result: partial as Prisma.InputJsonValue, adapterVersion: result.adapterVersion } });
    if (!stored.count) return;
    let content: Record<string, any>;
    try {
      this.logger.log(JSON.stringify({ event: 'speaking_content_call', submissionId: id, count: 1, assessmentProfile: 'topic-speaking-v1' }));
      content = await this.ml.scoreTopicContent(topic, hints, result.transcript, result.durationSeconds);
      if (!validContentResult(content, result.transcript)) throw new Error('invalid_content');
    } catch {
      content = { status: 'unavailable', errorCode: 'content_assessment_failed' };
    }
    this.logger.log(JSON.stringify({ event: 'speaking_content_result', submissionId: id, status: content.status }));
    await this.prisma.speakingSubmission.updateMany({ where: { id, userId, status: 'PROCESSING' }, data: {
      result: { ...result, content } as Prisma.InputJsonValue, status: 'SUCCEEDED', completedAt: new Date(),
    } });
  }
  private logResult(id: string, started: number, status: string, code?: string, completeness?: string, profile?: string) {
    this.logger.log(JSON.stringify({ event: 'speaking_result', submissionId: id, durationMs: Date.now() - started, status, code, assessmentProfile: profile ?? this.ml.speakingProfile ?? 'read-aloud-v1', assessmentCompleteness: completeness }));
  }
  private providerFailure(error: unknown) {
    const e = (error && typeof error === 'object' ? error : {}) as { response?: { status?: number; data?: { detail?: unknown } }; message?: string };
    const allowed = new Set(['audio_empty', 'audio_silent', 'speech_not_recognized', 'invalid_audio', 'unsupported_audio_format', 'invalid_prompt', 'audio_too_large', 'audio_too_long', 'azure_quota_exceeded', 'azure_auth_failed', 'azure_missing_config', 'azure_invalid_response', 'azure_unavailable', 'azure_timeout', 'azure_transport_error', 'invalid_multipart', 'invalid_multipart_fields', 'multipart_headers_too_large']);
    const detail = e.response?.data?.detail;
    allowed.add('invalid_assessment_profile');
    const raw = typeof detail === 'string' ? detail : (detail && typeof detail === 'object' ? (detail as { code?: string }).code : undefined);
    const code = raw && allowed.has(raw) ? raw : e.message === 'invalid_provider_result' ? 'azure_invalid_response' : 'provider_unknown';
    return { code, uncertain: !e.response || code === 'azure_timeout' || code === 'azure_transport_error' || code === 'azure_invalid_response' || code === 'azure_unavailable' || code === 'provider_unknown' };
  }
}

export function applySpeakingWeights(result: ReadAloudResult): ReadAloudResult {
  if (result.schemaVersion !== 2) return result;
  const weights = { accuracy: 40, fluency: 25, prosody: 25, completeness: 10 };
  const overall = typeof result.prosody === 'number' && Number.isFinite(result.prosody)
    ? (result.accuracy * weights.accuracy + result.fluency * weights.fluency +
       result.prosody * weights.prosody + result.completeness * weights.completeness) / 100
    : null;
  return { ...result, overall, scoringPolicy: { version: 'lingoroad-weighted-v1', weights } };
}

export function validReadAloudResult(value: unknown): value is ReadAloudResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as ReadAloudResult;
  const score = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
  if (r.schemaVersion !== undefined || r.assessmentProfile !== undefined) {
    if (r.schemaVersion !== 2 || r.assessmentProfile !== 'read-aloud-v2' ||
        !(r.prosody === null || score(r.prosody)) || r.assessmentCompleteness !== (r.prosody === null ? 'partial' : 'full') ||
        typeof r.referenceText !== 'string' || !r.referenceText.trim() ||
        typeof r.audioHash !== 'string' || !/^[a-f0-9]{64}$/.test(r.audioHash) ||
        typeof r.assessedAt !== 'string' || !Number.isFinite(Date.parse(r.assessedAt)) ||
        !r.assessmentConfig || typeof r.assessmentConfig !== 'object' || Array.isArray(r.assessmentConfig)) return false;
    const expectedConfig = { locale: 'en-US', scenario: 'reading', gradingSystem: 'HundredMark', granularity: 'Phoneme',
      dimension: 'Comprehensive', enableMiscue: true, enableProsodyAssessment: true, breakConfidenceThreshold: .75, monotoneScope: 'utterance' };
    if (!Object.entries(expectedConfig).every(([key, expected]) => r.assessmentConfig![key] === expected)) return false;
    const timing = (v: { offsetMs?: number | null; durationMs?: number | null }) =>
      (v.offsetMs === null && v.durationMs === null) ||
      (typeof v.offsetMs === 'number' && Number.isFinite(v.offsetMs) && v.offsetMs >= 0 &&
       typeof v.durationMs === 'number' && Number.isFinite(v.durationMs) && v.durationMs >= 0 &&
       v.offsetMs + v.durationMs <= r.durationSeconds * 1000 + 1);
    const confidence = (v: unknown) => v === null || (score(v) && (v as number) <= 1);
    if (!Array.isArray(r.words) || !r.words.every(w => {
      if (!w || !timing(w) || !w.prosody || !confidence(w.prosody.unexpectedBreakConfidence) || !confidence(w.prosody.missingBreakConfidence) ||
          !(w.prosody.monotone === null || typeof w.prosody.monotone === 'boolean')) return false;
      return (['phonemes', 'syllables'] as const).every(key => Array.isArray(w[key]) && w[key]!.every(segment =>
        !!segment && typeof segment[key === 'phonemes' ? 'phoneme' : 'syllable'] === 'string' &&
        !!segment[key === 'phonemes' ? 'phoneme' : 'syllable'] && timing(segment) && (segment.accuracy === null || score(segment.accuracy))));
    })) return false;
  }
  return r.provider === 'azure' && typeof r.transcript === 'string' && r.transcript.trim().length > 0 &&
    [r.accuracy, r.fluency, r.completeness, r.pronunciation].every(score) && typeof r.durationSeconds === 'number' && r.durationSeconds > 0 && r.durationSeconds <= 30 &&
    typeof r.adapterVersion === 'string' && r.adapterVersion.length > 0 && r.adapterVersion.length <= 100 && typeof r.feedbackVi === 'string' &&
    Array.isArray(r.words) && r.words.length > 0 && r.words.every(w => !!w && typeof w === 'object' && typeof w.word === 'string' && w.word.length > 0 &&
      (w.accuracy === null || score(w.accuracy)) && ['None', 'Omission', 'Insertion', 'Mispronunciation', 'UnexpectedBreak', 'MissingBreak', 'Monotone'].includes(w.errorType));
}


function validTopicResult(result: Record<string, any>, hash: string): boolean {
  const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  if (result.schemaVersion !== 3 || result.assessmentProfile !== 'topic-speaking-v1' || result.mode !== 'TOPIC' || result.provider !== 'azure' ||
      result.audioHash !== hash || typeof result.adapterVersion !== 'string' ||
      typeof result.transcript !== 'string' || !result.transcript.trim() ||
      !score(result.accuracy) || !score(result.fluency) || !(result.prosody === null || score(result.prosody)) ||
      typeof result.durationSeconds !== 'number' || !Number.isFinite(result.durationSeconds) || result.durationSeconds <= 0 || result.durationSeconds > 60 ||
      !Array.isArray(result.words) || !result.words.length) return false;
  const expected = result.prosody === null ? null : (40 * result.accuracy + 25 * result.fluency + 25 * result.prosody) / 90;
  if (expected === null ? result.overall !== null : !score(result.overall) || Math.abs(result.overall - expected) > 0.000001) return false;
  return result.words.every((word: any) => typeof word?.word === 'string' && word.word.length > 0 && score(word.accuracy) &&
    ['None', 'Mispronunciation', 'UnexpectedBreak', 'MissingBreak', 'Monotone'].includes(word.errorType) &&
    (word.offsetMs === null && word.durationMs === null || typeof word.offsetMs === 'number' && typeof word.durationMs === 'number' &&
     Number.isFinite(word.offsetMs) && Number.isFinite(word.durationMs) && word.offsetMs >= 0 && word.durationMs >= 0 && word.offsetMs + word.durationMs <= result.durationSeconds * 1000 + 1));
}
function validContentResult(content: Record<string, any>, transcript: string): boolean {
  if (['insufficient_data', 'unavailable'].includes(content?.status)) return true;
  const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  return content?.status === 'succeeded' && content.rubricVersion === 'topic-content-v1' &&
    [content.vocabulary, content.grammar, content.topic, content.overall].every(score) &&
    Math.abs(content.overall - (content.vocabulary + content.grammar + content.topic) / 3) < 0.000001 &&
    Array.isArray(content.strengths) && content.strengths.length <= 3 && content.strengths.every((item: unknown) => typeof item === 'string') &&
    Array.isArray(content.improvements) && content.improvements.length <= 3 && content.improvements.every((item: any) =>
      typeof item.quote === 'string' && item.quote.length > 0 && transcript.includes(item.quote) && typeof item.explanationVi === 'string' && typeof item.suggestion === 'string');
}
