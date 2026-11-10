"""Continuous topic assessment with transient, in-memory PCM audio."""
import io
import json
import math
import threading
import wave
from datetime import datetime, timezone
from hashlib import sha256
from fastapi import HTTPException
from . import azure


def sdk_break_confidence(value):
    # SDK feedback can return positive scores above 1. Preserve provider units.
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError("invalid break confidence")
    return value


def aggregate(payloads, duration, audio_hash):
    utterances, words = [], []
    try:
        for utterance_index, payload in enumerate(payloads):
            best = payload["NBest"][0]
            scores = best.get("PronunciationAssessment", best)
            weight = payload["Duration"] / 10_000_000
            if weight <= 0:
                raise ValueError("invalid duration")
            utterances.append({"text": best["Display"], "durationSeconds": weight,
                "accuracy": azure._score(scores["AccuracyScore"]),
                "fluency": azure._score(scores["FluencyScore"]),
                "prosody": None if scores.get("ProsodyScore") is None else azure._score(scores["ProsodyScore"]),
                "pronunciation": azure._score(scores["PronScore"])})
            for entry in best["Words"]:
                score = entry.get("PronunciationAssessment", entry)
                words.append({"word": entry["Word"], "utteranceIndex": utterance_index, "accuracy": azure._score(score["AccuracyScore"]),
                    "errorType": score.get("ErrorType", "None"), **azure._word_details(entry, score, duration, sdk_break_confidence)})
        if not utterances or not words:
            raise HTTPException(422, "speech_not_recognized")
        total = sum(item["durationSeconds"] for item in utterances)
        result = {}
        for key in ("accuracy", "fluency", "prosody"):
            result[key] = None if any(item[key] is None for item in utterances) else sum(
                item[key] * item["durationSeconds"] for item in utterances) / total
        result["overall"] = None if result["prosody"] is None else (
            40 * result["accuracy"] + 25 * result["fluency"] + 25 * result["prosody"]) / 90
        return {**result, "schemaVersion": 3, "assessmentProfile": "topic-speaking-v1", "mode": "TOPIC",
            "assessmentCompleteness": "partial" if result["prosody"] is None else "full",
            "transcript": " ".join(item["text"] for item in utterances), "words": words,
            "utterances": utterances, "durationSeconds": duration, "audioHash": audio_hash,
            "provider": "azure", "adapterVersion": "azure-topic-v1-ipa",
            "assessedAt": datetime.now(timezone.utc).isoformat(),
            "assessmentConfig": {"locale": "en-US", "scenario": "speaking", "phonemeAlphabet": "IPA",
                "aggregation": "utterance-duration", "breakConfidenceScale": "provider-raw", "breakConfidenceThreshold": .75},
            "scoringPolicy": {"version": "lingoroad-topic-v1", "weights": {"accuracy": 40, "fluency": 25, "prosody": 25}, "divisor": 90},
            "feedbackVi": "Chạm vào từng từ để xem chi tiết phát âm."}
    except (KeyError, IndexError, TypeError, ValueError):
        raise HTTPException(502, "azure_invalid_response") from None


def assess(data):
    duration = azure.validate_audio(data, max_seconds=60)
    key, region = azure.configuration()
    try:
        import azure.cognitiveservices.speech as speechsdk
    except ImportError:
        raise HTTPException(503, "speech_sdk_missing") from None
    config = speechsdk.SpeechConfig(subscription=key, region=region)
    config.speech_recognition_language = "en-US"
    config.output_format = speechsdk.OutputFormat.Detailed
    stream = speechsdk.audio.PushAudioInputStream(speechsdk.audio.AudioStreamFormat(
        samples_per_second=16000, bits_per_sample=16, channels=1))
    recognizer = speechsdk.SpeechRecognizer(speech_config=config,
        audio_config=speechsdk.audio.AudioConfig(stream=stream))
    assessment = speechsdk.PronunciationAssessmentConfig(json_string=json.dumps({
        "GradingSystem": "HundredMark", "Granularity": "Phoneme", "PhonemeAlphabet": "IPA",
        "Dimension": "Comprehensive", "EnableMiscue": False}))
    assessment.enable_prosody_assessment()
    assessment.apply_to(recognizer)
    done = threading.Event()
    payloads, failures = [], []

    def recognized(event):
        if event.result.reason == speechsdk.ResultReason.RecognizedSpeech:
            try:
                payloads.append(json.loads(event.result.json))
            except (ValueError, TypeError):
                failures.append("azure_invalid_response")

    def canceled(event):
        if event.reason == speechsdk.CancellationReason.Error:
            code = getattr(event, "error_code", None)
            failures.append("azure_quota_exceeded" if code == speechsdk.CancellationErrorCode.TooManyRequests else
                            "azure_auth_failed" if code == speechsdk.CancellationErrorCode.AuthenticationFailure else "azure_unavailable")
        done.set()

    recognizer.recognized.connect(recognized)
    recognizer.canceled.connect(canceled)
    recognizer.session_stopped.connect(lambda event: done.set())
    try:
        recognizer.start_continuous_recognition_async().get()
        with wave.open(io.BytesIO(data), "rb") as audio:
            stream.write(audio.readframes(audio.getnframes()))
        stream.close()
        if not done.wait(80):
            raise HTTPException(504, "azure_timeout")
        if failures:
            raise HTTPException(429 if failures[0] == "azure_quota_exceeded" else 503 if failures[0] == "azure_auth_failed" else 502, failures[0])
        result = aggregate(payloads, duration, sha256(data).hexdigest())
        result["serviceRegion"] = region
        result["assessmentConfig"]["sdkVersion"] = speechsdk.__version__
        return result
    finally:
        stream.close()
        recognizer.stop_continuous_recognition_async().get()
