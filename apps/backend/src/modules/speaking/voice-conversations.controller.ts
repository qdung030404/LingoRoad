import { Body, Controller, Get, HttpException, Param, ParseUUIDPipe, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsIn, IsJSON, IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  conversationSpeechRates, conversationTurnPauses, conversationVoices, VoiceLiveConfig,
} from './voice-live.config';
import { VoiceConversationsService } from './voice-conversations.service';
import { conversationPreparation } from './conversation-preparation';
import { SpeakingService } from './speaking.service';

const readingByTopic: Record<string, readonly string[]> = {
  'topic-1': ['read-aloud-2', 'read-aloud-3'],
  'topic-2': ['read-aloud-4'],
  'topic-3': ['read-aloud-5'],
  'topic-4': ['topic-read-aloud-1'],
  'topic-5': ['topic-read-aloud-2'],
  'topic-6': ['topic-read-aloud-3'],
};

class CreateConversationDto {
  @IsUUID() topicId!: string;
  @IsUUID() clientRequestId!: string;
  @IsOptional() @IsBoolean() deferHistory?: boolean;
  @IsOptional() @IsIn(Object.keys(conversationVoices)) voice?: keyof typeof conversationVoices;
  @IsOptional() @IsIn(Object.keys(conversationSpeechRates)) speechRate?: keyof typeof conversationSpeechRates;
  @IsOptional() @IsIn(Object.keys(conversationTurnPauses)) turnPause?: keyof typeof conversationTurnPauses;
}
class ConversationHistoryChoiceDto {
  @IsBoolean() save!: boolean;
}
class ConversationHistoryQuery {
  @IsOptional() @IsUUID() cursor?: string;
}
class ConversationAudioDto {
  @IsOptional() @IsJSON() segments?: string;
}

@Controller('speaking/conversations')
@UseGuards(JwtAuthGuard)
export class VoiceConversationsController {
  constructor(private readonly prisma: PrismaService, private readonly voice: VoiceLiveConfig,
    private readonly conversations: VoiceConversationsService, private readonly speaking: SpeakingService) {}

  @Get('topics')
  async topics() {
    const items = await this.prisma.speakingPrompt.findMany({
      where: { published: true, mode: 'TOPIC' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, text: true, hints: true, contentVersion: true },
    });
    return { success: true, data: { ...this.voice.readiness(), items } };
  }

  @Get('topics/:id')
  async topic(@Param('id', ParseUUIDPipe) id: string) {
    const topic = await this.prisma.speakingPrompt.findFirst({
      where: { id, published: true, mode: 'TOPIC' },
    });
    if (!topic) throw new HttpException({ code: 'conversation_topic_not_found', message: 'Chủ đề chưa khả dụng.' }, 404);
    const { id: topicId, code, title, text, hints, contentVersion } = topic;
    const readAloud = await this.speaking.prompts('READ_ALOUD', readingByTopic[code] ?? []);
    return { success: true, data: {
      ...this.voice.readiness(), id: topicId, title, text, hints, contentVersion, maxDurationSeconds: 180,
      practice: {
        readAloud: { enabled: readAloud.enabled, items: readAloud.items },
        topic: { enabled: this.speaking.modeEnabled('TOPIC'), prompt: topic },
      },
      preparation: conversationPreparation(code),
    } };
  }

  @Post()
  async create(@CurrentUser('sub') userId: string, @Body() body: CreateConversationDto) {
    const { topicId, clientRequestId, deferHistory, voice, speechRate, turnPause } = body;
    return { success: true, data: await this.conversations.create(
      userId, topicId, clientRequestId, deferHistory, { voice, speechRate, turnPause },
    ) };
  }

  @Get()
  async history(@CurrentUser('sub') userId: string, @Query() query: ConversationHistoryQuery) {
    return { success: true, data: await this.conversations.history(userId, query.cursor) };
  }

  @Get(':id')
  async detail(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.conversations.detail(userId, id) };
  }

  @Get(':id/summary')
  async summary(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.conversations.summary(userId, id) };
  }

  @Get(':id/turns')
  async transcript(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.conversations.transcript(userId, id) };
  }

  @Put(':id/history')
  async chooseHistory(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConversationHistoryChoiceDto) {
    return { success: true, data: await this.conversations.chooseHistory(userId, id, body.save) };
  }

  @Post(':id/finish')
  async finish(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.conversations.finish(userId, id) };
  }

  @Post(':id/turns/:itemId/translation')
  async translate(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Param('itemId') itemId: string) {
    return { success: true, data: await this.conversations.translate(userId, id, itemId) };
  }

  @Put(':id/assessment/audio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024, files: 1, fields: 1, fieldSize: 32768 } }))
  async assessAudio(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { buffer: Buffer } | undefined, @Body() body: ConversationAudioDto) {
    if (!file?.buffer) throw new HttpException({ code: 'audio_empty', message: 'Chưa có bản thu để chấm.' }, 422);
    return { success: true, data: await this.conversations.assess(userId, id, file.buffer, body.segments) };
  }

  @Post(':id/assessment')
  async assessContent(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.conversations.assess(userId, id) };
  }

  @Post(':id/assessment/content')
  async retryContent(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.conversations.retryContent(userId, id) };
  }


}
