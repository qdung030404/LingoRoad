# Task: Implement Multi-Skill CEFR Aggregation & Diagnostic Service

## Mission (Sứ mệnh)

Xây dựng `CefrAggregationService` trong NestJS để tổng hợp điểm số 4 kỹ năng từ `MockSubmission`, tính điểm Overall chuẩn 10, ánh xạ Bậc CEFR, sinh biểu đồ Radar và hoàn tất phiên thi thử.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Service Tổng hợp điểm 4 kỹ năng và Báo cáo chẩn đoán CEFR (`CefrAggregationService`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/25-multi-skill-assessment-engine/02-multi-skill-cefr-aggregation/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/25-multi-skill-assessment-engine/02-multi-skill-cefr-aggregation/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/25-multi-skill-assessment-engine/02-multi-skill-cefr-aggregation/spec.md)

---

# 3. Description (Mô tả)

- Tạo `CefrAggregationService` trong `apps/backend/src/modules/mock-exam/services/`:
  - Viết logic `rawToScale10()` cho bài thi Nghe và Đọc.
  - Viết logic tổng hợp trọng số bài thi Viết (Task 1 + Task 2).
  - Viết hàm `mapScoreToCefr()` ánh xạ điểm số sang Bậc CEFR (A1 - C2).
  - Viết logic chẩn đoán `generateDiagnosticReport()` phát hiện điểm yếu và đề xuất hành động.
- Viết Unit Tests đầy đủ cho các trường hợp biên của thuật toán làm tròn điểm số.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Tính toán điểm tổng hợp và phân loại CEFR.
- Cập nhật các trường điểm số trong bảng `mock_exam_sessions`.
- Viết Unit Test cho Service.

### NGOÀI PHẠM VI (OUT):
- Vẽ biểu đồ trên ứng dụng Flutter (thuộc Task UI).

---

# 5. Implementation Checklist (Danh mục Triển khai)

- [ ] Tạo `CefrAggregationService` với các hàm tính toán theo công thức đặc tả.
- [ ] Thêm phương thức `aggregateAndComplete(sessionId)` vào MockExamRepository.
- [ ] Lắng nghe sự kiện `mock_exam.evaluation_finished` để tự động kích hoạt tính điểm.
- [ ] Viết Unit Test kiểm tra tính chính xác của thuật toán quy đổi điểm và làm tròn 0.5.
