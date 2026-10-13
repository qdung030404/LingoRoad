# KT model comparison — EdNet KT1 subset

Setup: 60,000 users / 7,504,848 interactions (mean correct 0.654), user-level 80/10/10 split,
seq_len 100, d=128, batch 128, Adam lr 1e-3, 5 epochs each (best-val checkpoint), AMP on RTX 4060.
Published full-EdNet SAINT+ is ~0.79; this subset scores lower, as expected (requirement.md V-4).

| Model | Val AUC | Test AUC |
|---|---|---|
| dkt | 0.7593 | 0.7565 |
| dkvmn | 0.7588 | 0.7558 |
| saint_plus | 0.7619 | 0.7586 |
| saint_plus | 0.7475 | 0.7516 |
