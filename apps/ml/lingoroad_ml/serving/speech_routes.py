import asyncio
import io
import os
from functools import lru_cache
from fastapi import APIRouter, UploadFile, Form, HTTPException, Request
from python_multipart.multipart import MultipartParser, parse_options_header
from lingoroad_ml.speech.scoring import word_scores, fluency_from_wpm
from lingoroad_ml.speech import azure

router = APIRouter()
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_DURATION_SECONDS = 120
MODEL_VERSION = os.environ.get("LINGOROAD_SPEECH_MODEL_VERSION", "faster-whisper-small")
_speech_slots = asyncio.Semaphore(max(
    1, int(os.environ.get("LINGOROAD_SPEECH_CONCURRENCY", "1"))))


@router.post("/speech/topic/score")
@router.post("/speech/read-aloud/score")
async def read_aloud_score(request: Request):
    profile = request.headers.get("x-speaking-profile", "read-aloud-v1")
    azure.assessment_parameters("", profile)
    # Do not use UploadFile here: Starlette may spool malicious uploads to disk
    # before route-level size validation runs. Parse a bounded body in memory.
    media_type, options = parse_options_header(request.headers.get("content-type", ""))
    boundary = options.get(b"boundary")
    if media_type != b"multipart/form-data" or not boundary or len(boundary) > 200:
        raise HTTPException(415, "invalid_multipart")
    fields, current = {}, {}
    finished = False

    def part_begin():
        current.clear()
        current.update(header=bytearray(), value=bytearray(), headers={}, data=bytearray())

    def header_field(data, start, end):
        current["header"].extend(data[start:end])
        if len(current["header"]) > 1024:
            raise HTTPException(413, "multipart_headers_too_large")

    def header_value(data, start, end):
        current["value"].extend(data[start:end])
        if len(current["value"]) > 4096:
            raise HTTPException(413, "multipart_headers_too_large")

    def header_end():
        current["headers"][bytes(current["header"]).lower()] = bytes(current["value"])
        current["header"].clear()
        current["value"].clear()

    def headers_finished():
        _, opts = parse_options_header(current["headers"].get(b"content-disposition", b""))
        name = opts.get(b"name")
        if name not in {b"file", b"prompt_text"} or name in fields:
            raise HTTPException(422, "invalid_multipart_fields")
        current["name"] = name

    def part_data(data, start, end):
        limit = azure.MAX_BYTES if current["name"] == b"file" else 4000
        if len(current["data"]) + end - start > limit:
            raise HTTPException(413, "audio_too_large")
        current["data"].extend(data[start:end])

    def part_end():
        fields[current["name"]] = bytes(current["data"])

    def end():
        nonlocal finished
        finished = True

    callbacks = {"on_part_begin": part_begin, "on_header_field": header_field,
        "on_header_value": header_value, "on_header_end": header_end,
        "on_headers_finished": headers_finished, "on_part_data": part_data,
        "on_part_end": part_end, "on_end": end}
    parser = MultipartParser(boundary, callbacks)
    received = 0
    try:
        async for chunk in request.stream():
            received += len(chunk)
            if received > azure.MAX_BYTES + 16384:
                raise HTTPException(413, "audio_too_large")
            parser.write(chunk)
        parser.finalize()
        if not finished or set(fields) != {b"file", b"prompt_text"}:
            raise HTTPException(422, "invalid_multipart_fields")
        prompt = fields[b"prompt_text"].decode("utf-8")
    except (ValueError, KeyError, UnicodeError):
        raise HTTPException(422, "invalid_multipart") from None
    if request.url.path.endswith("/topic/score"):
        from lingoroad_ml.speech import topic
        async with _speech_slots:
            try:
                return await asyncio.wait_for(asyncio.to_thread(topic.assess, fields[b"file"]), timeout=85)
            except TimeoutError:
                raise HTTPException(504, "azure_timeout") from None
    return await azure.assess(fields[b"file"], prompt, profile)

def _valid_signature(content_type: str | None, data: bytes) -> bool:
    signatures = {
        "audio/webm": data.startswith(b"\x1a\x45\xdf\xa3"),
        "audio/ogg": data.startswith(b"OggS"),
        "audio/wav": data.startswith(b"RIFF") and data[8:12] == b"WAVE",
        "audio/x-wav": data.startswith(b"RIFF") and data[8:12] == b"WAVE",
        "audio/mpeg": data.startswith(b"ID3") or (
            len(data) >= 2 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0),
        "audio/mp4": len(data) >= 12 and data[4:8] == b"ftyp",
        "audio/x-m4a": len(data) >= 12 and data[4:8] == b"ftyp",
    }
    return signatures.get((content_type or "").split(";", 1)[0].lower(), False)

FEEDBACK_PROMPT = """Học viên đọc câu: "{expected}"
Whisper nghe được: "{transcript}". Các từ bị thiếu/sai: {missing}.
Viết 2-3 câu phản hồi tiếng Việt: khen điểm tốt, chỉ ra từ cần luyện,
gợi ý cách phát âm (chú ý lỗi phổ biến của người Việt như /th/, âm cuối)."""

