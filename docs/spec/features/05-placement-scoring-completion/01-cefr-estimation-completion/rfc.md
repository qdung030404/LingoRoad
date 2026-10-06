# Request for Comments (RFC) - CEFR Estimation & Completion Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thuật toán tính điểm Cutoff Mapping, cơ chế cập nhật phiên làm việc và phát sự kiện `PlacementCompletedEvent`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD CEFR Estimation (`docs/spec/features/05-placement-scoring-completion/01-cefr-estimation-completion/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để ánh xạ tổng hợp 15 câu trả lời ở các mức độ khó khác nhau thành 1 cấp độ CEFR chuẩn hóa kèm điểm tin cậy?
- Kích hoạt tiến trình khởi tạo lộ trình học tập bất đồng bộ mà không làm chậm HTTP response.

---

# 3. Goals (Mục tiêu)

- Thời gian tính điểm và cập nhật database < 80ms.
- Sự kiện `PlacementCompletedEvent` được dispatch chuẩn qua NestJS EventEmitter.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Tạo cây tri thức Knowledge Graph (do Learning Path domain xử lý khi nghe sự kiện).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
SubmitAnswerUseCase (Final Item) ──> CefrScoringEngine (Domain Service)
                                            │
                           [Calculate weighted accuracy by CEFR]
                                            │
                                            ▼
                           { estimatedCefr: 'B1', confidence: 0.88 }
                                            │
                                            ▼
                               [PlacementSessionRepository]
                           UPDATE placement_sessions SET
                             status = 'COMPLETED',
                             estimated_cefr = 'B1',
                             confidence_score = 0.88,
                             completed_at = NOW()
                                            │
                                            ▼
                                     [EventEmitter2]
                      emit('placement.completed', new PlacementCompletedEvent(...))
                                            │
                                            ▼
                               Return Assessment Result DTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **Learning Path Domain**: Khởi tạo lộ trình học cá nhân hóa tương ứng với trình độ đầu vào.
- **Mastery Domain**: Thiết lập Initial Mastery Seeds cho các kỹ năng cốt lõi.
- **Gamification Domain**: Thưởng XP và Badge hoàn thành bài test đầu vào.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Sử dụng trường `estimated_cefr` và `confidence_score` trong bảng `placement_sessions`.

---

# 8. API Design (Thiết kế API)

- Tích hợp trực tiếp vào bước hoàn tất của `POST /placement/{sessionId}/answer` hoặc endpoint finalize.

---

# 9. Event Design (Thiết kế Sự kiện)

- **Event Name**: `placement.completed`
- **Payload**:
  ```typescript
  export class PlacementCompletedEvent {
    constructor(
      public readonly userId: string,
      public readonly sessionId: string,
      public readonly estimatedCefr: string,
      public readonly correctCount: number,
      public readonly totalItems: number,
      public readonly completedAt: Date,
    ) {}
  }
  ```

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu event dispatch lỗi, log ERROR nhưng vẫn đảm bảo session trong DB đã được lưu trạng thái `COMPLETED`.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Đảm bảo chỉ người sở hữu session mới có thể kích hoạt hoàn tất bài thi.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Thuật toán Cutoff Scoring tính toán in-memory trong < 1ms.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- **Lựa chọn A: Gọi API đồng bộ sang Learning Path Service**: Dễ gây timeout nếu Learning Path khởi tạo mất nhiều thời gian.
- **Lựa chọn B: Event-Driven Architecture qua EventEmitter2**: Tách rời hoàn toàn các phân hệ và tốc độ phản hồi tức thì (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có sẵn trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test thuật toán CefrScoringEngine với các ma trận kết quả khác nhau (all correct, mixed, all wrong).
  - Test phát sự kiện `PlacementCompletedEvent`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Đo lường phân bố cấp độ CEFR ước lượng của người dùng mới (tỷ lệ A1, A2, B1, B2).

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
