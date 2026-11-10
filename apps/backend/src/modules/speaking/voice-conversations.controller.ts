import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { VoiceLiveConfig } from './voice-live.config';
import { VoiceConversationsService } from './voice-conversations.service';

class CreateConversationDto {
  @IsUUID() topicId!: string;
  @IsUUID() clientRequestId!: string;
}
class ConversationHistoryQuery {
  @IsOptional() @IsUUID() cursor?: string;
}

@Controller('speaking/conversations')
@UseGuards(JwtAuthGuard)
export class VoiceConversationsController {
  constructor(private readonly prisma: PrismaService, private readonly voice: VoiceLiveConfig,
    private readonly conversations: VoiceConversationsService) {}

  @Get('topics')
  async topics() {
    const items = await this.prisma.speakingPrompt.findMany({
      where: { published: true, mode: 'TOPIC' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, text: true, hints: true, contentVersion: true },
    });
    return { success: true, data: { ...this.voice.readiness(), items } };
  }

  @Post()
  async create(@CurrentUser('sub') userId: string, @Body() body: CreateConversationDto) {
    return { success: true, data: await this.conversations.create(userId, body.topicId, body.clientRequestId) };
  }

  @Get()
  async history(@CurrentUser('sub') userId: string, @Query() query: ConversationHistoryQuery) {
    return { success: true, data: await this.conversations.history(userId, query.cursor) };
  }

  @Get(':id')
  async detail(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.conversations.detail(userId, id) };
  }

  @Post(':id/finish')
  async finish(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.conversations.finish(userId, id) };
  }

  @Post(':id/turns/:itemId/translation')
  async translate(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Param('itemId') itemId: string) {
    return { success: true, data: await this.conversations.translate(userId, id, itemId) };
  }


}
