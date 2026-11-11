import io
import json
import struct
import wave
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from lingoroad_ml.serving.app import app
from lingoroad_ml.speech import azure, content, topic


@pytest.fixture(autouse=True)
def no_internal_auth(monkeypatch):
    monkeypatch.delenv("LINGOROAD_ML_INTERNAL_TOKEN", raising=False)


def test_conversation_content_uses_only_learner_evidence(monkeypatch):
    calls = []
    result = {"vocabulary": 71.5, "grammar": 80.5, "topic": 90.5,
              "strengths": ["Rõ ý"], "improvements": []}
    def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(result)))])
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(content, "_client", lambda: SimpleNamespace(with_options=lambda **kwargs: client))
    monkeypatch.setenv("SPEAKING_CONTENT_MODEL", "fixture")
    turns = [{"role": "ASSISTANT", "transcript": "Please describe your hobbies."},
             {"role": "USER", "transcript": "I enjoy reading books and playing chess with my friends because these activities help me learn and relax after school every day."}]
    with TestClient(app) as api:
        response = api.post("/speech/conversation/content", json={"topic": "Hobbies", "turns": turns})
        assert response.status_code == 200
        assert response.json()["overall"] == pytest.approx(80.83333333333333)
        assert response.json()["rubricVersion"] == "conversation-content-v1"
        sent = json.loads(calls[0]["messages"][1]["content"])
        assert sent["transcript"] == turns[1]["transcript"]
        assert sent["conversation"] == turns
        result["improvements"] = [{"quote": turns[0]["transcript"], "explanationVi": "x", "suggestion": "x"}]
        assert api.post("/speech/conversation/content", json={"topic": "Hobbies", "turns": turns}).json()["improvements"] == []


def test_assistant_words_do_not_meet_minimum_learner_words(monkeypatch):
    monkeypatch.setattr(content, "_client", lambda: pytest.fail("provider must not be called"))
    with TestClient(app) as api:
        response = api.post("/speech/conversation/content", json={"topic": "Family", "turns": [
            {"role": "ASSISTANT", "transcript": "many words " * 30}, {"role": "USER", "transcript": ""}]})
        assert response.json()["status"] == "insufficient_data"


def test_pronunciation_endpoint_preserves_audio_and_uses_conversation_limits(monkeypatch):
    calls = []
    def assess(data, **kwargs):
        calls.append((data, kwargs))
        return {"accuracy": 32.5, "fluency": 58.4, "prosody": None, "overall": None}
    monkeypatch.setattr(topic, "assess", assess)
    with TestClient(app) as api:
        result = api.post("/speech/conversation/score", content=b"wav-fixture").json()
    assert calls[0][0] == b"wav-fixture"
    assert calls[0][1]["max_seconds"] == 180
    assert result["assessmentProfile"] == "conversation-speaking-v1"
    assert result["accuracy"] == 32.5
    assert result["prosody"] is None


def test_conversation_wav_limit_does_not_change_short_recording_contract():
    data = io.BytesIO()
    with wave.open(data, "wb") as audio:
        audio.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        audio.writeframes(struct.pack("<h", 1000) * (70 * 16000))
    assert azure.validate_audio(data.getvalue(), max_seconds=180, max_bytes=6 * 1024 * 1024) == 70
    with pytest.raises(Exception) as failure:
        azure.validate_audio(data.getvalue())
    assert failure.value.status_code == 413


def test_empty_provider_turn_does_not_reject_whole_conversation(monkeypatch):
    seen = []
    def evaluate(topic, hints, transcript, duration, *, conversation):
        seen.extend(conversation)
        return {"status": "succeeded", "overall": 67.5}
    monkeypatch.setattr(content, "evaluate", evaluate)
    with TestClient(app) as api:
        response = api.post("/speech/conversation/content", json={"topic": "Family", "perTurn": True,
            "turns": [{"role": "USER", "itemId": "empty", "transcript": ""},
                      {"role": "USER", "itemId": "answer", "transcript": "My name is Anna."}]})
    assert response.status_code == 200
    assert response.json()["assessmentScope"] == "whole_conversation"
    assert len(seen) == 1
    assert seen[0]["itemId"] == "answer"
