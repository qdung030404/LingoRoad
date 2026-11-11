"""Loopback-only Android WebRTC smoke relay. Requires an explicit device token."""
import argparse
import asyncio
import importlib.util
import json
from pathlib import Path
from urllib.parse import urlencode

from websockets.asyncio.client import connect
from websockets.asyncio.server import serve


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device-config', type=Path, required=True)
    parser.add_argument('--port', type=int, default=8767)
    args = parser.parse_args()
    token = json.loads(args.device_config.read_text())['VOICE_LIVE_DEVICE_TOKEN']
    spec = importlib.util.spec_from_file_location('voice_config', Path(__file__).with_name('check-voice-live.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    config = module.configuration(Path(__file__).resolve().parents[1] / 'config/local/azure/lingoroad-voice-live.env')

    async def handle(device):
        if device.request.path != '/' + token:
            await device.close(1008, 'Invalid device token')
            return
        query = urlencode({'api-version': config['apiVersion'], 'model': config['model']})
        uri = config['endpoint'].replace('https://', 'wss://', 1) + '/voice-live/realtime/calls?' + query
        try:
            async with asyncio.timeout(180), connect(uri, additional_headers={'api-key': config['key']},
                                                     open_timeout=20, close_timeout=3) as provider:
                async def outbound():
                    async for raw in device:
                        message = json.loads(raw)
                        if message.get('type') == 'rtc.call.sdp.create':
                            message['session'] = {
                                'modalities': ['text', 'audio'],
                                'instructions': 'You are a friendly lingoRoad English tutor. Practice introducing yourself. Ask one short A1-A2 question at a time. Explain in Vietnamese when asked.',
                                'voice': {'type': 'azure-standard', 'name': config['voice']},
                                'input_audio_transcription': {'model': 'azure-speech', 'language': 'en-US'},
                                'turn_detection': {'type': 'server_vad', 'threshold': 0.5,
                                                   'prefix_padding_ms': 300, 'silence_duration_ms': 700},
                            }
                        elif message.get('type') != 'response.create':
                            continue
                        await provider.send(json.dumps(message))

                async def inbound():
                    async for raw in provider:
                        message = json.loads(raw)
                        print(json.dumps({'providerEvent': message.get('type'),
                                          'errorCode': message.get('error', {}).get('code')}), flush=True)
                        await device.send(raw)

                tasks = [asyncio.create_task(outbound()), asyncio.create_task(inbound())]
                try:
                    await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                finally:
                    for task in tasks:
                        task.cancel()
                    await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as error:
            print(json.dumps({'relayError': type(error).__name__}), flush=True)
        finally:
            await device.close()

    async with serve(handle, '127.0.0.1', args.port, max_size=2**20):
        print('Device smoke relay ready on loopback', flush=True)
        await asyncio.Future()


if __name__ == '__main__':
    asyncio.run(main())
