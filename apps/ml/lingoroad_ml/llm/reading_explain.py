import os

SYSTEM = """Bạn là trợ giảng luyện đọc tiếng Anh cho người Việt.
Giải thích NGẮN GỌN (3-5 câu) bằng tiếng Việt vì sao đáp án đúng chính xác và vì sao lựa chọn của học viên đúng hoặc chưa đúng.
CHỈ dựa trên đoạn văn, câu hỏi, các lựa chọn và dẫn chứng được cung cấp. Không suy đoán thêm thông tin không có trong đoạn văn."""

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
) -> list[dict]:
    type_label = _TYPE_LABELS.get(question_type, question_type)
    options_txt = "\n".join(f"- {opt}" for opt in options)
    lines = [
        f"Trình độ: {cefr}" if cefr else None,
        f"Dạng câu hỏi: {type_label}",
        f"Đoạn văn:\n{passage.strip()}",
        f"Câu hỏi: {question_prompt.strip()}",
        f"Các lựa chọn:\n{options_txt}",
        f"Học viên đã chọn: {selected_option.strip()}",
        f"Đáp án đúng: {correct_option.strip()}",
        f"Dẫn chứng trong bài: {evidence.strip()}" if evidence and evidence.strip() else "Dẫn chứng trong bài: (không có trích đoạn riêng)",
        f"Giải thích gốc: {curriculum_explanation.strip()}" if curriculum_explanation.strip() else None,
    ]
    user_content = "\n\n".join(part for part in lines if part)
    return [
        {"role": "system", "content": SYSTEM},
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
) -> str:
    model = os.environ.get("LINGOROAD_LLM_MODEL_VERSION", "gemini-2.5-flash")
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
