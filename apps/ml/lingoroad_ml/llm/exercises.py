import json, os

SYSTEM = "You create English exercises for Vietnamese learners. Return strict JSON."

def build_exercise_messages(skill_code: str, skill_name: str, cefr: str,
                            ex_type: str, count: int) -> list[dict]:
    user = f"""Create {count} exercises. Skill: {skill_name} ({skill_code}).
CEFR level: {cefr} exactly. Type: {ex_type}.
- mcq: 4 options, one correct; distractors = common Vietnamese-learner errors.
- cloze: stem contains '___', options [], correct_answer = missing word/phrase.
- rewrite: stem gives a sentence + instruction; options []; correct_answer = rewritten sentence.
Each item: explanation_vi = short Vietnamese explanation of the answer.
Return JSON: {{"exercises":[{{"stem","options","correct_answer","explanation_vi"}}]}}"""
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]

def parse_exercises(raw: str) -> list[dict]:
    items = json.loads(raw).get("exercises", [])
    valid = []
    for it in items:
        if not it.get("stem") or not it.get("correct_answer"):
            continue
        opts = it.get("options") or []
        if opts and it["correct_answer"] not in opts:
            continue
        valid.append({"stem": it["stem"], "options": opts,
                      "correct_answer": str(it["correct_answer"]),
                      "explanation_vi": it.get("explanation_vi", "")})
    return valid

def generate(client, skill_code, skill_name, cefr, ex_type, count) -> list[dict]:
    model = os.environ.get("LINGOROAD_LLM_MODEL_VERSION", "gemini-3.8-flash")
    resp = client.chat.completions.create(
        model=model, temperature=0.7, response_format={"type": "json_object"},
        messages=build_exercise_messages(skill_code, skill_name, cefr, ex_type, count))
    return parse_exercises(resp.choices[0].message.content)
