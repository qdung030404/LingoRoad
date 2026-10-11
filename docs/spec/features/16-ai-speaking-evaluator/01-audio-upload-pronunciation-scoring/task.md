# Task: Implement Speaking Evaluation Endpoint & ML Service Gateway

## Mission (Sứ mệnh)

Xây dựng endpoint `POST /speaking/attempts`, cấu hình Multer kiểm tra file âm thanh, tích hợp `MlServiceGateway` gọi ML Microservice và lưu kết quả đánh giá phát âm.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Chấm điểm Phát âm Luyện nói (`POST /speaking/attempts`) và ML Gateway

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/01-audio-upload-pronunciation-scoring/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/01-audio-upload-pronunciation-scoring/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/01-audio-upload-pronunciation-scoring/spec.md)

---

# 3. Description (Mô tả)

- Cấu hình Multer file upload interceptor với memory storage và size/type validation.
- Xây dựng `MlServiceGateway` kết nối tới Speech ML Service qua HTTP.
- Xây dựng `EvaluateSpeakingUseCase` thực hiện điều phối và lưu `SpeakingAttempt`.
- Đăng ký endpoint trong `SpeakingController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Multipart upload và validation.
- Tích hợp HTTP ML Gateway.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Triển khai mô hình AI Python (chỉ giao tiếp qua API contract).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/ai-tutoring/controllers/speaking.controller.ts`
  - `src/modules/ai-tutoring/use-cases/evaluate-speaking.use-case.ts`
  - `src/modules/ml/ml-client.service.ts` (đã có sẵn `scoreSpeaking`)
  - `src/modules/ai-tutoring/repositories/speaking-attempt.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `@nestjs/platform-express`, `multer`, `MlModule` (`MlClientService`), `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Upload file audio hợp lệ nhận được điểm số chi tiết (HTTP 200).
- [ ] Chặn file không phải audio hoặc quá 10MB (HTTP 400).
- [ ] Bảng `speaking_attempts` ghi nhận kết quả.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Valid Audio Upload**: Gửi file WAV hợp lệ -> Nhận điểm overall, accuracy, fluency.
2. **Invalid File Type**: Gửi file PDF -> Báo lỗi 400 Bad Request.
3. **ML Service Timeout**: ML gateway trả về timeout -> Xử lý fallback sạch.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
