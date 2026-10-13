# Practicum Report Evidence Checklist

| # | Artifact | Source | Requirement section |
|---|----------|--------|---------------------|
| 1 | Question bank: 617 items, 6 CEFR levels, seeded IRT params | `GET /items`; generated locally to `ml/data/items.json` (gitignored) | 1.1 |
| 2 | CAT simulation: exact-CEFR 0.750 @ mean 18.5 items vs Fixed-30 0.672 | `ml/reports/cat_simulation.{md,png}` | 1.1 |
| 3 | KT AUC (5 epochs, equal budget): SAINT+ 0.7586 > DKT 0.7565 > DKVMN 0.7558 | `ml/reports/kt_results.md` | 1.2 |
| 4 | Knowledge graph: 174 skill nodes (156 leaf micro-skills + 18 containers) + prerequisite edges | `GET /skills/graph`, `LingoRoad/Data/Seed/skills.json` | 1.2 |
| 5 | Live SAINT+ inference | `POST /kt/predict` demo (QG_KT_CHECKPOINT=ml/checkpoints/saint_plus.pt) | 1.2 |
| 6 | Rule-based path + FSRS schedule | `GET /path`, `/reviews/*` (exercised by e2e smoke) | 1.3 |
| 7 | DQN PoC (100 eps, seed 123; DQN 4000 eps + checkpoint selection): DP 0.636 > DQN 0.588 > greedy 0.533 > random 0.197 | `ml/reports/dqn_poc.{md,png}`, `docs/learning-path-optimization.md` §6.1 | 1.3 |
| 8 | Advisor sample (Vietnamese, RAG-grounded) | `ml/reports/samples/advisor.md` | 1.3 |
| 9 | Generated exercises + WordNet distractors sample | `ml/reports/samples/exercises.md` | 1.4 |
| 10 | AWE sample (IELTS rubric, Vietnamese feedback) | `ml/reports/samples/awe.md` | 1.4 |
| 11 | Speaking assessment sample (Whisper + Vietnamese feedback) | `ml/reports/samples/speaking.md` | 1.5 |
| 12 | E2E smoke run transcript | `ml/research/e2e_smoke.py` output | system |

Honest-limitations paragraph for the report: IRT parameters are heuristically seeded, not
calibrated from response data (V-2); the KT vocabulary gap between EdNet and our item bank
is bridged by EMA mastery rather than direct SAINT+ scoring of our items (task-10 note);
AWE is LLM-as-judge on the IELTS rubric, not a fine-tuned scoring model (V-6); speaking
scoring is word-level (Whisper + alignment), no phoneme-level GOP (V-7); the speaking live
sample uses a TTS clip as a stand-in for a human recording; the DQN is a toy-simulator PoC
(4-skill env), not production-scale RL.

## E2E smoke run transcript

```
[1] auth ok
[2] item bank: 617 items
[3] placement: 30 items -> C2 (theta 3.47)
[4] mastery rows: 19
[5] path: next = grammar.articles
[6] FSRS: next due 2026-07-21T18:47:58.0104292Z
[7] advisor: Bạn nên tập trung vào các chủ đề cơ bản trong lộ trình hiện ...
[8] exercises: generated 3, submit scored
[9] AWE: TA=1
SMOKE OK
```
