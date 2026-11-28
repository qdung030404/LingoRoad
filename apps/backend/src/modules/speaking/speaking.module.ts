import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SpeakingController } from './speaking.controller';
import { SpeakingService } from './speaking.service';
import { VoiceLiveConfig } from './voice-live.config';
import { VoiceConversationsController } from './voice-conversations.controller';
import { VoiceConversationsService } from './voice-conversations.service';
@Module({
  imports: [NotificationsModule],
  controllers: [SpeakingController, VoiceConversationsController],
  providers: [SpeakingService, VoiceLiveConfig, VoiceConversationsService],
  exports: [SpeakingService, VoiceLiveConfig, VoiceConversationsService],
})
export class SpeakingModule {}
