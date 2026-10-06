# Product Requirements Document (PRD) - Learning Path Builder & Mastery Gate

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc xây dựng lộ trình học tập cá nhân hóa (`UserLearningPath`) dựa trên kết quả bài kiểm tra đầu vào và cơ chế kiểm soát mở khóa bài học theo cổng năng lực (Mastery Gate).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Sau khi hoàn thành bài test đầu vào, người học cần một lộ trình bài học xuyên suốt hướng tới Target CEFR mà không phải tự tìm kiếm bài học thủ công.
- Cần cơ chế khóa bài học nâng cao nếu các kỹ năng tiên quyết chưa đạt ngưỡng thành thạo (Mastery Gate ≥ 0.70) nhằm tránh việc học trước khi hiểu nền tảng.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tự động hóa**: 100% người học hoàn tất Placement được tạo lộ trình `UserLearningPath` ngay lập tức.
- **Tính chính xác**: 100% bài học phụ thuộc bị khóa chính xác theo đồ thị DAG nếu kỹ năng tiên quyết chưa đạt chuẩn.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đổi lộ trình học sang ngôn ngữ khác (chỉ áp dụng Tiếng Anh).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học theo dõi bản đồ lộ trình học tập cá nhân.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học hoàn thành Placement test đạt cấp độ A2.
2. Hệ thống tự động khởi tạo lộ trình `UserLearningPath` với `currentLevel: A2`, `targetLevel: B1`.
3. Bản đồ học tập hiển thị các bài học cấp độ A2: Bài 1 mở khóa, các bài sau bị khóa cho đến khi hoàn thành bài trước.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Lắng nghe sự kiện `PlacementCompletedEvent` để tạo bản ghi `UserLearningPath`.
- Sắp xếp thứ tự các bài học theo cấu trúc Topological Sort của đồ thị DAG.
- Tính toán trạng thái `isLocked` cho từng bài học dựa trên điểm Mastery của kỹ năng tiên quyết (ngưỡng 0.70).
- Cập nhật tiến độ `currentLessonIndex` khi học viên hoàn thành bài học.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Bài học của kỹ năng B bị khóa nếu bất kỳ kỹ năng tiên quyết A nào có điểm Mastery < 0.70.
- Điểm xuất phát của lộ trình được căn chỉnh theo `estimatedCefr` từ bài test đầu vào.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% người dùng có lộ trình học tập hợp lệ sau khi làm test.

---

# 9. Constraints (Ràng buộc)

- Phải tích hợp đồng bộ với kết quả từ Knowledge Tracing Domain.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL, EventEmitter2, Curriculum Domain.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
