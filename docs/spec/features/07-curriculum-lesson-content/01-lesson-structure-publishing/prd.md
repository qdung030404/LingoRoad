# Product Requirements Document (PRD) - Lesson Structure & Publishing Lifecycle

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho cấu trúc bài học chính khóa (`LearningLesson`), kiểm định tính toàn vẹn của nội dung bài học (`validateLearningContent`: bước học `steps` + đúng 5 câu hỏi × 4 lựa chọn), kiểm định tệp âm thanh WAV và quản lý trạng thái xuất bản (`published`) trong LingoRoad.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Bài học cần được cấu trúc chuẩn hóa theo từng nhóm kỹ năng (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`), có đầy đủ nội dung lý thuyết/ngữ liệu (`steps`, `passage`, `audioUrl`, `transcript`) và bộ câu hỏi thực hành nhất quán trước khi phát hành cho học viên.
- Cần cơ chế kiểm định tự động (`validateLearningContent`, `validateLearningSeeds`) và cờ xuất bản (`published`) để không bao giờ phát hành bài học thiếu câu hỏi, sai đáp án hoặc thiếu tệp âm thanh lên ứng dụng di động.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tiêu chuẩn chất lượng bất biến**: 100% bài học `LearningLesson` được xuất bản (`published = true`) phải vượt qua kiểm định `validateLearningContent()` với đúng 5 câu hỏi trắc nghiệm, mỗi câu hỏi có đúng 4 lựa chọn hợp lệ và giải thích chi tiết (`explanation`).
- **Tính sẵn sàng của nội dung mẫu**: Cung cấp sẵn bộ 4 bài học chuẩn hóa (`grammar-pronouns-to-be`, `vocabulary-family`, `reading-everyday-introductions`, `listening-greetings-introductions`), tổng cộng 20 câu hỏi và 11 tệp âm thanh WAV chuẩn RIFF qua `prisma/seed-learning.ts`.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Trình soạn thảo WYSIWYG trực quan phức tạp (sử dụng cấu trúc `LearningContent` JSONB chuẩn hóa).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Content Seeder / Admin**: Biên soạn, kiểm định và xuất bản bài học (`seed-learning.ts` / Admin CMS).
- **Learner**: Chỉ nhìn thấy các bài học đã đạt chuẩn và có `published = true`.

---

# 5. User Journey (Hành trình Người dùng)

1. Nội dung bài học được định nghĩa theo giao diện `LearningSeed` / `LearningContent` (`steps`, `questions`, `passage`, `audioUrl`, `transcript`).
2. Hệ thống chạy `validateLearningContent()` và `validateLearningSeeds()` để xác thực:
   - Đủ 4 kỹ năng (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`).
   - Mỗi bài có đúng 5 câu hỏi (`questions.length === 5`), mỗi câu có đúng 4 lựa chọn (`options.length === 4`) và `correctOptionId` hợp lệ.
   - Bài `READING` bắt buộc có `passage`; bài `LISTENING` bắt buộc có `audioUrl` và `transcript`.
   - Toàn bộ 11 tệp âm thanh `/media/learning/v1/*.wav` tồn tại trên đĩa và có header `RIFF` hợp lệ.
3. Dữ liệu được upsert vào bảng `learning_lessons` với `published = true` theo mã định danh ổn định `code`.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Lưu trữ thực thể `LearningLesson` (`id`, `code`, `kind: LearningKind`, `title`, `description`, `estimatedMinutes`, `sortOrder`, `published`, `contentVersion`, `content: Json`).
- Kiểm định cấu trúc `LearningContent` bằng `validateLearningContent()` (`apps/backend/src/modules/learning/learning.types.ts`) cả khi seed dữ liệu lẫn khi bắt đầu lượt học (`LearningService.start()`).
- Cung cấp CLI kiểm định và nạp dữ liệu `apps/backend/prisma/seed-learning.ts` (`--validate`).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Một bài học hợp lệ bắt buộc phải có đúng **5 câu hỏi** (`questions.length === 5`) và mỗi câu hỏi có đúng **4 lựa chọn** (`options.length === 4`).
- Nếu nội dung bài học không vượt qua `validateLearningContent()` tại thời điểm người học bắt đầu làm bài, `LearningService.start()` từ chối với lỗi `503 Service Unavailable` (`LEARNING_CONTENT_UNAVAILABLE`).
- Các bài học có `published = false` bị ẩn hoàn toàn khỏi danh mục học viên (`GET /learning/lessons`).

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0% bài học rỗng, thiếu câu hỏi hoặc hỏng file audio được xuất bản.
- 100% bài học mẫu (4 bài học, 20 câu hỏi, 11 file WAV) vượt qua kiểm định `seed-learning.ts --validate`.

---

# 9. Constraints (Ràng buộc)

- Script seed chỉ cho phép ghi vào các cơ sở dữ liệu cô lập `lingoroad_demo` hoặc `lingoroad_*test`.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM (`LearningLesson`), thư mục media `apps/backend/media/learning/v1/`.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
