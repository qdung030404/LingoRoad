"""Short scripted Azure assessment. Audio is processed only in memory."""
import asyncio
import base64
import io
import json
import math
import os
import re
import struct
import wave
from datetime import datetime, timezone
from hashlib import sha256

import httpx
from dotenv import dotenv_values
from fastapi import HTTPException

MAX_BYTES = 2 * 1024 * 1024
ADAPTER_VERSION = "azure-read-aloud-v1"
PROFILES = {"read-aloud-v1", "read-aloud-v2"}


def assessment_parameters(prompt: str, profile: str) -> dict:
    if profile not in PROFILES:
        raise HTTPException(422, "invalid_assessment_profile")
    parameters = {"ReferenceText": prompt, "GradingSystem": "HundredMark",
                  "Granularity": "Phoneme", "Dimension": "Comprehensive", "EnableMiscue": True}
    if profile == "read-aloud-v2":
        parameters["EnableProsodyAssessment"] = True
        parameters["PhonemeAlphabet"] = "IPA"
    return parameters


def _timing(entry: dict, duration: float) -> dict:
    offset, length = entry.get("Offset"), entry.get("Duration")
    valid = all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0 for v in (offset, length))
    if not valid or offset + length > duration * 10_000_000 + 10_000:
        return {"offsetMs": None, "durationMs": None}
    return {"offsetMs": offset / 10_000, "durationMs": length / 10_000}


def _confidence(value):
    if value is None:
        return None
    result = _score(value)
    if result > 1:
        raise ValueError("invalid confidence")
    return result


def _segments(entry: dict, key: str, label: str, duration: float) -> list:
    segments = []
    for segment in entry.get(key, []):
        text = segment[label]
        if not isinstance(text, str) or not text:
            raise ValueError("invalid segment")
        value = segment.get("PronunciationAssessment", segment).get("AccuracyScore")
        segments.append({label.lower(): text, "accuracy": None if value is None else _score(value), **_timing(segment, duration)})
    return segments


def _word_details(entry: dict, scores: dict, duration: float, confidence_parser=_confidence) -> dict:
    feedback = entry.get("Feedback", scores.get("Feedback", {})).get("Prosody", {})
    breaks, intonation = feedback.get("Break", {}), feedback.get("Intonation", {})
    return {**_timing(entry, duration),
            "phonemes": _segments(entry, "Phonemes", "Phoneme", duration),
            "syllables": _segments(entry, "Syllables", "Syllable", duration),
            "prosody": {
                "unexpectedBreakConfidence": confidence_parser(breaks.get("UnexpectedBreak", {}).get("Confidence")),
                "missingBreakConfidence": confidence_parser(breaks.get("MissingBreak", {}).get("Confidence")),
                "monotone": "Monotone" in intonation.get("ErrorTypes", []) if intonation else None,
            }}


def configuration() -> tuple[str, str]:
    path = os.environ.get("AZURE_SPEECH_ENV_FILE")
    try:
        values = dotenv_values(path, encoding="utf-8-sig", interpolate=False) if path else {}
    except (OSError, UnicodeError):
        values = {}
    key = (os.environ.get("AZURE_SPEECH_KEY") or values.get("AZURE_SPEECH_KEY") or "").strip()
    region = (os.environ.get("AZURE_SPEECH_REGION") or values.get("AZURE_SPEECH_REGION") or "").strip()
    if not key or not re.fullmatch(r"[a-z0-9]+", region):
        raise HTTPException(503, "azure_missing_config")
    return key, region


def readiness() -> str:
    try:
        configuration()
        return "ready"
    except HTTPException:
        return "missing_config"


def validate_audio(data: bytes, max_seconds: int = 30, max_bytes: int = MAX_BYTES) -> float:
    if len(data) > max_bytes:
        raise HTTPException(413, "audio_too_large")
    if not data:
        raise HTTPException(422, "audio_empty")
    # Python wave supports extensible WAV too; this contract requires plain PCM.
    try:
        with wave.open(io.BytesIO(data), "rb") as audio:
            if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype()) != (1, 2, 16000, "NONE"):
                raise HTTPException(415, "unsupported_audio_format")
            frames = audio.getnframes()
            duration = frames / 16000
            if duration <= 0:
                raise HTTPException(422, "audio_empty")
            if duration > max_seconds:
                raise HTTPException(413, "audio_too_long")
            pcm = audio.readframes(frames)
            if len(pcm) != frames * 2:
                raise HTTPException(415, "invalid_audio")
    except (wave.Error, EOFError, ValueError, OSError):
        raise HTTPException(415, "invalid_audio") from None
    samples = struct.unpack(f"<{frames}h", pcm)
    rms = math.sqrt(sum(value * value for value in samples) / frames)
    if rms < 10:
        raise HTTPException(422, "audio_silent")
    return duration


