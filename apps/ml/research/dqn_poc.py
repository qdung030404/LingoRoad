"""DQN vs DP vs greedy vs random on ToyLearnerEnv -> ml/reports/dqn_poc.{png,md}.

Protocol: docs/learning-path-optimization.md §7. Run as a module from ml/:
    .venv/Scripts/python -m research.dqn_poc
"""
import copy
import time
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from lingoroad_ml.rl.dp import solve
from lingoroad_ml.rl.dqn import DQNAgent
from lingoroad_ml.rl.env import ToyLearnerEnv

ROOT = Path(__file__).parents[1]
EPISODES = 4000
EPS_DECAY_EPISODES = 400
CHECKPOINT_EVERY = 100
VAL_SEED = 42       # validation env for selection — NEVER the test seed 123
VAL_EPISODES = 20
N_SKILLS = 5


def evaluate(policy, episodes=100, seed=123):
    """All policies share this evaluator: identical env seed => identical resets."""
    env = ToyLearnerEnv(n_skills=N_SKILLS, seed=seed)
    returns, lengths, goals, latencies = [], [], [], []
    for _ in range(episodes):
        s, total, done, t = env.reset(), 0.0, False, 0
        while not done:
            t0 = time.perf_counter()
            a = policy(s)
            latencies.append(time.perf_counter() - t0)
            s, r, done = env.step(a)
            total += r
            t += 1
        returns.append(total)
        lengths.append(t)
        goals.append(bool(np.all(env.mastery >= 0.8)))
    return {"return": float(np.mean(returns)),
            "length": float(np.mean(lengths)),
            "goal_rate": float(np.mean(goals)),
            "latency_ms": float(np.mean(latencies) * 1e3)}


def train_dqn(episodes=EPISODES, checkpoint_every=CHECKPOINT_EVERY):
    env = ToyLearnerEnv(n_skills=N_SKILLS, seed=0)
    agent = DQNAgent(state_dim=N_SKILLS, n_actions=N_SKILLS, seed=0)
    curve = []
    best_val, best_ep, best_state = float("-inf"), 0, None

    def validate(after_ep):
        nonlocal best_val, best_ep, best_state
        val = evaluate(lambda s: agent.act(s, eps=0.0),
                       episodes=VAL_EPISODES, seed=VAL_SEED)["return"]
        if val > best_val:
            best_val, best_ep = val, after_ep
            best_state = copy.deepcopy(agent.q.state_dict())

    for ep in range(episodes):
        eps = max(0.05, 1.0 - ep / EPS_DECAY_EPISODES)
        s, total, done = env.reset(), 0.0, False
        while not done:
            a = agent.act(s, eps)
            s2, r, done = env.step(a)
            agent.remember(s, a, r, s2, done)
            agent.train_step()
            s, total = s2, total + r
        curve.append(total)
        if ep % 100 == 0:
            print(f"ep {ep}: mean return (last 100) {np.mean(curve[-100:]):.3f}", flush=True)
        if (ep + 1) % checkpoint_every == 0:
            validate(ep + 1)
    if episodes % checkpoint_every:
        validate(episodes)
    agent.q.load_state_dict(best_state)
    agent.target.load_state_dict(best_state)
    return agent, curve, best_ep, best_val


