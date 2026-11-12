# Request for Comments (RFC) - Mastery Overview & Radar Vector Analytics Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế API và thuật toán tổng hợp Vector năng lực theo từng nhóm kỹ năng ngôn ngữ cho biểu đồ Radar.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Mastery Overview (`docs/spec/features/13-knowledge-mastery-analytics/01-mastery-overview-radar/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để gom nhóm và tính toán tỷ lệ Mastery cho từng danh mục (`SkillCategory`) trong thời gian thực với chi phí truy vấn SQL thấp nhất?

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `GET /mastery` < 50ms.
- Truy vấn aggregate nhanh gọn bằng Prisma SQL Group By hoặc in-memory aggregation.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Không bao gồm dự báo xu hướng năng lực trong tương lai bằng AI.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──GET /mastery (Bearer)──> MasteryController
                                       │
                                [JwtAuthGuard]
                                       │
                                       ▼
                             GetMasteryOverviewUseCase
                                       │
                          [UserSkillMasteryRepository]
                     (Join skills + user_skill_masteries for userId)
                                       │
                                       ▼
                       Aggregate Vector & Status Counts:
                       - GRAMMAR: avg(masteryScore)
                       - VOCABULARY: avg(masteryScore)
                       - READING: avg(masteryScore)
                       - LISTENING: avg(masteryScore)
                       - Count by status: NOVICE, PRACTICING, MASTERED
                                       │
                                       ▼
                              Return MasteryOverviewDTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp số liệu cho giao diện Mobile Profile và Admin Analytics.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Không cần thay đổi schema.

---

# 8. API Design (Thiết kế API)

### 1. `GET /mastery`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "overallMasteryPercentage": 68.5,
      "totalMasteredSkills": 24,
      "totalPracticingSkills": 8,
      "totalNoviceSkills": 3,
      "categoryBreakdown": {
        "GRAMMAR": 0.72,
        "VOCABULARY": 0.65,
        "READING": 0.70,
        "LISTENING": 0.60
      }
    }
  }
  ```

### 2. `GET /mastery/skills`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "skillId": "a1b2c3d4-0001-0000-0000-000000000001",
        "skillName": "Present Simple Tense",
        "category": "GRAMMAR",
        "masteryScore": 0.88,
        "status": "MASTERED",
        "lastPracticedAt": "2026-10-05T14:20:00.000Z"
      }
    ]
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu người học chưa có bản ghi Mastery nào: Trả về các danh mục với điểm mặc định 0.10 (10%).

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Chỉ trả về dữ liệu của `req.user.id`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Index `[userId, status]` và `[userId, skillId]` tối ưu hóa câu lệnh join.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Lưu sẵn điểm trung bình vào bảng `user_profiles`: Phải viết logic recalculate phức tạp trên mỗi câu trả lời. Tính toán on-the-fly là phương án sạch và luôn nhất quán (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Sẵn sàng.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test aggregate khi có nhiều kỹ năng thuộc các categories khác nhau.
  - Test khi user mới chưa có kỹ năng nào.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượt gọi API Mastery Overview.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
