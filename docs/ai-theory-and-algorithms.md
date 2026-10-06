# AI Theory and Algorithms in LingoRoad

This document explains the theory behind every AI/ML component in LingoRoad, why each
technique was chosen, how it is implemented in this repository, and what evidence we have
that it works. Paths are relative to `src/backend/`.

| Component | Technique | Code | Status |
|---|---|---|---|
| Placement test | IRT 3PL + EAP + max-information CAT | `ml/lingoroad_ml/irt.py`, `cat.py` | Done |
| Knowledge tracing | SAINT+ (vs DKT, DKVMN baselines) | `ml/lingoroad_ml/kt/` | Done |
| Skill mastery | EMA with exponential decay | `LingoRoad/Domain/MasteryCalc.cs` | Done |
| Spaced repetition | FSRS-4.5 | `LingoRoad/Domain/Fsrs.cs` | Done |
| Learning path | Topological sort over prerequisite DAG | `LingoRoad/Domain/PathBuilder.cs` | Done |
| Study advisor | RAG + LLM (Gemini) in Vietnamese | `ml/lingoroad_ml/llm/` | Done (code) |
| Exercise generation & AWE | LLM generation + automated writing evaluation | task 13 | Planned |
| Speaking assessment | Whisper ASR + scoring | task 14 | Planned |
| Path optimization | DQN proof-of-concept | task 15 | Planned |

Deep-dives: [learning-path-optimization.md](learning-path-optimization.md) (formal
problem statement, Greedy vs DP vs RL) and [system-architecture.md](system-architecture.md)
(full-stack architecture and schema).

---

## 1. Adaptive placement testing

### 1.1 Item Response Theory — the 3PL model

Classical tests score "number correct", which conflates item difficulty with learner
ability. Item Response Theory (IRT) instead models the *probability* that a learner with
latent ability θ answers item *i* correctly. We use the three-parameter logistic (3PL)
model:

```
P_i(θ) = c_i + (1 − c_i) / (1 + exp(−a_i(θ − b_i)))
```

- **a** (discrimination): how sharply the item separates weaker from stronger learners.
- **b** (difficulty): the θ at which the learner has a 50/50 chance (above guessing).
- **c** (guessing): the floor probability — a learner far below b can still guess a
  multiple-choice item correctly (~0.25 for 4 options).

θ lives on a standard-normal scale (≈ −3 … +3). LingoRoad maps θ to CEFR levels with
fixed cut-offs (`LingoRoad/Domain/CefrMap.cs` and `ml/lingoroad_ml/cefr.py`):

| θ | < −1.5 | −1.5…−0.5 | −0.5…0.5 | 0.5…1.5 | 1.5…2.25 | ≥ 2.25 |
|---|---|---|---|---|---|---|
| CEFR | A1 | A2 | B1 | B2 | C1 | C2 |

### 1.2 EAP ability estimation

After each answer we re-estimate θ using **Expected A Posteriori (EAP)** estimation
(`irt.py:eap_estimate`). EAP is Bayesian: start from a N(0,1) prior over θ (most people
are near average), multiply by the likelihood of the observed response pattern, and take
the posterior mean:

```
posterior(θ) ∝ prior(θ) · Π_i P_i(θ)^{x_i} · (1 − P_i(θ))^{1−x_i}
θ̂  = E[θ | responses]          (posterior mean)
SE = sqrt(Var[θ | responses])   (posterior standard deviation)
```

The integral is computed numerically on a fixed grid of 161 points over [−4, 4].
EAP was chosen over maximum likelihood because ML estimates diverge to ±∞ when a learner
has answered everything right (or wrong) — exactly the situation at the start of a test.
EAP always returns a finite estimate and a meaningful standard error.

### 1.3 Computerized Adaptive Testing (CAT)

A CAT picks each next question to be maximally informative *for this learner right now*,
instead of giving everyone the same fixed form. "Informative" is Fisher information; for
the 3PL model (`irt.py:information`):

