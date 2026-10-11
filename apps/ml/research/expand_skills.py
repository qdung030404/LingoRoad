"""Expand skills.json to ~150 micro-skills using an LLM. Review the diff by hand.

Defaults to Gemini: gemini-2.5-flash via the OpenAI-compatible endpoint, key from
GEMINI_API_KEY. For any other OpenAI-compatible provider set OPENAI_BASE_URL +
OPENAI_API_KEY, and pick the model with EXPAND_MODEL.
"""
import json, os, sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from openai import OpenAI

SEED = Path(__file__).parents[1] / "data/skills.json"

PROMPT = """You are designing a knowledge graph for Vietnamese learners of English.
Below is an existing skills.json with 'skills' and 'prerequisites'.
Extend it to ~150 micro-skills total. Rules:
- Keep every existing entry unchanged.
- Same JSON shape. code = dot-separated lowercase path; name_vi = Vietnamese name.
- Each new leaf skill: category in [grammar,vocabulary,reading,listening,writing],
  cefr in [A1..C2], parent must exist, prerequisites must not create cycles.
- Cover: all tenses, gerunds/infinitives, comparatives, question forms, quantifiers,
  vocabulary topic sets per CEFR level, listening sub-skills, reading strategies,
  writing genres (reports, reviews, stories), punctuation, linking words.
Return ONLY the complete JSON document.
{json}"""

def main():
    data = SEED.read_text(encoding="utf-8")
    if os.environ.get("OPENAI_BASE_URL"):
        client = OpenAI()
    else:
        client = OpenAI(api_key=os.environ["GEMINI_API_KEY"],
                        base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
    resp = client.chat.completions.create(
        model=os.environ.get("EXPAND_MODEL", "gemini-2.5-flash"), temperature=0.3,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": PROMPT.format(json=data)}])
    expanded = json.loads(resp.choices[0].message.content)
    old = json.loads(data)
    old_codes = {s["code"] for s in old["skills"]}
    new_codes = {s["code"] for s in expanded["skills"]}
    assert old_codes <= new_codes, f"dropped skills: {old_codes - new_codes}"
    assert len(new_codes) >= 140, f"only {len(new_codes)} skills generated"
    SEED.write_text(json.dumps(expanded, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"skills: {len(old_codes)} -> {len(new_codes)}")

if __name__ == "__main__":
    sys.exit(main())
