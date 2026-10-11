"""SAINT+ (Shin et al. 2021): encoder attends to exercises, decoder to responses
+ temporal features. Response/elapsed are shifted right (start token); lag is not
(known before answering)."""
import torch
import torch.nn as nn

class SAINTPlus(nn.Module):
    START = 2  # response vocab: 0 wrong, 1 correct, 2 start-of-sequence

    def __init__(self, n_questions: int, n_parts: int = 8, d: int = 128,
                 heads: int = 8, layers: int = 2, seq_len: int = 100,
                 dropout: float = 0.1):
        super().__init__()
        self.q_emb = nn.Embedding(n_questions, d, padding_idx=0)
        self.part_emb = nn.Embedding(n_parts + 1, d, padding_idx=0)
        self.pos_emb = nn.Embedding(seq_len, d)
        self.resp_emb = nn.Embedding(3, d)
        self.elapsed_lin = nn.Linear(1, d)
        self.lag_lin = nn.Linear(1, d)
        self.transformer = nn.Transformer(
            d_model=d, nhead=heads, num_encoder_layers=layers,
            num_decoder_layers=layers, dim_feedforward=4 * d,
            dropout=dropout, batch_first=True)
        self.out = nn.Linear(d, 1)

    def forward(self, batch: dict) -> torch.Tensor:
        q, part = batch["q"], batch["part"]
        B, L = q.shape
        pos = self.pos_emb(torch.arange(L, device=q.device))[None]

        enc = self.q_emb(q) + self.part_emb(part) + pos

        resp_prev = torch.cat(
            [torch.full((B, 1), self.START, device=q.device, dtype=torch.long),
             batch["correct"][:, :-1]], dim=1)
        elapsed_prev = torch.cat(
            [torch.zeros(B, 1, device=q.device), batch["elapsed"][:, :-1]], dim=1)
        dec = (self.resp_emb(resp_prev)
               + self.elapsed_lin(elapsed_prev.unsqueeze(-1))
               + self.lag_lin(batch["lag"].unsqueeze(-1))
               + pos)

        causal = nn.Transformer.generate_square_subsequent_mask(L, device=q.device)
        h = self.transformer(enc, dec, src_mask=causal, tgt_mask=causal,
                             memory_mask=causal)
        return self.out(h).squeeze(-1)
