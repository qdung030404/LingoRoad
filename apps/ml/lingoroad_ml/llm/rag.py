"""Tiny numpy vector store (corpus is small; FAISS unnecessary — noted in brainstorm doc)."""
import json
from pathlib import Path
import numpy as np

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
    sims = vecs @ qv / (np.linalg.norm(vecs, axis=1) * np.linalg.norm(qv) + 1e-9)
    return [chunks[i] for i in np.argsort(-sims)[:k]]

def gemini_embed(texts: list[str]) -> np.ndarray:
    import os
    from openai import OpenAI
    client = OpenAI(api_key=os.environ["GEMINI_API_KEY"],
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
    resp = client.embeddings.create(model="gemini-embedding-001", input=texts)
    return np.array([d.embedding for d in resp.data], dtype=np.float32)
