# Product Requirements Document (PRD) - Item Bank & Question Types Management

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc xây dựng, kiểm định và quản trị Ngân hàng câu hỏi đánh giá (`AssessmentItemGroup`, `AssessmentItem`) hỗ trợ 7 định dạng `ItemType`, phân loại theo phạm vi sử dụng (`ItemUsageScope`), cấp độ CEFR (`A1` – `C2`), tham số 3PL IRT (`irtA`, `irtB`, `irtC`) và tiêu chí chấm tự luận (`rubricCriteria`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Việc đánh giá năng lực tiếng Anh và luyện tập theo chuẩn CEFR đòi hỏi nhiều định dạng câu hỏi khác nhau: từ câu hỏi đơn lẻ, bài đọc/nghe theo nhóm ngữ liệu (`AssessmentItemGroup`), đến câu hỏi viết luận (`ESSAY`) và nói (`SPEAKING_PROMPT`).
- Cần một kho câu hỏi tập trung có gắn mã kỹ năng (`skillCode`), thông số đo lường 3PL IRT (`irtA`, `irtB`, `irtC`), và bộ kiểm định nghiêm ngặt (`validateDemoContent`, `waveDurationSeconds`) cho cả văn bản và tệp âm thanh WAV trước khi lưu vào cơ sở dữ liệu.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Hỗ trợ đa định dạng (7 `ItemType`)**: Hỗ trợ đầy đủ `MULTIPLE_CHOICE`, `CLOZE`, `SENTENCE_REORDER`, `MATCHING`, `GAP_FILL`, `ESSAY`, `SPEAKING_PROMPT`.
- **Phân tách phạm vi sử dụng (`ItemUsageScope`)**: Hỗ trợ phân loại `PLACEMENT`, `MOCK_EXAM`, `PRACTICE`, `ALL`.
- **Tính toàn vẹn nội dung và âm thanh**: 100% câu hỏi trong ngân hàng Placement (`demo-v1`, 40 câu hỏi: 20 Reading + 20 Listening trải đều A1–B2) và ngân hàng CEFR mở rộng (`cefr-v1`: nhóm bài đọc/nghe, Writing rubric, Speaking rubric) được kiểm định đáp án và thời lượng WAV (15–45 giây, PCM 16-bit mono) qua `prisma/demo-content/validate.ts`.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Chấm điểm bài thi Placement hoặc bài viết Writing (thuộc các phân hệ Assessment tương ứng).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Placement & Assessment Engine**: Truy vấn câu hỏi theo `usageScope`, `skill`, `cefrLevel` và tham số IRT (`irtA`, `irtB`, `irtC`).
- **Content Seeder / Admin**: Khởi tạo và quản trị ngân hàng câu hỏi qua `seed-placement.ts`, `seed-cefr-bank.ts` và Admin CMS.

---

# 5. User Journey (Hành trình Người dùng)

1. Nội dung câu hỏi được định nghĩa trong `prisma/demo-content/items.json` (cho `seed-placement.ts`) và `prisma/seed-cefr-bank.ts`.
2. Bộ kiểm định `validateDemoContent()` (`prisma/demo-content/validate.ts`) kiểm tra:
   - Đúng 40 câu hỏi (5 câu cho mỗi cặp `READING`/`LISTENING` × `A1`/`A2`/`B1`/`B2`).
   - Đúng 4 lựa chọn phân biệt và `correctOption` nằm trong `options`.
   - Kiểm tra cấu trúc container WAV RIFF (`waveDurationSeconds`): chuẩn PCM 16-bit mono và thời lượng nằm trong khoảng 15–45 giây.
3. Dữ liệu được nạp idempotent bằng `upsert` theo `externalId` vào bảng `assessment_item_groups` và `assessment_items`.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Lưu trữ nhóm ngữ liệu `AssessmentItemGroup` (`skill`, `title`, `cefrLevel`, `partNumber`, `passage`, `audioUrl`, `transcript`, `usageScope`).
- Lưu trữ câu hỏi `AssessmentItem` (`groupId`, `itemOrder`, `externalId`, `bankVersion`, `skill`, `passage`, `skillCode`, `cefrLevel`, `type`, `prompt`, `options`, `correctOption`, `explanation`, `audioUrl`, `rubricCriteria`, `usageScope`, `irtA`, `irtB`, `irtC`).
- Kiểm định offline không cần kết nối DB qua `prisma/demo-content/validate.ts`.
- Khởi tạo dữ liệu ngân hàng câu hỏi qua `prisma/seed-placement.ts` (`demo-v1`) và `prisma/seed-cefr-bank.ts` (`cefr-v1`).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Đối với câu hỏi trắc nghiệm (`MULTIPLE_CHOICE`, `GAP_FILL`), `correctOption` bắt buộc phải tồn tại trong mảng `options`.
- Đối với câu hỏi tự luận (`ESSAY`, `SPEAKING_PROMPT`), trường `rubricCriteria` lưu tiêu chí chấm điểm chi tiết (`taskAchievement`, `coherenceCohesion`, `lexicalResource`, `grammarAccuracy`, `wordCount` hoặc `minSpeakingSeconds`/`maxSpeakingSeconds`) và tham số đoán mò `irtC = 0.0`.
- Khi seed ngân hàng `demo-v1` (`seed-placement.ts`), trường `transcript` của câu hỏi Listening được giữ trong fixture kiểm định offline và không lưu trực tiếp vào bản ghi `AssessmentItem` để ngăn rò rỉ đáp án nghe.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0% câu hỏi bị lỗi thiếu đáp án hoặc hỏng file audio trong `demo-v1` và `cefr-v1`.

---

# 9. Constraints (Ràng buộc)

- Các script seed kiểm tra tên database hợp lệ (`lingoroad`, `lingoroad_demo`, `lingoroad_test`, `postgres`) trước khi thực thi.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM (`AssessmentItemGroup`, `AssessmentItem`).

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
