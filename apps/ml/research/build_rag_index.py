from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from lingoroad_ml.llm.rag import build_index, gemini_embed

ROOT = Path(__file__).parents[1]
build_index(ROOT / "data/corpus", ROOT / "data/corpus_index.npz", embed_fn=gemini_embed)
print("index built")