```
I_i(θ) = a_i² · (P_i − c_i)² / (1 − c_i)² · Q_i / P_i     where Q_i = 1 − P_i
```

Information peaks when item difficulty is near the learner's current θ̂ — intuitively,
questions that are far too easy or far too hard tell us almost nothing. The selector
(`cat.py:select_next`) simply returns the candidate item with maximal I(θ̂).

**Stop rule** (used by `LingoRoad/Endpoints/PlacementEndpoints.cs`): minimum 8 items;
stop as soon as SE(θ̂) < 0.35; hard cap 30 items. SE < 0.35 means the posterior is tight
enough that the CEFR bucket is unlikely to change with more questions.

**Evidence** (`ml/reports/cat_simulation.md`, N = 1000 simulated examinees, 617-item bank):

| Metric | CAT | Fixed-30 |
|---|---|---|
| Exact CEFR accuracy | **0.750** | 0.672 |
| Adjacent (±1 level) accuracy | 1.000 | — |
| RMSE(θ) | 0.342 | — |
| Mean items administered | **18.5** | 30 |

The CAT is both more accurate than a fixed 30-item test *and* ~38 % shorter.

---

## 2. Knowledge tracing (KT)

### 2.1 The task

Knowledge tracing predicts, from a learner's interaction history
(question, correctness, timing), the probability they answer the *next* question
correctly. It is the deep-learning successor to Bayesian Knowledge Tracing, and provides
the per-interaction signal we fold into skill mastery.

We trained three architectures on the same data budget to justify the choice
(`ml/lingoroad_ml/kt/`):

- **DKT** (Piech et al. 2015) — an LSTM over one-hot (question, correctness) pairs; the
  hidden state is the "knowledge state". Simple, strong baseline.
- **DKVMN** (Zhang et al. 2017) — a key-value memory network: a static key matrix holds
  latent concepts, a dynamic value matrix holds the mastery of each, with attention-based
  read/write. More interpretable per-concept state.
- **SAINT+** (Shin et al. 2021) — an encoder–decoder Transformer. The encoder attends to
  the exercise sequence (question id + part embeddings + positions); the decoder attends
  to the response sequence enriched with two temporal features: **elapsed time** (how long
  the answer took) and **lag time** (gap since the previous interaction). Responses and
  elapsed time are shifted right by one position (start token) so the model never sees the
  answer to the question it is predicting; lag is not shifted because it is known *before*
  answering (`kt/saint_plus.py`).

### 2.2 Data and results

Training data is **EdNet KT1** (Choi et al. 2020), the large public TOEIC-preparation log:
our subset is 60,000 users / 7,504,848 interactions, mean correctness 0.654
(`ml/research/ednet_prepare.py`). Splits are **by user** (80/10/10), so no learner appears
in both train and test — this prevents identity leakage, and a regression test guards the
feature dtypes and split integrity (`ml/tests/test_kt_data.py`).

Results with equal budgets (seq_len 100, d = 128, batch 128, Adam 1e-3, 5 epochs, AMP,
RTX 4060) from `ml/reports/kt_results.md`:

| Model | Val AUC | Test AUC |
|---|---|---|
| DKT | 0.7593 | 0.7565 |
| DKVMN | 0.7588 | 0.7558 |
| **SAINT+** | **0.7619** | **0.7586** |

All exceed the ≥ 0.75 target; SAINT+ wins and is the model served at `/kt/predict`
(`ml/lingoroad_ml/serving/kt_routes.py`, checkpoint via `QG_KT_CHECKPOINT`). Published
full-EdNet SAINT+ reaches ~0.79; a 60k-user subset scoring slightly lower is expected.

---

## 3. Skill mastery — EMA with forgetting decay

Mastery per (user, skill) is a number in [0, 1] stored in `Masteries` and updated on every
answer (`LingoRoad/Domain/MasteryCalc.cs`):

```
decayed = 0.5 + (prior − 0.5) · exp(−0.03 · days_since_last)   // Ebbinghaus-style decay
next    = decayed + 0.3 · (target − decayed)                    // EMA toward 1 (correct) or 0 (wrong)
```

