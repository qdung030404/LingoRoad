"""Opt-in real Azure check through the read-aloud FastAPI route, in memory.

Consumes TTS + assessment quota. Synthetic speech verifies connectivity/contracts,
not learner scoring quality. Never writes audio or credentials to disk.
"""
import argparse
import asyncio
import os
from pathlib import Path
import sys
from xml.sax.saxutils import escape

import httpx
from dotenv import dotenv_values

PROMPTS = (
    "I have lived here for five years",
    "My name is Anna",
    "I am a student from Hanoi",
)


async def check(env_file: str, profile: str = "read-aloud-v2") -> bool:
    values = dotenv_values(env_file, encoding="utf-8-sig", interpolate=False)
    for name in ("AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"):
        value = os.environ.get(name) or values.get(name)
        if not value:
            print("Missing Azure configuration; no credentials were logged.")
            return False
        os.environ[name] = value
    region = os.environ["AZURE_SPEECH_REGION"]
    # Use a fixed regional Azure domain, never an arbitrary endpoint from dotenv.
    if not region.isalnum():
        print("Invalid region.")
        return False
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "ml"))
    from lingoroad_ml.serving.app import app

    auth = os.environ.get("LINGOROAD_ML_INTERNAL_TOKEN")
    internal_headers = {"x-internal-token": auth} if auth else {}
    internal_headers["x-speaking-profile"] = profile
    ok = True
    async with httpx.AsyncClient(timeout=60) as cloud, httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://runtime"
    ) as runtime:
        for index, prompt in enumerate(PROMPTS, 1):
            tts = await cloud.post(
                f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
                headers={
                    "Ocp-Apim-Subscription-Key": os.environ["AZURE_SPEECH_KEY"],
                    "Content-Type": "application/ssml+xml",
                    "X-Microsoft-OutputFormat": "riff-16khz-16bit-mono-pcm",
                },
                content=(f'<speak version="1.0" xml:lang="en-US">'
                         f'<voice name="en-US-JennyNeural">{escape(prompt)}'
                         '</voice></speak>'),
            )
            if tts.status_code != 200:
                print(f"case={index} tts_http={tts.status_code}")
                ok = False
                continue
            result = await runtime.post(
                "/speech/read-aloud/score", headers=internal_headers,
                data={"prompt_text": prompt},
                files={"file": ("sample.wav", tts.content, "audio/wav")},
            )
            payload = result.json() if result.status_code == 200 else {}
            names = ("accuracy", "fluency", "completeness", "pronunciation")
            if profile == "read-aloud-v2":
                names += ("prosody",)
            valid = result.status_code == 200 and all(
                isinstance(payload.get(name), (int, float))
                and not isinstance(payload[name], bool)
                and 0 <= payload[name] <= 100 for name in names
            )
            ok = ok and valid
            summary = {name: payload.get(name) for name in names}
            words = payload.get("words", [])
            counts = {name: sum(len(word.get(name, [])) for word in words) for name in ("phonemes", "syllables")}
            print(f"case={index} http={result.status_code} valid={valid} profile={payload.get('assessmentProfile')} scores={summary} details={counts}")
    return ok


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", required=True)
    parser.add_argument("--profile", choices=("read-aloud-v1", "read-aloud-v2"), default="read-aloud-v2")
    args = parser.parse_args()
    try:
        success = asyncio.run(check(args.env_file, args.profile))
    except Exception:
        print("Runtime check failed; no credentials or raw provider errors were logged.")
        success = False
    raise SystemExit(0 if success else 1)
