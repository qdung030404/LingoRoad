import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from lingoroad_ml.llm import reading_explain
from lingoroad_ml.llm.advisor import build_messages
from lingoroad_ml.llm.awe import parse_awe_response
from lingoroad_ml.serving import llm_routes


@pytest.fixture(autouse=True)
def isolate_llm_env(monkeypatch):
    llm_routes._client.cache_clear()
    monkeypatch.delenv("AZURE_OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("AZURE_OPENAI_ENDPOINT", raising=False)
    monkeypatch.delenv("AZURE_OPENAI_DEPLOYMENT_NAME", raising=False)
    monkeypatch.delenv("AZURE_OPENAI_API_VERSION", raising=False)


def test_client_prefers_azure_openai_when_configured(monkeypatch):
    llm_routes._client.cache_clear()
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "azure-mock-key")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://mock-openai.openai.azure.com/")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-mock-key")

    client = llm_routes._client()
    assert client.api_key == "azure-mock-key"
    assert "mock-openai.openai.azure.com" in str(client.base_url)

def test_messages_include_path_and_context_in_vietnamese_frame():
    msgs = build_messages("Tại sao học present perfect?",
                          [{"code": "pp", "name": "Present Perfect",
                            "mastery": 0.35, "reason": "below_threshold"}],
                          ["Present perfect connects past and present."])
    assert msgs[0]["role"] == "system" and "tiếng Việt" in msgs[0]["content"]
    body = msgs[1]["content"]
    assert "Present Perfect" in body and "0.35" in body and "connects past" in body


def test_generated_exercises_include_configured_model_version(monkeypatch):
    monkeypatch.setenv("LINGOROAD_LLM_MODEL_VERSION", "gemini-test-v2")
    monkeypatch.setattr(llm_routes, "_client", lambda: object())
    monkeypatch.setattr(llm_routes.ex_mod, "generate", lambda *_: [])

    result = llm_routes.llm_exercises(llm_routes.ExerciseReq(
        skill_code="grammar.present",
        skill_name="Present tense",
        cefr="A1",
        type="mcq",
        count=3,
    ))

    assert result == {"exercises": [], "model_version": "gemini-test-v2"}


def test_client_prefers_openai_when_configured(monkeypatch):
    llm_routes._client.cache_clear()
    monkeypatch.setenv("OPENAI_API_KEY", "sk-mock-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://custom-proxy.example.com/v1")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    client = llm_routes._client()
    assert client.api_key == "sk-mock-key"
    assert "https://custom-proxy.example.com/v1" in str(client.base_url)


def test_client_openai_default_base_url(monkeypatch):
    llm_routes._client.cache_clear()
    monkeypatch.setenv("OPENAI_API_KEY", "sk-mock-key")
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    client = llm_routes._client()
    assert client.api_key == "sk-mock-key"
    assert "https://api.openai.com/v1" in str(client.base_url)


def test_client_falls_back_to_gemini(monkeypatch):
    llm_routes._client.cache_clear()
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "mock-gemini-key")

    client = llm_routes._client()
    assert client.api_key == "mock-gemini-key"
    assert "generativelanguage.googleapis.com" in str(client.base_url)


def test_client_gemini_ignores_openai_base_url(monkeypatch):
    llm_routes._client.cache_clear()
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_BASE_URL", "https://motapis.com/v1")
    monkeypatch.setenv("GEMINI_API_KEY", "mock-gemini-key")

    client = llm_routes._client()
    assert client.api_key == "mock-gemini-key"
    assert "generativelanguage.googleapis.com" in str(client.base_url)
    assert "motapis.com" not in str(client.base_url)


def test_client_raises_clean_error_when_no_keys(monkeypatch):
    llm_routes._client.cache_clear()
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="Neither OPENAI_API_KEY nor GEMINI_API_KEY"):
        llm_routes._client()


def test_advisor_req_validation_rejects_oversized_question():
    with pytest.raises(ValidationError):
        llm_routes.AdvisorReq(question="a" * 1001, path=[])


def test_awe_req_validation_rejects_oversized_essay():
    with pytest.raises(ValidationError):
        llm_routes.AweReq(task_prompt="Valid prompt", essay="a" * 10001)


def test_parse_awe_response_handles_markdown_code_fences():
    raw = "```json\n{\"scores\": {\"task_achievement\": 7.0}, \"overall_vi\": \"Tốt\"}\n```"
    res = parse_awe_response(raw)
    assert res["scores"]["task_achievement"] == 7.0
    assert res["overall_vi"] == "Tốt"


def test_llm_exercises_truncated_json_raises_502(monkeypatch):
    monkeypatch.setattr(llm_routes, "_client", lambda: object())
    def fake_generate(*args, **kwargs):
        raise ValueError("LLM returned invalid or truncated JSON response: Unterminated string")
    monkeypatch.setattr(llm_routes.ex_mod, "generate", fake_generate)

    with pytest.raises(HTTPException) as excinfo:
        llm_routes.llm_exercises(llm_routes.ExerciseReq(
            skill_code="grammar.present",
            skill_name="Present tense",
            cefr="A1",
            type="mcq",
            count=3,
        ))
    assert excinfo.value.status_code == 502
    assert "malformed or truncated JSON response" in excinfo.value.detail


