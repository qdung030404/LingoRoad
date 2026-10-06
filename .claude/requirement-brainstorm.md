# LingoRoad — Brainstorm Result: Scope & Sprint Plan

> Companion to `.claude/requirement.md`. Captures the decisions made during
> brainstorming on 2026-07-09 and the agreed design for the ~1.5-month (6-week) build.

## 1. Context & Decisions

| Decision | Choice |
|----------|--------|
| Primary goal | **Academic practicum report** — trained models, metrics, and dataset pipelines are the deliverable; the API demonstrates them end-to-end |
| Research-depth modules | **1.1 Placement Test (IRT/CAT)** and **1.2 Knowledge Tracing (SAINT+)** |
| Simplified modules | 1.3 Learning Path (rule-based + FSRS + LLM advisor), 1.4 Exercise Gen/AWE (LLM API), 1.5 Speaking (Whisper), plus a time-boxed **DQN proof-of-concept** |
| Team | Solo developer (backend + AI) |
| Hardware | NVIDIA RTX 4060 8 GB — sufficient for SAINT+ on an EdNet subset; not for 7B fine-tuning (LLM fine-tuning is out of scope) |
| Architecture | **NestJS Backend + Python FastAPI ML service** |
| Database | PostgreSQL via Prisma; knowledge graph as plain tables (no Neo4j) |
| Timeline | **3 sprints × 2 weeks** |

## 2. Architecture

Two services, one repository:

```
LingoRoad/            ASPNestJS Core (NestJS 10) — product API
  ├─ Auth (JWT), learner profiles
  ├─ Question bank, test sessions, responses
  ├─ Learning path, SRS review queue, exercises, speaking uploads
  └─ PostgreSQL (Prisma); calls ml-service over HTTP

ml/                    Python FastAPI + PyTorch — AI service AND research code
  ├─ serving/    IRT ability estimation + CAT item selection
  │              SAINT+ inference, LLM calls (advisor, exercise gen, AWE),
  │              FAISS RAG index, Whisper transcription
  └─ research/   EdNet preprocessing, SAINT+/DKT-LSTM/DKVMN training,
                 IRT calibration + CAT simulation, DQN PoC
```

Key principle: **production inference and report experiments share the same code**
(e.g., the CAT engine used by the API is the one used in the simulation study).

Degradation: if the ML service is unreachable, AI endpoints return 503 with a clear
error body; non-AI endpoints keep working.

## 3. Data Model (PostgreSQL)

- `users` — auth + profile (target CEFR goal, native language)
- `items` — question bank: content, audio ref (TTS for listening), CEFR level,
  skill tag, IRT parameters (a, b, c), source
- `skills` — 150 micro-skills; `skill_edges` — prerequisite relationships
- `test_sessions`, `responses` — CAT session state and answer log
- `mastery` — user × skill mastery estimates, updated by knowledge tracing
- `review_cards` — FSRS state (stability, difficulty, due date) per vocab/grammar card
- `exercises` — generated exercises cached with CEFR/skill metadata
- `speaking_attempts` — audio ref, transcript, scores, feedback

## 4. Module Scope

### 4.1 Placement Test — research depth
- 3PL IRT; EAP ability estimation; Maximum-Information item selection;
  stop rule: SE(θ) threshold or 30-item cap.
- Question bank: ~500 items curated from CEFR-SP and RACE plus GPT-4o-assisted
  generation/labeling; listening audio via TTS; IRT parameters **seeded heuristically
  from CEFR labels** (honest limitation — true calibration needs response data;
  re-calibration planned as future work).
- **Report experiment**: simulation with synthetic examinees of known θ —
  CEFR classification accuracy vs. a fixed full-length test, and
  items-to-convergence curve.

### 4.2 Knowledge Tracing — research depth
- SAINT+ trained on an **EdNet-KT1 subset (~5–10M interactions)** on the RTX 4060.
- Baselines: DKT-LSTM, DKVMN. **Report deliverable: AUC-ROC comparison table**
  (realistic target ≥ 0.78, per note V-4 in requirement.md).
- Feature pipeline: correctness, response time, attempt count, elapsed/lag time.
- Predictions mapped to micro-skills to update `mastery`.

