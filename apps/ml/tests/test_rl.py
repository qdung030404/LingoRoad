import numpy as np

from lingoroad_ml.rl.dp import build_model, solve
from lingoroad_ml.rl.dqn import DQNAgent
from lingoroad_ml.rl.env import ToyLearnerEnv


def test_env_reset_and_step_shapes():
    env = ToyLearnerEnv(seed=0)
    s = env.reset()
    assert s.shape == (5,) and np.all((0 <= s) & (s <= 1))
    s2, r, done = env.step(0)
    assert s2.shape == (5,) and isinstance(done, bool)


def test_prerequisite_gating():
    env = ToyLearnerEnv(seed=0)
    env.reset()
    m_before = env.mastery.copy()
    env.step(4)                      # skill 4 blocked: skill 3 mastery starts < 0.5
    gain_blocked = env.mastery[4] - m_before[4]
    env.reset()
    m_before = env.mastery.copy()
    env.step(0)                      # skill 0 has no prerequisite
    gain_open = env.mastery[0] - m_before[0]
    assert gain_open > gain_blocked


def test_episode_terminates():
    env = ToyLearnerEnv(seed=0)
    env.reset()
    for _ in range(60):
        _, _, done = env.step(0)
        if done:
            break
    assert done


def test_agent_trains_without_error_and_buffer_fills():
    env, agent = ToyLearnerEnv(seed=1), DQNAgent(state_dim=5, n_actions=5, seed=1)
    s = env.reset()
    for _ in range(200):
        a = agent.act(s, eps=1.0)
        s2, r, done = env.step(a)
        agent.remember(s, a, r, s2, done)
        s = env.reset() if done else s2
    loss = agent.train_step()
    assert loss is not None and np.isfinite(loss)


def test_dp_model_matches_env_dynamics():
    grid, corner_idx, corner_w, reward, terminal = build_model(n_skills=3, k=11)
    env = ToyLearnerEnv(n_skills=3, seed=0)
    rng = np.random.default_rng(0)
    for s in rng.choice(np.flatnonzero(~terminal), size=20, replace=False):
        for a in range(3):
            env.mastery = grid[s].copy()
            env.t = 0
            m2, r, _ = env.step(a)
            assert np.isclose(reward[s, a], r)
            if np.all(m2 >= 0.8):
                assert corner_w[s, a].sum() == 0.0   # episode ends: no continuation
            else:
                assert np.isclose(corner_w[s, a].sum(), 1.0)
                recon = corner_w[s, a] @ grid[corner_idx[s, a]]
                assert np.allclose(recon, m2, atol=1e-6)   # interpolation is exact


def test_dp_converges_and_reaches_goal():
    policy = solve(n_skills=3, k=11)
    assert policy.iterations < 5000 and np.all(np.isfinite(policy.v))
    env = ToyLearnerEnv(n_skills=3, seed=0)
    s, done = env.reset(), False
    while not done:
        s, _, done = env.step(policy.act(s))
    assert bool(np.all(env.mastery >= 0.8))          # goal, not the 60-step cap


def test_dp_at_least_greedy():
    policy = solve(n_skills=3, k=11)

    def greedy(s):
        return min(int(np.argmax(s < 0.8)), 2)

    def mean_return(pi):
        env = ToyLearnerEnv(n_skills=3, seed=123)
        rets = []
        for _ in range(20):
            s, total, done = env.reset(), 0.0, False
            while not done:
                s, r, done = env.step(pi(s))
                total += r
            rets.append(total)
        return float(np.mean(rets))

    # theoretical ordering, with headroom for grid discretization error
    assert mean_return(policy.act) >= mean_return(greedy) - 0.05
