"""Checkpoint selection must return the best-validation network, deterministically."""
from research.dqn_poc import VAL_EPISODES, VAL_SEED, evaluate, train_dqn


def test_returned_agent_reproduces_best_validation_score():
    agent, curve, best_ep, best_val = train_dqn(episodes=25, checkpoint_every=10)
    assert len(curve) == 25
    # Periodic evals fire after episodes 10 and 20; 25 % 10 != 0 adds a final eval at 25.
    assert best_ep in (10, 20, 25)
    # Deterministic env + greedy policy: re-evaluating the returned agent on the
    # validation seed must reproduce the best checkpoint's score exactly —
    # proving the loaded weights ARE the best snapshot.
    val = evaluate(lambda s: agent.act(s, eps=0.0),
                   episodes=VAL_EPISODES, seed=VAL_SEED)["return"]
    assert abs(val - best_val) < 1e-9