@lru_cache
def _whisper():
    """Local faster-whisper. "small" fits easily in the 4060's 8 GB; CPU fallback for dev boxes."""
    from faster_whisper import WhisperModel
    try:
        return WhisperModel("small", device="cuda", compute_type="float16")
    except Exception:
        return WhisperModel("small", device="cpu", compute_type="int8")

@router.post("/speech/score")
async def speech_score(file: UploadFile, prompt_text: str = Form(...)):
    data = await file.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio_too_large")
    if not _valid_signature(file.content_type, data):
        raise HTTPException(status_code=415, detail="unsupported_audio_type")
    async with _speech_slots:
        return await asyncio.to_thread(_score_sync, data, prompt_text)


def _score_sync(data: bytes, prompt_text: str):
    from lingoroad_ml.serving.llm_routes import _client
    audio = io.BytesIO(data)
    segments, info = _whisper().transcribe(audio, language="en")
    duration = max(info.duration or 0.0, 0.1)
    if duration > MAX_DURATION_SECONDS:
        raise HTTPException(status_code=413, detail="audio_too_long")
    transcript = " ".join(seg.text.strip() for seg in segments)

    s = word_scores(prompt_text, transcript)
    wpm = len(transcript.split()) / (duration / 60.0)
    fluency = fluency_from_wpm(wpm)
    total = round(0.6 * s["accuracy"] + 0.2 * s["completeness"] + 0.2 * fluency, 3)

    try:
        model = os.environ.get("LINGOROAD_LLM_MODEL_VERSION", "gemini-3.8-flash")
        fb = _client().chat.completions.create(model=model, temperature=0.4, messages=[
            {"role": "user", "content": FEEDBACK_PROMPT.format(
                expected=prompt_text, transcript=transcript,
                missing=", ".join(s["missing_words"]) or "không có")}])
        feedback = fb.choices[0].message.content
    except Exception:
        feedback = "Phản hồi chi tiết tạm thời không khả dụng."
    return {"transcript": transcript, "accuracy": s["accuracy"],
            "completeness": s["completeness"], "fluency": fluency,
            "total": total, "duration_seconds": duration,
            "model_version": MODEL_VERSION, "feedback_vi": feedback}


from pydantic import BaseModel, Field

class TopicContentRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=1000)
    hints: list[str] = Field(default_factory=list, max_length=3)
    transcript: str = Field(min_length=1, max_length=12000)
    durationSeconds: float = Field(gt=0, le=60, allow_inf_nan=False)

@router.post("/speech/topic/content")
async def topic_content(req: TopicContentRequest):
    from lingoroad_ml.speech.content import evaluate
    return await asyncio.to_thread(evaluate, req.topic, req.hints, req.transcript, req.durationSeconds)


class ConversationTranslationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)


class ConversationTurn(BaseModel):
    itemId: str | None = Field(default=None, min_length=1, max_length=200)
    role: str = Field(pattern="^(USER|ASSISTANT)$")
    transcript: str = Field(min_length=0, max_length=12000)


class ConversationAssessmentRequest(BaseModel):
    perTurn: bool = False
    topic: str = Field(min_length=1, max_length=1000)
    turns: list[ConversationTurn] = Field(max_length=256)


@router.post("/speech/conversation/content")
async def conversation_content(req: ConversationAssessmentRequest):
    from lingoroad_ml.speech.content import evaluate
    transcript = "\n".join(turn.transcript for turn in req.turns if turn.role == "USER")
    if sum(len(turn.transcript) for turn in req.turns) > 48000:
        raise HTTPException(413, "conversation_too_large")
    turns = [turn.model_dump(exclude_none=True) for turn in req.turns if turn.transcript.strip()]
    result = await asyncio.to_thread(evaluate, req.topic, [], transcript, None, conversation=turns)
    return {**result, "assessmentScope": "whole_conversation"}



@router.post("/speech/conversation/score")
async def conversation_pronunciation(request: Request):
    from lingoroad_ml.speech import topic
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > 6 * 1024 * 1024:
            raise HTTPException(413, "audio_too_large")
        data.extend(chunk)
    async with _speech_slots:
        try:
            result = await asyncio.wait_for(asyncio.to_thread(
                topic.assess, bytes(data), max_seconds=180, max_bytes=6 * 1024 * 1024,
                timeout_seconds=195), timeout=200)
        except TimeoutError:
            raise HTTPException(504, "azure_timeout") from None
    return {**result, "assessmentProfile": "conversation-speaking-v1",
            "adapterVersion": "azure-conversation-v1-ipa"}


@router.post("/speech/conversation/translate")
async def translate_conversation(req: ConversationTranslationRequest):
    from lingoroad_ml.speech.translation import translate
    return await asyncio.to_thread(translate, req.text)
