# Learning Path Optimization in LingoRoad

Theory deliverable for **Mảng 3** (`.claude/theory-reqquirement.md`), parts 1–2
of the required output: the formal optimization problem *(bài toán tối ưu)* with its
input/output/constraints, and the comparison of Greedy vs Dynamic Programming vs
Reinforcement Learning on accuracy and computational cost *(độ chính xác / chi phí tính
toán)*. The architecture part of the deliverable is in
[system-architecture.md](system-architecture.md). Paths are relative to the repo root.

## 1. The problem, informally

LingoRoad's curriculum is 156 micro-skills *(kỹ năng vi mô)* arranged in a prerequisite
DAG (nodes = skills with a CEFR level, edges = "must learn first"). Each learner has a
mastery vector — one number in [0, 1] per skill (`Masteries` table) — and a goal CEFR
level. A **learning path** *(lộ trình học)* is the sequence of study activities we
recommend. The requirement asks us to generate the path that **minimizes the time to
reach the goal** *(tối thiểu hóa thời gian đạt mục tiêu)*.

Four things make this more than "sort the skills":

1. **Precedence** — prerequisites must come first; this is a hard constraint, never a
   preference.
2. **Order-dependent gains** — studying a skill whose prerequisite is weak is mostly
   wasted effort, so the value of an action depends on what was studied before it.
3. **Forgetting** — mastery decays over time (`src/backend/LingoRoad/Domain/MasteryCalc.cs` decays
   toward 0.5 at 0.03/day), so a pure feed-forward order is not enough; good paths revisit.
4. **Stochasticity** — real learning gains vary per learner and per attempt.

Repo grounding: the production path builder is rule-based
(`src/backend/LingoRoad/Domain/PathBuilder.cs`, see
[ai-theory-and-algorithms.md](ai-theory-and-algorithms.md) §5); the mastery dynamics that
define our transition model are in `MasteryCalc.cs`; the planned RL proof-of-concept is
task 15 (`.claude/tasks/task-15-dqn-poc.md`).

## 2. Formal problem statement *(input / output / constraints)*

### 2.1 Static combinatorial formulation *(bài toán tối ưu tổ hợp)*

**Input:**
- Skill graph G = (S, E): |S| = 174 nodes — 156 studiable leaves + 18 containers;
  edge (p, s) ∈ E means p is a prerequisite of s (`SkillEdges` table).
- CEFR level ℓ(s) ∈ {A1 … C2} and expected study cost c(s) > 0 (minutes) per skill.
- Current mastery m ∈ [0, 1]^S; mastery threshold τ = 0.8; mastered set
  D = {s : m_s ≥ τ}.
- Goal level g. Target set T = {s ∈ S : s is a leaf, ℓ(s) ≤ g} \ D.

**Output:** an ordering π = (s₁, …, s_k) of T — the learning path.

**Objective:** minimize total study time Σᵢ c(sᵢ), plus revisit costs when forgetting is
modeled.

**Constraints:**
- **C1 Precedence (hard):** for every (p, sᵢ) ∈ E with p ∉ D, p appears before sᵢ in π.
  (Assumes prerequisites of target skills are themselves studiable targets — leaves with
  ℓ(p) ≤ g. This is a modeling idealization: the seeded graph satisfies it for 140 of
  144 prerequisite edges; the exceptions — 3 container-as-prerequisite hierarchy edges
  and one B2 prerequisite of a B1 skill — are dropped by the production filters.)
- **C2 Goal filter:** every sᵢ has ℓ(sᵢ) ≤ g.
- **C3 Leaf-only:** container skills (nodes that are parents) are not studiable.
- **C4 Session budget:** the path is consumed in prefixes of at most B minutes per
  session.

**Hardness.** If gains are deterministic and order-independent, every topological order
costs the same and the problem is solvable in O(V+E) — this is why the production greedy
works at all. The problem becomes genuinely hard exactly when order affects cost:
single-machine sequencing under precedence constraints (1|prec|Σ wⱼCⱼ) is strongly
NP-hard (Lawler 1978; Lenstra & Rinnooy Kan 1978). Forgetting and stochastic gains push
the realistic problem out of the static frame entirely, which motivates:

### 2.2 Stochastic formulation — Markov Decision Process (MDP)

The canonical formulation, and the one task 15 implements at toy scale:

- **State** s_t = m_t ∈ [0, 1]^n — the mastery vector (optionally extended with time
  features).
- **Actions** A(s_t) — the studiable skills (leaf, ℓ ≤ g), optionally masked to skills
  whose prerequisites are met.
- **Transition:** studying skill a raises m_a by a learning gain — expected
  α·(1 − m_a) when a's prerequisites are met, a small wasted ε otherwise (toy values:
  α = 0.15, ε = 0.01) — while **all** skills decay from forgetting (toy: −0.005 per
  step; production: exponential decay toward 0.5 at 0.03/day per `MasteryCalc.cs`).
