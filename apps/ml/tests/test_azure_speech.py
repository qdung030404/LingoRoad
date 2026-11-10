import asyncio
import base64
import json
from hashlib import sha256
import copy
import io
import struct
import tempfile
import wave

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from lingoroad_ml.speech import azure
from lingoroad_ml.serving.app import app


def wav(seconds=0.2, rate=16000, channels=1, width=2, silent=False):
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(channels)
        audio.setsampwidth(width)
        audio.setframerate(rate)
        audio.writeframes((struct.pack("<h", 0 if silent else 1000) * int(seconds * rate * channels))[:int(seconds * rate * channels * width)])
    return output.getvalue()


@pytest.fixture
def response():
    return {"RecognitionStatus": "Success", "NBest": [{"Display": "My name is Anna.",
        "AccuracyScore": 95, "FluencyScore": 90, "CompletenessScore": 100, "PronScore": 94,
        "Words": [{"Word": "My", "AccuracyScore": 90, "ErrorType": "None"},
                  {"Word": "name", "AccuracyScore": 60, "ErrorType": "Mispronunciation"}]}]}


@pytest.fixture(autouse=True)
def config(monkeypatch):
    monkeypatch.setenv("AZURE_SPEECH_KEY", "test-key")
    monkeypatch.setenv("AZURE_SPEECH_REGION", "eastasia")
    monkeypatch.delenv("AZURE_SPEECH_ENV_FILE", raising=False)
    monkeypatch.delenv("LINGOROAD_ML_INTERNAL_TOKEN", raising=False)


def test_normalization(response):
    result = azure.normalize_assessment(response, 0.2)
    assert result["pronunciation"] == 94
    assert result["provider"] == "azure"
    assert "name" in result["feedbackVi"]
    assert "lingoRoad" in result["feedbackVi"]
    assert "Azure" not in result["feedbackVi"]
    assert result["words"][1]["errorType"] == "Mispronunciation"
    nested = copy.deepcopy(response)
    best = nested["NBest"][0]
    best["PronunciationAssessment"] = {key: best.pop(key) for key in ("AccuracyScore", "FluencyScore", "CompletenessScore", "PronScore")}
    assert azure.normalize_assessment(nested, 0.2)["accuracy"] == 95


def test_v2_preserves_decimals_details_and_missing_optional_fields(response):
    best = response["NBest"][0]
    best.update(AccuracyScore=31.25, FluencyScore=51.125, PronScore=41.375, ProsodyScore=40.625)
    word = best["Words"][0]
    word.update(Offset=10000, Duration=20000,
                Phonemes=[{"Phoneme": "m", "AccuracyScore": 29.25, "Offset": 10000, "Duration": 10000}],
                Syllables=[{"Syllable": "maɪ", "PronunciationAssessment": {"AccuracyScore": 30.5}}],
                Feedback={"Prosody": {"Break": {"UnexpectedBreak": {"Confidence": 0.751}, "MissingBreak": {"Confidence": 0.75}},
                                      "Intonation": {"ErrorTypes": ["Monotone"]}}})
    result = azure.normalize_assessment(response, .2, "read-aloud-v2", " My name is Anna! ", "a" * 64)
    assert [result[k] for k in ("accuracy", "fluency", "pronunciation", "prosody")] == [31.25, 51.125, 41.375, 40.625]
    assert result["referenceText"] == " My name is Anna! "
    assert result["assessmentCompleteness"] == "full"
    assert result["assessmentConfig"]["breakConfidenceThreshold"] == .75
    assert result["assessmentConfig"]["phonemeAlphabet"] == "IPA"
    assert result["words"][0]["syllables"][0]["syllable"] == "maɪ"
    assert result["words"][0]["offsetMs"] == 1
    assert result["words"][0]["phonemes"][0]["accuracy"] == 29.25
    assert result["words"][0]["syllables"][0]["offsetMs"] is None
    assert result["words"][0]["prosody"] == {"unexpectedBreakConfidence": .751, "missingBreakConfidence": .75, "monotone": True}
    assert result["words"][1]["prosody"]["monotone"] is None
    best.pop("ProsodyScore")
    result = azure.normalize_assessment(response, .2, "read-aloud-v2", "test", "a" * 64)
    assert result["prosody"] is None
    assert result["assessmentCompleteness"] == "partial"


