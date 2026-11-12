# Product Requirements Document (PRD) - 3-Mode Speaking Catalogue & Tongue Twister Game

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho hệ thống Danh mục Luyện nói 3 Chế độ (`READ_ALOUD` 9 đề bài, `TOPIC` 6 đề bài, `TONGUE_TWISTER` 12 màn chơi), cơ chế trò chơi phát âm câu xoắn lưỡi (`SpeakingGameProgress`) với mở khóa tuần tự, tính sao (`1–3 sao`), âm thanh mẫu bản xứ (`speaking-samples.json`) và lịch sử luyện nói (`GET /speaking/history`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Nếu chỉ có một danh sách câu đọc đơn điệu, người học dễ cảm thấy nhàm chán và không rèn luyện được đồng đều cả phát âm câu chuẩn, phản xạ nói theo chủ đề lẫn tốc độ phát âm phụ âm khó.
- Cần phân tách trải nghiệm luyện nói thành 3 chế độ rõ ràng (`READ_ALOUD`, `TOPIC`, `TONGUE_TWISTER`) kèm hệ thống gamification vượt màn tích lũy sao cho chế độ `TONGUE_TWISTER`.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Kho đề bài chuẩn hóa (27 Prompts)**:
  - `READ_ALOUD`: 9 đề bài phân theo độ khó 1–3 (A1, A2, B1), thời lượng tối đa 30s.
  - `TOPIC`: 6 chủ đề nói tự do kèm gợi ý triển khai ý (`hints`), thời lượng tối đa 60s.
  - `TONGUE_TWISTER`: 12 màn chơi câu xoắn lưỡi từ dễ đến khó, thời lượng tối đa 20s, có âm thanh giọng mẫu (`sampleAudioUrl`).
- **Cơ chế Game vượt màn**:
  - Ngưỡng sao: `≥ 60` điểm = 1 sao, `≥ 80` điểm = 2 sao, `≥ 90` điểm = 3 sao.
  - Điều kiện qua màn (`cleared`): Đạt từ 1 sao trở lên (`stars ≥ 1`) VÀ độ hoàn chỉnh câu `completeness ≥ 80`.
  - Mở khóa tuần tự: Hoàn thành màn trước mới mở khóa màn tiếp theo.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Bảng xếp hạng nhiều người chơi thời gian thực (Multiplayer PvP).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học muốn luyện phát âm đa chế độ và chinh phục thử thách câu xoắn lưỡi trên ứng dụng di động.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học mở trang Luyện nói (`SpeakingModesPage`), chọn 1 trong 3 chế độ: Đọc thành tiếng (`READ_ALOUD`), Nói theo chủ đề (`TOPIC`), hoặc Trò chơi Xoắn lưỡi (`TONGUE_TWISTER`).
2. Ở chế độ `READ_ALOUD` hoặc `TONGUE_TWISTER`, người học có thể bấm nghe giọng mẫu (`sampleAudioUrl`) trước khi ghi âm.
3. Ở chế độ `TONGUE_TWISTER`, ứng dụng gọi `GET /speaking/game/progress` hiển thị bản đồ 12 màn chơi với số sao đạt được (0–3 sao) và trạng thái khóa/mở (`unlocked`).
4. Sau khi đọc vượt qua một màn (`stars ≥ 1` và `completeness ≥ 80`), màn kế tiếp tự động mở khóa và kỷ lục cao nhất được lưu bền vững.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tự động khởi tạo dữ liệu gốc (`onModuleInit` trong `SpeakingService`) cho 27 đề bài (`PROMPT_CATALOGUE`) và ánh xạ tệp âm thanh mẫu từ `speaking-samples.json`.
- `GET /speaking/prompts?mode=READ_ALOUD|TOPIC|TONGUE_TWISTER`: Trả về danh sách đề bài theo chế độ.
- `GET /speaking/game/progress`: Trả về tiến độ 12 màn `TONGUE_TWISTER` gồm `stars`, `bestScore`, `cleared`, `unlocked`.
- `GET /speaking/history`: Phân trang lịch sử các lần nộp bài luyện nói theo cursor (`limit`, `cursor`).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Màn 1 (`sortOrder = 1`) của `TONGUE_TWISTER` luôn mở khóa mặc định (`unlocked = true`); màn thứ `k` (`k > 1`) chỉ mở khóa khi màn `k - 1` có `cleared === true`.
- Nếu người học cố tình gọi `POST /speaking/submissions` cho một màn `TONGUE_TWISTER` chưa mở khóa, Backend từ chối với lỗi `403 Forbidden` (`SPEAKING_LEVEL_LOCKED`).
- Khi cập nhật kỷ lục màn chơi (`SpeakingGameProgress`), hệ thống luôn giữ giá trị lớn nhất của `stars`, `bestScore` và `cleared` (không làm tụt sao nếu lần chơi sau điểm thấp hơn lần chơi trước).

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% cập nhật tiến độ game không bị mất kỷ lục khi có nhiều request đồng thời nhờ câu lệnh SQL nguyên tử `ON CONFLICT DO UPDATE ... GREATEST(...)`.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Đề bài thay đổi nội dung làm lệch kỷ lục cũ: Khóa chính của `SpeakingGameProgress` bao gồm cả `(userId, promptId, contentVersion)`.

---

# 11. Dependencies (Sự phụ thuộc)

- PostgreSQL (`PrismaService`), `speaking-samples.json` manifest.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
