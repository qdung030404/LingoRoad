import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, HTTPException
from openai import APIConnectionError, APIError, RateLimitError
from pydantic import BaseModel, Field
from lingoroad_ml.llm import advisor, rag
from lingoroad_ml.llm import exercises as ex_mod, awe as awe_mod

router = APIRouter()
INDEX = Path(os.environ.get("QG_RAG_INDEX", "data/corpus_index.npz"))

DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


@lru_cache
def _client():
    from openai import AzureOpenAI, OpenAI

    azure_key = os.environ.get("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    if azure_key and azure_endpoint:
        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")
        return AzureOpenAI(
            api_key=azure_key,
            azure_endpoint=azure_endpoint,
            api_version=api_version,
        )

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

    text = advisor.answer(
        req.question, [p.model_dump() for p in req.path], retrieve_fn, _client()
    )
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
        items = ex_mod.generate(
            _client(),
            req.skill_code,
            req.skill_name,
            req.cefr,
            req.type,
            req.count,
        )
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
    except RateLimitError as exc:
        raise HTTPException(
            status_code=429,
            detail=f"AI model rate limit exceeded: {exc}",
        ) from exc
    except (APIConnectionError, APIError) as exc:
        raise HTTPException(
            status_code=503,
            detail=f"AI model service temporarily unavailable: {exc}",
        ) from exc
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM returned malformed or truncated JSON response: {exc}",
        ) from exc


class LevelEvaluation(BaseModel):
    status: Literal["EXCEEDS_EXPECTATIONS", "MEETS_EXPECTATIONS", "NEEDS_IMPROVEMENT"]
    summary_vi: str
    encouragement_vi: str


class GrammarChecklistItem(BaseModel):
    grammar_point: str
    status: Literal["MASTERED", "ATTEMPTED_WITH_ERRORS", "NOT_USED"]
    evidence_sentence: str = ""
    feedback_vi: str


class CefrAweFeedbackItem(BaseModel):
    original_sentence: str
    issue_vi: str
    suggestion: str
    explanation_vi: str = ""


class CefrAweResponse(BaseModel):
    level_evaluation: LevelEvaluation
    grammar_checklist: list[GrammarChecklistItem] = Field(default_factory=list)
    improvement_steps: list[str] = Field(default_factory=list)
    feedback: list[CefrAweFeedbackItem] = Field(default_factory=list)
    overall_comment_vi: str = ""


class CefrAweReq(BaseModel):
    task_type: Literal["TASK_1", "TASK_2"] = "TASK_2"
    task_prompt: str = Field(..., min_length=1, max_length=4000)
    essay: str = Field(..., min_length=1, max_length=12000)
    target_cefr: str | None = Field(default=None, max_length=10)
    target_grammars: list[str] = Field(default_factory=list)


def _handle_cefr_awe(req: CefrAweReq) -> dict:
    try:
        return awe_mod.evaluate_cefr(
            _client(),
            task_prompt=req.task_prompt,
            essay=req.essay,
            task_type=req.task_type,
            target_cefr=req.target_cefr,
            target_grammars=req.target_grammars,
        )
    except RateLimitError as exc:
        raise HTTPException(
            status_code=429,
            detail=f"AI model rate limit exceeded: {exc}",
        ) from exc
    except (APIConnectionError, APIError) as exc:
        raise HTTPException(
            status_code=503,
            detail=f"AI model service temporarily unavailable: {exc}",
        ) from exc
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM returned malformed or truncated JSON response: {exc}",
        ) from exc


@router.post("/ml/awe/evaluate-cefr", response_model=CefrAweResponse)
def ml_awe_evaluate_cefr(req: CefrAweReq):
    return _handle_cefr_awe(req)


@router.post("/llm/awe/evaluate-cefr", response_model=CefrAweResponse)
def llm_awe_evaluate_cefr(req: CefrAweReq):
    return _handle_cefr_awe(req)
