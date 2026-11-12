# Request for Comments (RFC) - CEFR Estimation & Placement Completion Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc chấm điểm hoàn tất bài kiểm tra đầu vào, cấu trúc dữ liệu `skillResults`, dịch vụ chấm điểm CEFR và thiết kế sự kiện domain trong phân hệ Placement Assessment.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD CEFR Estimation & Placement Completion (`docs/spec/features/05-placement-scoring-completion/01-cefr-estimation-completion/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Tính toán cấp độ CEFR từ dữ liệu phản hồi 10 câu hỏi (5 Đọc + 5 Nghe), bóc tách thành tích theo từng phân môn.
- Cập nhật phiên sang `COMPLETED` bằng transaction an toàn và phát sự kiện `PlacementCompletedEvent` cho các hệ thống phụ thuộc.

---

# 3. Goals (Mục tiêu)

- Thời gian xử lý hoàn tất bài thi < 100ms.
- Đảm bảo tính nhất quán dữ liệu giữa kết quả phiên làm bài và sự kiện domain.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Tự động thay đổi bài thi đã hoàn thành.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
PlacementController / DemoPlacementService
                 │
                 ▼
       Complete Session Flow
                 │
   ┌─────────────┴─────────────┐
   ▼                           ▼
Calculate Provisional CEFR    Build skillResults JSON
(Reading + Listening stats)   (reading, listening, speaking, writing)
   │                           │
   └─────────────┬─────────────┘
                 ▼
   Prisma Transaction:
   - UPDATE placement_sessions:
       status = 'COMPLETED'
       completedAt = now()
       estimatedCefr = overallCefr
       skillResults = payload
   - Emit Event:
       placementCompletedEvent(userId, sessionId, estimatedCefr, ...)
                 ▼
   Return Completion Payload
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **Planning Domain**: Nhận sự kiện hoặc đọc `skillResults` từ phiên kiểm tra đầu vào để ưu tiên kỹ năng yếu hơn (giữa Đọc và Nghe) khi lập kế hoạch ngày (`chooseDailyItems`).

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Sử dụng trường `skillResults` kiểu JSONB trong bảng `placement_sessions`:
```json
{
  "reading": {
    "estimatedCefr": "B1",
    "correctCount": 4,
    "totalItems": 5,
    "status": "PROVISIONAL"
  },
  "listening": {
    "estimatedCefr": "A2",
    "correctCount": 2,
    "totalItems": 5,
    "status": "PROVISIONAL"
  },
  "speaking": {
    "estimatedCefr": null,
    "correctCount": null,
    "totalItems": null,
    "status": "NOT_ASSESSED"
  },
  "writing": {
    "estimatedCefr": null,
    "correctCount": null,
    "totalItems": null,
    "status": "NOT_ASSESSED"
  }
}
```

---

# 8. Event Design (Thiết kế Sự kiện)

Class sự kiện `PlacementCompletedEvent` tại `apps/backend/src/modules/placement/events/placement-completed.event.ts`:
```typescript
export class PlacementCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly estimatedCefr: CefrLevel,
    public readonly confidenceScore: number | null,
    public readonly correctCount: number,
    public readonly totalItems: number,
  ) {}
}
```

---

# 9. Algorithm Details (Chi tiết Thuật toán)

### Thuật toán Provisional CEFR (`provisionalCefr`):
- Tỷ lệ đúng = `correctCount / totalItems`
- Ngưỡng xếp loại:
  - Tỷ lệ đúng ≥ 0.85: `B2`
  - Tỷ lệ đúng ≥ 0.65: `B1`
  - Tỷ lệ đúng ≥ 0.40: `A2`
  - Tỷ lệ đúng < 0.40: `A1`

---

# 10. Failure Handling (Xử lý Sự cố)

- Đảm bảo transaction ghi cơ sở dữ liệu thành công trước khi phát sự kiện domain. Nếu transaction thất bại, sự kiện không được phát.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Quyền sửa đổi phiên chỉ thuộc về server; client không thể gửi kết quả điểm số hay tự ý sửa `estimatedCefr`.

# End
