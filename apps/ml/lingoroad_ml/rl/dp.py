"""Discretized value iteration on ToyLearnerEnv — the exact-optimum anchor.

Protocol: docs/learning-path-optimization.md §7, amended: transitions come
from the real ToyLearnerEnv.step() on every grid state (never a
re-implemented copy of the dynamics), but the successor is represented by
multilinear interpolation over its 2^n neighbouring grid points
(Kushner–Dupuis Markov-chain approximation) instead of the originally
specified nearest-grid rounding. At k = 11, nearest rounding is degenerate:
near high mastery the practice gain is smaller than half a grid cell
(0.7 -> 0.745 - 0.005 decay = 0.74 -> rounds back to 0.7), so the goal is
unreachable in the rounded model and DP collapses below greedy.
Interpolation preserves the expected successor exactly.

Goal handling: at k = 11 no grid state's true one-step successor crosses the
0.8 goal threshold (the highest non-terminal level is 0.7, and practicing
yields 0.745 - 0.005 = 0.74 < 0.8), so the +1 bonus never shows up in any
tabular transition reward. The approximating chain therefore attaches the
bonus to *arrival in the goal set*: goal grid states are absorbing with
V = 1.0 (the bonus, collected on entry), and interpolation corners inside
the goal set deliver it through the continuation term. True transitions that
do reach the goal in one step (possible at other k) keep the bonus in their
reward and get zero continuation weight, so it is never double-counted.
Infinite-horizon VI ignores the 60-step episode cap — an approximation the
report states explicitly.
"""
from functools import lru_cache

import numpy as np

from .env import ToyLearnerEnv


@lru_cache(maxsize=None)
def _corner_offsets(n: int) -> np.ndarray:
    """(2^n, n) binary matrix enumerating the corners of a unit hypercube."""
    return ((np.arange(2 ** n)[:, None] >> np.arange(n)) & 1).astype(np.int64)


def _interp(m: np.ndarray, k: int):
    """Multilinear interpolation of a mastery vector on the k-level grid.

    Returns (levels, weights): levels (2^n, n) grid coordinates, weights (2^n,)
    summing to 1 with expected grid value exactly m.
    """
    n = m.shape[0]
    scaled = np.clip(m, 0.0, 1.0) * (k - 1)
    lo = np.minimum(np.floor(scaled).astype(np.int64), k - 2)   # keep lo+1 on-grid
    t = scaled - lo
    corners = _corner_offsets(n)
    levels = lo + corners
    weights = np.where(corners == 1, t, 1.0 - t).prod(axis=1)
    return levels, weights


def build_model(n_skills: int = 5, k: int = 11):
    """Tabular interpolated model: (grid, corner_idx, corner_w, reward, terminal).

    corner_idx (S, A, 2^n) int32 and corner_w (S, A, 2^n) float32 describe the
    successor distribution of each state-action; rows entering the goal have
    all-zero weights (no continuation).
    """
    shape = (k,) * n_skills
    n_states = k ** n_skills
    n_corners = 2 ** n_skills
    levels = np.stack(np.unravel_index(np.arange(n_states), shape), axis=1)
    grid = levels / (k - 1)
    terminal = np.all(grid >= 0.8, axis=1)
    env = ToyLearnerEnv(n_skills=n_skills, seed=0)
    corner_idx = np.zeros((n_states, n_skills, n_corners), dtype=np.int32)
    corner_w = np.zeros((n_states, n_skills, n_corners), dtype=np.float32)
    reward = np.zeros((n_states, n_skills))
    for s in np.flatnonzero(~terminal):
        for a in range(n_skills):
            env.mastery = grid[s].copy()
            env.t = 0
            m2, r, _ = env.step(a)
            reward[s, a] = r
            if np.all(m2 >= 0.8):        # goal: episode ends, no continuation
                continue
            lv, w = _interp(m2, k)
            corner_idx[s, a] = np.ravel_multi_index(lv.T, shape)
            corner_w[s, a] = w
    return grid, corner_idx, corner_w, reward, terminal


class DpPolicy:
    """Greedy one-step lookahead on the real dynamics with interpolated V."""

    def __init__(self, v, k, n_skills, gamma, iterations):
        self.v, self.k, self.n = v, k, n_skills
        self.gamma, self.iterations = gamma, iterations
        self._env = ToyLearnerEnv(n_skills=n_skills, seed=0)

    def value(self, m) -> float:
        m = np.asarray(m, dtype=float)
        if np.all(m >= 0.8):
            return 0.0
        levels, weights = _interp(m, self.k)
        idx = np.ravel_multi_index(levels.T, (self.k,) * self.n)
        return float(weights @ self.v[idx])

    def act(self, state) -> int:
        best_a, best_q = 0, -np.inf
        for a in range(self.n):
            self._env.mastery = np.asarray(state, dtype=float).copy()
            self._env.t = 0
            m2, r, _ = self._env.step(a)
            q = r + self.gamma * self.value(m2)
            if q > best_q:
                best_a, best_q = a, q
        return best_a


def solve(n_skills: int = 5, k: int = 11, gamma: float = 0.98,
          tol: float = 1e-6, max_iter: int = 5000) -> DpPolicy:
    grid, corner_idx, corner_w, reward, terminal = build_model(n_skills, k)
    v = np.zeros(k ** n_skills)
    v[terminal] = 1.0                    # goal bonus, collected on arrival
    non_terminal = ~terminal
    for it in range(1, max_iter + 1):
        ev = (corner_w * v[corner_idx]).sum(axis=-1)
        q = (reward + gamma * ev).max(axis=1)
        delta = float(np.abs(q[non_terminal] - v[non_terminal]).max())
        v[non_terminal] = q[non_terminal]
        if delta < tol:
            break
    return DpPolicy(v, k, n_skills, gamma, it)
