# Feature Specification: Item Bank & Question Types Management

## Mission (Sứ mệnh)

Đặc tả chi tiết mô hình Ngân hàng câu hỏi (`AssessmentItemGroup`, `AssessmentItem`), 7 định dạng câu hỏi (`ItemType`), tham số 3PL IRT (`irtA`, `irtB`, `irtC`), tiêu chí chấm tự luận (`rubricCriteria`) và quy trình kiểm định/khởi tạo dữ liệu (`validate.ts`, `seed-placement.ts`, `seed-cefr-bank.ts`).

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp cấu trúc lưu trữ và kiểm định ngân hàng câu hỏi tập trung hỗ trợ 7 định dạng tương tác (`MULTIPLE_CHOICE`, `CLOZE`, `SENTENCE_REORDER`, `MATCHING`, `GAP_FILL`, `ESSAY`, `SPEAKING_PROMPT`), phân nhóm ngữ liệu đọc/nghe (`AssessmentItemGroup`), phân tách phạm vi sử dụng (`ItemUsageScope`) và lưu trữ tham số 3PL IRT phục vụ đánh giá năng lực theo chuẩn CEFR.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Hệ thống Đánh giá Năng lực (Placement / Assessment Engine) và Quản trị viên nội dung.
- **Tôi muốn**: Lưu trữ và truy xuất câu hỏi theo kỹ năng (`READING`, `LISTENING`, `WRITING`, `SPEAKING`), cấp độ CEFR (`A1`–`C2`), phạm vi sử dụng (`usageScope`) và thông số IRT (`irtA`, `irtB`, `irtC`).
- **Để tôi có thể**: Chọn câu hỏi thích ứng chính xác và chấm điểm tự động hoặc theo rubric chuẩn hóa.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. **Kiểm định Ngân hàng Câu hỏi Placement (`prisma/demo-content/validate.ts`)**:
   - Xác thực mảng `items` gồm đúng 40 câu hỏi, chia đều 5 câu cho mỗi tổ hợp `(READING | LISTENING) × (A1 | A2 | B1 | B2)` với mã `externalId` theo mẫu `demo-{skill}-{cefr}-0{1..5}`.
   - Mỗi câu hỏi phải có `prompt`, `correctOption`, `explanation` không rỗng, mảng `options` gồm đúng 4 phương án phân biệt và chứa `correctOption`.
   - Câu hỏi `READING` bắt buộc có `passage` và không có `transcript`; câu hỏi `LISTENING` bắt buộc có `transcript`, không có `passage`, và tệp âm thanh `/media/placement/{externalId}.wav` phải là WAV PCM 16-bit mono có thời lượng từ 15 đến 45 giây.
2. **Khởi tạo Ngân hàng Placement (`prisma/seed-placement.ts`)**:
   - Nạp 40 câu hỏi vào `assessment_items` với `bankVersion = "demo-v1"`, `usageScope = "PLACEMENT"`, `irtA = 1.0`, `irtC = 0.25`, và độ khó `irtB` tăng dần theo CEFR (`A1: -1.8`, `A2: -0.8`, `B1: 0.2`, `B2: 1.2`).
3. **Khởi tạo Ngân hàng Đa Kỹ năng CEFR (`prisma/seed-cefr-bank.ts`)**:
   - Tạo 2 nhóm `AssessmentItemGroup` (bài đọc B1 Part 3 và bài nghe B2 Part 2) kèm các câu hỏi `MULTIPLE_CHOICE` và `GAP_FILL` có thứ tự `itemOrder`.
   - Tạo 7 đề thi Viết (`ItemType.ESSAY`, cấp độ A2, B1, B2) và 2 đề thi Nói (`ItemType.SPEAKING_PROMPT`, cấp độ B1, C1) với cấu trúc `rubricCriteria` JSONB chi tiết và `irtC = 0.0`.

---

# 4. State Machine (Sơ đồ Trạng thái)

- Các bản ghi `AssessmentItemGroup` và `AssessmentItem` được quản lý theo phiên bản ngân hàng đề (`bankVersion`: `demo-v1`, `cefr-v1`) và phạm vi `usageScope`, được cập nhật idempotent qua khóa duy nhất `externalId`.

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Đáp án đúng (`correctOption`) của câu hỏi trắc nghiệm bắt buộc phải tồn tại trong tập lựa chọn (`options`).
- Các câu hỏi tự luận (`ESSAY`, `SPEAKING_PROMPT`) sử dụng `rubricCriteria` thay cho `options`/`correctOption` và có hệ số đoán mò `irtC = 0.0`.
- Bắt buộc sử dụng `onDelete: Restrict` từ `AssessmentResponse` và `PlacementSession` tới `AssessmentItem` để ngăn chặn xóa nhầm câu hỏi đã có lịch sử làm bài.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Tệp WAV có metadata chunk phụ trước chunk `data`: Hàm `waveDurationSeconds()` duyệt tuần tự từng chunk RIFF thay vì giả định header cố định 44 byte, đảm bảo tính đúng thời lượng.
- Chạy lại script seed nhiều lần: Nhờ `upsert` theo `externalId` bên trong `prisma.$transaction`, dữ liệu không bao giờ bị nhân bản.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Trên Mobile App, các câu hỏi thuộc cùng `AssessmentItemGroup` hiển thị chung đoạn văn `passage` hoặc trình phát `audioUrl`, giúp người học trả lời chuỗi câu hỏi thuận tiện.

---

# 8. API & Script Requirements (Yêu cầu Giao diện & Script)

- `apps/backend/prisma/demo-content/validate.ts` (`validateDemoContent`, `waveDurationSeconds`)
- `apps/backend/prisma/seed-placement.ts` (`seedDemoContent`)
- `apps/backend/prisma/seed-cefr-bank.ts` (`seedCefrBank`)
- Planned Admin CMS CRUD endpoints (`POST /admin/items`, `GET /admin/items`) cho giai đoạn mở rộng cổng quản trị.

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Định nghĩa `AssessmentItemGroup`, `AssessmentItem`, 7 `ItemType` và `ItemUsageScope` kèm tham số 3PL IRT (`irtA`, `irtB`, `irtC`) và `rubricCriteria` trong `apps/backend/prisma/schema.prisma`.
- [x] Triển khai bộ kiểm định `validateDemoContent()` và `waveDurationSeconds()` trong `apps/backend/prisma/demo-content/validate.ts`.
- [x] Triển khai `apps/backend/prisma/seed-placement.ts` nạp 40 câu hỏi Placement (`demo-v1`).
- [x] Triển khai `apps/backend/prisma/seed-cefr-bank.ts` nạp ngân hàng câu hỏi đa kỹ năng Reading, Listening, Writing, Speaking (`cefr-v1`).

# End
