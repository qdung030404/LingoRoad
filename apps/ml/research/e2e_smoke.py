"""End-to-end smoke test. Prereqs: docker db up, API on :5000 (dotnet run
--launch-profile http), ML service on :8001 (uvicorn started from ml/ with
GEMINI_API_KEY set), item bank imported. Usage (from src/backend):
  ml/.venv/Scripts/python ml/research/e2e_smoke.py --api http://localhost:5000 [--skip-llm]
"""
import argparse, sys, uuid
import httpx

if sys.stdout.encoding is not None and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:5000")
    ap.add_argument("--skip-llm", action="store_true",
                    help="skip advisor/exercises/AWE (no GEMINI_API_KEY)")
    args = ap.parse_args()
    c = httpx.Client(base_url=args.api, timeout=60)
    ok = lambda r: (r.raise_for_status(), r.json())[1]

    # 1. register + login
    email = f"smoke-{uuid.uuid4().hex[:8]}@test.com"
    tok = ok(c.post("/auth/register", json={"email": email, "password": "secret123",
                                            "name": "Smoke"}))["token"]
    c.headers["Authorization"] = f"Bearer {tok}"
    print("[1] auth ok")

    # 2. answer key from the diagnostics item listing (dev-only route)
    answers = {i["id"]: i["correctAnswer"] for i in ok(c.get("/items"))}
    assert len(answers) >= 100, f"item bank too small: {len(answers)}"
    print(f"[2] item bank: {len(answers)} items")

    # 3. adaptive placement, always correct
    state = ok(c.post("/placement/start"))
    session, item_id = state["sessionId"], state["item"]["id"]
    n = 0
    while True:
        step = ok(c.post(f"/placement/{session}/answer",
                         json={"itemId": item_id, "answer": answers[item_id]}))
        n += 1
        assert n <= 30, "stop rule violated"
        if step["done"]:
            break
        item_id = step["item"]["id"]
    result = ok(c.get(f"/placement/{session}/result"))
    assert 8 <= result["itemsAnswered"] <= 30
    print(f"[3] placement: {result['itemsAnswered']} items -> {result['cefr']} "
          f"(theta {result['theta']:.2f})")

    # 4. mastery + path
    print(f"[4] mastery rows: {len(ok(c.get('/mastery')))}")
    path = ok(c.get("/path"))
    assert path, "empty learning path"
    print(f"[5] path: next = {path[0]['code']}")

    # 5. reviews (FSRS)
    ok(c.post("/reviews/cards", json={"skillCode": path[0]["code"],
                                      "front": "hello", "back": "xin chào"}))
    due = ok(c.get("/reviews/due"))
    graded = ok(c.post(f"/reviews/{due[0]['id']}/grade", json={"rating": 3}))
    assert not ok(c.get("/reviews/due")), "card still due after Good"
    print(f"[6] FSRS: next due {graded['due']}")

    if not args.skip_llm:
        # 6. advisor, exercises, AWE (live LLM calls)
        adv = ok(c.post("/path/advisor",
                        json={"question": "Tôi nên học gì tiếp theo và tại sao?"}))
        assert len(adv["answer"]) > 20
        print(f"[7] advisor: {adv['answer'][:60]}...")

        exs = ok(c.post("/exercises/generate", json={"skillCode": path[0]["code"]}))
        assert exs, "no exercises generated"
        sub = ok(c.post(f"/exercises/{exs[0]['id']}/submit",
                        json={"answer": "wrong-on-purpose"}))
        assert sub["correct"] is False and sub["correctAnswer"]
        print(f"[8] exercises: generated {len(exs)}, submit scored")

        awe = ok(c.post("/writing/evaluate", json={
            "taskPrompt": "Describe your hometown.",
            "essay": "My hometown is Da Nang. It have many beautiful beach."}))
        assert "scores" in awe and awe["overallVi"]
        print(f"[9] AWE: TA={awe['scores']['taskAchievement']}")

    print("SMOKE OK")

if __name__ == "__main__":
    sys.exit(main())
