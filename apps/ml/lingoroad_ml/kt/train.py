"""Train a KT model on the EdNet parquet.
Usage: python -m lingoroad_ml.kt.train --model saint_plus [--epochs 5] [--batch 128]
"""
import argparse, json, time
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from sklearn.metrics import roc_auc_score
from torch.utils.data import DataLoader
from lingoroad_ml.kt.data import KTSequenceDataset, split_users
from lingoroad_ml.kt.saint_plus import SAINTPlus
from lingoroad_ml.kt.dkt import DKTLstm
from lingoroad_ml.kt.dkvmn import DKVMN

ROOT = Path(__file__).parents[2]

def make_model(name, n_q, seq_len, d):
    if name == "saint_plus": return SAINTPlus(n_q, d=d, seq_len=seq_len)
    if name == "dkt":        return DKTLstm(n_q, d=d)
    if name == "dkvmn":      return DKVMN(n_q, d=d)
    raise ValueError(name)

@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    ys, ps = [], []
    for b in loader:
        b = {k: v.to(device) for k, v in b.items()}
        logits = model(b)
        m = b["mask"].bool()
        ys.append(b["correct"][m].cpu().numpy())
        ps.append(torch.sigmoid(logits[m]).cpu().numpy())
    return roc_auc_score(np.concatenate(ys), np.concatenate(ps))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=["saint_plus", "dkt", "dkvmn"])
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--batch", type=int, default=128)
    ap.add_argument("--d", type=int, default=128)
    ap.add_argument("--seq-len", type=int, default=100)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--data", default=str(ROOT / "data/ednet"))
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    data = Path(args.data)
    meta = json.loads((data / "meta.json").read_text())
    df = pd.read_parquet(data / "interactions.parquet")
    train_u, val_u, test_u = split_users(df["user_id"].unique().tolist())
    loaders = {}
    for name, users, shuffle in [("train", train_u, True), ("val", val_u, False),
                                 ("test", test_u, False)]:
        ds = KTSequenceDataset(df[df["user_id"].isin(users)], seq_len=args.seq_len)
        loaders[name] = DataLoader(ds, batch_size=args.batch, shuffle=shuffle)

    model = make_model(args.model, meta["n_questions"], args.seq_len, args.d).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    scaler = torch.amp.GradScaler(device)
    bce = torch.nn.functional.binary_cross_entropy_with_logits

    best_auc, patience = 0.0, 0
    ckpt = ROOT / "checkpoints" / f"{args.model}.pt"
    ckpt.parent.mkdir(exist_ok=True)
    for epoch in range(args.epochs):
        model.train(); t0 = time.time()
        for b in loaders["train"]:
            b = {k: v.to(device) for k, v in b.items()}
            with torch.amp.autocast(device):
                logits = model(b)
                loss = bce(logits, b["correct"].float(), weight=b["mask"])
            opt.zero_grad(); scaler.scale(loss).backward()
            scaler.step(opt); scaler.update()
        val_auc = evaluate(model, loaders["val"], device)
        print(f"epoch {epoch}: val AUC={val_auc:.4f} ({time.time()-t0:.0f}s)")
        if val_auc > best_auc:
            best_auc, patience = val_auc, 0
            torch.save({"state_dict": model.state_dict(),
                        "config": {"model": args.model, "n_questions": meta["n_questions"],
                                   "d": args.d, "seq_len": args.seq_len}}, ckpt)
        elif (patience := patience + 1) >= 2:
            print("early stop"); break

    model.load_state_dict(torch.load(ckpt, weights_only=False)["state_dict"])
    test_auc = evaluate(model, loaders["test"], device)
    report = ROOT / "reports/kt_results.md"
    report.parent.mkdir(exist_ok=True)
    if not report.exists():
        report.write_text("| Model | Val AUC | Test AUC |\n|---|---|---|\n")
    with report.open("a") as f:
        f.write(f"| {args.model} | {best_auc:.4f} | {test_auc:.4f} |\n")
    print(f"TEST AUC ({args.model}): {test_auc:.4f}")

if __name__ == "__main__":
    main()
