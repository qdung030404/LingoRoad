import json
from types import SimpleNamespace
import pytest
from lingoroad_ml.speech import content

TEXT = "I live in Hanoi with my family and I enjoy reading books after school because reading helps me learn new things."

def fake_client(monkeypatch, payload):
    calls = []
    def create(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))])
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    monkeypatch.setattr(content, "_client", lambda: SimpleNamespace(with_options=lambda **kwargs: client))
    monkeypatch.setenv("SPEAKING_CONTENT_MODEL", "fixture-model")
    return calls

def valid():
    return {"vocabulary": 70, "grammar": 80, "topic": 90, "strengths": ["Diễn đạt rõ ý."],
        "improvements": [{"quote": "I live in Hanoi", "explanationVi": "Thêm chi tiết.", "suggestion": "I live in Hanoi, a busy city."}]}

def test_content_scores_and_exact_evidence(monkeypatch):
    calls = fake_client(monkeypatch, valid())
    result = content.evaluate("Introduce yourself", [], TEXT, 20)
    assert result["status"] == "succeeded"
    assert result["overall"] == 80
    assert result["rubricVersion"] == "topic-content-v1"
    assert calls[0]["temperature"] == 0

@pytest.mark.parametrize("change", [{"grammar": 101}, {"vocabulary": float("nan")},
    {"improvements": [{"quote": "invented quote", "explanationVi": "x", "suggestion": "y"}]}, {"topic": "90"}])
def test_malformed_or_invented_feedback_is_unavailable(monkeypatch, change):
    fake_client(monkeypatch, {**valid(), **change})
    assert content.evaluate("Introduce yourself", [], TEXT, 20)["status"] == "unavailable"

def test_short_speech_and_missing_config_do_not_call_model(monkeypatch):
    def unexpected(): raise AssertionError("provider must not be called")
    monkeypatch.setattr(content, "_client", unexpected)
    monkeypatch.delenv("SPEAKING_CONTENT_MODEL", raising=False)
    assert content.evaluate("Topic", [], TEXT, 5)["status"] == "insufficient_data"
    assert content.evaluate("Topic", [], "Hello", 20)["status"] == "insufficient_data"
    assert content.evaluate("Topic", [], TEXT, 20)["errorCode"] == "content_missing_config"
