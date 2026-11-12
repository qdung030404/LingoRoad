# Feature Specification: Lesson Structure & Publishing Lifecycle

## Mission (Sứ mệnh)

Đặc tả chi tiết cấu trúc dữ liệu `LearningLesson`, quy tắc kiểm định bất biến `validateLearningContent()` (bước học + 5 câu hỏi × 4 lựa chọn) và quy trình xuất bản bộ bài học mẫu qua `prisma/seed-learning.ts`.

---

# 1. Feature Overview (Tổng quan Tính năng)

Định nghĩa cấu trúc bài học chính khóa `LearningLesson` hỗ trợ 4 kỹ năng (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`), kiểm định tính hợp lệ của các bước lý thuyết (`steps`), câu hỏi trắc nghiệm (`questions`), đoạn đọc (`passage`), tệp nghe (`audioUrl`, `transcript`), và quản lý xuất bản thông qua cờ `published` và phiên bản nội dung `contentVersion`.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Hệ thống quản lý nội dung / Quản trị viên.
- **Tôi muốn**: Mọi bài học được xuất bản đều phải trải qua bước kiểm định cấu trúc 5 câu hỏi × 4 lựa chọn và kiểm tra tệp âm thanh tồn tại.
- **Để tôi có thể**: Đảm bảo người học trên Mobile App luôn nhận được bài học hoàn chỉnh, không gặp lỗi thiếu đáp án hay hỏng audio.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. **Cấu trúc 4 loại bài học chuẩn (`loadLearningContent` trong `seed-learning.ts`)**:
   - **`GRAMMAR` (`grammar-pronouns-to-be`)**: Gồm bước lý thuyết (`steps`) giải thích đại từ nhân xưng và động từ *to be*, theo sau là 5 câu hỏi trắc nghiệm.
   - **`VOCABULARY` (`vocabulary-family`)**: Gồm 10 bước từ vựng (`word`, `phonetic`, `meaning`, `example`, `body`, và `audioUrl` `/media/learning/v1/<word>.wav`), theo sau là 5 câu hỏi trắc nghiệm.
   - **`READING` (`reading-everyday-introductions`)**: Không có `steps` (`steps: []`), có đoạn văn đọc hiểu `passage` và 5 câu hỏi đọc hiểu.
   - **`LISTENING` (`listening-greetings-introductions`)**: Không có `steps` (`steps: []`), có tệp nghe `audioUrl: "/media/learning/v1/listening.wav"`, `transcript` và 5 câu hỏi nghe hiểu.
2. **Kiểm định bất biến (`validateLearningContent` & `validateLearningSeeds`)**:
   - Kiểm tra `steps` là mảng hợp lệ, mỗi bước có `id` không trùng, `title` và `body` không rỗng.
   - Kiểm tra `questions` có **đúng 5 phần tử**; mỗi phần tử có `id` không trùng, `prompt` và `explanation` không rỗng, `options` có **đúng 4 lựa chọn** (`A`, `B`, `C`, `D`) với `id` không trùng, và `correctOptionId` thuộc tập `options`.
   - Kiểm tra sự tồn tại và chữ ký `RIFF` của cả 11 tệp âm thanh WAV trong `apps/backend/media/learning/v1/`.
3. **Xuất bản (`seedLearningContent`)**:
   - Thực hiện `prisma.learningLesson.upsert` theo khóa duy nhất `code` trong một transaction, đặt `published = true` và `contentVersion = 1`.

---

# 4. State Machine (Sơ đồ Trạng thái Xuất bản)

```
[UNPUBLISHED (published = false)]
            │
            ▼ (Pass validateLearningContent() & Audio RIFF Check)
[PUBLISHED (published = true, contentVersion >= 1)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Bắt buộc mỗi bài học phải có đúng 5 câu hỏi và mỗi câu hỏi có đúng 4 lựa chọn.
- Bài học `LISTENING` bắt buộc phải có cả `audioUrl` và `transcript`; bài học `READING` bắt buộc phải có `passage`.
- Chỉ các bài học có `published = true` mới được hiển thị và cho phép bắt đầu lượt học.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Nội dung bài học trong DB bị sửa hỏng không khớp `validateLearningContent()`: Khi người học gọi `POST /learning/lessons/:lessonId/attempts`, `LearningService.start()` bắt ngoại lệ và trả về `503 Service Unavailable` (`LEARNING_CONTENT_UNAVAILABLE`).
- Bài học chưa xuất bản (`published = false`): Truy vấn `GET /learning/lessons/:lessonId` hoặc `POST /learning/lessons/:lessonId/attempts` trả về `404 Not Found` (`LEARNING_LESSON_NOT_FOUND`).

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Các bài học đã xuất bản hiển thị trên Mobile App với đầy đủ tiêu đề, mô tả, thời lượng ước tính (`estimatedMinutes`) và phân loại kỹ năng (`kind`).

---

# 8. API & CLI Requirements (Yêu cầu Giao diện & CLI)

- Hàm kiểm định `validateLearningContent()` tại `apps/backend/src/modules/learning/learning.types.ts`.
- Hàm kiểm định & seed `validateLearningSeeds()`, `seedLearningContent()` tại `apps/backend/prisma/seed-learning.ts`.
- Planned Admin CMS endpoints (`POST /admin/lessons`, `PATCH /admin/lessons/:id/publish`) cho cổng quản trị mở rộng.

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Định nghĩa model `LearningLesson` và enum `LearningKind` trong `apps/backend/prisma/schema.prisma`.
- [x] Triển khai hàm `validateLearningContent()` tại `apps/backend/src/modules/learning/learning.types.ts` kiểm tra chặt chẽ `steps` và đúng 5 câu hỏi × 4 lựa chọn.
- [x] Triển khai `apps/backend/prisma/seed-learning.ts` khởi tạo 4 bài học chuẩn (20 câu hỏi, 11 tệp WAV) với `published = true`.
- [x] Kiểm tra runtime `validateLearningContent()` khi tạo lượt học mới trong `LearningService.start()`.

# End
