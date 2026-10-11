# Automated writing evaluation (AWE) sample (task 13, step 3)

Live end-to-end check of `POST /writing/evaluate`, recorded 2026-07-18 against
real Gemini (`gemini-2.5-flash`).

## Setup

- Services: FastAPI ML on :8001 (`GEMINI_API_KEY` set for the session, never
  committed), .NET API on :5000 (`dotnet run --launch-profile http`).
- User: `task13-demo@lingoroad.test`.
- Essay has two deliberate errors: subject-verb agreement (`It have`) and a
  singular/plural noun mismatch (`beach` after `many`).

## Request

```json
POST /writing/evaluate
Authorization: Bearer <token>
{
  "taskPrompt": "Describe your hometown.",
  "essay": "My hometown is Da Nang. It have many beautiful beach."
}
```

## Response (HTTP 200, verbatim)

### Scores (0–9, IELTS rubric)

```json
{
  "taskAchievement": 2,
  "coherenceCohesion": 2,
  "lexicalResource": 2,
  "grammaticalAccuracy": 1
}
```

### Feedback (Vietnamese, per sentence)

```json
[
  {
    "sentence": "My hometown is Da Nang.",
    "issue": "Câu này đúng ngữ pháp và rõ ràng.",
    "suggestion": "Không cần sửa đổi."
  },
  {
    "sentence": "It have many beautiful beach.",
    "issue": "Có hai lỗi ngữ pháp chính: 1. Lỗi hòa hợp chủ ngữ-động từ ('It have' thay vì 'It has'). 2. Lỗi danh từ số ít/số nhiều ('beach' thay vì 'beaches' khi đi với 'many').",
    "suggestion": "Nên sửa thành 'It has many beautiful beaches.'"
  }
]
```

### Overall (Vietnamese)

> Bài viết này quá ngắn và chưa phát triển đầy đủ để đáp ứng yêu cầu của đề bài.
> Mặc dù đã nêu được tên quê hương và một đặc điểm, nhưng nội dung còn rất sơ sài.
> Có lỗi ngữ pháp cơ bản về hòa hợp chủ ngữ-động từ và danh từ số ít/số nhiều.
> Từ vựng rất hạn chế và chỉ ở mức cơ bản. Để đạt điểm cao hơn, bạn cần mở rộng
> nội dung, cung cấp thêm chi tiết về quê hương, sử dụng đa dạng cấu trúc ngữ
> pháp và từ vựng hơn.

## Why this is a good sample

- All four IELTS criteria (`taskAchievement`, `coherenceCohesion`,
  `lexicalResource`, `grammaticalAccuracy`) are scored 0–9 as required.
- The model caught both deliberate errors in `"It have many beautiful beach."`
  — the subject-verb agreement mistake and the singular/plural noun mismatch —
  and explained them correctly in Vietnamese, with a concrete corrected
  sentence in the `suggestion` field.
- Low scores (1–2) are consistent with the essay's actual length/quality: a
  two-sentence essay for a "describe your hometown" prompt is under-developed
  by IELTS standards, and `overallVi` explains why in Vietnamese.
