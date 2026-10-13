"""Maximum-Information item selection."""
from lingoroad_ml.irt import information

def select_next(theta: float, candidates: list[tuple]) -> object | None:
    """candidates: list of (item_id, a, b, c). Returns item_id with max Fisher information."""
    if not candidates:
        return None
    return max(candidates, key=lambda it: information(theta, it[1], it[2], it[3]))[0]