- **Reward** r_t = mean(m_{t+1}) − mean(m_t), plus a terminal bonus (+1) when every
  target skill reaches τ. (A pure min-time objective would use r = −1 per step; the
  mastery-gain form is a denser shaped proxy for the same goal.)
- **Objective:** a policy π maximizing E[Σ_t γᵗ r_t], discount γ = 0.98.
- **Bellman optimality equation:**
  Q*(s, a) = E[r + γ·max_{a'} Q*(s', a')], and V*(s) = max_a Q*(s, a).

The static formulation of §2.1 is the special case with deterministic gains, no
forgetting, and fixed per-skill costs.

## 3. Method 1 — Greedy *(thuật toán tham lam)*

Two greedy instantiations matter here:

**3.1 Rule pipeline (production, implemented).** `PathBuilder.cs`: Kahn topological sort
of the DAG with deterministic tie-breaking (CEFR then code), then filter — drop
containers (C3), drop above-goal (C2), drop mastered — annotate, truncate. Complexity
O(V+E). "Greedy" in the sense that it commits to one fixed priority order with zero
lookahead. Full rationale in [ai-theory-and-algorithms.md](ai-theory-and-algorithms.md) §5.

**3.2 Scoring greedy.** Repeatedly pick the unlocked skill with the best immediate value
per unit cost: score(a) = α·(1 − m_a) / c(a). O(n log n) with a heap. Note this is a
different policy from the fixed-order baseline in §7: it moves to a skill as soon as it
unlocks (prerequisite ≥ 0.5), not once the current skill is finished (≥ τ).

**Properties.**
- (+) Instant; zero training; zero data — works on day one with no learner history.
- (+) Constraints hold **by construction** (C1–C3 are filters, not penalties).
- (+) Fully explainable: "Past Simple precedes Present Perfect because it is its
  prerequisite."
- (−) Myopic: ignores *unlock value* (a low-gain prerequisite can unlock high-value
  dependents) and cannot time forgetting-aware revisits.
- (−) No optimality guarantee once order affects cost (§2.1 hardness).

## 4. Method 2 — Dynamic Programming *(quy hoạch động)*

DP solves the MDP **exactly** by backward induction on the Bellman equation.

**Value iteration:** V_{k+1}(s) = max_a E[r(s, a) + γ·V_k(s')]. The update is a
γ-contraction, so it converges to V* from any start. Per-sweep cost
O(|States| · |Actions| · |Successors|).

**The curse of dimensionality.** Mastery is continuous, so discretize each of n skills
into k levels → kⁿ states:
- n = 5, k = 11 → 11⁵ = 161,051 states — trivially tractable (the task-15 toy).
- n = 156, k = 11 → 11¹⁵⁶ ≈ 10¹⁶² states — more states than atoms in the observable
  universe (~10⁸⁰). DP can never run at production scale.

**Tractable special cases.**
- No forgetting + binary mastery: the state collapses to the *subset* of mastered
  skills → 2ⁿ states, a Held–Karp-style subset DP — usable to n ≈ 20.
- The toy environment (n = 5): value iteration on a k = 11 grid is cheap and yields the
  exact optimum of the **discretized** model — a near-optimal reference against which
  greedy and DQN are measured (§7).

DP also requires the transition model in closed form. With real learners we only ever
have *samples* of transitions — which is precisely the setting RL is built for.

## 5. Method 3 — Reinforcement Learning (DQN / PPO) *(học tăng cường)*

RL learns a policy from sampled interaction, escaping the curse of dimensionality with
function approximation (a neural network generalizes across states DP would enumerate).

**5.1 DQN** (Mnih et al. 2015) — what task 15 builds. Approximate Q*(s, ·) with an MLP
(toy: 5 → 64 → 64 → 5); ε-greedy exploration (1.0 → 0.05); experience replay (10k
buffer) to decorrelate samples; a target network synced every 200 steps to stabilize the
bootstrap target r + γ·max Q_target(s'); smooth-L1 loss, Adam 1e-3. Value-based and
off-policy (replays old experience), a good fit for a small discrete action space.

**5.2 PPO** (Schulman et al. 2017). Policy-gradient method optimizing the clipped
surrogate objective L = E[min(ρ_t·Â_t, clip(ρ_t, 1−ε, 1+ε)·Â_t)] where ρ_t is the
new/old policy probability ratio and Â_t the advantage estimate — the clip bounds each
update's policy shift, giving stable training. On-policy, so it needs more samples than
DQN, but it is preferred at larger scale: 156 actions instead of 5, native stochastic
policies (useful when several skills are equally good), and well-known robustness to
hyperparameters. PPO is the natural production-scale candidate; DQN is the right tool
for the 5-skill PoC.

**5.3 Hard constraints.** C1–C3 are not naturally expressed as rewards. The standard fix
is **action masking**: invalid actions get Q = −∞ (DQN) or probability 0 (PPO) before
selection. Reward penalties alone are soft — a trained policy can still occasionally
violate them, which is unacceptable for "never suggest a skill before its prerequisite".
(The toy env instead makes violations merely wasteful — gain ε — so the agent can
*discover* ordering; production must mask.)

**5.4 The simulator problem.** RL needs an environment to practice in, and real learners
are too slow and too valuable to explore on. So we train in a simulator — toy dynamics
now, an EdNet-fitted learner model later per the requirement — and inherit the
**sim-to-real gap**: the policy is only as good as the simulator is faithful
(`.claude/requirement.md`, note V-5). This is the deepest reason production
keeps the greedy path while RL remains a proof-of-concept.

## 6. Comparison *(so sánh 3 phương pháp)*

"Accuracy" *(độ chính xác)* = closeness to the true optimum of the modeled problem.
"Computational cost" *(chi phí tính toán)* splits into **offline** (solve/train, once)
and **online** (per-request) cost.

| Criterion | Greedy (rules) | Dynamic Programming | RL (DQN/PPO) |
|---|---|---|---|
| Solution quality | No guarantee; near-optimal when gains are ~independent | **Exact optimum** of the modeled MDP | Approaches optimum with enough training; no guarantee |
| Online cost | O(V+E), sub-millisecond | O(1) table lookup — *if* the table exists | One NN forward pass, ~ms |
| Offline cost | None | O(kⁿ·\|A\|) per sweep — toy scale only | Simulator training (minutes on toy; hours+ at scale) |
| Data needs | None | Exact transition model in closed form | A simulator, or massive logged interactions |
| Hard constraints (C1–C3) | By construction | By state-space design | Require action masking |
| Explainability | Full | Full (within the model) | Low — Q-values are opaque |
| Scales to 156 skills | Yes | **No** (11¹⁵⁶ states) | Yes (function approximation) |
| Status in LingoRoad | **Production** (`PathBuilder.cs`) | Planned toy baseline (§7) | Planned PoC (task 15) |

Bottom line: greedy is the only method with zero cost, zero data needs, and full
explainability — and is optimal-enough while gains are near-independent. DP is the only
method with a guarantee, but it exists only at toy scale, where its job is to *measure
the others*. RL is the only method that both scales and optimizes long-horizon effects
(unlock value, forgetting), at the price of a simulator, training compute, and opacity.

### 6.1 Measured on ToyLearnerEnv *(số liệu đo được, task 15)*

| Policy | Mean return | Mean episode length | Goal-reach rate | Offline cost (s) | Latency (ms/decision) |
|---|---|---|---|---|---|
| DP (value iteration) | 0.636 | 60.0 | 0.00 | 53.3 | 0.142 |
| DQN | 0.588 | 60.0 | 0.00 | 466.2 | 0.067 |
| Greedy (fixed order) | 0.533 | 60.0 | 0.00 | 0.0 | 0.003 |
| Random | 0.197 | 60.0 | 0.00 | 0.0 | 0.002 |

100 eval episodes, seed 123, identical dynamics for all policies (protocol §7). The
expected ordering **DP ≥ DQN ≥ greedy > random** holds. Two measured findings worth
quoting:

1. **The goal never fires at n = 5.** Total forgetting is 5 × 0.005 = 0.025/step while
   practice gains shrink as mastery rises (0.15·(1−m)), so pushing all five skills to
   ≥ 0.8 *simultaneously* needs ~80–90 steps — more than the 60-step cap, for any
   policy (goal-reach 0.00 across the board). The comparison is decided by
   mastery-growth efficiency alone.
2. **Fixed-order greedy is not near-optimal under forgetting** *(tham lam không còn
   gần tối ưu khi có quên)*: DQN beats it by +10% and DP by +19% mean return, because
   the fixed order keeps re-practicing early skills at diminishing returns instead of
   maximising marginal gain. The gaps are the "độ chính xác" column above, measured.

Full report with the learning curve: `src/backend/ml/reports/dqn_poc.md`.

## 7. Experiment protocol (executed with task 15)

Purpose: put measured numbers behind §6, all four policies on **identical dynamics**.
Executed by task 15 (2026-07-17); DQN retrained with checkpoint selection
(2026-07-19); results in §6.1 and
`src/backend/ml/reports/dqn_poc.md`; code under `src/backend/ml/lingoroad_ml/rl/`.
Two protocol details changed during implementation — both flagged below.

**Environment.** `ToyLearnerEnv` from task 15: n = 5 chained skills (skill *i* needs
skill *i−1* ≥ 0.5), gain 0.15·(1−m) when unlocked else 0.01, decay 0.005/step for all
skills, episode ends when all ≥ 0.8 (+1 bonus) or after 60 steps. Note the transitions
are deterministic — only `reset()` is random — which makes an exact DP solution
well-defined.

**Policies.**
1. **Random** — uniform over the 5 actions.
2. **Greedy** — first skill with mastery < 0.8, front to back (task 15's fixed-order
   policy; the toy-scale analogue of §3.1's rule pipeline: a fixed priority order,
   skipping mastered skills).
3. **DP** — value iteration on the discretized env: k = 11 levels per skill
   (0.0, 0.1, …, 1.0) → 11⁵ = 161,051 states; transitions from the true dynamics;
   γ = 0.98; iterate until ‖V_{k+1} − V_k‖∞ < 1e-6.
   *Amended in implementation:* the originally specified nearest-grid rounding is
   degenerate at k = 11 — late-stage practice gains are smaller than half a grid cell
   (0.7 → 0.74 rounds back to 0.7), making the goal unreachable in the rounded chain
   and hiding the +1 bonus from every tabular reward; measured DP fell *below* greedy.
   The implementation instead represents successors by multilinear interpolation over
   their 2⁵ neighbouring grid points (Kushner–Dupuis Markov-chain approximation, exact
   in expectation) and attaches the goal bonus to arrival in the goal set
   (V(terminal) = 1, with zero continuation for true one-step goal transitions so the
   bonus is never double-counted). The policy acts by one-step lookahead on the real
   dynamics with interpolated V. See `lingoroad_ml/rl/dp.py`.
4. **DQN** — retrained 2026-07-19: 4000 episodes, ε 1.0 → 0.05 over 400,
   checkpoint selection (greedy 20-episode validation eval on seed 42 every 100
   episodes, best network kept — selected at episode 2800).

**Protocol.** Task 15's `run_policy` evaluation: 100 episodes, seed 123. Report per
policy: (a) mean return; (b) mean episode length (time-to-goal, censored at the 60-step
cap); (c) goal-reach rate within the cap; (d) offline cost — DP solve wall-clock, DQN
training wall-clock, zero for greedy/random; (e) per-decision latency.

**Expected ordering:** DP ≥ DQN ≥ greedy > random on return. DP is the expected upper
bound (exact for the discretized model); the gaps quantify how much optimality greedy
and DQN sacrifice — the "độ chính xác" column of §6, measured.
*Outcome:* the ordering held exactly (§6.1: 0.636 > 0.588 > 0.533 > 0.197). One
pre-registered assumption did not: the goal is unreachable within the 60-step cap at
n = 5 for *any* policy (§6.1, finding 1), so time-to-goal and goal-reach rate are
degenerate (60.0 / 0.00 for all rows) and the return comparison rests on
mastery-growth efficiency.

**Deliverable:** extra rows (DP) and columns (time-to-goal, goal-reach rate, offline
cost, latency) in `src/backend/ml/reports/dqn_poc.md` — delivered, plus the measured
table in §6.1. (The task-15 file predates the QuestGraph → LingoRoad rename; code
lives under `src/backend/ml/lingoroad_ml/rl/`.)

## 8. Recommendation *(đề xuất)*

A layered strategy — which is what the repo already does, now with its justification:

1. **Production: greedy rule pipeline.** Constraints guaranteed, fully explainable,
   works with zero interaction data — the cold-start reality of a new platform.
2. **Theory anchor: DP on the toy environment.** The (discretized-)exact optimum that
   makes the other two measurable.
3. **Research track: RL.** DQN PoC now (task 15). If the EdNet-fitted simulator
   materializes, PPO + action masking at 156 skills is the natural next step — deployed
   only behind an evaluation gate that shows it beating greedy in simulation.

Hybrid endgame: greedy computes the *feasible frontier* (the constraint layer), RL picks
*within* it (the optimization layer) — action masking makes this composition natural.

## References

- Bellman, R. (1957). *Dynamic Programming*. Princeton University Press.
- Sutton, R. & Barto, A. (2018). *Reinforcement Learning: An Introduction* (2nd ed.). MIT Press.
- Mnih, V. et al. (2015). Human-level control through deep reinforcement learning. *Nature* 518.
- Schulman, J. et al. (2017). Proximal Policy Optimization Algorithms. arXiv:1707.06347.
- Lawler, E. (1978). Sequencing jobs to minimize total weighted completion time subject to precedence constraints. *Annals of Discrete Mathematics* 2.
- Lenstra, J.K. & Rinnooy Kan, A.H.G. (1978). Complexity of scheduling under precedence constraints. *Operations Research* 26(1).
- Held, M. & Karp, R. (1962). A dynamic programming approach to sequencing problems. *SIAM Journal* 10(1).
