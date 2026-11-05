import json, os

SYSTEM = """You are an English writing examiner. Score the essay 0-9 on the IELTS rubric:
Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy.
All feedback text in VIETNAMESE. Return strict JSON:
{"scores":{"task_achievement":n,"coherence_cohesion":n,"lexical_resource":n,
"grammatical_accuracy":n},"feedback":[{"sentence":"<original>","issue":"<vi>",
"suggestion":"<vi>"}],"overall_vi":"<vi summary>"}"""

def build_awe_messages(task_prompt: str, essay: str) -> list[dict]:
    return [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Task: {task_prompt}\n\nEssay:\n{essay}"}]

def parse_awe_response(raw: str) -> dict:
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM returned invalid or truncated JSON response: {exc}") from exc

def evaluate(client, task_prompt: str, essay: str) -> dict:
    model = os.environ.get("LINGOROAD_LLM_MODEL_VERSION", "gemini-2.5-flash")
    resp = client.chat.completions.create(
        model=model, temperature=0.2, response_format={"type": "json_object"},
        messages=build_awe_messages(task_prompt, essay))
    return parse_awe_response(resp.choices[0].message.content)
