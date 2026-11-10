import { Controller, Get, Post, Put, Body, Param, Query, UploadedFile, UseGuards, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SpeakingService } from './speaking.service';
import { CreateSpeakingDto, SpeakingHistoryQuery, SpeakingPromptsQuery } from './speaking.dto';
import { MAX_SPEAKING_BYTES } from './wav';

@Controller('speaking')
@UseGuards(JwtAuthGuard)
export class SpeakingController {
  constructor(private readonly speaking: SpeakingService) {}
  @Get('prompts') async prompts(@Query() query: SpeakingPromptsQuery) { return { success: true, data: await this.speaking.prompts(query.mode) }; }
  @Get('game/progress') async gameProgress(@CurrentUser('sub') userId: string) { return { success: true, data: await this.speaking.gameProgress(userId) }; }
  @Post('submissions') async create(@CurrentUser('sub') userId: string, @Body() dto: CreateSpeakingDto) {
    return { success: true, data: await this.speaking.create(userId, dto) };
  }
  @Get('history') async history(@CurrentUser('sub') userId: string, @Query() query: SpeakingHistoryQuery) {
    return { success: true, data: await this.speaking.history(userId, query.cursor, query.mode) };
  }
  @Get('submissions/:id') async detail(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.speaking.detail(userId, id) };
  }
  @Put('submissions/:id/audio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SPEAKING_BYTES, files: 1, fields: 0 } }))
  async upload(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: { buffer: Buffer }) {
    return { success: true, data: await this.speaking.upload(userId, id, file?.buffer) };
  }
}
