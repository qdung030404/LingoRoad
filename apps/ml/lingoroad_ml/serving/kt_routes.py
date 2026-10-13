import os
from pathlib import Path
import torch
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from lingoroad_ml.kt.saint_plus import SAINTPlus

router = APIRouter()
_model: SAINTPlus | None = None
_seq_len = 100

def reset_model():
    global _model
    _model = None

def _load():
    global _model, _seq_len
    if _model is None:
        path = Path(os.environ.get("QG_KT_CHECKPOINT", "checkpoints/saint_plus.pt"))
        if not path.exists():
            return None
        ckpt = torch.load(path, map_location="cpu", weights_only=False)
        cfg = ckpt["config"]
        _seq_len = cfg["seq_len"]
        _model = SAINTPlus(cfg["n_questions"], d=cfg["d"], seq_len=cfg["seq_len"],
                           heads=cfg.get("heads", 8), layers=cfg.get("layers", 2))
        _model.load_state_dict(ckpt["state_dict"])
        _model.eval()
    return _model

class KtEvent(BaseModel):
    q_idx: int; part: int; correct: int; elapsed: float; lag: float

class KtRequest(BaseModel):
    sequence: list[KtEvent]

@router.post("/kt/predict")
def kt_predict(req: KtRequest):
    model = _load()
    if model is None:
        return JSONResponse({"error": "model_not_loaded"}, status_code=503)
    n = len(req.sequence)
    if n == 0:
        return {"p_next": []}
    seq = req.sequence[-_seq_len:]
    L = len(seq)
    batch = {
        "q": torch.tensor([[e.q_idx for e in seq]]),
        "part": torch.tensor([[e.part for e in seq]]),
        "correct": torch.tensor([[e.correct for e in seq]]),
        "elapsed": torch.tensor([[e.elapsed for e in seq]], dtype=torch.float32),
        "lag": torch.tensor([[e.lag for e in seq]], dtype=torch.float32),
        "mask": torch.ones(1, L),
    }
    with torch.no_grad():
        probs = torch.sigmoid(model(batch))[0].tolist()
    # covers the last min(n, seq_len) events; longer histories are truncated
    return {"p_next": probs}
