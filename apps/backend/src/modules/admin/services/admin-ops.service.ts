import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SpeakingMode, SpeakingStatus } from '@prisma/client';
import { MediaStorageService } from '../../media/media-storage.service';
import { MlClientService } from '../../ml/ml-client.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SpeakingService } from '../../speaking/speaking.service';
import { VoiceConversationsService } from '../../speaking/voice-conversations.service';
import { VoiceLiveConfig } from '../../speaking/voice-live.config';
import {
  AdminSpeakingSubmissionsQueryDto,
  AdminVoiceConversationsQueryDto,
} from '../dto/admin-ops.dto';
import {
  extractSpeakingOverallScore,
  PaginatedResult,
} from './admin-users.service';
import {
  AdminSpeakingSubmissionDetail,
  AdminSpeakingSubmissionItem,
  AdminSpeakingSubmissionsSummary,
  AdminSystemReadinessView,
  AdminVoiceConversationDetail,
  AdminVoiceConversationItem,
  AdminVoiceConversationsSummary,
  canRetrySpeakingContent,
  extractContentStatus,
  isSpeakingStuckProcessing,
  SPEAKING_STUCK_MS,
  VOICE_ASSESSMENT_STUCK_MS,
  VOICE_LOCK_STUCK_MS,
} from './ops/admin-ops.types';

