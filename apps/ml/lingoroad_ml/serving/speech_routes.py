import asyncio
import io
import os
from functools import lru_cache
from fastapi import APIRouter, UploadFile, Form, HTTPException
from lingoroad_ml.speech.scoring import word_scores, fluency_from_wpm

router = APIRouter()
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_DURATION_SECONDS = 120
MODEL_VERSION = os.environ.get("LINGOROAD_SPEECH_MODEL_VERSION", "faster-whisper-small")
_speech_slots = asyncio.Semaphore(max(
    1, int(os.environ.get("LINGOROAD_SPEECH_CONCURRENCY", "1"))))

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
