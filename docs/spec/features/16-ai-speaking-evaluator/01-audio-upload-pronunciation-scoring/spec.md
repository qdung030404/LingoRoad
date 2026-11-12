# Feature Specification: Read-Aloud Pronunciation Scoring & WAV Validation

## Mission (Sứ mệnh)

Đặc tả chi tiết luồng tạo phiên nộp bài nói, xác thực tệp âm thanh 16kHz mono PCM WAV, công thức tính điểm trọng số `lingoroad-weighted-v1` và phản hồi âm vị IPA.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học ghi âm bài đọc tiếng Anh (`READ_ALOUD` và `TONGUE_TWISTER`) trên ứng dụng di động, tải lên Backend để xác thực tín hiệu WAV và chấm điểm phát âm chi tiết qua Azure Speech SDK (`POST /speech/read-aloud/score`).

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh muốn cải thiện phát âm.
- **Tôi muốn**: Đọc to câu tiếng Anh mẫu và nhận được điểm số chính xác cho từng từ và từng âm vị IPA.
- **Để tôi có thể**: Biết rõ mình phát âm sai ở âm nào và luyện đọc lại cho đến khi chuẩn xác.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Client gọi `POST /speaking/submissions` với `{ promptId, clientRequestId }`.
2. Backend tạo bản ghi `SpeakingSubmission` ở trạng thái `CREATED` kèm `promptSnapshot` (bản chụp bất biến của đề bài tại thời điểm tạo).
3. Client thu âm giọng nói ở định dạng 16kHz, 16-bit, mono PCM WAV và gửi qua `PUT /speaking/submissions/:id/audio`.
4. Backend:
   - Chạy `validateMono16kPcmWav(buffer, maxDurationSeconds)`: Kiểm tra RIFF/WAVE header, thời lượng `1.5s ≤ duration ≤ maxDurationSeconds + 1s`, và năng lượng `RMS ≥ 10`.
   - Tính mã băm SHA-256 `audioHash`. Nếu submission đã `SUCCEEDED` với cùng `audioHash` thì trả về ngay kết quả cũ.
   - Chuyển trạng thái sang `PROCESSING`, gửi WAV sang FastAPI `POST /speech/read-aloud/score`.
   - Nhận kết quả từ Azure Pronunciation Assessment (`Phoneme` granularity, `IPA` alphabet, `EnableProsodyAssessment`), lưu vào `SpeakingSubmission.result` với trạng thái `SUCCEEDED`.
5. Client hiển thị điểm tổng quan, 4 chỉ số thành phần và tô màu từng từ kèm chi tiết âm vị IPA.

---

# 4. State Machine (Sơ đồ Trạng thái `SpeakingSubmission`)

```
[CREATED] ──(PUT /audio hợp lệ)──> [PROCESSING] ──(Chấm thành công)──> [SUCCEEDED]
                                         │
                                         ├──(Không có tiếng nói / Lỗi)─> [FAILED]
                                         └──(Timeout > 18s / Stale)────> [UNKNOWN]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- **Chuẩn WAV bắt buộc**: PCM (`format = 1`), Mono (`channels = 1`), Sample Rate `16,000 Hz`, Bits Per Sample `16`, kích thước `≤ 2 MiB`.
- **Công thức điểm tổng (`lingoroad-weighted-v1`)**:
  `overall = round((40 × Accuracy + 25 × Fluency + 25 × Prosody + 10 × Completeness) ÷ 100)`
- Không cho phép ghi đè một `SpeakingSubmission` bằng một bản ghi âm khác (`audioHash` khác với `audioHash` đã gắn trước đó → lỗi `409 Conflict` `SPEAKING_SUBMISSION_IMMUTABLE`).

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người học bấm ghi âm nhưng không nói gì (`RMS < 10`): Hệ thống từ chối ngay tại bước kiểm tra WAV với mã `422 SPEAKING_NO_SPEECH`.
- Người học đọc hoàn toàn lạc đề (`completeness === 0` và mọi từ đều `Omission`): Hệ thống trả về `422 SPEAKING_NO_SPEECH`.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Màn hình luyện đọc hiển thị văn bản mẫu, phiên âm/gợi ý (`hints`) và nút nghe giọng đọc mẫu (`sampleAudioUrl`).
- Sau khi chấm điểm: Hiển thị vòng tròn điểm `overallScore`, 4 thanh chỉ số (`Accuracy`, `Fluency`, `Prosody`, `Completeness`) và danh sách từ tô màu theo độ chính xác; bấm vào từng từ mở hộp thoại xem điểm từng âm vị IPA.

---

# 8. API Requirements (Yêu cầu API)

- `POST /speaking/submissions` → `200 OK`
- `PUT /speaking/submissions/:id/audio` → `200 OK`
- `GET /speaking/submissions/:id` → `200 OK`
- FastAPI: `POST /speech/read-aloud/score` & `POST /speech/score` → `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Xác thực chính xác định dạng 16kHz 16-bit mono PCM WAV ≤ 2 MiB và RMS ≥ 10.
- [x] Chấm điểm `READ_ALOUD` qua Azure Speech SDK trả về đầy đủ điểm từ, lỗi ngắt nghỉ và âm vị IPA.
- [x] Tính đúng công thức `lingoroad-weighted-v1`.
- [x] Đảm bảo tính bất biến và Idempotency theo `clientRequestId` và `audioHash`.

# End
