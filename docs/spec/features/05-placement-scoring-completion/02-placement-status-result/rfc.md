# Request for Comments (RFC) - Assessment Status & Result Lookup Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thiết kế API tra cứu trạng thái kiểm tra đầu vào, truy vấn bảng điểm kết quả tổng hợp và xem lại chi tiết bài làm trong phân hệ Placement Assessment.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Assessment Status & Result Lookup (`docs/spec/features/05-placement-scoring-completion/02-placement-status-result/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Cung cấp API kiểm tra trạng thái cực nhanh để client quyết định luồng điều hướng ngay khi khởi động.
- Trả về bảng điểm chi tiết 4 kỹ năng (`skills`) và phân định rõ ràng các trường dữ liệu được phép xem trước và sau khi hoàn tất bài thi.

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `GET /placement/status` < 50ms.
- Bảo vệ dữ liệu kết quả: Chỉ cho phép đọc kết quả khi phiên đã `COMPLETED`.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Tự động thay đổi bài thi từ các endpoint tra cứu.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──GET /placement/status──> PlacementController ──> DemoPlacementService.status()
                                                                 │
                                                       Query PlacementSession
                                                                 │
                                                       Return status DTO

Client ──GET /placement/:id/result──> PlacementController ──> DemoPlacementService.result()
                                                                 │
                                                       Check ownership & COMPLETED
                                                                 │
                                                       Return Result & skills JSON

Client ──GET /placement/:id/review──> PlacementController ──> DemoPlacementService.review()
                                                                 │
                                                       Check status COMPLETED
                                                                 │
                                                       Return items with explanation
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **Mobile Client**: Điều hướng luồng người dùng (`WelcomePage` → `PlacementHome` vs `HomeDashboard`).

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Không thêm bảng mới; sử dụng các trường `skillResults`, `estimatedCefr`, `correctCount`, `totalItems` trong `placement_sessions`.

---

# 8. API Design (Thiết kế API)

### 8.1. Status Endpoint
- **Endpoint**: `GET /placement/status`
- **Headers**: `Authorization: Bearer <token>`
- **Response (Chưa có phiên)**:
  ```json
  {
    "success": true,
    "data": {
      "hasCompleted": false,
      "currentSessionId": null,
      "status": null,
      "currentIndex": 0,
      "totalItems": 10
    }
  }
  ```
- **Response (Đang làm dở)**:
  ```json
  {
    "success": true,
    "data": {
      "hasCompleted": false,
      "currentSessionId": "b47e32a6-2184-4869-9f44-8cb3123c52a1",
      "status": "IN_PROGRESS",
      "currentIndex": 4,
      "totalItems": 10
    }
  }
  ```

### 8.2. Result Endpoint
- **Endpoint**: `GET /placement/:sessionId/result`
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "b47e32a6-2184-4869-9f44-8cb3123c52a1",
      "status": "COMPLETED",
      "totalItems": 10,
      "correctCount": 7,
      "estimatedCefr": "B1",
      "confidenceScore": null,
      "completionRate": 1,
      "resultStatus": "PROVISIONAL",
      "scoringMethod": "PROVISIONAL_RATIO_V1",
      "completedAt": "2026-11-12T10:15:30.000Z",
      "skills": {
        "reading": {
          "estimatedCefr": "B1",
          "correctCount": 4,
          "totalItems": 5,
          "status": "PROVISIONAL"
        },
        "listening": {
          "estimatedCefr": "A2",
          "correctCount": 3,
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
    }
  }
  ```

### 8.3. Review Endpoint
- **Endpoint**: `GET /placement/:sessionId/review`
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "b47e32a6-2184-4869-9f44-8cb3123c52a1",
      "status": "COMPLETED",
      "items": [
        {
          "id": "item-uuid-1",
          "index": 0,
          "prompt": "Read the passage...",
          "options": ["A", "B", "C", "D"],
          "selectedOption": "A",
          "isCorrect": true,
          "correctOption": "A",
          "explanation": "Because Anna is stated as a student in Hanoi."
        }
      ]
    }
  }
  ```

---

# 9. Failure Handling (Xử lý Sự cố)

- Chưa hoàn tất phiên mà gọi `result`: Ném `400 Bad Request` (`PLACEMENT_NOT_COMPLETED`).
- Truy cập phiên của người khác: Ném `404 PLACEMENT_NOT_FOUND` hoặc `403 PLACEMENT_FORBIDDEN`.

# End
