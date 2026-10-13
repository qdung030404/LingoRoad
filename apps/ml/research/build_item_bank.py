"""Build the question bank. Usage:
  python ml/research/build_item_bank.py --per-skill 4 [--limit 10] [--post http://localhost:5000] [--sleep 7]

Defaults to Gemini: gemini-2.5-flash via the OpenAI-compatible endpoint, key from
GEMINI_API_KEY. For any other OpenAI-compatible provider set OPENAI_BASE_URL +
OPENAI_API_KEY, and pick the model with GEN_MODEL.

Listening audio: TTS_PROVIDER=openai uses tts-1 (needs OpenAI quota); anything
else (default "edge") uses edge-tts, Microsoft's free neural TTS (no key).
"""
import argparse, asyncio, json, os, sys, time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

import httpx
import numpy as np
import openai
from openai import OpenAI

sys.path.insert(0, str(Path(__file__).parents[1]))  # make lingoroad_ml importable
from lingoroad_ml.itemgen import seed_irt_params

ML_DIR = Path(__file__).parents[1]
SKILLS = ML_DIR / "data/skills.json"
OUT = ML_DIR / "data/items.json"
AUDIO_DIR = ML_DIR / "data/audio"

GEN_MODEL = os.environ.get("LINGOROAD_LLM_MODEL_VERSION") or os.environ.get("GEN_MODEL", "gemini-3.8-flash")
TTS_PROVIDER = os.environ.get("TTS_PROVIDER", "edge")
EDGE_VOICE = os.environ.get("EDGE_VOICE", "en-US-AriaNeural")
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


def llm_client() -> OpenAI:
    if os.environ.get("OPENAI_BASE_URL"):
        return OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY", ""),
            base_url=os.environ["OPENAI_BASE_URL"],
        )
    return OpenAI(api_key=os.environ.get("GEMINI_API_KEY", ""), base_url=GEMINI_BASE_URL)

GEN_PROMPT = """Create {n} English test questions for Vietnamese learners.
Skill: {name} ({code}). CEFR level: {cefr}. Question type: {qtype}. ALL items must be type {qtype}.
- mcq: stem may contain a blank '___'; 'options' MUST be exactly 4 non-empty strings, exactly one
  of them equal to correctAnswer; distractors reflect common Vietnamese-learner errors.
- cloze: sentence with one blank '___', options is [], correctAnswer is the missing word/phrase.
- listening_mcq: 'script' = 2-4 sentence monologue/dialogue to be read aloud; stem asks about it;
  'options' MUST be exactly 4 non-empty strings, exactly one equal to correctAnswer.
Return JSON: {{"items":[{{"stem":...,"options":[...],"correctAnswer":...,"script":...}}]}} ('script' only for listening_mcq)."""


def valid_item(it, qtype) -> bool:
    stem, answer = it.get("stem"), str(it.get("correctAnswer") or "")
    if not stem or not answer:
        return False
    opts = it.get("options") or []
    if qtype == "cloze":
        return "___" in stem
    return (len(opts) == 4 and all(isinstance(o, str) and o.strip() for o in opts)
            and answer in opts)


def leaf_skills():
    data = json.loads(SKILLS.read_text(encoding="utf-8"))
    parents = {s["parent"] for s in data["skills"] if s["parent"]}
    return [s for s in data["skills"] if s["code"] not in parents and s["parent"]]


def qtype_for(category):
    return {"listening": "listening_mcq", "vocabulary": "cloze"}.get(category, "mcq")


def generate_with_retry(client, prompt, max_retries=4):
    """Free-tier providers rate-limit hard and 503 under load; back off and retry."""
    for attempt in range(max_retries + 1):
        try:
            resp = client.chat.completions.create(
                model=GEN_MODEL, temperature=0.7,
                response_format={"type": "json_object"},
                messages=[{"role": "user", "content": prompt}])
            return json.loads(resp.choices[0].message.content)
        except (openai.RateLimitError, openai.InternalServerError) as e:
            if attempt == max_retries:
                raise
            wait = 30 * (attempt + 1) if isinstance(e, openai.RateLimitError) else 10 * (attempt + 1)
            print(f"  {type(e).__name__}; retrying in {wait}s", flush=True)
            time.sleep(wait)