def _score(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100:
        raise ValueError("invalid score")
    return value


def normalize_assessment(payload: dict, duration: float, profile: str = "read-aloud-v1", reference_text: str = "", audio_hash: str | None = None, service_region: str | None = None) -> dict:
    assessment_parameters(reference_text, profile)
    try:
        status = payload.get("RecognitionStatus")
        if status in {"NoMatch", "InitialSilenceTimeout", "BabbleTimeout", "EndOfDictation"}:
            raise HTTPException(422, "speech_not_recognized")
        if status != "Success":
            raise ValueError("invalid recognition status")
        best = payload["NBest"][0]
        transcript = best.get("Display") or payload.get("DisplayText")
        if not isinstance(transcript, str) or not transcript.strip():
            raise ValueError("missing transcript")
        assessment = best.get("PronunciationAssessment", best)
        result = {target: _score(assessment[source]) for target, source in (
            ("accuracy", "AccuracyScore"), ("fluency", "FluencyScore"),
            ("completeness", "CompletenessScore"), ("pronunciation", "PronScore"))}
        words = []
        for entry in best["Words"]:
            word = entry["Word"]
            if not isinstance(word, str) or not word:
                raise ValueError("invalid word")
            scores = entry.get("PronunciationAssessment", entry)
            error = scores.get("ErrorType", "None")
            if error not in {"None", "Omission", "Insertion", "Mispronunciation", "UnexpectedBreak", "MissingBreak", "Monotone"}:
                raise ValueError("invalid word error")
            accuracy = scores.get("AccuracyScore")
            normalized = {"word": word, "accuracy": None if accuracy is None else _score(accuracy), "errorType": error}
            if profile == "read-aloud-v2":
                normalized.update(_word_details(entry, scores, duration))
            words.append(normalized)
        if not words:
            raise ValueError("missing words")
        messages = []
        for error, message in (("Omission", "Từ chưa đọc"), ("Insertion", "Từ đọc thêm"), ("Mispronunciation", "Từ cần luyện theo lingoRoad")):
            selected = [word["word"] for word in words if word["errorType"] == error]
            if selected:
                messages.append(f"{message}: {', '.join(selected)}.")
        if not messages:
            messages.append("lingoRoad đã ghi nhận bài đọc. Hãy xem điểm từng từ và luyện lại để cải thiện độ rõ ràng, trôi chảy.")
        normalized = {**result, "transcript": transcript.strip(), "words": words,
                "durationSeconds": duration, "provider": "azure", "adapterVersion": ADAPTER_VERSION,
                "feedbackVi": " ".join(messages)}
        if profile == "read-aloud-v2":
            prosody = assessment.get("ProsodyScore")
            normalized.update(schemaVersion=2, assessmentProfile=profile,
                              prosody=None if prosody is None else _score(prosody),
                              assessmentCompleteness="partial" if prosody is None else "full",
                              referenceText=reference_text, audioHash=audio_hash, serviceRegion=service_region,
                              serviceVersion=payload.get("ModelVersion") if isinstance(payload.get("ModelVersion"), str) else None,
                              assessedAt=datetime.now(timezone.utc).isoformat(), adapterVersion="azure-read-aloud-v2-ipa",
                              assessmentConfig={"locale": "en-US", "scenario": "reading", "gradingSystem": "HundredMark",
                                                "granularity": "Phoneme", "phonemeAlphabet": "IPA", "dimension": "Comprehensive", "enableMiscue": True,
                                                "enableProsodyAssessment": True, "breakConfidenceThreshold": 0.75, "monotoneScope": "utterance"})
        return normalized
    except (KeyError, IndexError, TypeError, ValueError, AttributeError):
        raise HTTPException(502, "azure_invalid_response") from None


async def assess(data: bytes, prompt_text: str, profile: str = "read-aloud-v1") -> dict:
    parameters = assessment_parameters(prompt_text, profile)
    duration = validate_audio(data)
    if not prompt_text.strip() or len(prompt_text) > 1000:
        raise HTTPException(422, "invalid_prompt")
    key, region = configuration()
    assessment = base64.b64encode(json.dumps(parameters).encode()).decode()
    try:
        async with asyncio.timeout(45):
            async with httpx.AsyncClient(timeout=45, follow_redirects=False) as client:
                response = await client.post(
                    f"https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1",
                    params={"language": "en-US", "format": "detailed"},
                    headers={"Ocp-Apim-Subscription-Key": key, "Accept": "application/json",
                        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
                        "Pronunciation-Assessment": assessment}, content=data)
        if response.status_code == 429:
            raise HTTPException(429, "azure_quota_exceeded")
        if response.status_code in {401, 403}:
            raise HTTPException(503, "azure_auth_failed")
        if response.status_code != 200:
            raise HTTPException(502, "azure_unavailable")
        return normalize_assessment(response.json(), duration, profile, prompt_text, sha256(data).hexdigest(), region)
    except (TimeoutError, httpx.TimeoutException):
        raise HTTPException(504, "azure_timeout") from None
    except httpx.HTTPError:
        raise HTTPException(502, "azure_transport_error") from None
    except ValueError:
        raise HTTPException(502, "azure_invalid_response") from None
