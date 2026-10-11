import asyncio
import hmac
import os
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from lingoroad_ml.cat import select_next
from lingoroad_ml.irt import eap_estimate
from lingoroad_ml.serving import kt_routes, llm_routes, speech_routes


def _required_models() -> set[str]:
    raw = os.environ.get("LINGOROAD_ML_REQUIRED_MODELS", "cat")
    return {value.strip().lower() for value in raw.split(",") if value.strip()}


def _production_config_is_valid() -> None:
    environment = os.environ.get("LINGOROAD_ENVIRONMENT", "development").lower()
    token = os.environ.get("LINGOROAD_ML_INTERNAL_TOKEN", "")
    if environment == "production" and len(token) < 32:
        raise RuntimeError(
            "LINGOROAD_ML_INTERNAL_TOKEN must contain at least 32 characters"
        )


_production_config_is_valid()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if os.environ.get("LINGOROAD_ML_PREWARM", "false").lower() == "true":
        required = _required_models()
        if "speech" in required:
            await asyncio.to_thread(speech_routes._whisper)
        if "llm" in required:
            await asyncio.to_thread(llm_routes._client)
        if "kt" in required:
            await asyncio.to_thread(kt_routes._load)
    yield


app = FastAPI(title="LingoRoad ML Service", lifespan=lifespan)
app.include_router(kt_routes.router)
app.include_router(llm_routes.router)
app.include_router(speech_routes.router)


@app.middleware("http")
async def require_internal_token(request: Request, call_next):
    expected = os.environ.get("LINGOROAD_ML_INTERNAL_TOKEN", "")
    if expected and request.url.path not in {"/health", "/ready"}:
        provided = request.headers.get("x-internal-token", "")
        if not hmac.compare_digest(provided, expected):
            return JSONResponse(
                {"error": "invalid_internal_token"}, status_code=401
            )
    return await call_next(request)


class HistoryEntry(BaseModel):
    a: float
    b: float
    c: float
    correct: bool


class Candidate(BaseModel):
    item_id: str
    a: float
    b: float
    c: float


class CatSelectRequest(BaseModel):
    history: list[HistoryEntry]
    candidates: list[Candidate]


class CatSelectResponse(BaseModel):
    theta: float
    se: float
    next_item_id: str | None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    rag_index = Path(os.environ.get("QG_RAG_INDEX", "data/corpus_index.npz"))
    kt_checkpoint = Path(
        os.environ.get("QG_KT_CHECKPOINT", "checkpoints/saint_plus.pt")
    )
    components = {
        "cat": "ready",
        "llm": "ready" if os.environ.get("GEMINI_API_KEY") else "missing_config",
        "rag": "ready" if rag_index.exists() else "missing_artifact",
        "speech": (
            "ready"
            if speech_routes._whisper.cache_info().currsize > 0
            else "cold"
        ),
        "kt": "ready" if kt_checkpoint.exists() else "missing_artifact",
    }
    acceptable = {"ready", "cold"}
    required = _required_models()
    is_ready = all(components.get(name) in acceptable for name in required)
    return JSONResponse(
        {"status": "ready" if is_ready else "not_ready", "components": components},
        status_code=200 if is_ready else 503,
    )


@app.post("/cat/select", response_model=CatSelectResponse)
def cat_select(req: CatSelectRequest):
    theta, se = eap_estimate(
        [(h.a, h.b, h.c, h.correct) for h in req.history]
    )
    next_id = select_next(
        theta, [(c.item_id, c.a, c.b, c.c) for c in req.candidates]
    )
    return CatSelectResponse(theta=theta, se=se, next_item_id=next_id)