Two ideas are combined:

1. **Exponential moving average** (learning rate 0.3): recent performance counts more than
   old performance, without storing full history.
2. **Decay toward 0.5** (rate 0.03/day): knowledge fades when unused — but it decays toward
   the *uninformed baseline* 0.5, not toward 0, because absence of practice is absence of
   evidence, not evidence of failure.

A skill counts as "done" for path-building purposes at **mastery ≥ 0.8**.

---

## 4. Spaced repetition — FSRS-4.5

For vocabulary/flashcard review LingoRoad implements **FSRS-4.5** (Free Spaced Repetition
Scheduler), the modern, data-fitted successor to SM-2/Anki scheduling
(`LingoRoad/Domain/Fsrs.cs`, reference implementation: py-fsrs).

FSRS models each card with three quantities (the DSR model):

- **Retrievability R** — probability of recalling the card now. FSRS-4.5 uses a *power*
  forgetting curve, which fits human forgetting data better than an exponential:

  ```
  R(t, S) = (1 + 19/81 · t/S)^(−0.5)
  ```

- **Stability S** — the number of days for R to fall to 0.9. Grows with each successful
  review (spacing effect), grows *more* when the review happened at lower R (harder recall
  strengthens more), and shrinks on a lapse.
- **Difficulty D ∈ [1, 10]** — how hard this card is for this learner; hard cards' stability
  grows more slowly. Updated after each review with mean reversion so it cannot drift
  monotonically to the extremes.

The learner grades each review **Again / Hard / Good / Easy (1–4)**. The 17 weights
`w0…w16` are the published FSRS-4.5 defaults, fitted on hundreds of millions of real
reviews. Update rules (as implemented):

- First review: `S = w[grade−1]`, `D = clamp(w4 − (grade−3)·w5, 1, 10)`.
- Successful review at retrievability R:
  `S' = S · (1 + e^{w8} · (11 − D) · S^{−w9} · (e^{w10(1−R)} − 1) · hardPenalty · easyBonus)`.
- Lapse (Again): `S' = min(w11 · D^{−w12} · ((S+1)^{w13} − 1) · e^{w14(1−R)}, S)` and the
  card enters *relearning*, due again in 10 minutes.

**Scheduling**: with target retention 0.9, the power curve gives interval = S exactly
(R(S, S) = (1 + 19/81)^(−0.5) = 0.9), so the next due date is simply `now + S days`.
This is why the code contains no separate interval formula.

Endpoints: `POST /reviews/cards`, `GET /reviews/due`, `POST /reviews/{id}/grade`
(`LingoRoad/Endpoints/ReviewEndpoints.cs`). Property tests assert the theory's qualitative
behaviour: interval ordering by grade, stability growth under spaced success, stability
loss on lapse, D staying in [1, 10] (`LingoRoad.Tests/FsrsTests.cs`).

---

## 5. Learning path — prerequisite DAG + rules

The 156 micro-skills form a directed acyclic graph: nodes are skills (with CEFR level and
optional parent container), edges are prerequisites. The path builder
(`LingoRoad/Domain/PathBuilder.cs`) is deliberately rule-based and transparent:

1. **Kahn topological sort** of the skill DAG (`SkillGraph.TopologicalOrder`), with
   deterministic tie-breaking by CEFR then code — prerequisites always precede dependents.
2. Drop container skills (nodes that are parents) — only leaves are studiable.
3. Drop skills above the learner's goal CEFR (`CefrMap.Rank`).
4. Drop skills already mastered (mastery ≥ 0.8).
5. Annotate each remaining step: `not_started` (no mastery record) vs `below_threshold`
   (practiced but < 0.8); take the first `limit` steps.

Rules rather than a learned policy because the requirements are hard constraints
(never suggest a skill before its prerequisite), the result must be explainable to the
learner, and there is no interaction data yet to fit a policy — the DQN task (§8) is the
planned learned alternative. The formal optimization problem and the three-method
comparison are developed in [learning-path-optimization.md](learning-path-optimization.md).

