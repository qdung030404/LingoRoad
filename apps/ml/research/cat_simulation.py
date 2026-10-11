"""CAT vs fixed-test simulation study. Outputs ml/reports/cat_simulation.{png,md}.
Usage: python ml/research/cat_simulation.py [--n 1000] [--items ml/data/items.json]
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from lingoroad_ml.cefr import cefr_from_theta
from lingoroad_ml.simulation import make_synthetic_bank, simulate_examinee, fixed_test

ROOT = Path(__file__).parents[2]

def load_bank(path: str | None, rng) -> list[tuple]:
    if path and Path(path).exists():
        items = json.loads(Path(path).read_text(encoding="utf-8"))
        return [(i, it["a"], it["b"], it["c"]) for i, it in enumerate(items)]
    print("items.json not found - using synthetic 500-item bank")
    return make_synthetic_bank(500, rng)

def main():
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252, which lacks θ
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1000)
    ap.add_argument("--items", default=str(ROOT / "ml/data/items.json"))
    args = ap.parse_args()

    rng = np.random.default_rng(0)
    bank = load_bank(args.items, rng)
    thetas = rng.standard_normal(args.n)

    cat = [simulate_examinee(t, bank, rng) for t in thetas]
    true_cefr = [cefr_from_theta(t) for t in thetas]
    cat_cefr = [cefr_from_theta(r.theta_hat) for r in cat]

    lengths = [5, 10, 15, 20, 30, 50]
    fixed_acc = {}
    for L in lengths:
        est = [fixed_test(t, bank, L, rng) for t in thetas]
        fixed_acc[L] = float(np.mean([cefr_from_theta(e) == c
                                      for e, c in zip(est, true_cefr)]))

    levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
    idx = {l: i for i, l in enumerate(levels)}
    exact = float(np.mean([p == t for p, t in zip(cat_cefr, true_cefr)]))
    adjacent = float(np.mean([abs(idx[p] - idx[t]) <= 1
                              for p, t in zip(cat_cefr, true_cefr)]))
    rmse = float(np.sqrt(np.mean([(r.theta_hat - t) ** 2 for r, t in zip(cat, thetas)])))
    n_items = np.array([r.n_items for r in cat])

    out = ROOT / "ml/reports"; out.mkdir(parents=True, exist_ok=True)
    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    axes[0].hist(n_items, bins=range(8, 32))
    axes[0].set(title="CAT items used", xlabel="items", ylabel="examinees")
    axes[1].plot(lengths, [fixed_acc[L] for L in lengths], "o-", label="fixed test")
    axes[1].axhline(exact, color="tab:red", ls="--",
                    label=f"CAT (mean {n_items.mean():.1f} items)")
    axes[1].set(title="Exact CEFR accuracy vs test length", xlabel="test length",
                ylabel="accuracy"); axes[1].legend()
    fig.tight_layout(); fig.savefig(out / "cat_simulation.png", dpi=150)

    md = out / "cat_simulation.md"
    md.write_text(f"""# CAT Simulation Results (N={args.n}, bank={len(bank)} items)

| Metric | CAT | Fixed-30 |
|---|---|---|
| Exact CEFR accuracy | {exact:.3f} | {fixed_acc[30]:.3f} |
| Adjacent (±1) accuracy | {adjacent:.3f} | — |
| RMSE(θ) | {rmse:.3f} | — |
| Mean items | {n_items.mean():.1f} | 30 |
| Median items | {np.median(n_items):.0f} | 30 |
""", encoding="utf-8")
    print(md.read_text(encoding="utf-8"))

if __name__ == "__main__":
    main()
