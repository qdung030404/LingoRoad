import { HttpException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import { VoiceLiveConfig } from './voice-live.config';
import { MlClientService } from '../ml/ml-client.service';

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
    }, 30000);
    this.sweep.unref();
  }

  async onModuleDestroy() {
    clearInterval(this.sweep);
    await Promise.all([...this.calls.values()].map(call => call.close('server_stopped')));
    this.server?.close();
  }

  async detail(userId: string, id: string) {
    const row = await this.prisma.voiceConversation.findFirst({ where: { id, userId },
      include: { turns: { orderBy: { sequence: 'asc' } } } });
    if (!row) throw new HttpException({ code: 'conversation_not_found', message: 'Không tìm thấy hội thoại.' }, 404);
    const { activeUserId, ...result } = row;
    return result;
  }

  async history(userId: string, cursor?: string) {
    if (cursor) await this.detail(userId, cursor);
    const rows = await this.prisma.voiceConversation.findMany({ where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    return { items: rows.slice(0, 20).map(({ activeUserId, ...row }) => row),
      nextCursor: rows.length > 20 ? rows[19].id : null };
  }

  async create(userId: string, topicId: string, clientRequestId: string) {
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
          topicSnapshot: { title: topic.title, text: topic.text, hints: topic.hints, contentVersion: topic.contentVersion,
            model: settings.model, voice: settings.voice, instructionsVersion: 'conversation-tutor-v1', maxDurationSeconds: 180 } } });
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
    let timer: NodeJS.Timeout;
    let deadline: NodeJS.Timeout;
    let greeted = false;
    let sequence = 0;
    let writing = Promise.resolve();
    const indices = new Map<string, number>();
    const index = (item: string) => { if (!indices.has(item)) indices.set(item, sequence++); return indices.get(item)!; };
    const close = (reason: string): Promise<void> => {
      if (closed) return closed;
      closed = (async () => {
        clearTimeout(timer); clearTimeout(deadline);
        provider.close();
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'conversation.ended', reason }));
        client.close();
        await writing;
        await this.prisma.voiceConversation.updateMany({ where: { id, status: { in: ['CONNECTING', 'ACTIVE'] } },
          data: { activeUserId: null, status: ['user_finished', 'time_limit'].includes(reason) ? 'ENDED' : 'INTERRUPTED', endReason: reason, endedAt: new Date() } });
        this.calls.delete(id);
        this.logger.log(JSON.stringify({ conversationId: id, status: 'closed', reason }));
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
        voice: { type: 'azure-standard', name: topic.voice },
        input_audio_transcription: { model: 'azure-speech', language: 'en-US' },
        turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 700 },
      } }));
    });
    provider.on('message', message => {
      let event: Record<string, any>;
      try { event = JSON.parse(message.toString()); } catch { safelyClose('invalid_provider_event'); return; }
      writing = writing.then(async () => {
        if (event.type === 'error') { safelyClose('provider_error'); return; }
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
        if (role && typeof event.transcript === 'string' && event.item_id) {
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
