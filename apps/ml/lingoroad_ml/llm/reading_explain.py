import os

SYSTEM = """Bạn là trợ giảng luyện đọc tiếng Anh cho người Việt.
Hãy xưng "bạn" với người học và giải thích ngắn gọn (3-5 câu) bằng tiếng Việt vì sao đáp án đúng chính xác và vì sao lựa chọn của bạn đúng hoặc chưa đúng.
Viết thành đoạn văn tự nhiên, KHÔNG mở đầu bằng tiêu đề (như "Giải thích:") và hạn chế dùng ký hiệu Markdown như dấu sao.
CHỈ dựa trên đoạn văn, câu hỏi, các lựa chọn và dẫn chứng được cung cấp. Không suy đoán thêm thông tin không có trong đoạn văn."""

LISTENING_SYSTEM = """Bạn là trợ giảng luyện nghe tiếng Anh cho người Việt.
Giải thích ngắn gọn bằng tiếng Việt vì sao đáp án đúng và lựa chọn của người học đúng hoặc sai. Xưng "bạn", viết một đoạn không tiêu đề.
Trích một cụm tiếng Anh ngắn có thật trong bản chép lời và giải thích cụm đó giúp chọn đáp án thế nào. Chỉ dựa trên nội dung được cung cấp. Không suy đoán âm thanh, ngữ điệu, người nói hay mốc thời gian ngoài bản chép lời."""

_TYPE_LABELS = {
    "MULTIPLE_CHOICE": "Trắc nghiệm",
    "GAP_FILL": "Điền khuyết",
    "TRUE_FALSE_NOT_GIVEN": "True / False / Not Given",
}

DEFAULT_EXPLAIN_TIMEOUT_S = 9.0
MAX_EXPLAIN_TIMEOUT_S = 10.5
EXPLAIN_MAX_RETRIES = 0


def explain_timeout_seconds() -> float:
    raw = os.environ.get("LINGOROAD_EXPLAIN_TIMEOUT_S")
    if not raw:
        return DEFAULT_EXPLAIN_TIMEOUT_S
    try:
        parsed = float(raw)
    except ValueError:
        return DEFAULT_EXPLAIN_TIMEOUT_S
    return max(0.05, min(parsed, MAX_EXPLAIN_TIMEOUT_S))


def build_messages(
    *,
    passage: str,
    question_prompt: str,
    question_type: str,
    options: list[str],
    selected_option: str,
    correct_option: str,
    evidence: str | None = None,
    curriculum_explanation: str = "",
    cefr: str | None = None,
    source_kind: str = "READING",
) -> list[dict]:
    listening = source_kind == "LISTENING"
    source_label = "Bản chép lời trích đoạn nghe" if listening else "Đoạn văn"
    type_label = _TYPE_LABELS.get(question_type, question_type)
    options_txt = "\n".join(f"- {opt}" for opt in options)
    lines = [
        f"Trình độ: {cefr}" if cefr else None,
        f"Dạng câu hỏi: {type_label}",
        f"{source_label}:\n{passage.strip()}",
        f"Câu hỏi: {question_prompt.strip()}",
        f"Các lựa chọn:\n{options_txt}",
        f"Bạn đã chọn: {selected_option.strip()}",
        f"Đáp án đúng: {correct_option.strip()}",
        f"Dẫn chứng trong bài: {evidence.strip()}" if evidence and evidence.strip() else "Dẫn chứng trong bài: (không có trích đoạn riêng)",
        f"Giải thích gốc: {curriculum_explanation.strip()}" if curriculum_explanation.strip() else None,
    ]
    user_content = "\n\n".join(part for part in lines if part)
    return [
        {"role": "system", "content": LISTENING_SYSTEM if listening else SYSTEM},
        {"role": "user", "content": user_content},
    ]


def explain(
    client,
    *,
    passage: str,
    question_prompt: str,
    question_type: str,
    options: list[str],
    selected_option: str,
    correct_option: str,
    evidence: str | None = None,
    curriculum_explanation: str = "",
    cefr: str | None = None,
    source_kind: str = "READING",
) -> str:
    model = (
        os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME")
        or os.environ.get("LINGOROAD_LLM_MODEL_VERSION", "gemini-2.5-flash")
    )
    timeout_s = explain_timeout_seconds()
    scoped_client = (
        client.with_options(timeout=timeout_s, max_retries=EXPLAIN_MAX_RETRIES)
        if hasattr(client, "with_options")
        else client
    )
    messages = build_messages(
        passage=passage,
        question_prompt=question_prompt,
        question_type=question_type,
        options=options,
        selected_option=selected_option,
        correct_option=correct_option,
        evidence=evidence,
        curriculum_explanation=curriculum_explanation,
        cefr=cefr,
        source_kind=source_kind,
    )
    create_kwargs = dict(model=model, temperature=0.3, messages=messages)
    if not hasattr(client, "with_options"):
        try:
            resp = scoped_client.chat.completions.create(
                **create_kwargs, timeout=timeout_s
            )
        except TypeError:
            resp = scoped_client.chat.completions.create(**create_kwargs)
    else:
        resp = scoped_client.chat.completions.create(**create_kwargs)
    text = (resp.choices[0].message.content or "").strip()
    if not text:
        raise ValueError("Empty explanation from LLM.")
    return text
