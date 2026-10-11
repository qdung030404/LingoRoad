import numpy as np
from pathlib import Path
from lingoroad_ml.llm.rag import build_index, retrieve

def fake_embed(texts: list[str]) -> np.ndarray:
    """Deterministic embedding: 8-dim char histogram."""
    out = np.zeros((len(texts), 8), dtype=np.float32)
    for i, t in enumerate(texts):
        for ch in t.lower():
            out[i, ord(ch) % 8] += 1
    norms = np.linalg.norm(out, axis=1, keepdims=True)
    return out / np.maximum(norms, 1e-9)

def test_build_and_retrieve_roundtrip(tmp_path: Path):
    corpus = tmp_path / "corpus"; corpus.mkdir()
    (corpus / "perfect.md").write_text("present perfect connects past and present",
                                       encoding="utf-8")
    (corpus / "passive.md").write_text("zzz qqq xxx vvv www yyy", encoding="utf-8")
    index = tmp_path / "index.npz"
    build_index(corpus, index, embed_fn=fake_embed)
    hits = retrieve("present perfect usage", index, embed_fn=fake_embed, k=1)
    assert len(hits) == 1
    assert "present perfect" in hits[0]
