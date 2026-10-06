# Request for Comments (RFC) - AI Learning Advisor Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế API, cơ chế tổng hợp dữ liệu điểm yếu (Weakness Synthesizer) và tích hợp LLM Prompting để tạo lời khuyên học tập.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD AI Learning Advisor (`docs/spec/features/18-ai-learning-advisor/01-ai-advisor-insights/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để trích xuất nhanh chóng các điểm yếu cốt lõi của người học và gửi ngữ cảnh ngắn gọn nhất tới LLM nhằm tối ưu tốc độ phản hồi và chi phí token?

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `POST /path/advisor` < 2.0 giây.
- Token prompt đầu vào < 500 tokens.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Lưu toàn bộ lịch sử chat nhiều lượt.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /path/advisor (Bearer)──> PathAdvisorController
                                             │
                                      [JwtAuthGuard]
                                             │
                                             ▼
                                    GetAiAdvisorInsightUseCase
                                             │
                                [WeaknessSynthesizerService]
                                ├── 1. Query Top 3 lowest mastery skills
                                └── 2. Query Next uncompleted lesson for that skill
                                             │
                                             ▼
                                    [LlmGatewayService]
                                (Generate short encouraging advice)
                                             │
                                             ▼
                                    Return AdvisorInsightDTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Đọc dữ liệu từ Mastery và Curriculum để đưa ra gợi ý.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Không bắt buộc tạo bảng mới; có thể lưu cache lời khuyên trong Redis 1 giờ.

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `POST /path/advisor`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "adviceMarkdown": "Bạn đang làm rất tốt ở phần Từ vựng A2, nhưng thường gặp lỗi ở **Thì Hiện tại Hoàn thành**. Hãy dành 10 phút hôm nay để làm bài tập củng cố nhé!",
      "suggestedLessonId": "b2c3d4e5-1111-2222-3333-444455556666"
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu LLM không phản hồi: Fallback sử dụng template câu lời khuyên tĩnh ("Hãy tiếp tục duy trì việc học hàng ngày để nâng cao phản xạ tiếng Anh!").

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Không gửi thông tin PII của người dùng tới LLM, chỉ gửi tên kỹ năng và điểm số.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Cache kết quả advisor trong Redis 60 phút để tránh spam request liên tục.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Dùng câu template cứng: Kém hấp dẫn và thiếu tính cá nhân hóa (Bị loại bỏ).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Sẵn sàng.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test trích xuất đúng kỹ năng yếu nhất.
  - Test fallback template khi LLM lỗi.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi tỷ lệ phản hồi thành công của AI Advisor.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