def test_v2_request_profile_and_exact_wav(monkeypatch, response):
    audio, prompt = wav(), " My name is Anna! "
    def handler(request):
        parameters = json.loads(base64.b64decode(request.headers["Pronunciation-Assessment"]))
        assert parameters["ReferenceText"] == prompt
        assert parameters["EnableProsodyAssessment"] is True
        assert parameters["PhonemeAlphabet"] == "IPA"
        assert request.content == audio
        return httpx.Response(200, json=response)
    mock_provider(monkeypatch, handler)
    result = TestClient(app).post("/speech/read-aloud/score", headers={"x-speaking-profile": "read-aloud-v2"},
                                data={"prompt_text": prompt}, files={"file": ("audio.wav", audio, "audio/wav")})
    assert result.status_code == 200, result.text
    assert result.json()["audioHash"] == sha256(audio).hexdigest()
    assert result.json()["schemaVersion"] == 2
    assert result.json()["serviceRegion"] == "eastasia"
    assert result.json()["serviceVersion"] is None


def test_unknown_profile_never_calls_provider(monkeypatch):
    monkeypatch.setattr(azure.httpx, "AsyncClient", lambda **kwargs: pytest.fail("invalid profile called provider"))
    result = TestClient(app).post("/speech/read-aloud/score", headers={"x-speaking-profile": "unknown"})
    assert result.status_code == 422
    assert result.json()["detail"] == "invalid_assessment_profile"


def test_v2_nested_prosody_and_invalid_detail(response):
    word = response["NBest"][0]["Words"][0]
    word["PronunciationAssessment"] = {"AccuracyScore": 90.25, "ErrorType": "None", "Feedback": {
        "Prosody": {"Intonation": {"ErrorTypes": []}}}}
    assert azure.normalize_assessment(response, .2, "read-aloud-v2")["words"][0]["prosody"]["monotone"] is False
    word["PronunciationAssessment"]["Feedback"]["Prosody"]["Break"] = {"MissingBreak": {"Confidence": 2}}
    with pytest.raises(HTTPException):
        azure.normalize_assessment(response, .2, "read-aloud-v2")


def test_success_feedback_uses_app_name(response):
    for word in response["NBest"][0]["Words"]:
        word["ErrorType"] = "None"
    feedback = azure.normalize_assessment(response, 0.2)["feedbackVi"]
    assert feedback.startswith("lingoRoad đã ghi nhận bài đọc.")
    assert "Azure" not in feedback


@pytest.mark.parametrize("value", [None, True, -1, 101, float("nan"), "90"])
def test_missing_or_invalid_score_is_not_zero(response, value):
    response["NBest"][0]["AccuracyScore"] = value
    with pytest.raises(HTTPException) as error:
        azure.normalize_assessment(response, 0.2)
    assert error.value.detail == "azure_invalid_response"


def test_word_missing_accuracy_remains_null(response):
    response["NBest"][0]["Words"][0].pop("AccuracyScore")
    assert azure.normalize_assessment(response, 1)["words"][0]["accuracy"] is None


@pytest.mark.parametrize("payload,code", [
    (b"", "audio_empty"), (b"not-wav", "invalid_audio"),
    (b"x" * (azure.MAX_BYTES + 1), "audio_too_large"),
    (wav(rate=8000), "unsupported_audio_format"),
    (wav(channels=2), "unsupported_audio_format"),
    (wav(seconds=30.01), "audio_too_long"),
    (wav(silent=True), "audio_silent"),
    (wav()[:-2], "invalid_audio"),
], ids=["empty", "not-wav", "large", "rate", "channels", "duration", "silent", "truncated"])
def test_audio_validation(payload, code):
    with pytest.raises(HTTPException) as error:
        azure.validate_audio(payload)
    assert error.value.detail == code


def test_exact_duration_limit_and_valid_audio():
    assert azure.validate_audio(wav(seconds=30)) == 30


def mock_provider(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(azure.httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))


def test_route_validates_content_not_declared_mime(monkeypatch, response):
    calls = []
    def handler(request):
        calls.append(request)
        assert request.url.host == "eastasia.stt.speech.microsoft.com"
        assert request.headers["Ocp-Apim-Subscription-Key"] == "test-key"
        return httpx.Response(200, json=response)
    mock_provider(monkeypatch, handler)
    client = TestClient(app)
    result = client.post("/speech/read-aloud/score", data={"prompt_text": "My name is Anna"}, files={"file": ("record.wav", wav(), "application/octet-stream")})
    assert result.status_code == 200, result.text
    assert result.json()["accuracy"] == 95
    assert len(calls) == 1
    invalid = client.post("/speech/read-aloud/score", data={"prompt_text": "My name is Anna"}, files={"file": ("record.wav", b"wrong", "audio/wav")})
    assert invalid.status_code == 415
    assert len(calls) == 1


