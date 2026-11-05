import pytest
import numpy as np
from pathlib import Path
from lingoroad_ml.llm import rag

def fake_embed(texts: list[str]) -> np.ndarray:
    """Deterministic embedding: 8-dim char histogram."""
    out = np.zeros((len(texts), 8), dtype=np.float32)
    for i, t in enumerate(texts):
        for ch in t.lower():
            out[i, ord(ch) % 8] += 1
    norms = np.linalg.norm(out, axis=1, keepdims=True)
    return out / np.maximum(norms, 1e-9)

def fake_embed_16dim(texts: list[str]) -> np.ndarray:
    """Deterministic embedding: 16-dim vector."""
    out = np.zeros((len(texts), 16), dtype=np.float32)
    for i, t in enumerate(texts):
        for ch in t.lower():
            out[i, ord(ch) % 16] += 1
    norms = np.linalg.norm(out, axis=1, keepdims=True)
    return out / np.maximum(norms, 1e-9)

def test_build_and_retrieve_roundtrip(tmp_path: Path):
    corpus = tmp_path / "corpus"; corpus.mkdir()
    (corpus / "perfect.md").write_text("present perfect connects past and present",
                                       encoding="utf-8")
    (corpus / "passive.md").write_text("zzz qqq xxx vvv www yyy", encoding="utf-8")
    index = tmp_path / "index.npz"
    rag.build_index(corpus, index, embed_fn=fake_embed)
    hits = rag.retrieve("present perfect usage", index, embed_fn=fake_embed, k=1)
    assert len(hits) == 1
    assert "present perfect" in hits[0]

def test_retrieve_dimension_mismatch_raises_clear_error(tmp_path: Path):
    corpus = tmp_path / "corpus"; corpus.mkdir()
    (corpus / "dummy.md").write_text("dummy knowledge content", encoding="utf-8")
    index = tmp_path / "index.npz"
    rag.build_index(corpus, index, embed_fn=fake_embed)  # 8-dim

    with pytest.raises(ValueError, match="Embedding dimension mismatch"):
        rag.retrieve("dummy query", index, embed_fn=fake_embed_16dim, k=1)  # 16-dim query

def test_embedding_client_with_gemini(monkeypatch):
    rag._embedding_client.cache_clear()
    monkeypatch.setenv("GEMINI_API_KEY", "mock-gemini-key")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("EMBEDDING_BASE_URL", raising=False)

    client1 = rag._embedding_client()
    client2 = rag._embedding_client()
    assert client1 is client2  # cached singleton
    assert client1.api_key == "mock-gemini-key"
    assert "generativelanguage.googleapis.com" in str(client1.base_url)

def test_embedding_client_with_openai(monkeypatch):
    rag._embedding_client.cache_clear()
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-mock-key")
    monkeypatch.delenv("EMBEDDING_BASE_URL", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)

    client = rag._embedding_client()
    assert client.api_key == "sk-mock-key"
    assert "https://api.openai.com/v1" in str(client.base_url)

def test_embedding_client_raises_when_no_keys(monkeypatch):
    rag._embedding_client.cache_clear()
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("EMBEDDING_BASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="Neither GEMINI_API_KEY nor OPENAI_API_KEY"):
        rag._embedding_client()

def test_gemini_embed_model_selection(monkeypatch):
    rag._embedding_client.cache_clear()
    recorded_calls = []

    class FakeEmbeddings:
        def create(self, model, input):
            recorded_calls.append(model)
            class Item:
                embedding = [0.1, 0.2]
            class Resp:
                data = [Item()]
            return Resp()

    class FakeClient:
        embeddings = FakeEmbeddings()

    monkeypatch.setattr(rag, "_embedding_client", lambda: FakeClient())

    # Case 1: Pure OpenAI key -> default text-embedding-3-small
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-mock-key")
    monkeypatch.delenv("EMBEDDING_MODEL", raising=False)
    rag.gemini_embed(["hello"])
    assert recorded_calls[-1] == "text-embedding-3-small"

    # Case 2: Gemini key -> default gemini-embedding-001
    monkeypatch.setenv("GEMINI_API_KEY", "mock-gemini-key")
    monkeypatch.delenv("EMBEDDING_MODEL", raising=False)
    rag.gemini_embed(["hello"])
    assert recorded_calls[-1] == "gemini-embedding-001"

    # Case 3: Explicit EMBEDDING_MODEL overrides default
    monkeypatch.setenv("EMBEDDING_MODEL", "custom-embed-v1")
    rag.gemini_embed(["hello"])
    assert recorded_calls[-1] == "custom-embed-v1"
