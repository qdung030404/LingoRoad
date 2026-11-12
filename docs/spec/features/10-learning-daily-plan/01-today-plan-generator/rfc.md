# Request for Comments (RFC) - Today's Study Plan Generator Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thuật toán tổng hợp kế hoạch học tập hàng ngày và cơ chế cache Redis phục vụ tải trang chủ cực nhanh.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Today's Study Plan (`docs/spec/features/10-learning-daily-plan/01-today-plan-generator/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để tổng hợp dữ liệu từ nhiều domain (Curriculum, FSRS, Gamification) vào 1 API duy nhất với độ trễ < 50ms?

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `GET /path/today` < 50ms.
- Cache kết quả trong Redis với TTL 10 phút hoặc tự động invalidate khi có bài học hoàn thành.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Xây dựng mô hình AI dự báo dài hạn (chỉ lập kế hoạch cho ngày hiện tại).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──GET /path/today (Bearer)──> PathController
                                         │
                                  [JwtAuthGuard]
                                         │
                                         ▼
                                GetTodayPlanUseCase
                                         │
                               (Check Redis Cache)
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼ (Cache Hit)                                   ▼ (Cache Miss)
           Return Cached DTO                           [Parallel Queries]
                                                       ├── 1. Get Next Unlocked Lesson
                                                       ├── 2. Get FSRS Due Count
                                                       └── 3. Get User Profile Goals & Completed Today
                                                                 │
                                                                 ▼
                                                       Aggregate & Store in Redis
                                                                 │
                                                                 ▼
                                                         Return TodayPlanDTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Tích hợp với FSRS Domain và UserProfile.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Không cần thay đổi schema.

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `GET /path/today`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "targetCefr": "B1",
      "dailyGoalMinutes": 15,
      "completedTodayCount": 1,
      "recommendedLesson": {
        "id": "b2c3d4e5-1111-2222-3333-444455556666",
        "title": "Present Continuous for Future Arrangements",
        "skillName": "Future Forms",
        "estimatedMinutes": 8,
        "isLocked": false
      },
      "dueReviewsCount": 8
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Listener: Khi có `lesson.completed` hoặc `fsrs_card.reviewed`, xóa cache `today_plan:{userId}`.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu FSRS domain tạm thời không phản hồi: Fallback trả về `dueReviewsCount: 0`.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Chỉ trả về kế hoạch của user trong JWT.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Sử dụng `Promise.all` để chạy song song các truy vấn độc lập.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Tính toán sẵn qua Cron Job nửa đêm: Không cập nhật kịp thời khi người học đổi mục tiêu học. Tính toán on-demand kết hợp cache là tối ưu (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Sẵn sàng.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test trả về đúng bài học tiếp theo và số thẻ ôn tập.
  - Test fallback khi không còn bài học mới.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi tỷ lệ Cache Hit/Miss của `GET /path/today`.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
