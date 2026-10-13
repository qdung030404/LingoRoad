# Speaking assessment sample (task 14, step 3)

Live end-to-end check of `POST /speech/score` (direct ML) and `POST /speaking/attempts`
(.NET API proxy), recorded 2026-07-18 against real Gemini (`gemini-2.5-flash`) and a
local `faster-whisper` "small" model.

## Setup

- Services: FastAPI ML on :8001 (`GEMINI_API_KEY` set for the session, never
  committed), .NET API on :5000 (`dotnet run --launch-profile http`), Postgres
  via docker compose.
- User: fresh registration (`task14-demo@lingoroad.test`).
- Prompt text: `"I have lived here for two years"`.
- **Audio source:** the user was not available to record a live sample, so the
  clip is synthesized with `edge-tts` (`en-US-AriaNeural` voice) — a TTS
  stand-in for a human recording:

  ```powershell
  .venv\Scripts\python -m edge_tts --voice en-US-AriaNeural \
    --text "I have lived here for two years" --write-media speaking_clip.mp3
  ```

  This should be replaced with a real human recording in a later pass; it
  exercises the full pipeline (upload → Whisper ASR → scoring → Gemini
  feedback) but a clean synthetic voice does not test the ASR's robustness to
  accented or noisy speech the way a real learner recording would.
- **Whisper device:** the first `/speech/score` call downloaded the
  `Systran/faster-whisper-small` model (~460 MB) from the HF Hub, then loaded
  it on **CUDA (float16)** — confirmed via `nvidia-smi`, which listed the
  uvicorn worker PID as a GPU compute process (RTX 4060, no CPU fallback
  needed). Total pre-warm call (download + transcribe) took ~34s.

## Direct ML call (`POST http://localhost:8001/speech/score`, HTTP 200, verbatim)

```json
{
  "transcript": "I have lived here for two years.",
  "accuracy": 1.0,
  "completeness": 1.0,
  "fluency": 1.0,
  "total": 1.0,
  "feedback_vi": "Bạn phát âm rất rõ ràng và chính xác câu \"I have lived here for two years\" nên hệ thống nhận diện giọng nói đã nghe được hoàn toàn không thiếu hay sai từ nào. Rất tốt!\n\nĐể phát âm tự nhiên và chuẩn hơn nữa, bạn có thể chú ý luyện tập kỹ hơn các âm cuối, đặc biệt là âm /d/ trong từ \"lived\" và âm /z/ trong từ \"years\". Hãy đảm bảo bật rõ âm /d/ ở cuối \"lived\" và tạo độ rung cho âm /z/ ở cuối \"years\" (giống tiếng ong vo ve) để người nghe bản xứ dễ dàng nhận biết hơn."
}
```

## API call (`POST http://localhost:5000/speaking/attempts`, multipart `audio` + `promptText`, Bearer token, HTTP 200, verbatim)

```json
{
  "attemptId": "de1d2e5c-0ad7-40f2-8e34-8e5441ab2377",
  "transcript": "I have lived here for two years.",
  "accuracy": 1,
  "completeness": 1,
  "fluency": 1,
  "total": 1,
  "feedbackVi": "Chào bạn, bạn đã phát âm câu \"I have lived here for two years\" rất tốt! Whisper đã nhận diện chính xác 100% từng từ bạn nói, cho thấy bạn có khả năng phát âm rõ ràng và chuẩn xác.\n\nĐể câu nói của bạn càng tự nhiên và mượt mà hơn nữa, bạn có thể tiếp tục chú ý đến các âm cuối. Ví dụ, với từ \"lived\", hãy đảm bảo âm /d/ cuối được bật nhẹ nhàng và rõ ràng, tránh để nó bị mất hoặc nghe giống như thêm một âm tiết khác. Tương tự, với từ \"years\", hãy phát âm rõ âm /z/ ở cuối để câu nói thêm phần hoàn chỉnh.\n\nBạn đang đi đúng hướng rồi! Hãy tiếp tục luyện tập nhé."
}
```

## History (`GET /speaking/attempts`, Bearer same token, HTTP 200, verbatim)

```json
[
  {
    "id": "de1d2e5c-0ad7-40f2-8e34-8e5441ab2377",
    "promptText": "I have lived here for two years",
    "transcript": "I have lived here for two years.",
    "total": 1,
    "createdAt": "2026-07-18T01:28:29.584098Z"
  }
]
```

`AudioPath` is intentionally not part of this projection (see `SpeakingEndpoints.MapSpeaking`'s
`Select`), so it never leaks over the API. Querying Postgres directly confirms
the persisted value is the relative path fixed in task 14 step 0 (review
finding — the .NET side stores the server-generated file name, not an
absolute path):

```
Id                                   | AudioPath
de1d2e5c-0ad7-40f2-8e34-8e5441ab2377 | uploads\4be4830c4e8f48a1aa683da4352b1e21.mp3
```

## Why this is a good sample

- Both layers (`/speech/score` direct and `/speaking/attempts` proxied)
  return the same transcript, scores, and Vietnamese feedback shape, showing
  the .NET proxy round-trips the ML response faithfully (`feedback_vi` →
  `feedbackVi` casing aside).
- `accuracy`/`completeness`/`fluency`/`total` are all `1.0`: expected for a
  clean TTS reading of the exact prompt text with no disfluencies — this is
  the "ceiling" case; the unit tests (`test_speech.py`) already cover the
  partial-credit and missing-word paths.
- `feedback_vi` is genuinely tailored: Gemini names the exact two words
  (`"lived"`, `"years"`) whose final consonants (`/d/`, `/z/`) are common
  pronunciation trouble spots for Vietnamese learners, rather than generic
  praise.
- The relative-`AudioPath` and extension-whitelist fixes from step 0 are
  both exercised here: the uploaded `.mp3` extension was preserved (it's on
  the whitelist) and the persisted path is `uploads\<guid>.mp3`, not an
  absolute filesystem path.
