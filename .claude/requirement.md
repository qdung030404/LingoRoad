# LingoRoad — Requirement: AI-Powered English Learning Platform API

> Refined from the original Vietnamese practicum requirement ("Nội dung thực hành").
> Original intent preserved; technical inaccuracies flagged in §7 (Verification Notes).
> Date: 2026-07-09

## 0. Overview

Build a web application API for an English-learning education platform whose core value is
**AI-driven personalized learning**: assess a learner's level, track their knowledge over time,
generate a personalized learning path, generate adaptive exercises, and evaluate
pronunciation/speaking — with explanations delivered in Vietnamese.

Five AI modules sit behind the API:

| # | Module | Core techniques |
|---|--------|-----------------|
| 1.1 | Placement Test | IRT 3PL + Computerized Adaptive Testing (CAT) |
| 1.2 | Knowledge Tracing | SAINT+ (attention-based DKT), Knowledge Graph of micro-skills |
| 1.3 | Personalized Learning Path | DQN (RL), Spaced Repetition (SM-2/FSRS), LLM advisor with RAG |
| 1.4 | Adaptive Exercise Generation | Fine-tuned LLM, distractor generation, Automated Writing Evaluation |
| 1.5 | Pronunciation & Speaking | Whisper ASR + MFA + GOP scoring, AI conversation partner |

---

## 1. Module 1.1 — Placement Test (Đánh giá trình độ đầu vào)

**Question bank**
- Collect and build an English proficiency question bank from **CEFR-SP** and **RACE** datasets.
- Classify **500+ questions** across 6 CEFR levels (A1–C2) and 5 skills
  (Grammar, Vocabulary, Reading, Listening, Writing).
- Label each item with IRT parameters: difficulty (*b*), discrimination (*a*)
  — and guessing (*c*) since the 3PL model is used.

**Adaptive testing engine (CAT)**
- IRT **3-Parameter Logistic (3PL)** model.
- Item selection by **Maximum Information criterion** given the current ability estimate (θ).
- Ability estimation: MLE/EAP updated after each response; stop rule at 20–30 items
  (vs. a fixed 100-item test).
- Target: CEFR classification accuracy **> 88%** against a reference standardized test
  (see note V-3).

**Speaking assessment**
- Pipeline: **Whisper ASR** (speech recognition) → **Montreal Forced Aligner** (phoneme
  alignment) → pronunciation classifier fine-tuned on **SpeechOcean762**.
- Score on 5 dimensions: **accuracy, fluency, prosody, completeness, total score**.

## 2. Module 1.2 — Knowledge Tracing & Learner Modeling

**Feature pipeline**
- Preprocess **EdNet** (131M interactions) and **Duolingo SLAM** datasets.
- Interaction features: response time, correctness, attempt count, hint usage.
- Question features: difficulty, skill tags, CEFR level.
- Temporal features: time since last attempt, forgetting-curve features.

**Model**
- **SAINT+** (Separated Self-Attentive Neural Knowledge Tracing) trained on EdNet;
  predicts probability of answering the next question correctly per language skill.
- Target: **AUC-ROC > 0.82** on EdNet test set (see note V-4).
- Baselines for comparison: DKT-LSTM, DKVMN.

**Knowledge Graph**
- Define **150+ micro-skills** in a hierarchy
  (e.g., Grammar → Tenses → Present Perfect → Usage in Context)
  with **prerequisite relationships**.
- Knowledge-tracing model tracks per-micro-skill mastery over real study time.

## 3. Module 1.3 — Personalized Learning Path Generation

**RL-based path generation (DQN)**
- MDP formulation: **state** = learner ability vector over 150 micro-skills;
  **action** = next lesson/skill selection; **reward** = measured ability improvement
  after each lesson.
- Train DQN on a simulated environment built from EdNet data.
- Compare DQN paths vs. fixed curriculum paths; target: **35% reduction** in simulated
  time-to-CEFR-goal (see note V-5).

**Spaced repetition**
- **SM-2 / FSRS** scheduling for personalized vocabulary & grammar review.
- Optimal inter-repetition interval from ease factor updated after each review.
- Per-learner **Ebbinghaus forgetting curve** modeling.

**LLM Learning Path Advisor**
- LLM (**Vistral-7B / GPT-4o**) + **RAG** over an English-learning document store
  (textbooks, sample exercises, grammar guides).
- Generates natural-language explanations **in Vietnamese**
  ("Tại sao bạn cần học kỹ năng này tiếp theo?"), answers path questions,
  adjusts learning goals on user request.

## 4. Module 1.4 — Adaptive Exercise Generation

**Exercise generator**
- Fine-tune **Llama-3 / Vistral** on **RACE** and **Cambridge Learner Corpus** to generate:
  multiple-choice questions, cloze (fill-in-the-blank), sentence transformation,
  and dialogues — matched to the learner's CEFR level and target skill.
