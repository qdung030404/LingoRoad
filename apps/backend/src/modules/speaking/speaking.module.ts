import { Module } from '@nestjs/common';
import { SpeakingController } from './speaking.controller';
import { SpeakingService } from './speaking.service';
import { VoiceLiveConfig } from './voice-live.config';
import { VoiceConversationsController } from './voice-conversations.controller';
import { VoiceConversationsService } from './voice-conversations.service';
@Module({ controllers: [SpeakingController, VoiceConversationsController], providers: [SpeakingService, VoiceLiveConfig, VoiceConversationsService] })
export class SpeakingModule {}
