# DQN PoC — four-policy comparison on ToyLearnerEnv

Protocol: `docs/learning-path-optimization.md` §7 — 100 eval episodes, seed 123,
identical dynamics for all policies. DQN: 4000 training episodes,
eps 1.0 -> 0.05 over 400; checkpoint selection — greedy eval
(20 episodes, validation seed 42, never the test seed) every
100 episodes, best network kept (selected at episode 2800).
DP: k=11 grid (11^5 = 161,051 states),
multilinear-interpolated successors (Kushner-Dupuis), goal bonus on arrival
in the goal set, gamma = 0.98, tol 1e-6 (offline cost includes building the
transition table).

| Policy | Mean return | Mean episode length | Goal-reach rate | Offline cost (s) | Latency (ms/decision) |
|---|---|---|---|---|---|
| DP (value iteration) | 0.636 | 60.0 | 0.00 | 67.0 | 0.188 |
| DQN | 0.588 | 60.0 | 0.00 | 391.3 | 0.081 |
| Greedy (fixed order) | 0.533 | 60.0 | 0.00 | 0.0 | 0.003 |
| Random | 0.197 | 60.0 | 0.00 | 0.0 | 0.003 |

Notes:
- Episode length is censored at the 60-step cap; goal-reach rate is the share
  of episodes ending with all skills >= 0.8 within the cap.
- **The goal is unreachable within the cap at n=5 for any policy** (all
  goal-reach rates 0.00, all lengths 60): total decay is 5 x 0.005 = 0.025/step
  while practice gains shrink as mastery rises (0.15 x (1-m)), so raising all
  five skills to >= 0.8 *simultaneously* needs ~80-90 steps. The +1 bonus never
  fires; the comparison is decided by mastery-growth efficiency. (At n=3 the
  goal is comfortably reachable — see tests/test_rl.py.) This also explains why
  greedy's front-to-back rule is not near-optimal here: it keeps re-practicing
  early skills at diminishing returns instead of maximising marginal gain.
- DP is exact for the *discretized* (k=11, interpolated) model, not the
  continuous env: discretization plus the ignored 60-step horizon make it an
  upper-bound approximation. Nearest-grid rounding (the original protocol
  wording) is degenerate at k=11 — the goal is unreachable in the rounded
  chain — hence the interpolated model; see lingoroad_ml/rl/dp.py.
- The a-priori expectation (task file) that a fixed-order heuristic is
  near-optimal on a 5-skill chain did not survive measurement under forgetting:
  DQN beats greedy by +0.056 (+10%) and DP by
  +0.104 (+19%) mean return. The gaps quantify what
  optimising marginal gain buys over a fixed order — the 'do chinh xac'
  (accuracy) column of doc §6, measured.
