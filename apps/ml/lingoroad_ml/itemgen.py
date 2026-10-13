"""Heuristic IRT parameter seeding (true calibration needs response data - see requirement.md V-2)."""
import numpy as np

CEFR_B = {"A1": -2.0, "A2": -1.2, "B1": -0.4, "B2": 0.5, "C1": 1.4, "C2": 2.2}

def seed_irt_params(cefr: str, n_options: int, rng: np.random.Generator) -> tuple[float, float, float]:
    a = float(np.clip(rng.lognormal(mean=0.0, sigma=0.25), 0.6, 2.0))
    b = float(CEFR_B[cefr] + rng.uniform(-0.4, 0.4))
    c = round(1.0 / n_options, 4)
    return a, b, c
