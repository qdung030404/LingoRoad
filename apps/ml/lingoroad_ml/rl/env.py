import numpy as np


class ToyLearnerEnv:
    """5 chained skills: skill i requires skill i-1 at >= 0.5.

    Practicing an unlocked skill gains 0.15*(1-mastery), a blocked one 0.01;
    every step all skills decay 0.005 (floored at 0). Reward = change in mean
    mastery, +1 bonus when all >= 0.8 (goal, episode ends). Cap 60 steps.
    Only reset() is random; transitions are deterministic.
    """

    def __init__(self, n_skills: int = 5, seed: int = 0):
        self.n = n_skills
        self.rng = np.random.default_rng(seed)
        self.mastery = np.zeros(self.n)
        self.t = 0

    def reset(self) -> np.ndarray:
        self.mastery = self.rng.uniform(0.0, 0.2, self.n)
        self.t = 0
        return self.mastery.copy()

    def step(self, action: int):
        before = self.mastery.mean()
        prereq_ok = action == 0 or self.mastery[action - 1] >= 0.5
        gain = 0.15 * (1 - self.mastery[action]) if prereq_ok else 0.01
        self.mastery[action] = min(1.0, self.mastery[action] + gain)
        self.mastery = np.maximum(0.0, self.mastery - 0.005)   # forgetting
        self.t += 1
        goal = bool(np.all(self.mastery >= 0.8))
        reward = self.mastery.mean() - before + (1.0 if goal else 0.0)
        done = goal or self.t >= 60
        return self.mastery.copy(), float(reward), done