def test_llm_awe_truncated_json_raises_502(monkeypatch):
    monkeypatch.setattr(llm_routes, "_client", lambda: object())
    def fake_evaluate(*args, **kwargs):
        raise ValueError("LLM returned invalid or truncated JSON response: Expecting value")
    monkeypatch.setattr(llm_routes.awe_mod, "evaluate", fake_evaluate)

    with pytest.raises(HTTPException) as excinfo:
        llm_routes.llm_awe(llm_routes.AweReq(
            task_prompt="Describe your school.",
            essay="My school is big...",
        ))
    assert excinfo.value.status_code == 502
    assert "malformed or truncated JSON response" in excinfo.value.detail


def test_reading_explain_build_messages_includes_grounding_fields():
    msgs = reading_explain.build_messages(
        passage="Pocket parks lower street heat by 2 degrees.",
        question_prompt="Why are pocket parks useful?",
        question_type="TRUE_FALSE_NOT_GIVEN",
        options=["True", "False", "Not Given"],
        selected_option="False",
        correct_option="True",
        evidence="lower street heat by 2 degrees",
        curriculum_explanation="Bài đọc nêu công viên bỏ túi giảm nhiệt.",
        cefr="B2",
    )
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    assert 'xưng "bạn"' in msgs[0]["content"]
    user_msg = msgs[1]["content"]
    assert "True / False / Not Given" in user_msg
    assert "lower street heat by 2 degrees" in user_msg
    assert "Bạn đã chọn: False" in user_msg
    assert "Đáp án đúng: True" in user_msg


def test_listening_explain_uses_transcript_grounding():
    messages = reading_explain.build_messages(
        passage="Staff: It costs two pounds.",
        question_prompt="How much does it cost?",
        question_type="MULTIPLE_CHOICE",
        options=["Two pounds", "Five pounds"],
        selected_option="Five pounds",
        correct_option="Two pounds",
        source_kind="LISTENING",
    )
    assert "luyện nghe" in messages[0]["content"]
    assert "Bản chép lời trích đoạn nghe:\nStaff: It costs two pounds." in messages[1]["content"]


def test_reading_explain_req_validation_rejects_oversized_passage():
    with pytest.raises(ValidationError):
        llm_routes.ReadingExplainReq(
            passage="a" * 6001,
            question_prompt="Question?",
            question_type="MULTIPLE_CHOICE",
            options=["A", "B"],
            selected_option="A",
            correct_option="B",
        )


def test_llm_reading_explain_success_and_missing_key_503(monkeypatch):
    monkeypatch.setattr(llm_routes, "_client", lambda: object())
    monkeypatch.setattr(
        llm_routes.reading_explain_mod,
        "explain",
        lambda client, **kwargs: "Đáp án đúng là A vì đoạn văn nêu rõ lý do.",
    )
    req = llm_routes.ReadingExplainReq(
        passage="City trees shade sidewalks.",
        question_prompt="What do city trees shade?",
        question_type="MULTIPLE_CHOICE",
        options=["Sidewalks", "Rivers"],
        selected_option="Rivers",
        correct_option="Sidewalks",
        evidence="City trees shade sidewalks.",
    )
    res = llm_routes.llm_reading_explain(req)
    assert res["explanation"] == "Đáp án đúng là A vì đoạn văn nêu rõ lý do."
    assert "model_version" in res

    def missing_key():
        raise RuntimeError("Neither OPENAI_API_KEY nor GEMINI_API_KEY")

    monkeypatch.setattr(llm_routes, "_client", missing_key)
    with pytest.raises(HTTPException) as excinfo:
        llm_routes.llm_reading_explain(req)
    assert excinfo.value.status_code == 503


def test_reading_explain_sets_strict_timeout_and_zero_retries(monkeypatch):
    monkeypatch.setenv("LINGOROAD_EXPLAIN_TIMEOUT_S", "30")
    recorded = {}

    class DummyCompletions:
        def create(self, **kwargs):
            recorded["create_kwargs"] = kwargs
            msg = type("Msg", (), {"content": "Giải thích ngắn gọn từ AI."})()
            choice = type("Choice", (), {"message": msg})()
            return type("Resp", (), {"choices": [choice]})()

    class DummyClient:
        def __init__(self):
            self.chat = type("Chat", (), {"completions": DummyCompletions()})()

        def with_options(self, *, timeout, max_retries):
            recorded["timeout"] = timeout
            recorded["max_retries"] = max_retries
            return self

    out = reading_explain.explain(
        DummyClient(),
        passage="City trees cool sidewalks.",
        question_prompt="What cools sidewalks?",
        question_type="MULTIPLE_CHOICE",
        options=["City trees", "Buses"],
        selected_option="Buses",
        correct_option="City trees",
        evidence="City trees cool sidewalks.",
    )
    assert out == "Giải thích ngắn gọn từ AI."
    assert recorded["timeout"] == reading_explain.MAX_EXPLAIN_TIMEOUT_S
    assert recorded["max_retries"] == 0


def test_llm_reading_explain_timeout_raises_504(monkeypatch):
    from openai import APITimeoutError

    monkeypatch.setattr(llm_routes, "_client", lambda: object())

    def raise_timeout(*args, **kwargs):
        raise APITimeoutError(request=None)

    monkeypatch.setattr(llm_routes.reading_explain_mod, "explain", raise_timeout)
    req = llm_routes.ReadingExplainReq(
        passage="City trees shade sidewalks.",
        question_prompt="What do city trees shade?",
        question_type="MULTIPLE_CHOICE",
        options=["Sidewalks", "Rivers"],
        selected_option="Rivers",
        correct_option="Sidewalks",
    )
    with pytest.raises(HTTPException) as excinfo:
        llm_routes.llm_reading_explain(req)
    assert excinfo.value.status_code == 504
