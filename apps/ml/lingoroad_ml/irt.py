"""3PL IRT: P(theta) = c + (1-c) / (1 + exp(-a(theta-b))). EAP over N(0,1) prior."""
import numpy as np

_GRID = np.linspace(-4.0, 4.0, 161)
_PRIOR = np.exp(-0.5 * _GRID**2)

def prob_3pl(theta, a: float, b: float, c: float):
    return c + (1.0 - c) / (1.0 + np.exp(-a * (np.asarray(theta) - b)))

def information(theta, a: float, b: float, c: float):
    p = prob_3pl(theta, a, b, c)
    q = 1.0 - p
    return (a**2) * ((p - c) ** 2 / (1.0 - c) ** 2) * (q / p)

def eap_estimate(history: list[tuple[float, float, float, bool]]) -> tuple[float, float]:
    like = np.ones_like(_GRID)
    for a, b, c, correct in history:
        p = prob_3pl(_GRID, a, b, c)
        like = like * (p if correct else 1.0 - p)
    post = like * _PRIOR
    post = post / post.sum()
    theta = float((_GRID * post).sum())
    se = float(np.sqrt(((_GRID - theta) ** 2 * post).sum()))
    return theta, se
