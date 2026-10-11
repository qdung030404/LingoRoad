import json
from lingoroad_ml.llm.exercises import build_exercise_messages, parse_exercises
from lingoroad_ml.llm.awe import build_awe_messages
from lingoroad_ml.llm.distractors import wordnet_distractors

def test_exercise_prompt_pins_cefr_skill_and_type():
    msgs = build_exercise_messages("grammar.conditionals.second", "Second Conditional",
                                   "B1", "mcq", 3)
    body = msgs[-1]["content"]
    assert "B1" in body and "Second Conditional" in body and "mcq" in body and "3" in body

def test_parse_exercises_validates_correct_answer_in_options():
    raw = json.dumps({"exercises": [
        {"stem": "If I ___ rich...", "options": ["were", "am", "was", "be"],
         "correct_answer": "were", "explanation_vi": "Câu điều kiện loại 2 dùng 'were'."},
        {"stem": "bad item", "options": ["a", "b"], "correct_answer": "zzz"},
    ]})
    parsed = parse_exercises(raw)
    assert len(parsed) == 1            # invalid item dropped
    assert parsed[0]["correct_answer"] == "were"

def test_wordnet_distractors_exclude_the_answer():
    ds = wordnet_distractors("happy", n=3)
    assert "happy" not in ds
    assert len(ds) <= 3
    assert "unhappy" in ds

def test_wordnet_distractors_n_zero_returns_empty():
    assert wordnet_distractors("happy", 0) == []

def test_awe_prompt_contains_ielts_criteria():
    msgs = build_awe_messages("Describe your hometown.", "My hometown is small...")
    body = msgs[0]["content"] + msgs[1]["content"]
    for crit in ["Task Achievement", "Coherence", "Lexical Resource", "Grammatical"]:
        assert crit in body
