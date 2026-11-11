import { ConfigService } from '@nestjs/config';
import { VoiceLiveConfig } from './voice-live.config';

describe('VoiceLiveConfig', () => {
  function configuration(values: Record<string, string>) {
    return new VoiceLiveConfig(new ConfigService(values));
  }

  const resource = {
    VOICE_LIVE_ENABLED: 'true',
    AZURE_VOICE_LIVE_ENDPOINT: 'https://example.services.ai.azure.com',
    AZURE_VOICE_LIVE_KEY: 'test-secret',
  };

  it('defaults to disabled without exposing credentials', () => {
    expect(configuration({}).readiness()).toEqual({
      enabled: false, status: 'disabled', maxDurationSeconds: 180,
    });
  });

  it('reports configuration without making a provider call', () => {
    const result = configuration(resource).readiness();
    expect(result).toEqual({ enabled: true, status: 'configured', maxDurationSeconds: 180 });
    expect(JSON.stringify(result)).not.toContain('test-secret');
    expect(result).not.toHaveProperty('endpoint');
  });

  it.each(['http://example.services.ai.azure.com', 'https://example.org',
    'https://example.services.ai.azure.com/?api-key=secret',
    'https://user:secret@example.services.ai.azure.com'])('rejects invalid endpoint %s', endpoint => {
    expect(configuration({ ...resource, AZURE_VOICE_LIVE_ENDPOINT: endpoint }).readiness().enabled).toBe(false);
  });

  it('does not use the existing Speech key', () => {
    expect(configuration({ VOICE_LIVE_ENABLED: 'true', AZURE_SPEECH_KEY: 'old' }).readiness().status)
      .toBe('missing_config');
  });

  it('handles an inaccessible external configuration', () => {
    expect(configuration({ ...resource, AZURE_VOICE_LIVE_ENV_FILE: '/missing/voice-live.env' }).readiness().enabled)
      .toBe(false);
  });
});
