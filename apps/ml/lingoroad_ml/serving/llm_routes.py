import json
import os
from functools import lru_cache
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from lingoroad_ml.llm import advisor, rag
from lingoroad_ml.llm import exercises as ex_mod, awe as awe_mod

router = APIRouter()
INDEX = Path(os.environ.get("QG_RAG_INDEX", "data/corpus_index.npz"))

DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

@lru_cache
def _client():
    from openai import OpenAI
    openai_key = os.environ.get("OPENAI_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")

    if openai_key:
        base_url = os.environ.get("OPENAI_BASE_URL", DEFAULT_OPENAI_BASE_URL)
        return OpenAI(api_key=openai_key, base_url=base_url)
    elif gemini_key:
        base_url = os.environ.get("GEMINI_BASE_URL", DEFAULT_GEMINI_BASE_URL)
        return OpenAI(api_key=gemini_key, base_url=base_url)

    raise RuntimeError("Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured.")

class PathEntry(BaseModel):
    code: str = Field(..., max_length=100)
    name: str = Field(..., max_length=200)
    mastery: float = Field(..., ge=0.0, le=1.0)
    reason: str = Field(..., max_length=500)

class AdvisorReq(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    path: list[PathEntry] = Field(default_factory=list, max_length=50)
    locale: str = Field(default="vi", max_length=10)

@router.post("/llm/advisor")
def llm_advisor(req: AdvisorReq):
    def retrieve_fn(q):
        if not INDEX.exists():
            return []
        return rag.retrieve(q, INDEX, embed_fn=rag.gemini_embed, k=3)
    text = advisor.answer(req.question, [p.model_dump() for p in req.path],
                          retrieve_fn, _client())
    return {"answer": text}

class ExerciseReq(BaseModel):
    skill_code: str = Field(..., max_length=100)
    skill_name: str = Field(..., max_length=200)
    cefr: str = Field(..., max_length=10)
    type: str = Field(default="mcq", max_length=50)
    count: int = Field(default=3, ge=1, le=10)

@router.post("/llm/exercises")
def llm_exercises(req: ExerciseReq):
    try:
        items = ex_mod.generate(_client(), req.skill_code, req.skill_name,
                                req.cefr, req.type, req.count)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM returned malformed or truncated JSON response: {exc}",
        ) from exc
    return {
        "exercises": items,
        "model_version": os.environ.get(
            "LINGOROAD_LLM_MODEL_VERSION", "gemini-2.5-flash"
        ),
    }

class AweReq(BaseModel):
    task_prompt: str = Field(..., min_length=1, max_length=2000)
    essay: str = Field(..., min_length=1, max_length=10000)

@router.post("/llm/awe")
def llm_awe(req: AweReq):
    try:
        return awe_mod.evaluate(_client(), req.task_prompt, req.essay)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM returned malformed or truncated JSON response: {exc}",
        ) from exc
