import numpy as np
from lingoroad_ml.itemgen import seed_irt_params, CEFR_B

def test_params_within_bounds():
    rng = np.random.default_rng(42)
    for cefr in ["A1", "A2", "B1", "B2", "C1", "C2"]:
        a, b, c = seed_irt_params(cefr, n_options=4, rng=rng)
        assert 0.6 <= a <= 2.0
        assert abs(b - CEFR_B[cefr]) <= 0.4
        assert c == 0.25

def test_difficulty_increases_with_level():
    assert CEFR_B["A1"] < CEFR_B["A2"] < CEFR_B["B1"] < CEFR_B["B2"] < CEFR_B["C1"] < CEFR_B["C2"]

def test_deterministic_with_seed():
    p1 = seed_irt_params("B1", 4, np.random.default_rng(7))
    p2 = seed_irt_params("B1", 4, np.random.default_rng(7))
    assert p1 == p2
