"""Check Azure Speech credentials with synthetic audio, without printing secrets.

Run: python scripts/check-azure-speech.py --env-file PATH
Uses a short TTS request and scripted pronunciation assessment. This consumes
the resource's service quota; it does not validate learner scoring or CEFR.
"""
import argparse
import base64
import io
import json
import re
import sys
import wave
from pathlib import Path

import httpx
from dotenv import dotenv_values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, required=True)
    args = parser.parse_args()
    config = dotenv_values(args.env_file, encoding="utf-8-sig", interpolate=False)
    key = (config.get("AZURE_SPEECH_KEY") or "").strip()
    region = (config.get("AZURE_SPEECH_REGION") or "").strip()
    if not key or not re.fullmatch(r"[a-z0-9]+", region):
        print("Missing key or invalid region in config.", file=sys.stderr)
        return 1
    # Fixed Azure hosts: never forward the key to a URL supplied by a file.
    text = "I enjoy learning English every day."
    headers = {"Ocp-Apim-Subscription-Key": key}
    try:
        with httpx.Client(timeout=45, follow_redirects=False) as client:
            audio = client.post(
                f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
                headers={**headers, "Content-Type": "application/ssml+xml",
                         "X-Microsoft-OutputFormat": "riff-16khz-16bit-mono-pcm"},
                content=(f'<speak version="1.0" xml:lang="en-US">'
                         f'<voice name="en-US-JennyNeural">{text}</voice></speak>'),
            )
            if audio.status_code != 200:
                print(f"TTS failed: HTTP {audio.status_code}", file=sys.stderr)
                return 1
            with wave.open(io.BytesIO(audio.content)) as wav:
                duration = wav.getnframes() / wav.getframerate()
            if not 0 < duration <= 30:
                print("Unexpected sample duration.", file=sys.stderr)
                return 1
            assessment = base64.b64encode(json.dumps({
                "ReferenceText": text, "GradingSystem": "HundredMark",
                "Granularity": "Phoneme", "Dimension": "Comprehensive",
                "EnableMiscue": True,
            }).encode()).decode()
            response = client.post(
                f"https://{region}.stt.speech.microsoft.com/speech/recognition/"
                "conversation/cognitiveservices/v1",
                params={"language": "en-US", "format": "detailed"},
                headers={**headers, "Accept": "application/json",
                         "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
                         "Pronunciation-Assessment": assessment},
                content=audio.content,
            )
            if response.status_code != 200:
                print(f"Assessment failed: HTTP {response.status_code}", file=sys.stderr)
                return 1
            result = response.json()
            best = result.get("NBest", [{}])[0]
            # Azure response fields vary between REST versions.
            scores = best.get("PronunciationAssessment", best)
            names = ("AccuracyScore", "FluencyScore", "CompletenessScore", "PronScore")
            valid = result.get("RecognitionStatus") == "Success" and all(
                isinstance(scores.get(name), (int, float)) and
                not isinstance(scores[name], bool) and 0 <= scores[name] <= 100
                for name in names
            )
            print(json.dumps({
                "ok": valid, "region": region, "sample": "synthetic English audio",
                "duration_seconds": round(duration, 2),
                "recognition_status": result.get("RecognitionStatus"),
                "scores": {name: scores.get(name) for name in names},
                "word_count": len(best.get("Words", [])),
                "note": "Connectivity check only; not a learner or CEFR benchmark.",
            }, indent=2))
            return 0 if valid else 1
    except (httpx.HTTPError, ValueError, KeyError, IndexError, wave.Error):
        # Do not log request objects, headers, tokens, or provider error bodies.
        print("Azure Speech check failed; no credentials were logged.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
