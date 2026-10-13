import json
import os
import sys
from pathlib import Path
import kagglehub
import pandas as pd

sys.path.insert(0, str(Path(__file__).parents[1]))  # make lingoroad_ml importable
from lingoroad_ml.kt.data import build_interactions

if sys.stdout.encoding is not None and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def main():
    print("[1/3] Downloading EdNet KT1 dataset from Kaggle via kagglehub...")
    dataset_path = Path(kagglehub.dataset_download("gmhost/ednetkt1"))
    print(f"-> Downloaded to: {dataset_path}")

    print("[2/3] Checking dataset structure...")
    kt1_candidates = list(dataset_path.glob("**/KT1")) or [dataset_path]
    kt1_dir = kt1_candidates[0]
    q_candidates = list(dataset_path.glob("**/questions.csv"))

    out_dir = Path(__file__).parents[1] / "data/ednet"
    out_dir.mkdir(parents=True, exist_ok=True)

    if q_candidates:
        print("[3/3] Building interactions dataset (max 10,000 users)...")
        df, q_map = build_interactions(kt1_dir, q_candidates[0], max_users=10000)
        df.to_parquet(out_dir / "interactions.parquet")
        
        with open(out_dir / "q_map.json", "w", encoding="utf-8") as f:
            json.dump(q_map, f)
            
        with open(out_dir / "meta.json", "w", encoding="utf-8") as f:
            json.dump({
                "n_questions": len(q_map) + 1,
                "n_parts": 8,
                "n_users": int(df["user_id"].nunique()),
                "n_rows": len(df)
            }, f, indent=2)
            
        print(f"-> SUCCESS: Prepared {len(df):,} interaction rows for {df['user_id'].nunique():,} users!")
        print(f"-> Saved dataset to: {out_dir}")
    else:
        print("questions.csv not found in dataset!")

if __name__ == "__main__":
    main()
