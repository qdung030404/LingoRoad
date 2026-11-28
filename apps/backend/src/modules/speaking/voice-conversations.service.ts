import { HttpException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma, VoiceHistoryStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  conversationSpeechRates, conversationTurnPauses, conversationVoices,
  VoiceConversationPreferences, VoiceLiveConfig,
} from './voice-live.config';
import { MlClientService } from '../ml/ml-client.service';
import { validateSpeakingWav } from './wav';
import { AudioSegment, ConversationTurn, conversationAnswers, conversationPronunciation, parseAudioSegments } from './conversation-assessment';
import {
  computeAssessmentStatus,
  processConversationAssessment,
  StoredConversationAssessment,
  wholeAudioScore,
} from './voice-conversations-assessment.helper';
import { runVoiceWebSocketSession } from './voice-conversations-ws.helper';

const pendingHistoryLifetimeMs = 24 * 60 * 60 * 1000;

@Injectable()
export class VoiceConversationsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(VoiceConversationsService.name);
  private readonly tickets = new Map<string, { id: string; expires: number }>();
  private readonly calls = new Map<string, { close: (reason: string) => Promise<void> }>();
  private server?: WebSocketServer;
  private sweep?: NodeJS.Timeout;
  private readonly translations = new Map<string, Promise<{ translationVi: string }>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: VoiceLiveConfig,
    private readonly adapter: HttpAdapterHost,
    private readonly ml: MlClientService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

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
    this.adapter.httpAdapter.getHttpServer().on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
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

  async detail(userId: string, id: string, visibleOnly = false) {
    const row = await this.prisma.voiceConversation.findFirst({ where: { id, userId, historyStatus: { not: 'DISCARDED' },
      ...(visibleOnly ? { historyHiddenAt: null } : {}) },
      include: { turns: { orderBy: { sequence: 'asc' } } } });
    if (!row) throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    if (row.assessmentStatus === 'PROCESSING' && row.assessmentStartedAt && row.assessmentStartedAt.getTime() < Date.now() - 900000) {
      const changed = await this.prisma.voiceConversation.updateMany({ where: { id, userId, assessmentStatus: 'PROCESSING',
        assessmentStartedAt: row.assessmentStartedAt }, data: { assessmentStatus: 'UNKNOWN' } });
      if (changed.count) row.assessmentStatus = 'UNKNOWN';
    }
    const stored = row.assessment as StoredConversationAssessment | null;
    if (stored?.schemaVersion === 2 && Array.isArray(stored.turns)) {
      stored.pronunciation = conversationPronunciation(stored.turns) ?? stored.pronunciation;
      row.assessment = stored as Prisma.JsonValue;
    }
    const { activeUserId, ...result } = row;
    return { ...result, assessmentStatus: computeAssessmentStatus(row), supportsPronunciationRetry: true };
  }

  async summary(userId: string, id: string) {
    const row = await this.prisma.voiceConversation.findFirst({ where: { id, userId, historyHiddenAt: null, historyStatus: { not: 'DISCARDED' } },
      include: { _count: { select: { turns: { where: { role: 'USER', transcript: { not: '' } } } } } } });
    if (!row) throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    if (row.assessmentStatus === 'PROCESSING' && row.assessmentStartedAt && row.assessmentStartedAt.getTime() < Date.now() - 900000) {
      const changed = await this.prisma.voiceConversation.updateMany({ where: { id, userId, assessmentStatus: 'PROCESSING', assessmentStartedAt: row.assessmentStartedAt }, data: { assessmentStatus: 'UNKNOWN' } });
      if (changed.count) row.assessmentStatus = 'UNKNOWN';
    }
    const stored = row.assessment as StoredConversationAssessment | null;
    if (stored?.schemaVersion === 2 && Array.isArray(stored.turns)) {
      stored.pronunciation = conversationPronunciation(stored.turns) ?? stored.pronunciation;
    }
    const { activeUserId, _count, ...result } = row;
    return { ...result, assessmentStatus: computeAssessmentStatus(row), hasUserTurns: _count.turns > 0, supportsPronunciationRetry: true };
  }

  async transcript(userId: string, id: string) {
    const owned = await this.prisma.voiceConversation.findFirst({ where: { id, userId, historyHiddenAt: null,
      historyStatus: { not: 'DISCARDED' } }, select: { id: true } });
    if (!owned) throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    const items = await this.prisma.voiceConversationTurn.findMany({ where: { conversationId: id }, orderBy: { sequence: 'asc' } });
    return { items };
  }

  async sample(userId: string, id: string, text: string) {
    const owned = await this.prisma.voiceConversation.findFirst({
      where: { id, userId, historyHiddenAt: null, historyStatus: { not: 'DISCARDED' }, status: { in: ['ENDED', 'INTERRUPTED'] } },
      select: { id: true },
    });
    if (!owned) throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    try {
      const audio = await this.ml.synthesizeConversationSample(text);
      return { audioBase64: audio.toString('base64') };
    } catch {
      throw new HttpException({ code: 'sample_unavailable', message: 'Chưa phát được giọng mẫu. Hãy thử lại.' }, 503);
    }
  }

  async assess(userId: string, id: string, audio?: Buffer, segmentInput?: unknown, retryPronunciation = false) {
    const row = await this.detail(userId, id, retryPronunciation);
    if (!['ENDED', 'INTERRUPTED'].includes(row.status)) {
      throw new HttpException({ code: 'conversation_active', message: 'Hãy kết thúc hội thoại trước khi chấm điểm.' }, 409);
    }
    const duration = audio ? validateSpeakingWav(audio, 180, 6 * 1024 * 1024) : 0;
    const segments = parseAudioSegments(segmentInput, duration * 1000);
    const segmentHash = createHash('sha256').update(JSON.stringify(segments)).digest('hex');
    const hash = audio ? createHash('sha256').update(audio).digest('hex') : null;
    const initial = row.assessmentStatus === 'UNASSESSED';
    const previous = (row.assessment ?? {}) as StoredConversationAssessment;
    const turns = row.turns.map((turn, index) => ({ itemId: turn.providerItemId ?? `turn-${index}`, role: turn.role, transcript: turn.transcript }));
    const conflicts = (stored: typeof row) => {
      const storedSegments = (stored.assessment as Record<string, unknown> | null)?.segmentHash;
      if (!audio || (retryPronunciation && !stored.assessmentAudioHash)) return false;
      return stored.assessmentAudioHash !== hash || Boolean(storedSegments && storedSegments !== segmentHash);
    };
    if (!initial) {
      if (conflicts(row)) {
        throw new HttpException({ code: 'assessment_audio_conflict', message: 'Phiên đã nhận một bản thu khác.' }, 409);
      }
      if (!retryPronunciation || !audio || row.assessmentStatus === 'PROCESSING' || wholeAudioScore(previous)) return row;
      const recorded = new Set(segments.map(segment => segment.itemId));
      const canRecover = conversationAnswers(turns).some(answer =>
        (!segments.length || recorded.has(answer.itemId)) &&
        !previous.turns?.some((turn) => turn.itemId === answer.itemId && turn.pronunciation),
      );
      if (!canRecover) return row;
    }
    if (!row.turns.some(turn => turn.role === 'USER' && turn.transcript.trim())) {
      throw new HttpException({ code: 'conversation_empty', message: 'Phiên chưa có lời nói của bạn để chấm điểm.' }, 422);
    }
    const assessmentStartedAt = new Date();
    const claimed = await this.prisma.voiceConversation.updateMany({
      where: {
        id, userId, historyStatus: { not: 'DISCARDED' },
        ...(retryPronunciation ? { historyHiddenAt: null } : {}),
        ...(initial ? { assessmentStatus: 'UNASSESSED' } : {
          assessmentStatus: { not: 'PROCESSING' }, assessmentStartedAt: row.assessmentStartedAt,
        }),
      },
      data: {
        assessmentStatus: 'PROCESSING', assessmentStartedAt, assessmentAudioHash: hash,
        assessment: { ...previous, segmentHash } as Prisma.InputJsonValue,
      },
    });
    if (!claimed.count) {
      const winner = await this.detail(userId, id);
      if (conflicts(winner)) {
        throw new HttpException({ code: 'assessment_audio_conflict', message: 'Phiên đã nhận một bản thu khác.' }, 409);
      }
      return winner;
    }
    const topic = (row.topicSnapshot as { text: string }).text;
    void this.processAssessment(id, userId, topic, turns, audio, segments,
      { ...previous, segmentHash }, assessmentStartedAt, retryPronunciation).catch(() => {
      this.logger.warn(JSON.stringify({ event: 'conversation_assessment_save_failed', conversationId: id }));
    });
    return this.detail(userId, id);
  }

  async retryContent(userId: string, id: string) {
    const row = await this.detail(userId, id);
    if (!['ENDED', 'INTERRUPTED'].includes(row.status)) {
      throw new HttpException({ code: 'conversation_active', message: 'Hãy kết thúc hội thoại trước khi chấm.' }, 409);
    }
    const previous = (row.assessment ?? {}) as StoredConversationAssessment;
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
    void this.processAssessment(id, userId, (row.topicSnapshot as { text: string }).text, turns, undefined, [], previous, assessmentStartedAt)
      .catch(() => this.logger.warn(JSON.stringify({ event: 'conversation_content_save_failed', conversationId: id })));
    return this.detail(userId, id);
  }

  private async processAssessment(id: string, userId: string, topic: string,
    turns: ConversationTurn[], audio: Buffer | undefined, segments: AudioSegment[], previous: StoredConversationAssessment, assessmentStartedAt: Date,
    pronunciationRetry = false) {
    return processConversationAssessment({
      prisma: this.prisma,
      ml: this.ml,
      logger: this.logger,
      notifications: this.notifications,
      id,
      userId,
      topic,
      turns,
      audio,
      segments,
      previous,
      assessmentStartedAt,
      pronunciationRetry,
    });
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
    const anchor = cursor ? await this.prisma.voiceConversation.findFirst({
      where: { ...where, id: cursor }, select: { id: true, createdAt: true },
    }) : null;
    if (cursor && !anchor) {
      throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    }
    const rows = await this.prisma.voiceConversation.findMany({
      where: { ...where, historyHiddenAt: null, ...(anchor ? { OR: [
        { createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } },
      ] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21,
    });
    return { items: rows.slice(0, 20).map(({ activeUserId, ...row }) => ({ ...row, assessmentStatus: computeAssessmentStatus(row) })),
      nextCursor: rows.length > 20 ? rows[19].id : null };
  }

  async hideHistory(userId: string, ids: string[]) {
    const normalizedIds = [...new Set(ids.map(id => id.toLowerCase()))];
    return this.prisma.$transaction(async tx => {
      const where: Prisma.VoiceConversationWhereInput = {
        userId, id: { in: normalizedIds }, historyStatus: VoiceHistoryStatus.SAVED, status: { in: ['ENDED', 'INTERRUPTED'] },
      };
      const matching = await tx.voiceConversation.count({ where });
      if (matching !== normalizedIds.length) {
        throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại đã kết thúc.' }, 404);
      }
      await tx.voiceConversation.updateMany({
        where: { ...where, historyHiddenAt: null }, data: { historyHiddenAt: new Date() },
      });
      return { hiddenIds: normalizedIds };
    });
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
            ...(topic.imageUrl ? { imageUrl: topic.imageUrl } : {}),
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

  async adminReleaseLock(conversationId: string) {
    const existing = await this.prisma.voiceConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true, activeUserId: true, endReason: true, endedAt: true },
    });
    if (!existing) {
      throw new HttpException(
        { code: 'ADMIN_VOICE_CONVERSATION_NOT_FOUND', message: 'Không tìm thấy phiên hội thoại.' },
        404,
      );
    }

    for (const [key, ticket] of this.tickets) {
      if (ticket.id === conversationId) {
        this.tickets.delete(key);
      }
    }

    const call = this.calls.get(conversationId);
    let released = false;
    const endedAt = new Date();
    if (call) {
      await call.close('admin_released');
      released = true;
    } else {
      const updated = await this.prisma.voiceConversation.updateMany({
        where: {
          id: conversationId,
          OR: [
            { activeUserId: { not: null } },
            { status: { in: ['CREATED', 'CONNECTING', 'ACTIVE'] } },
          ],
        },
        data: {
          activeUserId: null,
          status: 'INTERRUPTED',
          endReason: 'admin_released',
          endedAt,
        },
      });
      released = updated.count > 0;
    }

    const latest = await this.prisma.voiceConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true, activeUserId: true, endReason: true, endedAt: true },
    });
    return {
      id: conversationId,
      released,
      hadLiveCall: Boolean(call),
      status: latest?.status ?? (released ? 'INTERRUPTED' : existing.status),
      endReason: latest?.endReason ?? (released ? 'admin_released' : existing.endReason),
      endedAt: latest?.endedAt ?? (released ? endedAt : existing.endedAt),
      hasActiveLock: latest ? Boolean(latest.activeUserId) : !released && Boolean(existing.activeUserId),
    };
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
    await runVoiceWebSocketSession({
      id,
      firstSdp: first.sdp,
      client,
      prisma: this.prisma,
      config: this.config,
      logger: this.logger,
      calls: this.calls,
    });
  }
}
