# Exercise generation + submit sample (task 13, step 3)

Live end-to-end check of `POST /exercises/generate` and `POST /exercises/{id}/submit`,
recorded 2026-07-18 against real Gemini (`gemini-2.5-flash`).

## Setup

- Services: FastAPI ML on :8001 (`GEMINI_API_KEY` set for the session, never
  committed), .NET API on :5000 (`dotnet run --launch-profile http`), Postgres
  via docker compose.
- User: fresh registration (`task13-demo@lingoroad.test`).
- Skill: `grammar.conditionals.second` (Second Conditional, seeded B1 skill).

## Request

```json
POST /exercises/generate
Authorization: Bearer <token>
{"skillCode":"grammar.conditionals.second"}
```

## Response (HTTP 200, verbatim — no correctAnswer/explanationVi leaked)

```json
[
  {
    "id": "00c0adc3-9b95-4272-abe1-6a2c639eaf14",
    "stem": "If I had more time, I ___ learn a new language.",
    "options": ["would", "will", "would have", "can"]
  },
  {
    "id": "7fa49d27-fd26-4614-9fcc-dbff9416d399",
    "stem": "If my computer ___ faster, I wouldn't get so frustrated.",
    "options": []
  },
  {
    "id": "93cc8330-5fa9-4e43-be44-bcf4cee2c44c",
    "stem": "I don't have enough money, so I can't buy that car. (Rewrite using the Second Conditional)",
    "options": []
  }
]
```

- Item 1 is `mcq` with 4 English options (level-appropriate B1 second-conditional
  distractors: tense confusion `will`, aspect confusion `would have`, modal
  confusion `can`).
- Items 2–3 are `cloze`/`rewrite` — `options` is empty by design, `correct_answer`
  is checked server-side against a free-text response.

## Submit

```json
POST /exercises/00c0adc3-9b95-4272-abe1-6a2c639eaf14/submit
Authorization: Bearer <token>
{"answer": "would"}
```

## Submit response (HTTP 200, verbatim — answer + Vietnamese explanation revealed)

```json
{
  "correct": true,
  "correctAnswer": "would",
  "explanationVi": "Trong câu điều kiện loại 2, mệnh đề 'if' dùng thì quá khứ đơn (had), và mệnh đề chính dùng 'would' + động từ nguyên mẫu (would learn). Câu này diễn tả một tình huống giả định ở hiện tại hoặc tương lai."
}
```

Follow-up `GET /mastery` (Bearer same token) confirms the skill now appears:

```json
[{"skillCode":"grammar.conditionals.second","skillName":"Second Conditional","pCorrect":0.65,"updatedAt":"2026-07-18T00:59:30.535974Z"}]
```

Resubmitting the same exercise re-grades but does not move `pCorrect` again
(replay guard added in task 13 step 0 — `AnsweredAt` gates the mastery update
to the first submit).

## WordNet distractors

```python
from lingoroad_ml.llm.distractors import wordnet_distractors
wordnet_distractors('happy')  # -> ['unhappy']
wordnet_distractors('dog')    # -> ['hyena', 'hyaena', 'wolf']
```

`happy` only yields an antonym (WordNet has no useful co-hyponym sibling for
this adjective sense); `dog` yields co-hyponyms from the `canine` hypernym
(`hyena`/`hyaena`/`wolf`) — related-but-wrong words a Vietnamese learner might
plausibly confuse with the target.
