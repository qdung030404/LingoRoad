"""Sample EdNet KT1 users and write interactions.parquet (~5-10M rows).
Usage: python ml/research/ednet_prepare.py --max-users 60000
"""
import argparse, json
from pathlib import Path
from lingoroad_ml.kt.data import build_interactions

ROOT = Path(__file__).parents[2] / "ml/data/ednet"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-users", type=int, default=60000)
    args = ap.parse_args()

    df, q_map = build_interactions(ROOT / "KT1", ROOT / "contents/questions.csv",
                                   max_users=args.max_users)
    df.to_parquet(ROOT / "interactions.parquet")
    (ROOT / "q_map.json").write_text(json.dumps({k: v for k, v in q_map.items()}))
    (ROOT / "meta.json").write_text(json.dumps(
        {"n_questions": len(q_map) + 1, "n_parts": 8,
         "n_users": int(df["user_id"].nunique()), "n_rows": len(df)}))
    print(f"rows={len(df):,} users={df['user_id'].nunique():,} "
          f"questions={len(q_map):,} mean_correct={df['correct'].mean():.3f}")

if __name__ == "__main__":
    main()
