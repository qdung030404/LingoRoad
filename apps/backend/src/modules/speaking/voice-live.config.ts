import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { parse } from 'dotenv';

export const conversationVoices = {
  standard: undefined,
  ava: 'en-US-AvaMultilingualNeural',
  brian: 'en-US-BrianMultilingualNeural',
} as const;
export const conversationSpeechRates = { normal: '1.0', slow: '0.85', fast: '1.15' } as const;
export const conversationTurnPauses = { normal: 700, long: 1200 } as const;

export interface VoiceConversationPreferences {
  voice?: keyof typeof conversationVoices;
  speechRate?: keyof typeof conversationSpeechRates;
  turnPause?: keyof typeof conversationTurnPauses;
}

@Injectable()
export class VoiceLiveConfig {
  constructor(private readonly config: ConfigService) {}

  read() {
    let external: Record<string, string> = {};
    let fileError = false;
    const path = this.config.get<string>('AZURE_VOICE_LIVE_ENV_FILE');
    if (path) {
      try {
        external = parse(readFileSync(path));
      } catch {
        fileError = true;
      }
    }
    const value = (name: string, fallback = '') =>
      this.config.get<string>(name) || external[name] || fallback;
    const endpoint = value('AZURE_VOICE_LIVE_ENDPOINT');
    const key = value('AZURE_VOICE_LIVE_KEY');
    let validEndpoint = false;
    try {
      const url = new URL(endpoint);
      validEndpoint = url.protocol === 'https:' && !url.port && !url.username && !url.password &&
        !url.search && !url.hash && url.pathname === '/' &&
        (url.hostname.endsWith('.services.ai.azure.com') ||
          url.hostname.endsWith('.cognitiveservices.azure.com'));
    } catch { /* Missing or malformed resource endpoint. */ }
    const enabled = value('VOICE_LIVE_ENABLED', 'false') === 'true';
    const ready = !fileError && validEndpoint && Boolean(key);
    return {
      enabled, ready, endpoint, key,
      model: value('AZURE_VOICE_LIVE_MODEL', 'gpt-4o'),
      voice: value('AZURE_VOICE_LIVE_VOICE', 'en-US-AndrewMultilingualNeural'),
      apiVersion: value('AZURE_VOICE_LIVE_API_VERSION', '2026-07-15'),
      maxDurationSeconds: 180,
    };
  }

  readiness() {
    const { enabled, ready, maxDurationSeconds } = this.read();
    return {
      enabled: enabled && ready,
      status: !enabled ? 'disabled' : ready ? 'configured' : 'missing_config',
      maxDurationSeconds,
    };
  }
}
