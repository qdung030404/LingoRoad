import numpy as np
from lingoroad_ml.cefr import cefr_from_theta
from lingoroad_ml.simulation import make_synthetic_bank, simulate_examinee

def test_cefr_bins_match_dotnet():
    assert cefr_from_theta(-2.5) == "A1"
    assert cefr_from_theta(-1.0) == "A2"
    assert cefr_from_theta(0.0) == "B1"
    assert cefr_from_theta(1.0) == "B2"
    assert cefr_from_theta(2.0) == "C1"
    assert cefr_from_theta(3.0) == "C2"

def test_simulation_respects_stop_rule():
    rng = np.random.default_rng(1)
    bank = make_synthetic_bank(500, rng)
    r = simulate_examinee(theta_true=0.3, bank=bank, rng=rng)
    assert 8 <= r.n_items <= 30
    assert np.isfinite(r.theta_hat) and 0 < r.se < 1.0

def test_estimates_track_true_theta_on_average():
    rng = np.random.default_rng(2)
    bank = make_synthetic_bank(500, rng)
    errs = [simulate_examinee(t, bank, rng).theta_hat - t
            for t in np.linspace(-2, 2, 21)]
    assert abs(float(np.mean(errs))) < 0.25  # near-unbiased
