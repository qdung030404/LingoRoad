from dataclasses import dataclass
import numpy as np
from lingoroad_ml.irt import prob_3pl, eap_estimate
from lingoroad_ml.cat import select_next
from lingoroad_ml.itemgen import seed_irt_params

LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]

@dataclass
class SimResult:
    theta_hat: float
    se: float
    n_items: int

def make_synthetic_bank(n: int, rng: np.random.Generator) -> list[tuple]:
    """Returns [(item_id, a, b, c)] spread evenly across CEFR levels."""
    return [(i, *seed_irt_params(LEVELS[i % 6], 4, rng)) for i in range(n)]

def simulate_examinee(theta_true: float, bank: list[tuple], rng: np.random.Generator,
                      min_items: int = 8, max_items: int = 30,
                      se_stop: float = 0.35) -> SimResult:
    remaining = dict((it[0], it) for it in bank)
    history: list[tuple] = []
    theta, se = 0.0, 1.0
    while True:
        next_id = select_next(theta, list(remaining.values()))
        if next_id is None:
            break
        _, a, b, c = remaining.pop(next_id)
        correct = bool(rng.random() < prob_3pl(theta_true, a, b, c))
        history.append((a, b, c, correct))
        theta, se = eap_estimate(history)
        n = len(history)
        if n >= max_items or (n >= min_items and se < se_stop):
            break
    return SimResult(theta, se, len(history))

def fixed_test(theta_true: float, bank: list[tuple], length: int,
               rng: np.random.Generator) -> float:
    idx = rng.choice(len(bank), size=min(length, len(bank)), replace=False)
    history = []
    for i in idx:
        _, a, b, c = bank[i]
        history.append((a, b, c, bool(rng.random() < prob_3pl(theta_true, a, b, c))))
    theta, _ = eap_estimate(history)
    return theta
