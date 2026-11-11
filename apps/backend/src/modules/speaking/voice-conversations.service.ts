import { HttpException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma, VoiceHistoryStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import {
  conversationSpeechRates, conversationTurnPauses, conversationVoices,
  VoiceConversationPreferences, VoiceLiveConfig,
} from './voice-live.config';
import { MlClientService } from '../ml/ml-client.service';
import { validateSpeakingWav } from './wav';
import { contentRequestFailure, validContentResult, validTopicResult } from './speaking.service';
import { AudioSegment, ConversationTurn, conversationAnswers, conversationPronunciation, parseAudioSegments, splitConversationAudio } from './conversation-assessment';

const pendingHistoryLifetimeMs = 24 * 60 * 60 * 1000;
const emptySegmentHash = createHash('sha256').update('[]').digest('hex');

function wholeAudioScore(assessment: Record<string, any>) {
  if (assessment.pronunciationScope === 'per_turn') return null;
  if (assessment.pronunciationScope === 'whole_audio' || (
    !assessment.turns?.some((turn: any) => turn.pronunciation) &&
    (!assessment.segmentHash || assessment.segmentHash === emptySegmentHash)
  )) return assessment.pronunciation ?? null;
  return null;
}

function assessmentStatus(row: { assessmentStatus: string; assessment: unknown }) {
  const stored = row.assessment as Record<string, any> | null;
  if (row.assessmentStatus === 'READY' && stored?.schemaVersion === 2 &&
      Array.isArray(stored.turns) && stored.turns.some((turn: any) => !turn.pronunciation) &&
      !wholeAudioScore(stored)) return 'PARTIAL';
  return row.assessmentStatus;
}

@Injectable()
export class VoiceConversationsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(VoiceConversationsService.name);
  private readonly tickets = new Map<string, { id: string; expires: number }>();
  private readonly calls = new Map<string, { close: (reason: string) => Promise<void> }>();
  private server?: WebSocketServer;
  private sweep?: NodeJS.Timeout;
  private readonly translations = new Map<string, Promise<{ translationVi: string }>>();

  constructor(private readonly prisma: PrismaService, private readonly config: VoiceLiveConfig,
    private readonly adapter: HttpAdapterHost, private readonly ml: MlClientService) {}

  async translate(userId: string, id: string, itemId: string) {
    await this.detail(userId, id);
    const turn = await this.prisma.voiceConversationTurn.findFirst({ where: {
      conversationId: id, providerItemId: itemId, role: 'ASSISTANT',
    } });
    if (!turn) throw new HttpException({ code: 'turn_not_found', message: 'Không tìm thấy lời thoại cần dịch.' }, 404);
    if (turn.translationVi) return { translationVi: turn.translationVi };
    const previous = this.translations.get(turn.id);
    if (previous) return previous;
    const operation = (async () => {
      try {
        const translationVi = await this.ml.translateConversation(turn.transcript);
        await this.prisma.voiceConversationTurn.update({ where: { id: turn.id }, data: { translationVi } });
        return { translationVi };
      } catch {
        throw new HttpException({ code: 'translation_unavailable', message: 'Chưa dịch được. Hãy thử lại.' }, 503);
      } finally {
        this.translations.delete(turn.id);
      }
    })();
    this.translations.set(turn.id, operation);
    return operation;
  }

  async onApplicationBootstrap() {
    // One application instance owns the control sockets in this initial deployment.
    await this.prisma.voiceConversation.updateMany({ where: { activeUserId: { not: null } },
      data: { activeUserId: null, status: 'INTERRUPTED', endReason: 'server_restarted', endedAt: new Date() } });
    await this.prisma.voiceConversation.updateMany({ where: { assessmentStatus: 'PROCESSING' },
      data: { assessmentStatus: 'UNKNOWN' } });
    this.server = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });
    this.adapter.httpAdapter.getHttpServer().on('upgrade', (request: any, socket: any, head: Buffer) => {
      if (request.url !== '/speaking/conversations/connect') { socket.destroy(); return; }
      this.server!.handleUpgrade(request, socket, head, client => this.accept(client));
    });
    this.sweep = setInterval(() => {
      for (const [key, ticket] of this.tickets) if (ticket.expires < Date.now()) this.tickets.delete(key);
      void this.prisma.voiceConversation.updateMany({
        where: { status: 'CREATED', createdAt: { lt: new Date(Date.now() - 120000) } },
        data: { activeUserId: null, status: 'INTERRUPTED', endReason: 'connection_expired', endedAt: new Date() },
      }).catch(() => this.logger.warn('Voice session expiry failed'));
      void this.expirePendingHistory().catch(() => this.logger.warn('Voice history cleanup failed'));
    }, 30000);
    this.sweep.unref();
  }

  async onModuleDestroy() {
    clearInterval(this.sweep);
    await Promise.all([...this.calls.values()].map(call => call.close('server_stopped')));
    this.server?.close();
  }

  async detail(userId: string, id: string) {
    const row = await this.prisma.voiceConversation.findFirst({ where: { id, userId, historyStatus: { not: 'DISCARDED' } },
      include: { turns: { orderBy: { sequence: 'asc' } } } });
    if (!row) throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    if (row.assessmentStatus === 'PROCESSING' && row.assessmentStartedAt && row.assessmentStartedAt.getTime() < Date.now() - 900000) {
      const changed = await this.prisma.voiceConversation.updateMany({ where: { id, userId, assessmentStatus: 'PROCESSING',
        assessmentStartedAt: row.assessmentStartedAt }, data: { assessmentStatus: 'UNKNOWN' } });
      if (changed.count) row.assessmentStatus = 'UNKNOWN';
    }
    const stored = row.assessment as any;
    if (stored?.schemaVersion === 2 && Array.isArray(stored.turns)) {
      stored.pronunciation = conversationPronunciation(stored.turns) ?? stored.pronunciation;
      row.assessment = stored;
    }
    const { activeUserId, ...result } = row;
    return { ...result, assessmentStatus: assessmentStatus(row) };
  }

  async summary(userId: string, id: string) {
    const row = await this.prisma.voiceConversation.findFirst({ where: { id, userId, historyStatus: { not: 'DISCARDED' } },
      include: { _count: { select: { turns: { where: { role: 'USER', transcript: { not: '' } } } } } } });
    if (!row) throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    if (row.assessmentStatus === 'PROCESSING' && row.assessmentStartedAt && row.assessmentStartedAt.getTime() < Date.now() - 900000) {
      const changed = await this.prisma.voiceConversation.updateMany({ where: { id, userId, assessmentStatus: 'PROCESSING', assessmentStartedAt: row.assessmentStartedAt }, data: { assessmentStatus: 'UNKNOWN' } });
      if (changed.count) row.assessmentStatus = 'UNKNOWN';
    }
    const stored = row.assessment as any;
    if (stored?.schemaVersion === 2 && Array.isArray(stored.turns)) {
      stored.pronunciation = conversationPronunciation(stored.turns) ?? stored.pronunciation;
    }
    const { activeUserId, _count, ...result } = row;
    return { ...result, assessmentStatus: assessmentStatus(row), hasUserTurns: _count.turns > 0 };
  }

  async transcript(userId: string, id: string) {
    const owned = await this.prisma.voiceConversation.findFirst({ where: { id, userId, historyStatus: { not: 'DISCARDED' } }, select: { id: true } });
    if (!owned) throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    const items = await this.prisma.voiceConversationTurn.findMany({ where: { conversationId: id }, orderBy: { sequence: 'asc' } });
    return { items };
  }

  async assess(userId: string, id: string, audio?: Buffer, segmentInput?: unknown) {
    const row = await this.detail(userId, id);
    if (!['ENDED', 'INTERRUPTED'].includes(row.status)) {
      throw new HttpException({ code: 'conversation_active', message: 'Hãy kết thúc hội thoại trước khi chấm điểm.' }, 409);
    }
    const duration = audio ? validateSpeakingWav(audio, 180, 6 * 1024 * 1024) : 0;
    const segments = parseAudioSegments(segmentInput, duration * 1000);
    const segmentHash = createHash('sha256').update(JSON.stringify(segments)).digest('hex');
    const hash = audio ? createHash('sha256').update(audio).digest('hex') : null;
    if (row.assessmentStatus !== 'UNASSESSED') {
      if (audio && (row.assessmentAudioHash !== hash || (row.assessment as any)?.segmentHash && (row.assessment as any).segmentHash !== segmentHash)) {
        throw new HttpException({ code: 'assessment_audio_conflict', message: 'Phiên đã nhận một bản thu khác.' }, 409);
      }
      return row;
    }
    if (!row.turns.some(turn => turn.role === 'USER' && turn.transcript.trim())) {
      throw new HttpException({ code: 'conversation_empty', message: 'Phiên chưa có lời nói của bạn để chấm điểm.' }, 422);
    }
    const assessmentStartedAt = new Date();
    const claimed = await this.prisma.voiceConversation.updateMany({
      where: { id, userId, historyStatus: { not: 'DISCARDED' }, assessmentStatus: 'UNASSESSED' },
      data: { assessmentStatus: 'PROCESSING', assessmentStartedAt, assessmentAudioHash: hash, assessment: { segmentHash } },
    });
    if (!claimed.count) {
      const winner = await this.detail(userId, id);
      if (audio && (winner.assessmentAudioHash !== hash || (winner.assessment as any)?.segmentHash && (winner.assessment as any).segmentHash !== segmentHash)) {
        throw new HttpException({ code: 'assessment_audio_conflict', message: 'Phiên đã nhận một bản thu khác.' }, 409);
      }
      return winner;
    }
    const topic = (row.topicSnapshot as Record<string, any>).text;
    const turns = row.turns.map((turn, index) => ({ itemId: turn.providerItemId ?? `turn-${index}`, role: turn.role, transcript: turn.transcript }));
    void this.processAssessment(id, userId, topic, turns, audio, segments, { segmentHash }, assessmentStartedAt).catch(() => {
      this.logger.warn(JSON.stringify({ event: 'conversation_assessment_save_failed', conversationId: id }));
    });
    return this.detail(userId, id);
  }

  async retryContent(userId: string, id: string) {
    const row = await this.detail(userId, id);
    if (!['ENDED', 'INTERRUPTED'].includes(row.status)) {
      throw new HttpException({ code: 'conversation_active', message: 'Hãy kết thúc hội thoại trước khi chấm.' }, 409);
    }
    const previous = (row.assessment ?? {}) as Record<string, any>;
    if (row.assessmentStatus === 'PROCESSING' || previous.content?.status === 'succeeded' && previous.content?.assessmentScope === 'whole_conversation') return row;
    if (!row.turns.some(turn => turn.role === 'USER' && turn.transcript.trim())) {
      throw new HttpException({ code: 'conversation_empty', message: 'Phiên chưa có lời nói của bạn để chấm điểm.' }, 422);
    }
    const assessmentStartedAt = new Date();
    const claim = await this.prisma.voiceConversation.updateMany({ where: { id, userId,
      historyStatus: { not: 'DISCARDED' }, assessmentStatus: { not: 'PROCESSING' }, assessmentStartedAt: row.assessmentStartedAt },
      data: { assessmentStatus: 'PROCESSING', assessmentStartedAt } });
    if (!claim.count) return this.detail(userId, id);
    const turns = row.turns.map(turn => ({ itemId: turn.providerItemId, role: turn.role, transcript: turn.transcript }));
    void this.processAssessment(id, userId, (row.topicSnapshot as any).text, turns, undefined, [], previous, assessmentStartedAt)
      .catch(() => this.logger.warn(JSON.stringify({ event: 'conversation_content_save_failed', conversationId: id })));
    return this.detail(userId, id);
  }

  private async processAssessment(id: string, userId: string, topic: string,
    turns: ConversationTurn[], audio: Buffer | undefined, segments: AudioSegment[], previous: Record<string, any>, assessmentStartedAt: Date) {
    const started = Date.now();
    const answers = conversationAnswers(turns);
    const clips = audio && segments.length ? splitConversationAudio(audio, segments) : new Map<string, Buffer>();
    const scoreAudio = async (bytes: Buffer) => {
      try {
        const result = await this.ml.scoreConversationAudio(bytes);
        const hash = createHash('sha256').update(bytes).digest('hex');
        if (validTopicResult(result, hash, 180, 'conversation-speaking-v1')) return result;
      } catch { /* Individual failure leaves the other replies available. */ }
      return null;
    };
    const scoreReplies = async () => {
      const results = new Map<string, any>();
      // Sequential provider calls respect the speech resource's concurrency limit.
      for (const answer of answers) {
        const clip = clips.get(answer.itemId);
        const saved = previous.turns?.find((turn: any) => turn.itemId === answer.itemId)?.pronunciation;
        results.set(answer.itemId, clip ? await scoreAudio(clip) : saved ?? null);
      }
      return results;
    };
    this.logger.log(JSON.stringify({ event: 'conversation_assessment_started', conversationId: id,
      pronunciationCalls: segments.length ? clips.size : audio ? 1 : 0, contentCalls: 1 }));
    const contentPromise = this.ml.scoreConversationContent(topic, turns.filter(turn => turn.transcript.trim())).catch(contentRequestFailure);
    const [replies, contentResult, legacySpeech] = await Promise.all([
      scoreReplies(), contentPromise,
      audio && !segments.length ? scoreAudio(audio) : Promise.resolve(wholeAudioScore(previous)),
    ]);
    const transcript = turns.filter(turn => turn.role === 'USER').map(turn => turn.transcript).join('\n');
    const content: Record<string, any> = validContentResult(contentResult, transcript, 'conversation-content-v1')
      ? contentResult : { status: 'unavailable', errorCode: 'content_invalid_response' };
    const results = answers.map(answer => {
      const candidate = Array.isArray(content.turns) ? content.turns.find((item: any) => item.itemId === answer.itemId)?.content : null;
      const turnContent = candidate && validContentResult(candidate, answer.answer, 'conversation-content-v1')
        ? candidate : { status: 'unavailable', errorCode: 'content_assessment_failed' };
      return { ...answer, pronunciation: replies.get(answer.itemId), content: turnContent };
    });
    const hasSpeech = legacySpeech || results.some(turn => turn.pronunciation);
    const hasContent = content.status === 'succeeded';
    const complete = hasContent && (legacySpeech || (results.length > 0 && results.every(turn => turn.pronunciation)));
    const status = complete ? 'READY' : hasSpeech || hasContent ? 'PARTIAL' : 'FAILED';
    const assessment = { schemaVersion: 2, pronunciation: conversationPronunciation(results) ?? legacySpeech, content, turns: results,
      pronunciationScope: legacySpeech ? 'whole_audio' : 'per_turn',
      segmentHash: previous.segmentHash ?? null, contentBasis: 'learner_reply_with_question',
      audioSource: audio ? 'local_microphone_vad' : previous.audioSource ?? null, assessedAt: new Date().toISOString() };
    await this.prisma.voiceConversation.updateMany({ where: { id, userId, assessmentStatus: 'PROCESSING', assessmentStartedAt },
      data: { assessmentStatus: status, assessment: assessment as Prisma.InputJsonValue } });
    this.logger.log(JSON.stringify({ event: 'conversation_assessment_completed', conversationId: id,
      status, contentStatus: content.status, contentErrorCode: content.errorCode,
      totalReplies: answers.length, scoredReplies: results.filter(turn => turn.pronunciation).length,
      latencyMs: Date.now() - started }));
  }

  private async discardHistory(where: Prisma.VoiceConversationWhereInput) {
    return this.prisma.$transaction(async tx => {
      const changed = await tx.voiceConversation.updateMany({
        where: { ...where, historyStatus: 'PENDING', status: { in: ['ENDED', 'INTERRUPTED'] } },
        data: { historyStatus: 'DISCARDED', assessment: Prisma.DbNull,
          assessmentStatus: 'UNASSESSED', assessmentStartedAt: null, assessmentAudioHash: null,
          topicSnapshot: {} },
      });
      if (changed.count) {
        await tx.voiceConversationTurn.deleteMany({ where: { conversation: { ...where, historyStatus: 'DISCARDED' } } });
      }
      return changed.count;
    });
  }

  private async expirePendingHistory() {
    await this.discardHistory({ endedAt: { lt: new Date(Date.now() - pendingHistoryLifetimeMs) } });
  }

  async chooseHistory(userId: string, id: string, save: boolean) {
    const target = save ? VoiceHistoryStatus.SAVED : VoiceHistoryStatus.DISCARDED;
    const owned = { id, userId };
    const pending = { ...owned, historyStatus: VoiceHistoryStatus.PENDING, status: { in: ['ENDED', 'INTERRUPTED'] } };
    const changed = save
      ? (await this.prisma.voiceConversation.updateMany({ where: pending, data: { historyStatus: target } })).count
      : await this.discardHistory(owned);
    if (changed) return { historyStatus: target };

    const row = await this.prisma.voiceConversation.findFirst({ where: owned, select: { historyStatus: true, status: true } });
    if (!row) throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    if (row.historyStatus === target && ['ENDED', 'INTERRUPTED'].includes(row.status)) return { historyStatus: target };
    throw new HttpException({ code: 'conversation_history_conflict', message: 'Phiên chưa kết thúc hoặc đã có lựa chọn lưu.' }, 409);
  }

  async history(userId: string, cursor?: string) {
    const where = { userId, historyStatus: VoiceHistoryStatus.SAVED };
    if (cursor && !await this.prisma.voiceConversation.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
      throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    }
    const rows = await this.prisma.voiceConversation.findMany({ where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    return { items: rows.slice(0, 20).map(({ activeUserId, ...row }) => ({ ...row, assessmentStatus: assessmentStatus(row) })),
      nextCursor: rows.length > 20 ? rows[19].id : null };
  }

  async create(userId: string, topicId: string, clientRequestId: string, deferHistory = false,
    preferences: VoiceConversationPreferences = {}) {
    const previous = await this.prisma.voiceConversation.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId } } });
    if (previous) {
      if (previous.topicId !== topicId) throw new HttpException({ code: 'conversation_conflict', message: 'Yêu cầu đã gắn với chủ đề khác.' }, 409);
      return this.connectionResponse(userId, previous.id);
    }
    if (!this.config.readiness().enabled) throw new HttpException({ code: 'voice_live_unavailable', message: 'Hội thoại AI chưa sẵn sàng. Hãy thử lại sau.' }, 503);
    const topic = await this.prisma.speakingPrompt.findFirst({ where: { id: topicId, mode: 'TOPIC', published: true } });
    if (!topic) throw new HttpException({ code: 'conversation_topic_not_found', message: 'Chủ đề chưa khả dụng.' }, 404);
    const settings = this.config.read();
    try {
      const row = await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        const since = new Date(); since.setUTCHours(0, 0, 0, 0);
        const count = await tx.voiceConversation.count({ where: { userId, createdAt: { gte: since }, startedAt: { not: null } } });
        if (count >= 10) throw new HttpException({ code: 'conversation_daily_limit', message: 'Bạn đã dùng hết 10 phiên hôm nay.' }, 429);
        return tx.voiceConversation.create({ data: { userId, activeUserId: userId, topicId, clientRequestId,
          historyStatus: deferHistory ? 'PENDING' : 'SAVED',
          topicSnapshot: { title: topic.title, text: topic.text, hints: topic.hints, contentVersion: topic.contentVersion,
            model: settings.model,
             voice: conversationVoices[preferences.voice ?? 'standard'] ?? settings.voice,
             speechRate: conversationSpeechRates[preferences.speechRate ?? 'normal'],
             silenceDurationMs: conversationTurnPauses[preferences.turnPause ?? 'normal'],
             instructionsVersion: 'conversation-tutor-v1', maxDurationSeconds: 180 } } });
      });
      return this.connectionResponse(userId, row.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.voiceConversation.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId } } });
        if (winner && winner.topicId === topicId) return this.connectionResponse(userId, winner.id);
        throw new HttpException({ code: 'conversation_active', message: 'Bạn đang có một phiên hội thoại. Hãy kết thúc phiên đó trước.' }, 409);
      }
      throw error;
    }
  }

  private async connectionResponse(userId: string, id: string) {
    const row = await this.detail(userId, id);
    if (row.status !== 'CREATED') return { conversation: row, connectTicket: null };
    for (const [key, ticket] of this.tickets) if (ticket.id === id) this.tickets.delete(key);
    const ticket = randomBytes(32).toString('base64url');
    this.tickets.set(ticket, { id, expires: Date.now() + 30000 });
    return { conversation: row, connectTicket: ticket };
  }

  async finish(userId: string, id: string) {
    await this.detail(userId, id);
    const call = this.calls.get(id);
    if (call) await call.close('user_finished');
    else await this.prisma.voiceConversation.updateMany({ where: { id, userId, status: 'CREATED' },
      data: { activeUserId: null, status: 'ENDED', endedAt: new Date(), endReason: 'user_finished' } });
    return this.detail(userId, id);
  }

  private accept(client: WebSocket) {
    const timeout = setTimeout(() => client.close(1008, 'Authentication required'), 10000);
    client.once('message', raw => {
      clearTimeout(timeout);
      void this.connect(client, raw.toString()).catch(() => client.close(1011, 'Connection failed'));
    });
    client.on('error', () => undefined);
  }

  private async connect(client: WebSocket, raw: string) {
    const first = JSON.parse(raw);
    const ticket = this.tickets.get(first.ticket);
    this.tickets.delete(first.ticket);
    if (!ticket || ticket.expires < Date.now() || !this.config.readiness().enabled ||
      typeof first.sdp !== 'string' || first.sdp.length > 100000) {
      client.close(1008, 'Invalid connection request'); return;
    }
    const id = ticket.id;
    const claim = await this.prisma.voiceConversation.updateMany({ where: { id, status: 'CREATED' }, data: { status: 'CONNECTING' } });
    if (!claim.count) { client.close(1008, 'Session already claimed'); return; }
    const row = await this.prisma.voiceConversation.findUniqueOrThrow({ where: { id } });
    const topic = row.topicSnapshot as Record<string, any>;
    const settings = this.config.read();
    const endpoint = new URL(settings.endpoint);
    endpoint.protocol = 'wss:';
    endpoint.pathname = '/voice-live/realtime/calls';
    endpoint.search = new URLSearchParams({ 'api-version': settings.apiVersion, model: topic.model }).toString();
    const provider = new WebSocket(endpoint, { headers: { 'api-key': settings.key }, handshakeTimeout: 15000, maxPayload: 2 * 1024 * 1024 });
    let closed: Promise<void> | undefined;
    let acceptingEvents = true;
    let timer: NodeJS.Timeout;
    let deadline: NodeJS.Timeout;
    let greeted = false;
    let pendingSettings: { requestId: string; silenceDurationMs: number; rate: string; timeout: NodeJS.Timeout } | undefined;
    const turnDetection = (silenceDurationMs: number) => ({
      type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300,
      silence_duration_ms: silenceDurationMs,
    });
    const sendSettingsResult = (requestId: string, applied: boolean) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: applied ? 'settings.updated' : 'settings.rejected', requestId }));
      }
    };
    const finishSettingsUpdate = (applied: boolean) => {
      if (!pendingSettings) return;
      const { requestId, timeout } = pendingSettings;
      pendingSettings = undefined;
      clearTimeout(timeout);
      sendSettingsResult(requestId, applied);
    };
    let sequence = 0;
    let writing = Promise.resolve();
    const indices = new Map<string, number>();
    const index = (item: string) => { if (!indices.has(item)) indices.set(item, sequence++); return indices.get(item)!; };
    const close = (reason: string): Promise<void> => {
      if (closed) return closed;
      acceptingEvents = false;
      finishSettingsUpdate(false);
      closed = (async () => {
        try {
          await writing;
          await this.prisma.voiceConversation.updateMany({
            where: { id, status: { in: ['CONNECTING', 'ACTIVE'] } },
            data: { activeUserId: null, status: ['user_finished', 'time_limit'].includes(reason) ? 'ENDED' : 'INTERRUPTED',
              endReason: reason, endedAt: new Date() },
          });
          this.logger.log(JSON.stringify({ conversationId: id, status: 'closed', reason }));
        } finally {
          clearTimeout(timer); clearTimeout(deadline);
          provider.close();
          if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'conversation.ended', reason }));
          client.close();
          this.calls.delete(id);
        }
      })();
      return closed;
    };
    this.calls.set(id, { close });
    const safelyClose = (reason: string) => void close(reason).catch(() => this.logger.warn(`Voice session ${id} closure failed`));
    deadline = setTimeout(() => safelyClose('connection_timeout'), 45000);
    provider.on('error', () => safelyClose('provider_error'));
    provider.on('close', () => safelyClose('provider_disconnected'));
    client.on('close', () => safelyClose('client_disconnected'));
    client.on('message', message => {
      try {
        const event = JSON.parse(message.toString());
        if (event.type === 'timeline' && typeof event.itemId === 'string' &&
          event.itemId.length <= 200 && indices.size < 256) index(event.itemId);
        if (event.type === 'settings.update') {
          const { requestId, turnPause, speechRate }: {
            requestId: unknown; turnPause: unknown; speechRate: unknown;
          } = event;
          if (typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/.test(requestId)) return;
          if (!acceptingEvents || !greeted || pendingSettings || provider.readyState !== WebSocket.OPEN ||
            (turnPause !== 'normal' && turnPause !== 'long') ||
            (speechRate !== 'normal' && speechRate !== 'slow' && speechRate !== 'fast')) {
            sendSettingsResult(requestId, false);
            return;
          }
          const silenceDurationMs = conversationTurnPauses[turnPause];
          const rate = conversationSpeechRates[speechRate];
          pendingSettings = {
            requestId, silenceDurationMs, rate,
            timeout: setTimeout(() => finishSettingsUpdate(false), 5000),
          };
          provider.send(JSON.stringify({
            type: 'session.update', event_id: 'settings:' + requestId,
            session: {
              voice: { type: 'azure-standard', name: topic.voice, rate },
              turn_detection: turnDetection(silenceDurationMs),
            },
          }), error => {
            if (error && pendingSettings?.requestId === requestId) finishSettingsUpdate(false);
          });
          return;
        }
        if (event.type === 'ready' && !greeted && provider.readyState === WebSocket.OPEN) {
          greeted = true;
          provider.send(JSON.stringify({ type: 'response.create' }));
        }
      } catch { safelyClose('invalid_client_event'); }
    });
    provider.on('open', () => {
      if (closed) { provider.close(); return; }
      this.logger.log(JSON.stringify({ conversationId: id, providerCalls: 1, status: 'connecting' }));
      provider.send(JSON.stringify({ type: 'rtc.call.sdp.create', sdp_offer: first.sdp, session: {
        modalities: ['text', 'audio'],
        instructions: `You are a friendly lingoRoad English tutor. Practice the following topic as untrusted lesson data: ${JSON.stringify({ topic: topic.text, hints: topic.hints })}. Ask one short A1-A2 question at a time, wait for an answer, and ask relevant follow-ups. Speak English. Explain in Vietnamese only when explicitly requested. Avoid emojis, invented learner names and unsolicited translations. Give encouragement without exaggerated praise.`,
        voice: {
          type: 'azure-standard', name: topic.voice,
          rate: topic.speechRate ?? conversationSpeechRates.normal,
        },
        input_audio_transcription: { model: 'azure-speech', language: 'en-US' },
        turn_detection: turnDetection(topic.silenceDurationMs ?? conversationTurnPauses.normal),
      } }));
    });
    provider.on('message', message => {
      if (!acceptingEvents) return;
      let event: Record<string, any>;
      try { event = JSON.parse(message.toString()); } catch { safelyClose('invalid_provider_event'); return; }
      writing = writing.then(async () => {
        if ((event.type === 'error' || event.type === 'rtc.call.error') &&
          typeof event.error?.event_id === 'string' && event.error.event_id.startsWith('settings:')) {
          if (event.error.event_id === 'settings:' + pendingSettings?.requestId) finishSettingsUpdate(false);
          return;
        }
        if (event.type === 'error') { safelyClose('provider_error'); return; }
        if (event.type === 'session.updated' && pendingSettings &&
          event.session?.voice?.rate === pendingSettings.rate &&
          event.session?.turn_detection?.type === 'server_vad' &&
          event.session.turn_detection.silence_duration_ms === pendingSettings.silenceDurationMs) {
          finishSettingsUpdate(true);
        }
        if (event.type === 'rtc.call.sdp.created') {
          clearTimeout(deadline);
          await this.prisma.voiceConversation.updateMany({ where: { id, status: 'CONNECTING' }, data: { status: 'ACTIVE', startedAt: new Date() } });
          timer = setTimeout(() => safelyClose('time_limit'), 180000);
          this.logger.log(JSON.stringify({ conversationId: id, status: 'active' }));
        }
        if (event.item_id) index(event.item_id);
        if (event.type === 'response.output_item.added' && event.item?.id) index(event.item.id);
        const role = event.type === 'conversation.item.input_audio_transcription.completed' ? 'USER' :
          event.type === 'response.audio_transcript.done' ? 'ASSISTANT' : null;
        if (role && typeof event.transcript === 'string' && event.transcript.trim() && event.item_id) {
          await this.prisma.voiceConversationTurn.upsert({
            where: { conversationId_providerItemId: { conversationId: id, providerItemId: event.item_id } },
            create: { conversationId: id, providerItemId: event.item_id, role, transcript: event.transcript.slice(0, 12000), sequence: index(event.item_id) },
            update: {},
          });
        }
        if (client.readyState === WebSocket.OPEN) {
          // Forward only display/control events, never the provider session object.
          if (event.type === 'rtc.call.sdp.created') client.send(JSON.stringify({ type: event.type, sdp_answer: event.sdp_answer }));
          else if (role) client.send(JSON.stringify({ type: event.type, transcript: event.transcript, item_id: event.item_id, sequence: index(event.item_id) }));
        }
      }).catch(() => safelyClose('persistence_failed'));
    });
  }
}
