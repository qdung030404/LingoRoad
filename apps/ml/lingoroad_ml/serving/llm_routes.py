import os
from functools import lru_cache
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from lingoroad_ml.llm import advisor, rag
from lingoroad_ml.llm import exercises as ex_mod, awe as awe_mod

router = APIRouter()
INDEX = Path(os.environ.get("QG_RAG_INDEX", "data/corpus_index.npz"))

@lru_cache
def _client():
    from openai import OpenAI
    return OpenAI(api_key=os.environ["GEMINI_API_KEY"],
                  base_url="https://generativelanguage.googleapis.com/v1beta/openai/")

class PathEntry(BaseModel):
    code: str; name: str; mastery: float; reason: str

class AdvisorReq(BaseModel):
    question: str
    path: list[PathEntry]
    locale: str = "vi"

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
    skill_code: str; skill_name: str; cefr: str; type: str = "mcq"; count: int = 3

@router.post("/llm/exercises")
def llm_exercises(req: ExerciseReq):
    items = ex_mod.generate(_client(), req.skill_code, req.skill_name,
                            req.cefr, req.type, req.count)
    return {
        "exercises": items,
        "model_version": os.environ.get(
            "LINGOROAD_LLM_MODEL_VERSION", "gemini-2.5-flash"
        ),
    }

class AweReq(BaseModel):
    task_prompt: str; essay: str

@router.post("/llm/awe")
def llm_awe(req: AweReq):
    return awe_mod.evaluate(_client(), req.task_prompt, req.essay)
