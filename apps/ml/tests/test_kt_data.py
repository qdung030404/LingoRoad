import pandas as pd
import numpy as np
from pathlib import Path
from lingoroad_ml.kt.data import build_interactions, split_users, KTSequenceDataset

def make_fixture(tmp_path: Path):
    kt1 = tmp_path / "KT1"; kt1.mkdir()
    # user 1: two answers, second one wrong; timestamps 10s apart, 4s elapsed
    pd.DataFrame({
        "timestamp": [1_000_000, 1_010_000],
        "solving_id": [1, 2],
        "question_id": ["q1", "q2"],
        "user_answer": ["a", "c"],
        "elapsed_time": [4000, 3000],
    }).to_csv(kt1 / "u1.csv", index=False)
    pd.DataFrame({
        "question_id": ["q1", "q2"],
        "correct_answer": ["a", "b"],
        "part": [1, 5],
        "tags": ["1;2", "3"],
    }).to_csv(tmp_path / "questions.csv", index=False)
    return kt1, tmp_path / "questions.csv"

def test_build_interactions_correctness_and_lag(tmp_path):
    kt1, qcsv = make_fixture(tmp_path)
    df, q_map = build_interactions(kt1, qcsv, max_users=10)
    assert list(df["correct"]) == [1, 0]           # a==a, c!=b
    assert list(df["lag_ms"]) == [0, 6000]         # 10000 - 4000
    assert set(df["q_idx"]) == {q_map["q1"], q_map["q2"]}

def test_split_users_disjoint_and_deterministic():
    users = list(range(100))
    tr1, va1, te1 = split_users(users, seed=0)
    tr2, va2, te2 = split_users(users, seed=0)
    assert (tr1, va1, te1) == (tr2, va2, te2)
    assert set(tr1) | set(va1) | set(te1) == set(users)
    assert not (set(tr1) & set(va1)) and not (set(va1) & set(te1))
    assert len(tr1) == 80

def test_dataset_shapes_and_padding(tmp_path):
    kt1, qcsv = make_fixture(tmp_path)
    df, _ = build_interactions(kt1, qcsv, max_users=10)
    ds = KTSequenceDataset(df, seq_len=8)
    sample = ds[0]
    for key in ["q", "part", "correct", "elapsed", "lag", "mask"]:
        assert sample[key].shape == (8,)
    assert sample["mask"].sum() == 2               # two real interactions, rest padding
    assert 0.0 <= float(sample["elapsed"].max()) <= 1.0
    import torch
    for key in ["elapsed", "lag", "mask"]:         # float64 would break AMP training
        assert sample[key].dtype == torch.float32, key
