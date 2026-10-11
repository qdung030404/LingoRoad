from lingoroad_ml.llm.advisor import build_messages
from lingoroad_ml.serving import llm_routes

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
