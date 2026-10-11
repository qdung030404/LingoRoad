"""Theta -> CEFR. MUST stay in sync with LingoRoad/Domain/CefrMap.cs."""
def cefr_from_theta(theta: float) -> str:
    if theta < -1.5: return "A1"
    if theta < -0.5: return "A2"
    if theta < 0.5:  return "B1"
    if theta < 1.5:  return "B2"
    if theta < 2.25: return "C1"
    return "C2"
