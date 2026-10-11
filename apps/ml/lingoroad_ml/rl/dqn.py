from collections import deque
import random

import numpy as np
import torch
import torch.nn as nn


class DQNAgent:
    def __init__(self, state_dim: int, n_actions: int, seed: int = 0,
                 lr: float = 1e-3, gamma: float = 0.98,
                 buffer_size: int = 10_000, batch: int = 64):
        torch.manual_seed(seed); random.seed(seed)
        self.n_actions, self.gamma, self.batch = n_actions, gamma, batch
        def net():
            return nn.Sequential(nn.Linear(state_dim, 64), nn.ReLU(),
                                 nn.Linear(64, 64), nn.ReLU(),
                                 nn.Linear(64, n_actions))
        self.q, self.target = net(), net()
        self.target.load_state_dict(self.q.state_dict())
        self.opt = torch.optim.Adam(self.q.parameters(), lr=lr)
        self.buffer = deque(maxlen=buffer_size)
        self.steps = 0

    def act(self, state, eps: float) -> int:
        if random.random() < eps:
            return random.randrange(self.n_actions)
        with torch.no_grad():
            return int(self.q(torch.as_tensor(state, dtype=torch.float32)).argmax())

    def remember(self, s, a, r, s2, done):
        self.buffer.append((s, a, r, s2, done))

    def train_step(self):
        if len(self.buffer) < self.batch:
            return None
        s, a, r, s2, d = map(np.array, zip(*random.sample(self.buffer, self.batch)))
        s = torch.as_tensor(s, dtype=torch.float32)
        s2 = torch.as_tensor(s2, dtype=torch.float32)
        r = torch.as_tensor(r, dtype=torch.float32)
        a = torch.as_tensor(a, dtype=torch.int64)
        d = torch.as_tensor(d, dtype=torch.float32)
        with torch.no_grad():
            target = r + self.gamma * (1 - d) * self.target(s2).max(1).values
        q = self.q(s).gather(1, a[:, None]).squeeze(1)
        loss = nn.functional.smooth_l1_loss(q, target)
        self.opt.zero_grad(); loss.backward(); self.opt.step()
        self.steps += 1
        if self.steps % 200 == 0:
            self.target.load_state_dict(self.q.state_dict())
        return loss.item()