def report_lines(results, best_ep):
    """Markdown report body. Every measured number comes from `results`."""
    lines = [
        "# DQN PoC — four-policy comparison on ToyLearnerEnv",
        "",
        "Protocol: `docs/learning-path-optimization.md` §7 — 100 eval episodes, seed 123,",
        f"identical dynamics for all policies. DQN: {EPISODES} training episodes,",
        f"eps 1.0 -> 0.05 over {EPS_DECAY_EPISODES}; checkpoint selection — greedy eval",
        f"({VAL_EPISODES} episodes, validation seed {VAL_SEED}, never the test seed) every",
        f"{CHECKPOINT_EVERY} episodes, best network kept (selected at episode {best_ep}).",
        "DP: k=11 grid (11^5 = 161,051 states),",
        "multilinear-interpolated successors (Kushner-Dupuis), goal bonus on arrival",
        "in the goal set, gamma = 0.98, tol 1e-6 (offline cost includes building the",
        "transition table).",
        "",
        "| Policy | Mean return | Mean episode length | Goal-reach rate | Offline cost (s) | Latency (ms/decision) |",
        "|---|---|---|---|---|---|",
    ]
    for name, (m, cost) in results.items():
        lines.append(f"| {name} | {m['return']:.3f} | {m['length']:.1f} | "
                     f"{m['goal_rate']:.2f} | {cost:.1f} | {m['latency_ms']:.3f} |")
    greedy = results["Greedy (fixed order)"][0]["return"]
    dqn_gap = results["DQN"][0]["return"] - greedy
    dp_gap = results["DP (value iteration)"][0]["return"] - greedy
    lines += [
        "",
        "Notes:",
        "- Episode length is censored at the 60-step cap; goal-reach rate is the share",
        "  of episodes ending with all skills >= 0.8 within the cap.",
        "- **The goal is unreachable within the cap at n=5 for any policy** (all",
        "  goal-reach rates 0.00, all lengths 60): total decay is 5 x 0.005 = 0.025/step",
        "  while practice gains shrink as mastery rises (0.15 x (1-m)), so raising all",
        "  five skills to >= 0.8 *simultaneously* needs ~80-90 steps. The +1 bonus never",
        "  fires; the comparison is decided by mastery-growth efficiency. (At n=3 the",
        "  goal is comfortably reachable — see tests/test_rl.py.) This also explains why",
        "  greedy's front-to-back rule is not near-optimal here: it keeps re-practicing",
        "  early skills at diminishing returns instead of maximising marginal gain.",
        "- DP is exact for the *discretized* (k=11, interpolated) model, not the",
        "  continuous env: discretization plus the ignored 60-step horizon make it an",
        "  upper-bound approximation. Nearest-grid rounding (the original protocol",
        "  wording) is degenerate at k=11 — the goal is unreachable in the rounded",
        "  chain — hence the interpolated model; see lingoroad_ml/rl/dp.py.",
        "- The a-priori expectation (task file) that a fixed-order heuristic is",
        "  near-optimal on a 5-skill chain did not survive measurement under forgetting:",
        f"  DQN beats greedy by {dqn_gap:+.3f} ({dqn_gap / greedy:+.0%}) and DP by",
        f"  {dp_gap:+.3f} ({dp_gap / greedy:+.0%}) mean return. The gaps quantify what",
        "  optimising marginal gain buys over a fixed order — the 'do chinh xac'",
        "  (accuracy) column of doc §6, measured.",
    ]
    return lines


def main():
    t0 = time.perf_counter()
    agent, curve, best_ep, best_val = train_dqn()
    dqn_cost = time.perf_counter() - t0
    print(f"DQN trained in {dqn_cost:.1f}s (best checkpoint: ep {best_ep}, "
          f"val return {best_val:.3f})", flush=True)

    t0 = time.perf_counter()
    dp = solve(n_skills=N_SKILLS, k=11)
    dp_cost = time.perf_counter() - t0
    print(f"DP solved in {dp_cost:.1f}s ({dp.iterations} sweeps)", flush=True)

    rng = np.random.default_rng(7)
    policies = {
        "DP (value iteration)": (dp.act, dp_cost),
        "DQN": (lambda s: agent.act(s, eps=0.0), dqn_cost),
        "Greedy (fixed order)": (lambda s: min(int(np.argmax(s < 0.8)), N_SKILLS - 1), 0.0),
        "Random": (lambda s: int(rng.integers(N_SKILLS)), 0.0),
    }
    results = {name: (evaluate(fn), cost) for name, (fn, cost) in policies.items()}

    out = ROOT / "reports"
    out.mkdir(exist_ok=True)
    smooth = np.convolve(curve, np.ones(20) / 20, mode="valid")
    plt.figure(figsize=(7, 4))
    plt.plot(smooth, label="DQN (smoothed)")
    plt.axvline(best_ep, color="tab:red", ls=":", lw=1, label=f"selected ep {best_ep}")
    for name, color, ls in [("Random", "gray", ":"),
                            ("Greedy (fixed order)", "tab:orange", "--"),
                            ("DP (value iteration)", "tab:green", "-.")]:
        m, _ = results[name]
        plt.axhline(m["return"], color=color, ls=ls,
                    label=f"{name} {m['return']:.2f}")
    plt.xlabel("episode"); plt.ylabel("return"); plt.legend()
    plt.title("DQN learning curve vs baselines")
    plt.tight_layout()
    plt.savefig(out / "dqn_poc.png", dpi=150)

    (out / "dqn_poc.md").write_text("\n".join(report_lines(results, best_ep)) + "\n",
                                    encoding="utf-8")
    for name, (m, cost) in results.items():
        print(f"{name}: return {m['return']:.3f}, len {m['length']:.1f}, "
              f"goal {m['goal_rate']:.2f}, offline {cost:.1f}s", flush=True)


if __name__ == "__main__":
    main()
