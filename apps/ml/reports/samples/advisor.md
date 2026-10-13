# Advisor sample response (task 12, step 5)

Live end-to-end check of `POST /path/advisor`, recorded 2026-07-18 after the
Gemini credit top-up unblocked the 2026-07-13 blocker.

## Setup

- RAG index built the same day: `python -m research.build_rag_index` over the 12
  corpus guides in `ml/data/corpus/` (gemini-embedding-001, 3072-dim vectors,
  index at `ml/data/corpus_index.npz` — gitignored data artifact).
- Services: FastAPI ML on :8001, .NET API on :5000 (Development profile),
  Postgres via docker compose.
- User: fresh registration (`advisor-demo@lingoroad.test`), no placement taken,
  so all masteries are 0 and `GET /path` returns the A1-first default path
  (Articles, Nouns, Countable/Uncountable, … — `reason: not_started`).

## Request

```json
POST /path/advisor
{"question": "Tôi nên học gì tiếp theo và tại sao? Tôi hay nhầm giữa thì hiện tại đơn và hiện tại tiếp diễn."}
```

## Response (HTTP 200, verbatim)

> Bạn nên học **Present Simple (Thì hiện tại đơn)** tiếp theo.
>
> **Lý do:**
> 1.  Đây là một trong những ngữ pháp cơ bản nhất, cần thiết để xây dựng nền tảng.
> 2.  Tài liệu có sẵn và chỉ ra lỗi phổ biến của người Việt (như chia động từ cho ngôi thứ ba số ít), giúp bạn tránh nhầm lẫn ngay từ đầu.
> 3.  Nắm vững thì này sẽ giúp bạn giải quyết một phần sự nhầm lẫn với thì hiện tại tiếp diễn sau này.

## Why this is a good sample

- Answer is in Vietnamese, short, and directly actionable (task requirement).
- It is grounded in both context sources: the recommendation matches the
  learner's beginner path (all mastery 0 → foundational A1 grammar), and the
  reasoning cites content that only exists in the retrieved corpus chunk
  (`present_simple.md` calls out the third-person -s mistake common for
  Vietnamese learners).
- Retrieval was on-topic: the question about present-simple confusion pulled
  the present-simple guide rather than an arbitrary chunk.

Fail-soft behavior (ML service down → `503 {"error":"ml_service_unavailable"}`)
was live-checked in the 2026-07-13 session and is unchanged.
