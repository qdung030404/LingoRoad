import torch
from pathlib import Path
from fastapi.testclient import TestClient

def make_checkpoint(tmp_path: Path) -> Path:
    from lingoroad_ml.kt.saint_plus import SAINTPlus
    m = SAINTPlus(n_questions=100, seq_len=100, d=32, heads=4, layers=1)
    p = tmp_path / "saint_plus.pt"
    torch.save({"state_dict": m.state_dict(),
                "config": {"model": "saint_plus", "n_questions": 100,
                           "d": 32, "seq_len": 100, "heads": 4, "layers": 1}}, p)
    return p

def test_kt_predict_returns_probabilities(tmp_path, monkeypatch):
    monkeypatch.setenv("QG_KT_CHECKPOINT", str(make_checkpoint(tmp_path)))
    from lingoroad_ml.serving import kt_routes
    kt_routes.reset_model()          # force reload with the env var
    from lingoroad_ml.serving.app import app
    r = TestClient(app).post("/kt/predict", json={"sequence": [
        {"q_idx": 5, "part": 1, "correct": 1, "elapsed": 0.1, "lag": 0.0},
        {"q_idx": 9, "part": 2, "correct": 0, "elapsed": 0.2, "lag": 0.3},
    ]})
    assert r.status_code == 200
    probs = r.json()["p_next"]
    assert len(probs) == 2 and all(0.0 <= p <= 1.0 for p in probs)

def test_kt_predict_without_checkpoint_returns_503(monkeypatch, tmp_path):
    monkeypatch.setenv("QG_KT_CHECKPOINT", str(tmp_path / "missing.pt"))
    from lingoroad_ml.serving import kt_routes
    kt_routes.reset_model()
    from lingoroad_ml.serving.app import app
    r = TestClient(app).post("/kt/predict", json={"sequence": []})
    assert r.status_code == 503
