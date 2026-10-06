# Request for Comments (RFC) - AI Speaking Evaluator Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế API multipart upload, cơ chế xác thực MIME tệp âm thanh, tích hợp với ML Microservice và quy trình dọn dẹp file tạm Zero-Retention.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD AI Speaking Evaluator (`docs/spec/features/16-ai-speaking-evaluator/01-audio-upload-pronunciation-scoring/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để xử lý file âm thanh ghi âm từ thiết bị di động an toàn, không bị tấn công upload mã độc (MIME Spoofing) và giao tiếp nhanh chóng với ML Service?

---

# 3. Goals (Mục tiêu)

- Xác thực chặt chẽ kích thước file $\le 10\text{ MB}$ và MIME type `audio/*`.
- File ghi âm được xử lý trong Memory Buffer hoặc Temp File và xóa ngay lập tức trong block `finally`.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Tự host mô hình ML trong process NestJS (gọi qua Python ML Service).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /speaking/attempts (multipart: audio, referenceText, itemId)──> SpeakingController
                                                                                   │
                                                                       [Multer File Interceptor]
                                                                       - Limit: 10MB
                                                                       - MIME: audio/wav, audio/m4a, audio/mp3
                                                                                   │
                                                                                   ▼
                                                                       EvaluateSpeakingUseCase
                                                                                   │
                                                                       [MlServiceGateway (Axios/HTTP)]
                                                                       POST /evaluate-pronunciation
                                                                                   │
                                                                                   ▼
                                                                        [ML Service: Whisper/Wav2Vec2]
                                                                       Return { overall, accuracy, fluency, phonemes }
                                                                                   │
                                                                                   ▼
                                                                        [Finally: Purge Temp Buffer]
                                                                                   │
                                                                                   ▼
                                                                       [SpeakingAttemptRepository]
                                                                       INSERT INTO speaking_attempts
                                                                                   │
                                                                                   ▼
                                                                       Return EvaluationResultDTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Ghi dữ liệu vào `speaking_attempts`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
model SpeakingAttempt {
  id                String   @id @default(uuid()) @db.Uuid
  userId            String   @map("user_id") @db.Uuid
  itemId            String?  @map("item_id") @db.Uuid
  referenceText     String   @map("reference_text") @db.Text
  overallScore      Float    @map("overall_score")
  accuracyScore     Float    @map("accuracy_score")
  fluencyScore      Float    @map("fluency_score")
  completenessScore Float    @map("completeness_score")
  phonemeDetails    Json     @map("phoneme_details") @db.JsonB
  createdAt         DateTime @default(now()) @map("created_at")

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  item              Item?    @relation(fields: [itemId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@map("speaking_attempts")
}
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `POST /speaking/attempts`
- **Headers**: `Authorization: Bearer <accessToken>`, `Content-Type: multipart/form-data`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "overallScore": 86.5,
      "accuracyScore": 90.0,
      "fluencyScore": 82.0,
      "completenessScore": 100.0,
      "phonemeFeedback": [
        {
          "word": "coffee",
          "accuracyScore": 95.0,
          "errorType": "None"
        }
      ]
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu ML Service timeout (> 5 giây): Trả về lỗi `504 Gateway Timeout` ("Dịch vụ chấm điểm đang bận, vui lòng thử lại sau").

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Kiểm tra file extension và magic bytes để đảm bảo file là âm thanh hợp lệ.
- File tạm xóa ngay sau khi request kết thúc.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Sử dụng Memory Storage Buffer của Multer cho file dung lượng nhỏ dưới 5MB để tránh ghi đĩa I/O.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Lưu file vào S3 trước rồi mới chấm: Chậm và vi phạm chính sách Zero-Retention (Bị loại bỏ).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test validate file size > 10MB -> Báo lỗi 400.
  - Test mock ML Service trả về kết quả -> Lưu đúng vào database.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi độ trễ p95 của ML Service Gateway.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