def synth_speech(script: str, path: Path):
    if TTS_PROVIDER == "openai":
        speech = OpenAI().audio.speech.create(model="tts-1", voice="alloy", input=script)
        path.write_bytes(speech.content)
    else:
        import edge_tts
        asyncio.run(edge_tts.Communicate(script, EDGE_VOICE).save(str(path)))


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-skill", type=int, default=4)
    ap.add_argument("--limit", type=int, help="only first N skills (smoke run)")
    ap.add_argument("--post", help="API base URL; when set, POST to /admin/items/import")
    ap.add_argument("--sleep", type=float, default=0.0, help="seconds between LLM calls (free-tier pacing)")
    ap.add_argument("--resume", action="store_true",
                    help="load existing items.json and skip skills already present in it")
    args = ap.parse_args()

    client = llm_client()
    provider = "Groq" if "groq" in os.environ.get("OPENAI_BASE_URL", "").lower() else ("OpenAI/Custom" if os.environ.get("OPENAI_BASE_URL") else "Google Gemini")
    print(f"-> Connecting Provider: {provider} | Model: {GEN_MODEL}\n", flush=True)
    rng = np.random.default_rng(0)
    skills = leaf_skills()[: args.limit]
    bank, failed, dropped = [], [], 0
    done_codes: set[str] = set()
    if args.resume and OUT.exists():
        bank = json.loads(OUT.read_text(encoding="utf-8"))
        done_codes = {it["skillCode"] for it in bank}
        print(f"resuming: {len(bank)} items across {len(done_codes)} skills already done")
    for i, s in enumerate(skills):
        if s["code"] in done_codes:
            continue
        qtype = qtype_for(s["category"])
        try:
            data = generate_with_retry(client, GEN_PROMPT.format(
                n=args.per_skill, name=s["name"], code=s["code"], cefr=s["cefr"], qtype=qtype))
            items = [it for it in data["items"] if valid_item(it, qtype)]
            dropped += len(data["items"]) - len(items)
        except Exception as e:
            print(f"{s['code']}: FAILED ({type(e).__name__}: {e})", flush=True)
            failed.append(s["code"])
            continue
        skill_items = []
        for it in items:
            n_opt = max(len(it.get("options") or []), 4)
            a, b, c = seed_irt_params(s["cefr"], n_opt, rng)
            item = {"skillCode": s["code"], "cefrLevel": s["cefr"], "type": qtype,
                    "stem": it["stem"], "options": it.get("options") or [],
                    "correctAnswer": str(it["correctAnswer"]), "source": GEN_MODEL,
                    "a": a, "b": b, "c": 0.0 if qtype == "cloze" else c}
            if qtype == "listening_mcq" and it.get("script"):
                AUDIO_DIR.mkdir(parents=True, exist_ok=True)
                fname = f"{s['code'].replace('.', '_')}_{len(bank)}.mp3"
                try:
                    synth_speech(it["script"], AUDIO_DIR / fname)
                    item["audioUrl"] = f"/audio/{fname}"
                except Exception as e:
                    print(f"  TTS failed for {fname}: {e} (item kept without audio)", flush=True)
            skill_items.append(item)
            bank.append(item)
        print(f"[{i + 1}/{len(skills)}] {s['code']}: {len(items)} items", flush=True)
        OUT.parent.mkdir(parents=True, exist_ok=True)  # checkpoint after every skill
        OUT.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")
        if args.post and skill_items:
            try:
                import_url = f"{args.post.rstrip('/')}/placement/items/import"
                token = os.environ.get("ML_INTERNAL_TOKEN", "")
                headers = {"x-internal-token": token} if token else {}
                resp = httpx.post(import_url, json=skill_items, headers=headers, timeout=30)
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    imported = data.get("importedCount", len(skill_items))
                    total_db = data.get("totalInDb", "?")
                    print(f"  -> Da luu {imported} cau vao Database qua API! (Tong trong DB: {total_db})", flush=True)
                else:
                    print(f"  -> Luu API that bai ({resp.status_code}): {resp.text}", flush=True)
            except Exception as pe:
                print(f"  -> Loi ket noi API Backend: {pe}", flush=True)

        if args.sleep and i + 1 < len(skills):
            time.sleep(args.sleep)

    if bank:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote {len(bank)} items -> {OUT} ({dropped} invalid dropped)"
              + (f" ({len(failed)} skills failed: {failed})" if failed else ""))
    else:
        print(f"No new items generated ({dropped} invalid dropped)"
              + (f" ({len(failed)} skills failed: {failed})" if failed else ""))


if __name__ == "__main__":
    sys.exit(main())
