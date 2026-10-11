"""DKVMN baseline (Zhang et al. 2017), compact: static key memory, dynamic value
memory with erase/add writes. Read for question t happens BEFORE writing response t."""
import torch
import torch.nn as nn

class DKVMN(nn.Module):
    def __init__(self, n_questions: int, d: int = 128, n_mem: int = 32):
        super().__init__()
        self.q_emb = nn.Embedding(n_questions, d, padding_idx=0)
        self.resp_emb = nn.Embedding(2, d)
        self.key = nn.Parameter(torch.randn(n_mem, d) * 0.1)
        self.v_init = nn.Parameter(torch.randn(n_mem, d) * 0.1)
        self.erase = nn.Linear(d, d)
        self.add = nn.Linear(d, d)
        self.f = nn.Linear(2 * d, d)
        self.out = nn.Linear(d, 1)

    def forward(self, batch: dict) -> torch.Tensor:
        q, correct = batch["q"], batch["correct"]
        B, L = q.shape
        mv = self.v_init.expand(B, -1, -1).contiguous()   # [B, n_mem, d]
        logits = []
        for t in range(L):
            k = self.q_emb(q[:, t])                        # [B, d]
            w = torch.softmax(k @ self.key.T, dim=-1)      # [B, n_mem]
            read = (w.unsqueeze(-1) * mv).sum(1)           # [B, d]
            summary = torch.tanh(self.f(torch.cat([read, k], dim=-1)))
            logits.append(self.out(summary).squeeze(-1))
            v = k + self.resp_emb(correct[:, t])           # write AFTER predicting
            e = torch.sigmoid(self.erase(v))
            a = torch.tanh(self.add(v))
            mv = mv * (1 - w.unsqueeze(-1) * e.unsqueeze(1)) \
                 + w.unsqueeze(-1) * a.unsqueeze(1)
        return torch.stack(logits, dim=1)
