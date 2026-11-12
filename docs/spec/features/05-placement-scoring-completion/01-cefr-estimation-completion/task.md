# Task: Implement CEFR Estimation & Placement Completion

## Mission (Sứ mệnh)

Triển khai logic hoàn tất bài kiểm tra đầu vào, thuật toán xếp loại CEFR tạm thời (`PROVISIONAL_RATIO_V1`), cập nhật cấu trúc `skillResults` trong PostgreSQL và phát sự kiện `PlacementCompletedEvent`.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Thuật toán Chấm điểm CEFR và Hoàn tất Phiên Kiểm tra Đầu vào

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/01-cefr-estimation-completion/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/01-cefr-estimation-completion/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/01-cefr-estimation-completion/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng thuật toán xếp loại CEFR `provisionalCefr` trong `DemoPlacementService` và `CefrScoringService`.
- Bóc tách điểm số 10 câu thành 2 nhóm kỹ năng `READING` (câu 0–4) và `LISTENING` (câu 5–9).
- Đóng gói dữ liệu `skillResults` JSONB.
- Định nghĩa class `PlacementCompletedEvent` và phát sự kiện sau khi cập nhật phiên.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Logic tính điểm và xác định cấp độ CEFR (`A1`, `A2`, `B1`, `B2`).
- Cập nhật bản ghi `PlacementSession` thành `COMPLETED`.
- Phát sự kiện `PlacementCompletedEvent`.
- Viết Unit test cho service chấm điểm.

### NGOÀI PHẠM VI (OUT):
- API truy vấn kết quả (thuộc subtask 02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files tạo/chỉnh sửa**:
  - `apps/backend/src/modules/placement/services/demo-placement.service.ts`
  - `apps/backend/src/modules/placement/services/cefr-scoring.service.ts`
  - `apps/backend/src/modules/placement/events/placement-completed.event.ts`
  - `apps/backend/src/modules/placement/services/cefr-scoring.service.spec.ts`
  - `apps/backend/src/modules/placement/services/demo-placement.service.spec.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `EventEmitter2`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Hoàn tất phiên làm bài khi trả lời xong 10 câu hỏi.
- [x] Xếp loại chính xác cấp độ CEFR tổng thể và từng kỹ năng theo tỷ lệ đúng.
- [x] Lưu vết đầy đủ `skillResults` vào cơ sở dữ liệu PostgreSQL.
- [x] Phát sự kiện `PlacementCompletedEvent` thành công.
- [x] Unit Test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Perfect Score**: Đúng 10/10 câu → Xếp loại B2, Reading 5/5 B2, Listening 5/5 B2.
2. **Intermediate Score**: Đúng 7/10 câu → Xếp loại B1 (tỷ lệ 70%).
3. **Low Score**: Đúng 2/10 câu → Xếp loại A1 (tỷ lệ 20%).

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