export type {
  AdminSpeakingSubmissionDetail,
  AdminSpeakingSubmissionItem,
  AdminSpeakingSubmissionsSummary,
  AdminSystemReadinessView,
  AdminVoiceConversationDetail,
  AdminVoiceConversationItem,
  AdminVoiceConversationsSummary,
} from './ops/admin-ops.types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AdminOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly voiceConversationsService: VoiceConversationsService,
    private readonly speakingService: SpeakingService,
    private readonly voiceLiveConfig: VoiceLiveConfig,
    private readonly mlClient: MlClientService,
    @Optional() private readonly mediaStorage?: MediaStorageService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async listVoiceConversations(
    query: AdminVoiceConversationsQueryDto,
  ): Promise<
    PaginatedResult<AdminVoiceConversationItem, AdminVoiceConversationsSummary>
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const stuckAssessmentCutoff = new Date(Date.now() - VOICE_ASSESSMENT_STUCK_MS);

    const andConditions: Prisma.VoiceConversationWhereInput[] = [];
    if (query.userId) andConditions.push({ userId: query.userId });
    if (query.status) andConditions.push({ status: query.status.trim().toUpperCase() });
    if (query.assessmentStatus) {
      andConditions.push({
        assessmentStatus: query.assessmentStatus.trim().toUpperCase(),
      });
    }
    if (query.stuckOnly === 'true') {
      andConditions.push({
        OR: [
          { activeUserId: { not: null } },
          {
            assessmentStatus: 'PROCESSING',
            OR: [
              { assessmentStartedAt: { lt: stuckAssessmentCutoff } },
              { assessmentStartedAt: null },
            ],
          },
        ],
      });
    }
    if (search) {
      andConditions.push({
        OR: [
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          ...(UUID_REGEX.test(search)
            ? [{ id: search }, { userId: search }, { topicId: search }]
            : []),
        ],
      });
    }

    const where: Prisma.VoiceConversationWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [total, rows, activeLocks, failedAssessments, stuckProcessing] =
      await Promise.all([
        this.prisma.voiceConversation.count({ where }),
        this.prisma.voiceConversation.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: { select: { id: true, email: true, name: true } },
            _count: { select: { turns: true } },
          },
        }),
        this.prisma.voiceConversation.count({
          where: { activeUserId: { not: null } },
        }),
        this.prisma.voiceConversation.count({
          where: { assessmentStatus: { in: ['FAILED', 'UNKNOWN'] } },
        }),
        this.prisma.voiceConversation.count({
          where: {
            assessmentStatus: 'PROCESSING',
            OR: [
              { assessmentStartedAt: { lt: stuckAssessmentCutoff } },
              { assessmentStartedAt: null },
            ],
          },
        }),
      ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        topicId: row.topicId,
        topicTitle:
          (row.topicSnapshot as { title?: string } | null)?.title ?? 'Hội thoại AI',
        status: row.status,
        endReason: row.endReason,
        historyStatus: row.historyStatus,
        historyHiddenAt: row.historyHiddenAt,
        assessmentStatus: row.assessmentStatus,
        hasActiveLock: Boolean(row.activeUserId),
        turnsCount: row._count.turns,
        createdAt: row.createdAt,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        assessmentStartedAt: row.assessmentStartedAt,
        user: row.user,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      summary: {
        activeLocks,
        failedAssessments,
        stuckProcessing,
      },
    };
  }

  async getVoiceConversation(id: string): Promise<AdminVoiceConversationDetail> {
    const row = await this.prisma.voiceConversation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        turns: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'ADMIN_VOICE_CONVERSATION_NOT_FOUND',
        message: 'Không tìm thấy phiên hội thoại.',
      });
    }

    return {
      id: row.id,
      userId: row.userId,
      topicId: row.topicId,
      topicTitle:
        (row.topicSnapshot as { title?: string } | null)?.title ?? 'Hội thoại AI',
      status: row.status,
      endReason: row.endReason,
      historyStatus: row.historyStatus,
      historyHiddenAt: row.historyHiddenAt,
      assessmentStatus: row.assessmentStatus,
      hasActiveLock: Boolean(row.activeUserId),
      turnsCount: row.turns.length,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      assessmentStartedAt: row.assessmentStartedAt,
      user: row.user,
      topicSnapshot: row.topicSnapshot,
      assessment: row.assessment,
      assessmentAudioHash: row.assessmentAudioHash,
      turns: row.turns.map((turn) => ({
        id: turn.id,
        providerItemId: turn.providerItemId,
        sequence: turn.sequence,
        role: turn.role,
        transcript: turn.transcript,
        translationVi: turn.translationVi,
        interrupted: turn.interrupted,
        createdAt: turn.createdAt,
      })),
    };
  }

  async releaseVoiceConversationLock(id: string) {
    return this.voiceConversationsService.adminReleaseLock(id);
  }

  async retryVoiceConversationContent(id: string) {
    const row = await this.prisma.voiceConversation.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'ADMIN_VOICE_CONVERSATION_NOT_FOUND',
        message: 'Không tìm thấy phiên hội thoại.',
      });
    }
    return this.voiceConversationsService.retryContent(row.userId, id);
  }

  async listSpeakingSubmissions(
    query: AdminSpeakingSubmissionsQueryDto,
  ): Promise<
    PaginatedResult<AdminSpeakingSubmissionItem, AdminSpeakingSubmissionsSummary>
  > {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const nowMs = Date.now();
    const stuckCutoff = new Date(nowMs - SPEAKING_STUCK_MS);

    const where: Prisma.SpeakingSubmissionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.mode ? { prompt: { mode: query.mode } } : {}),
      ...(query.errorCode?.trim() ? { errorCode: query.errorCode.trim() } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(search
        ? {
            OR: [
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { user: { name: { contains: search, mode: 'insensitive' } } },
              { prompt: { code: { contains: search, mode: 'insensitive' } } },
              { prompt: { title: { contains: search, mode: 'insensitive' } } },
              { errorCode: { contains: search, mode: 'insensitive' } },
              ...(UUID_REGEX.test(search)
                ? [{ id: search }, { userId: search }, { promptId: search }]
                : []),
            ],
          }
        : {}),
    };

    const [total, rows, failed, unknown, stuckProcessing, contentUnavailable] =
      await Promise.all([
        this.prisma.speakingSubmission.count({ where }),
        this.prisma.speakingSubmission.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: { select: { id: true, email: true, name: true } },
            prompt: { select: { code: true, title: true, mode: true } },
          },
        }),
        this.prisma.speakingSubmission.count({
          where: { status: SpeakingStatus.FAILED },
        }),
        this.prisma.speakingSubmission.count({
          where: { status: SpeakingStatus.UNKNOWN },
        }),
        this.prisma.speakingSubmission.count({
          where: {
            status: SpeakingStatus.PROCESSING,
            OR: [
              { processingAt: { lt: stuckCutoff } },
              { processingAt: null, createdAt: { lt: stuckCutoff } },
            ],
          },
        }),
        this.prisma.speakingSubmission.count({
          where: {
            result: { path: ['content', 'status'], equals: 'unavailable' },
          },
        }),
      ]);

    return {
      items: rows.map((row) => {
        const snapshot = row.promptSnapshot as {
          mode?: SpeakingMode;
          title?: string;
        } | null;
        const mode = snapshot?.mode ?? row.prompt?.mode ?? SpeakingMode.READ_ALOUD;
        return {
          id: row.id,
          userId: row.userId,
          promptId: row.promptId,
          promptCode: row.prompt?.code ?? null,
          promptTitle: snapshot?.title ?? row.prompt?.title ?? 'Luyện nói',
          mode,
          status: row.status,
          overallScore: extractSpeakingOverallScore(row.result),
          contentStatus: extractContentStatus(row.result),
          errorCode: row.errorCode,
          adapterVersion: row.adapterVersion,
          canRetryContent: canRetrySpeakingContent(mode, row.status, row.result),
          isStuckProcessing: isSpeakingStuckProcessing(
            row.status,
            row.processingAt,
            row.createdAt,
            nowMs,
          ),
          processingAt: row.processingAt,
          completedAt: row.completedAt,
          createdAt: row.createdAt,
          historyHiddenAt: row.historyHiddenAt,
          user: row.user,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      summary: {
        failed,
        unknown,
        stuckProcessing,
        contentUnavailable,
      },
    };
  }

  async getSpeakingSubmission(id: string): Promise<AdminSpeakingSubmissionDetail> {
    const row = await this.prisma.speakingSubmission.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        prompt: { select: { code: true, title: true, mode: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'ADMIN_SPEAKING_SUBMISSION_NOT_FOUND',
        message: 'Không tìm thấy bài nộp luyện nói.',
      });
    }

    const nowMs = Date.now();
    const snapshot = row.promptSnapshot as {
      mode?: SpeakingMode;
      title?: string;
    } | null;
    const mode = snapshot?.mode ?? row.prompt?.mode ?? SpeakingMode.READ_ALOUD;

    return {
      id: row.id,
      userId: row.userId,
      promptId: row.promptId,
      promptCode: row.prompt?.code ?? null,
      promptTitle: snapshot?.title ?? row.prompt?.title ?? 'Luyện nói',
      mode,
      status: row.status,
      overallScore: extractSpeakingOverallScore(row.result),
      contentStatus: extractContentStatus(row.result),
      errorCode: row.errorCode,
      adapterVersion: row.adapterVersion,
      canRetryContent: canRetrySpeakingContent(mode, row.status, row.result),
      isStuckProcessing: isSpeakingStuckProcessing(
        row.status,
        row.processingAt,
        row.createdAt,
        nowMs,
      ),
      processingAt: row.processingAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      historyHiddenAt: row.historyHiddenAt,
      user: row.user,
      promptSnapshot: row.promptSnapshot,
      result: row.result,
      audioHash: row.audioHash,
    };
  }

  async retrySpeakingSubmissionContent(id: string) {
    return this.speakingService.adminRetryContent(id);
  }

  async expireSpeakingSubmission(id: string) {
    return this.speakingService.adminExpireStuck(id);
  }

  async getSystemReadiness(): Promise<AdminSystemReadinessView> {
    const now = new Date();
    const voiceLockCutoff = new Date(now.getTime() - VOICE_LOCK_STUCK_MS);
    const speakingStuckCutoff = new Date(now.getTime() - SPEAKING_STUCK_MS);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const dbCheckPromise = (async () => {
      const started = Date.now();
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        return {
          status: 'ready' as const,
          latencyMs: Date.now() - started,
        };
      } catch (err) {
        return {
          status: 'unavailable' as const,
          latencyMs: Date.now() - started,
          error: err instanceof Error ? err.message : 'Database ping failed',
        };
      }
    })();

    const incidentsPromise = Promise.all([
      this.prisma.voiceConversation.count({
        where: {
          activeUserId: { not: null },
          createdAt: { lt: voiceLockCutoff },
        },
      }),
      this.prisma.speakingSubmission.count({
        where: {
          status: SpeakingStatus.PROCESSING,
          OR: [
            { processingAt: { lt: speakingStuckCutoff } },
            { processingAt: null, createdAt: { lt: speakingStuckCutoff } },
          ],
        },
      }),
      this.prisma.speakingSubmission.count({
        where: {
          status: { in: [SpeakingStatus.FAILED, SpeakingStatus.UNKNOWN] },
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      this.prisma.refreshSession.count({
        where: { isRevoked: false, expiresAt: { gt: now } },
      }),
    ]).catch(() => [0, 0, 0, 0] as const);

    const [database, ml, incidentsTuple] = await Promise.all([
      dbCheckPromise,
      this.mlClient.checkReady(),
      incidentsPromise,
    ]);

    const voiceReadiness = this.voiceLiveConfig.readiness();
    const voiceSettings = this.voiceLiveConfig.read();

    const appVersion =
      this.configService?.get<string>('APP_VERSION')?.trim() ||
      process.env.APP_VERSION?.trim() ||
      '1.0.0';
    const authProvider =
      this.configService?.get<string>('AUTH_PROVIDER')?.trim() ||
      process.env.AUTH_PROVIDER?.trim() ||
      'firebase';

    return {
      checkedAt: now.toISOString(),
      appVersion,
      authProvider,
      database,
      mediaStorage: {
        mode: this.mediaStorage?.storageMode() ?? 'local',
        azureConfigured: this.mediaStorage?.isAzureConfigured() ?? false,
        azureRequired: this.mediaStorage?.isAzureRequired() ?? false,
      },
      ml,
      voiceLive: {
        enabled: voiceReadiness.enabled,
        status: voiceReadiness.status,
        maxDurationSeconds: voiceReadiness.maxDurationSeconds,
        model: voiceSettings.model,
        voice: voiceSettings.voice,
        apiVersion: voiceSettings.apiVersion,
      },
      speaking: {
        scoringProfile: this.mlClient.speakingProfile,
        modes: {
          READ_ALOUD: this.speakingService.modeEnabled(SpeakingMode.READ_ALOUD),
          TOPIC: this.speakingService.modeEnabled(SpeakingMode.TOPIC),
          PICTURE_DESCRIPTION: this.speakingService.modeEnabled(
            SpeakingMode.PICTURE_DESCRIPTION,
          ),
          TONGUE_TWISTER: this.speakingService.modeEnabled(
            SpeakingMode.TONGUE_TWISTER,
          ),
        },
      },
      incidents: {
        stuckVoiceLocks: incidentsTuple[0],
        stuckSpeakingJobs: incidentsTuple[1],
        failedSpeaking24h: incidentsTuple[2],
        activeRefreshSessions: incidentsTuple[3],
      },
    };
  }
}
