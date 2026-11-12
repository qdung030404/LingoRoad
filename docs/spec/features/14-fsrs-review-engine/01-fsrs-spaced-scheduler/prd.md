# Product Requirements Document (PRD) - FSRS Spaced Repetition & Flashcard Learning State Engine

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho cơ chế tính toán trạng thái ghi nhớ từ vựng (`learningState`: `NEEDS_REVIEW` | `REMEMBERED`), chuẩn hóa đáp án kiểm tra nhớ từ (`normalizeVocabularyAnswer` v1) và lập lịch ôn tập ngắt quãng trong `VocabularyModule` (Backend) cùng `SrsReviewPage` / `WordLibrary` (Mobile Guest Mode).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Học từ vựng thụ động không có cơ chế phân loại mức độ nhớ và kiểm tra gõ lại từ (Active Recall) khiến người học nhanh chóng quên từ sau vài ngày.
- Cần kết hợp cơ chế đánh giá trực tiếp 3 mức (`EASY`, `MEDIUM`, `HARD`) với pha kiểm tra gõ lại từ (`RECALL_AFTER_REVEAL`) cho tài khoản đăng nhập, đồng thời hỗ trợ bộ lập lịch ôn tập ngắt quãng cục bộ cho người dùng Guest.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tỷ lệ ghi nhớ**: Duy trì tỷ lệ nhớ từ vựng mục tiêu đạt ≥ 90% (Target Retention = 0.90).
- **Độ chính xác chuẩn hóa đáp án**: 100% đáp án người học nhập trong pha `RECALL` được chuẩn hóa Unicode NFKC, chữ thường, lược bỏ khoảng trắng thừa trước khi so khớp với `acceptedAnswers`.
- **Đồng bộ trạng thái tức thì**: Cập nhật chính xác `learningState` (`NEEDS_REVIEW` hoặc `REMEMBERED`) và dấu thời gian `lastPresentedAt`, `lastReviewedAt` sau mỗi phiên ôn tập.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Tự động huấn luyện trọng số cá nhân hóa bằng Machine Learning trên từng tài khoản riêng lẻ.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner (Authenticated & Guest)**: Người học muốn ôn tập flashcard từ vựng hiệu quả cao với lộ trình ưu tiên những từ chưa thuộc (`NEEDS_REVIEW`).

---

# 5. User Journey (Hành trình Người dùng)

1. Người học chọn một bộ từ vựng (`VocabularyDeck`) và bắt đầu phiên ôn tập theo phạm vi `NEEDS_REVIEW` (hoặc `ALL`).
2. Hệ thống ưu tiên chọn tối đa 20 từ có `lastPresentedAt` cũ nhất (những từ chưa từng xuất hiện `lastPresentedAt = null` được xếp lên đầu).
3. Ở mặt trước (`FRONT`), người học tự đánh giá:
   - Chọn `EASY` hoặc `MEDIUM`: Thẻ được đánh dấu `REVIEWED` (`resultSource = 'SELF_REPORT'`).
   - Chọn `HARD`: Thẻ lật sang pha `MEANING` hiển thị nghĩa và ví dụ, sau đó chuyển sang pha `RECALL` yêu cầu gõ lại từ tiếng Anh.
4. Khi kết thúc phiên (`SUBMIT`), hệ thống cập nhật `learningState` của từng từ thành `REMEMBERED` (nếu đạt `EASY`/`MEDIUM`) hoặc `NEEDS_REVIEW` (nếu `HARD`).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Chuẩn hóa từ vựng và đáp án (`normalizeVocabularyAnswer`, `buildAcceptedAnswers` với `NORMALIZATION_VERSION = 'v1'`).
- Sắp xếp hàng đợi ưu tiên từ cần ôn tập theo thứ tự: `lastPresentedAt ASC NULLS FIRST, createdAt ASC, id ASC`.
- Chấm điểm pha `RECALL`: So khớp đáp án chuẩn hóa với mảng `acceptedAnswers` trong `wordSnapshot`, gán `isCorrect = true, rating = 'MEDIUM'` nếu đúng và `isCorrect = false, rating = 'HARD'` nếu sai.
- Hỗ trợ lập lịch SRS trên Mobile (`SrsReviewPage` & `WordLibrary`) với 4 mức đánh giá (`Quên` → 1 phút, `Khó` → 1 ngày, `Tốt` → 3 ngày, `Dễ` → 7 ngày).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mọi thông số lý thuyết FSRS tuân thủ giới hạn: Độ khó D trong đoạn [1.0, 10.0], Độ bền S ≥ 0.1 ngày, Target Retention = 0.90.
- Một từ vựng phải có ít nhất 1 đáp án hợp lệ trong `acceptedAnswers` (luôn tự động bao gồm từ gốc `english` đã chuẩn hóa) và tối đa 10 đáp án đồng nghĩa.
- Khi `SUBMIT` phiên ôn tập, nếu một từ đã được cập nhật bởi một phiên ôn tập khác mới hơn, phiên cũ không được ghi đè `learningState` của từ đó.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Thời gian chuẩn hóa đáp án và chuyển pha ôn tập < 5ms mỗi lệnh.

---

# 9. Constraints (Ràng buộc)

- Triển khai thuần túy bằng TypeScript trong `apps/backend/src/modules/vocabulary/` và Dart trong `apps/mobile/lib/features/vocabulary/`.

---

# 10. Risks (Rủi ro)

- Người dùng sửa nội dung từ vựng trong khi đang có phiên ôn tập mở: Giải quyết bằng cách lưu `wordSnapshot` và `wordContentVersion` ngay khi khởi tạo `VocabularyReviewItem`.

---

# 11. Dependencies (Sự phụ thuộc)

- `PrismaModule` (PostgreSQL).

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
