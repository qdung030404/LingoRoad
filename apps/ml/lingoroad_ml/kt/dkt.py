"""DKT baseline: LSTM over previous interactions, predict current question."""
import torch
import torch.nn as nn

class DKTLstm(nn.Module):
    START = 2

    def __init__(self, n_questions: int, d: int = 128):
        super().__init__()
        self.q_emb = nn.Embedding(n_questions, d, padding_idx=0)
        self.resp_emb = nn.Embedding(3, d)
        self.lstm = nn.LSTM(d, d, batch_first=True)
        self.out = nn.Sequential(nn.Linear(2 * d, d), nn.ReLU(), nn.Linear(d, 1))

    def forward(self, batch: dict) -> torch.Tensor:
        q = batch["q"]
        B, L = q.shape
        q_prev = torch.cat([torch.zeros(B, 1, dtype=torch.long, device=q.device),
                            q[:, :-1]], dim=1)
        r_prev = torch.cat([torch.full((B, 1), self.START, dtype=torch.long,
                                       device=q.device),
                            batch["correct"][:, :-1]], dim=1)
        h, _ = self.lstm(self.q_emb(q_prev) + self.resp_emb(r_prev))
        return self.out(torch.cat([h, self.q_emb(q)], dim=-1)).squeeze(-1)