- Quality evaluation: BLEU, ROUGE + expert linguist review (target **> 4.2/5**).

**Distractor generation**
- **Word2Vec/FastText** embeddings + **WordNet** to find near-synonyms that are wrong
  in context, producing plausible distractors.
- Distractors aligned with common errors of Vietnamese learners of English,
  derived from **EFCAMDAT**.

**Automated Writing Evaluation (AWE)**
- Fine-tune an essay-scoring model (dataset: see note V-6) on criteria:
  Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Accuracy.
- Generate detailed **Vietnamese feedback** with per-sentence error locations and fixes.

## 5. Module 1.5 — Pronunciation & Speaking Practice

**Pronunciation assessment pipeline**
- Whisper ASR → MFA phoneme-level alignment → acoustic features (MFCC, pitch, energy)
  → **GOP (Goodness of Pronunciation)** scoring fine-tuned on **L2-ARCTIC** and
  **SpeechOcean762**.
- Detect and localize specific phoneme errors
  (e.g., Vietnamese speakers realizing /θ/ as /d/ or /t/).

**AI conversation partner** *(original text truncated here — reconstructed intent, see V-1)*
- LLM chatbot for conversation practice integrating **ASR + TTS**:
  learner speaks → ASR transcribes → LLM responds in role-play scenarios matched to
  the learner's CEFR level → TTS speaks the reply.
- Conversation topics/scenarios by level; in-conversation feedback on grammar,
  vocabulary, and pronunciation.

---

## 6. Cross-Cutting API Requirements (implied, made explicit)

The original document covers only AI tasks (section 1). A usable product also needs:

- **Web API backend** (this repo — ASPNestJS Core, NestJS 10) exposing the 5 modules:
  auth & learner profiles, test sessions, item bank CRUD, learning-path endpoints,
  exercise delivery & submission, review-queue (SRS) endpoints, speaking uploads.
- **Persistence**: learner interactions, mastery states, item bank, schedules.
- **AI serving layer**: the models above are Python-ecosystem; integration
  architecture must be decided (see brainstorm doc).

---

## 7. Verification Notes (issues found in the original requirement)

- **V-1 (truncation)**: The source text ends mid-sentence at module 1.5, second bullet
  ("chatbot luyện hội…"). The AI-conversation-partner bullet was reconstructed from
  context. Any content after it (e.g., section 2 — non-AI/backend tasks) is missing
  and should be supplied.
- **V-2 (datasets ≠ question bank)**: **CEFR-SP** provides CEFR-labeled *sentences*
  (text difficulty), not test questions; **RACE** is reading-comprehension MCQ without
  CEFR labels or listening audio. Building "500+ CEFR-labeled questions across 5 skills"
  requires significant manual curation, and Listening items need an audio source
  (e.g., TTS-generated). Also, true IRT *a/b/c* calibration requires learner *response
  data*, not just labels — initial parameters will have to be seeded heuristically
  (from CEFR level / expert judgment) and re-calibrated once real responses accumulate.
- **V-3 (accuracy claim)**: ">88% CEFR classification vs. Cambridge standardized test"
  is an *evaluation study result*, not a buildable feature — it needs a validation
  cohort taking both tests. Treat as an aspirational research target, or validate
  by simulation only.
- **V-4 (SAINT+ AUC)**: The SAINT+ paper reports ~0.79 AUC on EdNet; **> 0.82** exceeds
  published state of the art. Realistic target: ≥ 0.78–0.80, and training on the full
  131M interactions is compute-heavy — plan for a sampled subset.
- **V-5 (DQN 35%)**: "35% faster to CEFR goal" is only measurable in the EdNet-derived
  *simulator*, which itself embeds modeling assumptions. State as "improvement in
  simulation", not real-learner outcome.
- **V-6 (TOEFL11 mismatch)**: **TOEFL11** is a native-language-identification corpus
  with coarse (low/medium/high) score bands; the listed criteria
  (Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Accuracy)
  are the **IELTS writing rubric**. Better fits: **ELLIPSE**, **ASAP-AES**,
  **Write & Improve/CLC** — or rubric-based LLM scoring. Recommendation: keep the IELTS
  rubric, switch dataset or use LLM-as-judge with the rubric.
- **V-7 (feasibility)**: Full research-grade delivery of all 5 modules (multiple
  fine-tunings, RL training, validation studies) plus a production API in **~1.5 months**
  is not feasible for a small team. Scope must be tiered (see
  `.claude/requirement-brainstorm.md`): classical algorithms (IRT/CAT, SM-2/FSRS,
  knowledge graph) are cheap to implement well; deep-model work (SAINT+, DQN,
  fine-tuned LLMs, GOP) should be staged, simplified, or replaced by
  pretrained/API-based equivalents where acceptable.

