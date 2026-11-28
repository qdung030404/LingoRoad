import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { MlClientService } from '../ml/ml-client.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AudioSegment,
  ConversationTurn,
  conversationAnswers,
  conversationPronunciation,
  splitConversationAudio,
} from './conversation-assessment';
import {
  contentRequestFailure,
  validContentResult,
  validTopicResult,
} from './speaking.service';

export const emptySegmentHash = createHash('sha256').update('[]').digest('hex');

export interface StoredAssessedTurn {
  itemId: string;
  pronunciation?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface StoredConversationAssessment {
  schemaVersion?: number;
  segmentHash?: string | null;
  pronunciationScope?: string;
  pronunciation?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
  turns?: StoredAssessedTurn[];
  audioSource?: string | null;
  [key: string]: unknown;
}

export function wholeAudioScore(assessment: StoredConversationAssessment) {
  if (assessment.pronunciationScope === 'per_turn') return null;
  if (
    assessment.pronunciationScope === 'whole_audio' ||
    (!assessment.turns?.some((turn) => turn.pronunciation) &&
      (!assessment.segmentHash || assessment.segmentHash === emptySegmentHash))
  ) {
    return assessment.pronunciation ?? null;
  }
  return null;
}

export function computeAssessmentStatus(row: {
  assessmentStatus: string;
  assessment: unknown;
}) {
  const stored = row.assessment as StoredConversationAssessment | null;
  if (
    row.assessmentStatus === 'READY' &&
    stored?.schemaVersion === 2 &&
    Array.isArray(stored.turns) &&
    stored.turns.some((turn) => !turn.pronunciation) &&
    !wholeAudioScore(stored)
  ) {
    return 'PARTIAL';
  }
  return row.assessmentStatus;
}

export async function processConversationAssessment(params: {
  prisma: PrismaService;
  ml: MlClientService;
  logger: Logger;
  notifications?: NotificationsService;
  id: string;
  userId: string;
  topic: string;
  turns: ConversationTurn[];
  audio: Buffer | undefined;
  segments: AudioSegment[];
  previous: StoredConversationAssessment;
  assessmentStartedAt: Date;
  pronunciationRetry?: boolean;
}) {
  const {
    prisma,
    ml,
    logger,
    notifications,
    id,
    userId,
    topic,
    turns,
    audio,
    segments,
    previous,
    assessmentStartedAt,
    pronunciationRetry = false,
  } = params;

  const started = Date.now();
  const answers = conversationAnswers(turns);
  const clips =
    audio && segments.length
      ? splitConversationAudio(audio, segments)
      : new Map<string, Buffer>();

  const scoreAudio = async (
    bytes: Buffer,
  ): Promise<Record<string, unknown> | null> => {
    try {
      const result = (await ml.scoreConversationAudio(bytes)) as Record<
        string,
        unknown
      >;
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (validTopicResult(result, hash, 180, 'conversation-speaking-v1')) {
        return result;
      }
    } catch {
      /* Individual failure leaves the other replies available. */
    }
    return null;
  };

  const scoreReplies = async () => {
    const results = new Map<string, Record<string, unknown> | null>();
    for (const answer of answers) {
      const clip = clips.get(answer.itemId);
      const saved = previous.turns?.find(
        (turn) => turn.itemId === answer.itemId,
      )?.pronunciation;
      results.set(answer.itemId, saved ?? (clip ? await scoreAudio(clip) : null));
    }
    return results;
  };

  const reuseContent = pronunciationRetry;
  logger.log(
    JSON.stringify({
      event: 'conversation_assessment_started',
      conversationId: id,
      pronunciationCalls: segments.length
        ? answers.filter(
            (answer) =>
              clips.has(answer.itemId) &&
              !previous.turns?.some(
                (turn) => turn.itemId === answer.itemId && turn.pronunciation,
              ),
          ).length
        : audio
          ? 1
          : 0,
      contentCalls: reuseContent ? 0 : 1,
    }),
  );

  const contentPromise = reuseContent
    ? Promise.resolve(previous.content ?? { status: 'unavailable' })
    : ml
        .scoreConversationContent(
          topic,
          turns.filter((turn) => turn.transcript.trim()),
        )
        .catch(contentRequestFailure);

  const [replies, contentResult, legacySpeech] = await Promise.all([
    scoreReplies(),
    contentPromise,
    audio && !segments.length
      ? scoreAudio(audio)
      : Promise.resolve(wholeAudioScore(previous)),
  ]);

  const transcript = turns
    .filter((turn) => turn.role === 'USER')
    .map((turn) => turn.transcript)
    .join('\n');
  const content: Record<string, unknown> =
    reuseContent && previous.content
      ? previous.content
      : validContentResult(contentResult, transcript, 'conversation-content-v1')
        ? (contentResult as Record<string, unknown>)
        : { status: 'unavailable', errorCode: 'content_invalid_response' };

  const results = answers.map((answer) => {
    const candidate = Array.isArray(content.turns)
      ? (content.turns as StoredAssessedTurn[]).find(
          (item) => item.itemId === answer.itemId,
        )?.content
      : null;
    const saved = reuseContent
      ? previous.turns?.find((turn) => turn.itemId === answer.itemId)?.content
      : null;
    const turnContent =
      saved ??
      (candidate &&
      validContentResult(candidate, answer.answer, 'conversation-content-v1')
        ? candidate
        : { status: 'unavailable', errorCode: 'content_assessment_failed' });
    return {
      ...answer,
      pronunciation: replies.get(answer.itemId),
      content: turnContent,
    };
  });

  const hasSpeech = legacySpeech || results.some((turn) => turn.pronunciation);
  const hasContent = content.status === 'succeeded';
  const complete =
    hasContent &&
    (legacySpeech ||
      (results.length > 0 && results.every((turn) => turn.pronunciation)));
  const status = complete
    ? 'READY'
    : hasSpeech || hasContent
      ? 'PARTIAL'
      : 'FAILED';

  const assessment = {
    schemaVersion: 2,
    pronunciation: conversationPronunciation(results) ?? legacySpeech,
    content,
    turns: results,
    pronunciationScope: legacySpeech ? 'whole_audio' : 'per_turn',
    segmentHash: previous.segmentHash ?? null,
    contentBasis: 'learner_reply_with_question',
    audioSource: audio
      ? 'local_microphone_vad'
      : (previous.audioSource ?? null),
    assessedAt: new Date().toISOString(),
  };

  const updated = await prisma.voiceConversation.updateMany({
    where: { id, userId, assessmentStatus: 'PROCESSING', assessmentStartedAt },
    data: {
      assessmentStatus: status,
      assessment: assessment as Prisma.InputJsonValue,
    },
  });

  if (updated.count && (status === 'READY' || status === 'PARTIAL') && notifications) {
    try {
      await notifications.createNotification({
        userId,
        type: 'SPEAKING_RESULT_READY',
        title: 'Kết quả hội thoại AI đã sẵn sàng',
        body:
          status === 'READY'
            ? 'Phiên hội thoại luyện nói của bạn đã có kết quả đánh giá đầy đủ.'
            : 'Phiên hội thoại luyện nói của bạn đã có kết quả đánh giá một phần.',
        targetType: 'SPEAKING',
        targetPayload: { conversationId: id, assessmentStatus: status },
        dedupeKey: `voice_conversation:${id}`,
      });
    } catch (error) {
      logger.warn(
        JSON.stringify({
          event: 'conversation_notification_failed',
          conversationId: id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  logger.log(
    JSON.stringify({
      event: 'conversation_assessment_completed',
      conversationId: id,
      status,
      contentStatus: content.status,
      contentErrorCode: content.errorCode,
      totalReplies: answers.length,
      scoredReplies: results.filter((turn) => turn.pronunciation).length,
      latencyMs: Date.now() - started,
    }),
  );
}
