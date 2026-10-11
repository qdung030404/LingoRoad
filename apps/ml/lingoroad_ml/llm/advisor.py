import os

SYSTEM = """Bạn là cố vấn học tiếng Anh cho người Việt. Trả lời NGẮN GỌN bằng tiếng Việt.
Dựa vào lộ trình học và mức thành thạo hiện tại của học viên (0-1) và tài liệu tham khảo."""

def build_messages(question: str, path: list[dict], context_chunks: list[str]) -> list[dict]:
    path_txt = "\n".join(f"- {p['name']} ({p['code']}): mastery {p['mastery']:.2f}, {p['reason']}"
                         for p in path)
    ctx = "\n---\n".join(context_chunks)
    return [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content":
            f"Lộ trình hiện tại:\n{path_txt}\n\nTài liệu:\n{ctx}\n\nCâu hỏi: {question}"},
    ]

def answer(question: str, path: list[dict], retrieve_fn, client) -> str:
    chunks = retrieve_fn(question)
    model = os.environ.get("LINGOROAD_LLM_MODEL_VERSION", "gemini-3.8-flash")
    resp = client.chat.completions.create(
        model=model, temperature=0.4,
        messages=build_messages(question, path, chunks))
    return resp.choices[0].message.content