---

## 6. LLM study advisor with RAG

`POST /path/advisor` answers free-form questions ("Why should I learn present perfect
next?") in **Vietnamese**, grounded in (a) the learner's current path + mastery and
(b) a curated grammar corpus. This is Retrieval-Augmented Generation (RAG): retrieval
supplies facts so the LLM explains rather than invents.

**Pipeline** (`ml/lingoroad_ml/llm/rag.py`, `advisor.py`, served at `/llm/advisor`):

1. **Corpus**: ~12 short hand-reviewed grammar guides (`ml/data/corpus/*.md`), each with
   form, usage, signal words, and a typical *Vietnamese-learner* error (e.g. dropped
   third-person -s, missing articles — transfer effects from Vietnamese).
2. **Indexing**: guides are chunked (800 chars) and embedded with `gemini-embedding-001`;
   vectors are stored in a plain `.npz` file. The corpus is tiny, so brute-force cosine
   similarity beats maintaining a vector database (FAISS et al. unnecessary).
3. **Retrieval**: embed the question, cosine-score against all chunks, take top k = 3.
4. **Generation**: `gemini-2.5-flash` (temperature 0.4) with a Vietnamese system prompt;
   the user message contains the learner's path with mastery numbers, the retrieved
   chunks, and the question. The .NET side assembles the path context so the ML service
   stays stateless.

**Degradation rule**: if the ML service is unreachable, the endpoint returns
`503 {"error":"ml_service_unavailable"}` — AI features fail soft, core features keep
working. Tests use a fake embedder (deterministic char-histogram) and a prompt-shape
test so no API calls happen in CI (`ml/tests/test_rag.py`, `test_llm_api.py`).

---

## 7. Planned: exercise generation, AWE, speaking (tasks 13–14)

- **Exercise generation** — LLM-generated items per skill with distractor generation;
  AWE (automated writing evaluation) scores learner writing and returns Vietnamese
  feedback (`gemini-2.5-flash`).
- **Speaking** — audio upload → local **faster-whisper** ASR on the RTX 4060 →
  pronunciation/fluency scoring → Vietnamese feedback. Whisper runs locally: no audio
  leaves the machine and no per-call cost.

These follow the same degradation and testing patterns (fake clients in tests, 503 fail-soft).

## 8. Planned: DQN proof-of-concept (task 15)

A time-boxed experiment: treat sequencing as a reinforcement-learning problem. A toy
learner simulator (mastery dynamics like §3) provides the environment; a **Deep
Q-Network** (state = mastery vector, action = which skill to practice, reward = mastery
gain) is trained against it, and its learning curve is compared with the rule-based path.
It is a PoC only: real learner data is far too scarce to train RL safely, which is exactly
why production uses §5's rules. The experiment protocol comparing DQN with DP and greedy
baselines on the same environment is specified in
[learning-path-optimization.md](learning-path-optimization.md) §7.

---

## References

- Lord, F. (1980). *Applications of Item Response Theory*. — 3PL model.
- Bock & Mislevy (1982). EAP estimation in adaptive testing.
- van der Linden & Glas (2010). *Elements of Adaptive Testing*. — max-info CAT, stop rules.
- Piech et al. (2015). Deep Knowledge Tracing. NeurIPS.
- Zhang et al. (2017). Dynamic Key-Value Memory Networks. WWW.
- Choi et al. (2020). EdNet: A Large-Scale Hierarchical Dataset in Education. AIED.
- Shin et al. (2021). SAINT+: Integrating Temporal Features into EdNet KT. LAK.
- Ye, J. et al. — FSRS: Free Spaced Repetition Scheduler (github.com/open-spaced-repetition),
  FSRS-4.5 weights and DSR model.
- Lewis et al. (2020). Retrieval-Augmented Generation. NeurIPS.
- Mnih et al. (2015). Human-level control through deep RL (DQN). Nature.
