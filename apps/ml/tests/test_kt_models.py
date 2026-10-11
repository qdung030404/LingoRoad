import torch
from lingoroad_ml.kt.saint_plus import SAINTPlus
from lingoroad_ml.kt.dkt import DKTLstm
from lingoroad_ml.kt.dkvmn import DKVMN

def fake_batch(B=4, L=16, n_q=50):
    g = torch.Generator().manual_seed(0)
    return {
        "q": torch.randint(1, n_q, (B, L), generator=g),
        "part": torch.randint(1, 8, (B, L), generator=g),
        "correct": torch.randint(0, 2, (B, L), generator=g),
        "elapsed": torch.rand(B, L, generator=g),
        "lag": torch.rand(B, L, generator=g),
        "mask": torch.ones(B, L),
    }

MODELS = [
    lambda: SAINTPlus(n_questions=50, seq_len=16, d=32, heads=4, layers=1),
    lambda: DKTLstm(n_questions=50, d=32),
    lambda: DKVMN(n_questions=50, d=32, n_mem=8),
]

def test_forward_shapes():
    b = fake_batch()
    for make in MODELS:
        logits = make()(b)
        assert logits.shape == (4, 16)

def test_no_response_leakage_at_current_position():
    """Flipping correct[t] must not change the logit at t (only at >t)."""
    b1, b2 = fake_batch(), fake_batch()
    b2["correct"] = b1["correct"].clone()
    b2["correct"][:, -1] = 1 - b2["correct"][:, -1]   # flip only the last response
    for make in MODELS:
        m = make().eval()
        with torch.no_grad():
            l1, l2 = m(b1), m(b2)
        assert torch.allclose(l1[:, -1], l2[:, -1], atol=1e-5), type(m).__name__

def test_saint_plus_overfits_tiny_batch():
    torch.manual_seed(0)
    b = fake_batch(B=8, L=16)
    m = SAINTPlus(n_questions=50, seq_len=16, d=32, heads=4, layers=1)
    opt = torch.optim.Adam(m.parameters(), lr=1e-3)
    for _ in range(300):
        loss = torch.nn.functional.binary_cross_entropy_with_logits(
            m(b), b["correct"].float())
        opt.zero_grad(); loss.backward(); opt.step()
    acc = ((m(b) > 0) == b["correct"].bool()).float().mean()
    assert acc > 0.9
