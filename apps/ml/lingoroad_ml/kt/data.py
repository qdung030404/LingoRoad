"""EdNet KT1 -> interaction frame + torch dataset (features per SAINT+ paper)."""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset

def build_interactions(kt1_dir: Path, questions_csv: Path, max_users: int | None = None):
    q = pd.read_csv(questions_csv, usecols=["question_id", "correct_answer", "part"])
    q_map = {qid: i + 1 for i, qid in enumerate(q["question_id"])}  # 0 = padding
    q = q.set_index("question_id")

    frames = []
    files = sorted(Path(kt1_dir).glob("u*.csv"))[:max_users]
    for f in files:
        df = pd.read_csv(f).sort_values("timestamp")
        df["user_id"] = int(f.stem[1:])
        df = df.join(q, on="question_id", how="inner")
        df["correct"] = (df["user_answer"] == df["correct_answer"]).astype("int8")
        prev_end = (df["timestamp"] + df["elapsed_time"]).shift(1)
        df["lag_ms"] = (df["timestamp"] - prev_end).clip(lower=0).fillna(0).astype("int64")
        df["q_idx"] = df["question_id"].map(q_map)
        df["elapsed_ms"] = df["elapsed_time"].astype("int64")
        frames.append(df[["user_id", "q_idx", "part", "correct", "elapsed_ms", "lag_ms"]])
    out = pd.concat(frames, ignore_index=True)
    return out, q_map

def split_users(user_ids, seed: int = 0):
    rng = np.random.default_rng(seed)
    ids = np.array(sorted(user_ids))
    rng.shuffle(ids)
    n = len(ids)
    return (ids[: int(n * 0.8)].tolist(),
            ids[int(n * 0.8): int(n * 0.9)].tolist(),
            ids[int(n * 0.9):].tolist())

class KTSequenceDataset(Dataset):
    def __init__(self, df: pd.DataFrame, seq_len: int = 100):
        self.seq_len = seq_len
        self.windows = []
        for _, g in df.groupby("user_id", sort=False):
            arr = g[["q_idx", "part", "correct", "elapsed_ms", "lag_ms"]].to_numpy()
            for start in range(0, len(arr), seq_len):
                self.windows.append(arr[start: start + seq_len])

    def __len__(self):
        return len(self.windows)

    def __getitem__(self, i):
        w = self.windows[i]
        L, n = self.seq_len, len(w)
        pad = L - n
        def col(j, dtype):
            v = np.zeros(L, dtype=dtype); v[pad:] = w[:, j]; return v
        elapsed = np.clip(col(3, np.float32) / 1000.0, 0, 300) / 300.0
        # divide by a python float, not np.log1p(1440.0): a float64 scalar would
        # promote the whole array to float64 and break AMP (Double vs Half)
        lag = np.log1p(np.minimum(col(4, np.float32), 86_400_000) / 60_000.0) / float(np.log1p(1440.0))
        mask = np.zeros(L, dtype=np.float32); mask[pad:] = 1.0
        return {"q": torch.from_numpy(col(0, np.int64)),
                "part": torch.from_numpy(col(1, np.int64)),
                "correct": torch.from_numpy(col(2, np.int64)),
                "elapsed": torch.from_numpy(elapsed),
                "lag": torch.from_numpy(lag),
                "mask": torch.from_numpy(mask)}
