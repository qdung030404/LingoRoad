"""Check external Voice Live configuration; --connect explicitly opens a provider session."""
import argparse
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlencode, urlsplit

from dotenv import dotenv_values


def configuration(path):
    values = {**dotenv_values(path), **os.environ}
    endpoint = values.get('AZURE_VOICE_LIVE_ENDPOINT', '').rstrip('/')
    key = values.get('AZURE_VOICE_LIVE_KEY', '')
    url = urlsplit(endpoint)
    valid = (url.scheme == 'https' and not url.username and not url.password
             and not url.query and not url.fragment and not url.path
             and url.port in (None, 443)
             and bool(url.hostname)
             and url.hostname.endswith(('.services.ai.azure.com', '.cognitiveservices.azure.com')))
    if not valid or not key:
        raise ValueError('missing_or_invalid_config')
    return {
        'endpoint': endpoint, 'key': key,
        'model': values.get('AZURE_VOICE_LIVE_MODEL', 'gpt-4o'),
        'voice': values.get('AZURE_VOICE_LIVE_VOICE', 'en-US-AndrewMultilingualNeural'),
        'apiVersion': values.get('AZURE_VOICE_LIVE_API_VERSION', '2026-07-15'),
    }


async def connect(config):
    from websockets.asyncio.client import connect as websocket_connect
    # The calls channel waits for an SDP offer. Probe the standard control channel
    # here so a valid resource is not incorrectly reported as a timeout.
    query = urlencode({'api-version': '2026-04-10', 'model': config['model']})
    uri = config['endpoint'].replace('https://', 'wss://', 1) + '/voice-live/realtime?' + query
    async with websocket_connect(uri, additional_headers={'api-key': config['key']},
                                 open_timeout=15, close_timeout=3, max_size=2**20) as socket:
        event = json.loads(await asyncio.wait_for(socket.recv(), 15))
        if event.get('type') != 'session.created':
            raise ValueError('unexpected_provider_event')
        await socket.send(json.dumps({'type': 'session.update', 'session': {
            'modalities': ['text', 'audio'],
            'instructions': 'You are a friendly lingoRoad English tutor. Ask one short A1-A2 question at a time. Help in Vietnamese when requested.',
            'voice': {'type': 'azure-standard', 'name': config['voice']},
            'turn_detection': {'type': 'server_vad', 'threshold': 0.5,
                               'prefix_padding_ms': 300, 'silence_duration_ms': 700},
        }}))
        event = json.loads(await asyncio.wait_for(socket.recv(), 15))
        if event.get('type') != 'session.updated':
            raise ValueError('provider_rejected_session_configuration')
        # No response.create or microphone data is sent by this connectivity check.
        return {'status': 'connected', 'event': 'session.updated',
                'webrtcAudioVerified': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, default=Path(__file__).resolve().parents[1] / 'config/local/azure/lingoroad-voice-live.env')
    parser.add_argument('--connect', action='store_true', help='Open a real provider session, which may incur usage.')
    args = parser.parse_args()
    try:
        config = configuration(args.env_file)
        result = asyncio.run(connect(config)) if args.connect else {'status': 'configured', 'providerCalled': False}
        print(json.dumps(result))
        return 0
    except Exception as error:
        # Provider exceptions can embed request URLs and headers. Emit only their class.
        print(json.dumps({'status': 'unavailable', 'errorType': type(error).__name__}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
