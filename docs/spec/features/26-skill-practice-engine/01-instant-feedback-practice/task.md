# Task: Implement Instant Feedback Practice Engine

## Mission (Sứ mệnh)

Xây dựng module backend `PracticeModule`, controller và use case cho phép người học bắt đầu phiên luyện tập kỹ năng và nhận phản hồi đúng/sai kèm giải thích tức thì cho từng câu hỏi.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Luyện tập kỹ năng có phản hồi tức thì (`POST /api/v1/practice/sessions/:sessionId/check`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/26-skill-practice-engine/01-instant-feedback-practice/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/26-skill-practice-engine/01-instant-feedback-practice/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/26-skill-practice-engine/01-instant-feedback-practice/spec.md)

---

# 3. Description (Mô tả)

- Tạo module mới `apps/backend/src/modules/practice`:
  - `practice.controller.ts`: Tiếp nhận các request luyện tập.
  - `use-cases/start-practice-session.use-case.ts`: Tạo phiên luyện tập và lấy đề bài.
  - `use-cases/check-practice-answer.use-case.ts`: Kiểm tra đáp án, lưu lịch sử và trả về giải thích.
  - `repositories/practice.repository.ts`: Thao tác với `practice_sessions` và `practice_answers`.
- Viết Unit Test và E2E Test cho luồng kiểm tra đáp án tức thì.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Quản lý phiên luyện tập (`PracticeSession`).
- So sánh đáp án và trả về giải thích + từ vựng chi tiết.
- Phát sự kiện `practice.answer_submitted` cho hệ thống theo dõi học tập.

### NGOÀI PHẠM VI (OUT):
- Tích hợp trợ lý AI gợi ý viết lại bài văn đa lượt (thuộc subtask 02).
- Giao diện người dùng Mobile.

---

# 5. Implementation Checklist (Danh mục Triển khai)

- [x] Triển khai `LearningAttempt` & `LearningAttemptAnswer` trong `apps/backend/prisma/schema.prisma`.
- [x] Xây dựng `PUT /learning/attempts/:attemptId/answers/:questionId/check` trả về tức thì `isCorrect`, `correctOptionId`, `explanation` và `POST /learning/attempts/:attemptId/submit` mở khóa `transcript` bài Nghe (`apps/backend/src/modules/learning/`).
- [x] Xây dựng `GET /api/v1/assessment/practice/groups`, `GET /api/v1/assessment/practice/groups/:id`, `GET /api/v1/assessment/writing/items` và `POST /api/v1/assessment/writing/evaluate` (`apps/backend/src/modules/assessment/`).
- [ ] Phase 2: Thêm model `PracticeSession` và `PracticeAnswer` tách biệt cho ngân hàng đề thi thử (`POST /api/v1/practice/sessions/:sessionId/check`).
- [x] Viết Unit Test và E2E Test cho luồng kiểm tra câu trả lời tức thì Phase 1.

---

# 6. Status (Trạng thái)

- **PHASE 1 DONE / PHASE 2 TODO**

