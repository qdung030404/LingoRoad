# Request for Comments (RFC) - Assessment Status & Result Lookup Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế các endpoint truy vấn trạng thái và xem chi tiết kết quả bài kiểm tra đầu vào.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Assessment Status & Result (`docs/spec/features/05-placement-scoring-completion/02-placement-status-result/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Cung cấp API kiểm tra trạng thái cực nhanh để Client quyết định màn hình đích (Routing Guard) ngay sau khi đăng nhập.
- Truy vấn kết quả bài test an toàn, chống truy cập chéo giữa các người dùng.

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `GET /placement/status` < 50ms.
- Bảo vệ quyền sở hữu dữ liệu (Ownership Check).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Không bao gồm thống kê phân tích cấp độ toàn hệ thống của Admin.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──GET /placement/status (Bearer)──> PlacementController
                                               │
                                        [JwtAuthGuard]
                                               │
                                               ▼
                                     GetPlacementStatusUseCase
                                               │
                                  Query placement_sessions by userId
                                               │
                                               ▼
                               Return { hasCompleted, currentSessionId, ... }

Client ──GET /placement/{id}/result (Bearer)──> PlacementController
                                                     │
                                              [JwtAuthGuard]
                                                     │
                                                     ▼
                                           GetPlacementResultUseCase
                                                     │
                                   Verify session.userId === req.user.id
                                   Verify session.status === 'COMPLETED'
                                                     │
                                                     ▼
                                        Return PlacementResultDTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Phục vụ điều hướng cho Mobile App và Web.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Không cần thay đổi schema.

---

# 8. API Design (Thiết kế API)

### 1. `GET /placement/status`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "hasCompleted": true,
      "currentSessionId": "7e2a91f4-3d12-4c22-b5e8-8a9d12345678",
      "status": "COMPLETED",
      "currentIndex": 15,
      "totalItems": 15
    }
  }
  ```

### 2. `GET /placement/{sessionId}/result`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "7e2a91f4-3d12-4c22-b5e8-8a9d12345678",
      "status": "COMPLETED",
      "estimatedCefr": "B1",
      "correctCount": 12,
      "totalItems": 15,
      "confidenceScore": 0.88,
      "completedAt": "2026-10-06T09:00:00.000Z"
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu xem result của session chưa hoàn thành: Ném `BadRequestException('SESSION_NOT_COMPLETED')`.
- Nếu xem session của người khác: Ném `ForbiddenException('ACCESS_DENIED')`.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Luôn kiểm tra `session.userId === req.user.id`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Index `[userId, status]` cho phép truy vấn session nhanh chóng.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Đóng gói status vào UserProfile: Không linh hoạt bằng việc truy vấn session độc lập.

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Sẵn sàng.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test status khi user chưa làm bài.
  - Test status khi user đang làm dở bài.
  - Test status khi user đã hoàn thành.
  - Test result của session COMPLETED vs IN_PROGRESS.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượt gọi API status.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
