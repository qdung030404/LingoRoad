# Task: Implement AI Learning Advisor Endpoint & Insights Generator

## Mission (Sứ mệnh)

Xây dựng endpoint `POST /path/advisor`, UseCase tổng hợp điểm yếu từ Mastery Graph và tích hợp LLM để tạo lời khuyên học tập cá nhân hóa.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Trợ lý Học tập AI (`POST /path/advisor`) và Tổng hợp Lời khuyên Năng lực

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/18-ai-learning-advisor/01-ai-advisor-insights/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/18-ai-learning-advisor/01-ai-advisor-insights/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/18-ai-learning-advisor/01-ai-advisor-insights/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `WeaknessSynthesizerService` tìm kiếm kỹ năng yếu nhất của user.
- Xây dựng `GetAiAdvisorInsightUseCase` gọi LLM để sinh lời khuyên.
- Đăng ký endpoint trong `PathAdvisorController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- UseCase, Service tổng hợp điểm yếu.
- Tích hợp LLM sinh lời khuyên.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Chatbot hội thoại tự do.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/ai-tutoring/controllers/path-advisor.controller.ts`
  - `src/modules/ai-tutoring/use-cases/get-ai-advisor-insight.use-case.ts`
  - `src/modules/ai-tutoring/services/weakness-synthesizer.service.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`, LLM Client.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `POST /path/advisor` trả về lời khuyên Markdown và ID bài học gợi ý (HTTP 200).
- [ ] Fallback hoạt động khi LLM timeout.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Get Advisor Valid**: User có kỹ năng yếu -> Trả về lời khuyên liên quan đến kỹ năng đó.
2. **LLM Error Fallback**: LLM fail -> Trả về câu khích lệ mặc định.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low) / Trung bình (Medium)
- **Thời gian ước tính**: 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
