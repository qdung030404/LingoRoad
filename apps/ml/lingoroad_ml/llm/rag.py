"""Tiny numpy vector store (corpus is small; FAISS unnecessary — noted in brainstorm doc)."""
import json
import os
from functools import lru_cache
from pathlib import Path
import numpy as np

DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

def _chunks(corpus_dir: Path, size: int = 800):
    for f in sorted(Path(corpus_dir).glob("*.md")):
        text = f.read_text(encoding="utf-8")
        for i in range(0, len(text), size):
            yield text[i: i + size]

def build_index(corpus_dir: Path, out_path: Path, embed_fn):
    chunks = list(_chunks(corpus_dir))
    vecs = embed_fn(chunks)
    np.savez(out_path, vecs=vecs)
    Path(str(out_path) + ".chunks.json").write_text(
        json.dumps(chunks, ensure_ascii=False), encoding="utf-8")

def retrieve(query: str, index_path: Path, embed_fn, k: int = 3) -> list[str]:
    vecs = np.load(index_path)["vecs"]
    chunks = json.loads(Path(str(index_path) + ".chunks.json").read_text(encoding="utf-8"))
    qv = embed_fn([query])[0]
    if len(vecs) > 0 and vecs.shape[1] != qv.shape[0]:
        raise ValueError(
            f"Embedding dimension mismatch: index vector dim is {vecs.shape[1]}, "
            f"but query vector dim is {qv.shape[0]}. Rebuild the index with the same embedding model."
        )
    sims = vecs @ qv / (np.linalg.norm(vecs, axis=1) * np.linalg.norm(qv) + 1e-9)
    return [chunks[i] for i in np.argsort(-sims)[:k]]

@lru_cache
def _embedding_client():
    from openai import OpenAI
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if os.environ.get("EMBEDDING_BASE_URL"):
        base_url = os.environ["EMBEDDING_BASE_URL"]
        api_key = gemini_key or openai_key
    elif gemini_key:
        base_url = DEFAULT_GEMINI_BASE_URL
        api_key = gemini_key
    elif openai_key:
        base_url = os.environ.get("OPENAI_BASE_URL", DEFAULT_OPENAI_BASE_URL)
        api_key = openai_key
    else:
        raise RuntimeError("Neither GEMINI_API_KEY nor OPENAI_API_KEY is configured for embedding.")

    return OpenAI(api_key=api_key, base_url=base_url)

def gemini_embed(texts: list[str]) -> np.ndarray:
    default_model = (
        "text-embedding-3-small"
        if os.environ.get("OPENAI_API_KEY") and not os.environ.get("GEMINI_API_KEY")
        else "gemini-embedding-001"
    )
    model = os.environ.get("EMBEDDING_MODEL", default_model)
    client = _embedding_client()
    resp = client.embeddings.create(model=model, input=texts)
    return np.array([d.embedding for d in resp.data], dtype=np.float32)

embed_texts = gemini_embed