@pytest.mark.parametrize("status,code", [(429, "azure_quota_exceeded"), (401, "azure_auth_failed"), (503, "azure_unavailable"), (302, "azure_unavailable")])
def test_provider_errors_no_retry(monkeypatch, status, code):
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(status, text="private-provider-body")
    mock_provider(monkeypatch, handler)
    with pytest.raises(HTTPException) as error:
        asyncio.run(azure.assess(wav(), "My name is Anna"))
    assert error.value.detail == code
    assert len(calls) == 1


def test_timeout_no_retry(monkeypatch):
    calls = []
    def handler(request):
        calls.append(request)
        raise httpx.ReadTimeout("private", request=request)
    mock_provider(monkeypatch, handler)
    with pytest.raises(HTTPException) as error:
        asyncio.run(azure.assess(wav(), "Hello"))
    assert error.value.detail == "azure_timeout"
    assert len(calls) == 1


def test_no_recognition_is_not_success():
    with pytest.raises(HTTPException) as error:
        azure.normalize_assessment({"RecognitionStatus": "NoMatch"}, 1)
    assert error.value.detail == "speech_not_recognized"


def test_readiness_only_checks_config(monkeypatch):
    monkeypatch.setenv("LINGOROAD_ML_REQUIRED_MODELS", "speech_azure")
    monkeypatch.setattr(azure.httpx, "AsyncClient", lambda **kwargs: pytest.fail("health must not call Azure"))
    client = TestClient(app)
    assert client.get("/ready").status_code == 200
    monkeypatch.delenv("AZURE_SPEECH_KEY")
    result = client.get("/ready")
    assert result.status_code == 503
    assert result.json()["components"]["speech_azure"] == "missing_config"


def test_outside_config_env_precedence(monkeypatch, tmp_path):
    config_file = tmp_path / "speech.env"
    config_file.write_text("AZURE_SPEECH_KEY=file-key\nAZURE_SPEECH_REGION=eastasia\n", encoding="utf-8-sig")
    monkeypatch.setenv("AZURE_SPEECH_ENV_FILE", str(config_file))
    assert azure.configuration()[0] == "test-key"
    monkeypatch.delenv("AZURE_SPEECH_KEY")
    assert azure.configuration()[0] == "file-key"


def test_chunked_oversized_upload_never_spools(monkeypatch):
    monkeypatch.setattr(tempfile, "SpooledTemporaryFile", lambda *a, **k: pytest.fail("audio must stay in memory"))
    monkeypatch.setattr(tempfile, "TemporaryFile", lambda *a, **k: pytest.fail("audio must stay in memory"))
    def chunks():
        yield b'--test\r\nContent-Disposition: form-data; name="prompt_text"\r\n\r\nHello\r\n'
        yield b'--test\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n'
        for _ in range(34):
            yield b'x' * 65536
        yield b'\r\n--test--\r\n'
    client = TestClient(app)
    result = client.post("/speech/read-aloud/score", content=chunks(), headers={"Content-Type": "multipart/form-data; boundary=test"})
    assert result.status_code == 413


def test_malformed_multipart_is_rejected():
    client = TestClient(app)
    result = client.post("/speech/read-aloud/score", content=b"--test\r\n", headers={"Content-Type": "multipart/form-data; boundary=test"})
    assert result.status_code == 422


def test_route_internal_token_enforced(monkeypatch):
    monkeypatch.setenv("LINGOROAD_ML_INTERNAL_TOKEN", "internal-test")
    result = TestClient(app).post("/speech/read-aloud/score")
    assert result.status_code == 401


def test_read_aloud_prewarm_never_loads_whisper(monkeypatch):
    from lingoroad_ml.serving import speech_routes
    monkeypatch.setenv("LINGOROAD_ML_PREWARM", "true")
    monkeypatch.setenv("LINGOROAD_ML_REQUIRED_MODELS", "speech_azure")
    monkeypatch.setattr(speech_routes, "_whisper", lambda: pytest.fail("new provider must not prewarm Whisper"))
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
