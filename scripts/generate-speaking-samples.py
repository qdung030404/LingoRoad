"""Explicitly generate bundled, synthetic sample audio using billed TTS."""
import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from xml.sax.saxutils import escape
import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/ml"))

async def generate(env_file):
    os.environ["AZURE_SPEECH_ENV_FILE"] = env_file
    from lingoroad_ml.speech.azure import configuration, validate_audio
    key, region = configuration()
    source = (ROOT / "apps/backend/prisma/seed-speaking.ts").read_text(encoding="utf-8")
    output = ROOT / "apps/mobile/assets/audio/preview"
    manifest = []
    async with httpx.AsyncClient(timeout=45) as client:
        for variable, prefix in [("readingTexts", "read-aloud"), ("topicReadingTexts", "topic-read-aloud"), ("twisters", "twister")]:
            section = source.split(f"export const {variable} = [", 1)[1].split("];", 1)[0]
            texts = re.findall(r"'([^']*)'", section)
            for index, text in enumerate(texts, 1):
                code = f"{prefix}-{index}"
                path = output / f"{code}.wav"
                if not path.exists():
                    response = await client.post(f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
                        headers={"Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
                                 "X-Microsoft-OutputFormat": "riff-16khz-16bit-mono-pcm"},
                        content=f'<speak version="1.0" xml:lang="en-US"><voice name="en-US-JennyNeural">{escape(text)}</voice></speak>')
                    if response.status_code != 200:
                        raise RuntimeError(f"TTS failed for {code}: HTTP {response.status_code}")
                    validate_audio(response.content)
                    path.write_bytes(response.content)
                data = path.read_bytes()
                duration = validate_audio(data)
                manifest.append({"code": code, "text": text, "sha256": hashlib.sha256(data).hexdigest(),
                                 "durationSeconds": duration, "voice": "en-US-JennyNeural"})
                print(f"sample={code} seconds={duration:.2f}")
    (output / "speaking-samples.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Verified {len(manifest)} samples")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", required=True)
    args = parser.parse_args()
    asyncio.run(generate(args.env_file))