### 4.3 Learning Path — simplified
- Rule-based path: topological walk over the prerequisite graph, prioritized by
  mastery gap and goal CEFR level.
- **FSRS** spaced-repetition scheduler: pure algorithm implemented in C# inside the
  NestJS API (the review queue is domain logic — no HTTP hop for scheduling), fully
  unit-tested against reference FSRS values.
- **LLM advisor**: GPT-4o with FAISS RAG over a small curated grammar/textbook corpus;
  generates Vietnamese explanations ("Tại sao bạn cần học kỹ năng này tiếp theo?").
- **DQN PoC (time-boxed ~4 days)**: minimal DQN on a toy simulated learner
  (~5 skills); deliverable = learning-curve plot + comparison vs. random and fixed
  policies. If it overruns the box, it ships as future work.

### 4.4 Exercise Generation & AWE — simplified
- CEFR-targeted GPT-4o prompting for MCQ, cloze, sentence transformation, dialogues.
- Distractors: WordNet + embedding-similarity heuristics.
- AWE: **LLM-as-judge with the IELTS rubric** (Task Achievement, Coherence & Cohesion,
  Lexical Resource, Grammatical Accuracy) producing per-sentence Vietnamese feedback
  (replaces the TOEFL11 fine-tune per note V-6).

### 4.5 Speaking — simplified
- Upload endpoint → Whisper transcription → word-level match scoring vs. prompt text
  → LLM-generated feedback. No MFA/GOP pipeline, no SpeechOcean762 fine-tuning
  (documented as future work).

## 5. Sprint Plan (3 × 2 weeks)

### Sprint 1 (weeks 1–2) — Foundations + Placement Test
- Repo restructure: `LingoRoad/` + `ml/`; docker-compose for Postgres.
- NestJS skeleton: JWT auth, Prisma + migrations, OpenAPI, error handling.
- Skills graph schema + seed (150 micro-skills with prerequisites).
- Question-bank pipeline → ~500 labeled items with seeded IRT params.
- IRT/CAT engine in `ml/` + CAT simulation experiment.
- Placement test endpoints working end-to-end (start session → adaptive items
  → CEFR result).

### Sprint 2 (weeks 3–4) — Knowledge Tracing
- EdNet-KT1 download, sampling, preprocessing, feature pipeline.
- Train SAINT+ + DKT-LSTM + DKVMN; produce AUC comparison table.
- SAINT+ inference endpoint in FastAPI; mastery updates wired into NestJS.
- Mastery-over-time endpoint for per-skill progress.

### Sprint 3 (weeks 5–6) — Remaining modules + report evidence
- FSRS scheduler + review-queue endpoints.
- Rule-based learning path + LLM advisor (RAG).
- Exercise generation + distractors + AWE endpoints.
- Speaking endpoint (Whisper + feedback).
- DQN PoC (time-boxed).
- Demo seed data; end-to-end smoke script; collect all plots/tables/sample
  outputs for the practicum report.

## 6. Testing

- **xUnit** (NestJS): CAT session flow with mocked ML client, FSRS interval math and
  review-queue behavior, auth/domain rules.
- **pytest** (`ml/`): IRT estimation against known values, EdNet feature pipeline,
  CAT item-selection determinism.
- One end-to-end smoke script driving a full placement session through both services.

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| EdNet preprocessing/training takes longer than planned | Subset size is tunable; baselines are small; sprint 2 is dedicated solely to KT |
| Question bank curation is slow | GPT-4o-assisted generation with human spot-checks; 500 items is the target, 300 is the floor for a working CAT |
| DQN PoC rabbit hole | Hard 4-day time box; predefined fallback = future-work section |
| LLM API cost/latency | Cache generated exercises; advisor responses not on hot path |
| Solo bandwidth | Simplified modules are all API-composition work (days, not weeks); deep work is confined to sprints 1–2 |

## 8. Out of Scope (documented as future work in the report)

- LLM fine-tuning (Llama-3/Vistral on RACE/CLC), MFA/GOP pronunciation pipeline,
  SpeechOcean762/L2-ARCTIC fine-tunes, AI conversation partner with TTS,
  full EdNet-scale training, real-learner validation studies (>88% vs Cambridge),
  DQN beyond the PoC, EFCAMDAT-derived Vietnamese-learner error models.

