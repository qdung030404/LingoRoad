# Feature Specification: AI Writing Evaluator & Grammar Feedback

## Mission (Sứ mệnh)

Đặc tả hành vi chi tiết của API đánh giá bài viết và sửa lỗi ngữ pháp câu (`POST /llm/awe`) trong phân hệ AI Writing Evaluator.

---

# 1. Feature Overview (Tổng quan Tính năng)

- Dịch vụ AI nhận diện lỗi ngữ pháp và diễn đạt trong bài viết của học viên.
- Trả về danh sách câu lỗi kèm lời giải thích nguyên nhân và câu sửa mẫu bằng tiếng Việt.

---

# 2. User Stories (Câu chuyện Người dùng)

Là một người học tiếng Anh,  
Tôi muốn nhập một câu hoặc đoạn văn ngắn và nhận phản hồi chi tiết về các lỗi ngữ pháp đã mắc phải,  
Để tôi có thể kịp thời sửa chữa và viết tiếng Anh tự nhiên hơn.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Client hoặc Backend gọi `POST /llm/awe` kèm `prompt` và `essay`.
2. Tầng validation kiểm tra:
   - `prompt` là chuỗi văn bản không vượt quá 2,000 ký tự.
   - `essay` là chuỗi văn bản không vượt quá 8,000 ký tự.
3. Dịch vụ AI gọi LLM với `SYSTEM_AWE`, `temperature = 0.2` và `response_format = {"type": "json_object"}`.
4. Parse phản hồi qua Pydantic `AweResponse`:
   - Nếu có câu lỗi: Danh sách `feedback` chứa các đối tượng `{ sentence, issue, suggestion }`.
   - Nếu bài viết hoàn hảo không có lỗi: `feedback` trả về mảng rỗng `[]`, `overall_vi` khen ngợi học viên.
5. Trả về kết quả JSON cho client với mã HTTP 200 trong vòng < 2.5 giây.

---

# 4. State Machine (Sơ đồ Trạng thái)

Dịch vụ hoạt động hoàn toàn phi trạng thái (Stateless request-response).

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Phản hồi giải thích (`issue`) và nhận xét tổng kết (`overall_vi`) bắt buộc phải bằng tiếng Việt.
- Câu gợi ý sửa (`suggestion`) phải tự nhiên, giữ nguyên ý đồ của người học nhưng chuẩn hóa ngữ pháp tiếng Anh.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- **Bài viết không có lỗi nào**: `feedback: []`, `overall_vi` ghi nhận bài viết chính xác và khích lệ học viên.
- **Bài viết quá ngắn hoặc chứa ký tự vô nghĩa**: LLM đưa ra nhận xét yêu cầu học viên viết câu hoàn chỉnh trong `overall_vi`.

---

# 7. API Requirements (Yêu cầu API)

- **Endpoint**: `POST /llm/awe`
- **Request Body**:
  ```json
  {
    "prompt": "string",
    "essay": "string"
  }
  ```
- **Response**:
  ```json
  {
    "feedback": [
      {
        "sentence": "string",
        "issue": "string",
        "suggestion": "string"
      }
    ],
    "overall_vi": "string"
  }
  ```

---

# 8. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] API `POST /llm/awe` phân tích thành công bài viết và trả về đúng schema JSON.
- [x] Phát hiện chính xác lỗi ngữ pháp câu và cung cấp câu gợi ý thay thế.
- [x] Lời giải thích và nhận xét được viết bằng tiếng Việt rõ ràng.
- [x] Tích hợp thành công với `MlClientService.evaluateWriting` trong NestJS Backend.
- [x] Unit test kiểm thử prompt và output parser pass 100%.

# End
