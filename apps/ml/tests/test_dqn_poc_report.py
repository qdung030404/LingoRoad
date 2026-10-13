"""report_lines() must compute every measured number it prints."""
from research.dqn_poc import report_lines


def _results():
    def m(ret, latency):
        return {"return": ret, "length": 60.0, "goal_rate": 0.0, "latency_ms": latency}
    # (metrics, offline_cost) per policy — the task-15 published numbers.
    return {
        "DP (value iteration)": (m(0.636, 0.149), 50.2),
        "DQN": (m(0.581, 0.071), 82.3),
        "Greedy (fixed order)": (m(0.533, 0.002), 0.0),
        "Random": (m(0.197, 0.002), 0.0),
    }


def test_table_rows_come_from_results():
    text = "\n".join(report_lines(_results(), best_ep=3210))
    assert "| DQN | 0.581 | 60.0 | 0.00 | 82.3 | 0.071 |" in text
    assert "| Random | 0.197 | 60.0 | 0.00 | 0.0 | 0.002 |" in text
    assert "selected at episode 3210" in text


def test_gap_sentence_computed_not_hardcoded():
    text = "\n".join(report_lines(_results(), best_ep=3210))
    # 0.581-0.533=+0.048 (+9% of greedy); 0.636-0.533=+0.103 (+19%)
    assert "+0.048 (+9%)" in text
    assert "+0.103 (+19%)" in text
    # And with a different DQN return the sentence must follow.
    r = _results()
    r["DQN"][0]["return"] = 0.611
    text = "\n".join(report_lines(r, best_ep=3210))
    assert "+0.078 (+15%)" in text
