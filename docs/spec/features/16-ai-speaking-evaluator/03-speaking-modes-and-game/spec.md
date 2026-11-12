# Feature Specification: 3-Mode Speaking Catalogue & Tongue Twister Game

## Mission (Sứ mệnh)

Đặc tả chi tiết 3 chế độ luyện nói (`READ_ALOUD`, `TOPIC`, `TONGUE_TWISTER`), quy tắc tính sao và mở khóa màn chơi tuần tự, quản lý file âm thanh mẫu và giao diện `SpeakingModesPage` trên ứng dụng Mobile.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp hệ thống luyện nói đa chế độ gồm 27 đề bài chuẩn hóa (`9 READ_ALOUD`, `6 TOPIC`, `12 TONGUE_TWISTER`), hỗ trợ nghe giọng mẫu bản xứ, lưu lịch sử luyện tập có phân trang cursor và chế độ trò chơi vượt màn tích lũy sao cho `TONGUE_TWISTER`.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Lựa chọn giữa đọc đoạn văn chuẩn âm, nói tự do theo chủ đề hoặc chơi thử thách câu xoắn lưỡi mở khóa từng màn.
- **Để tôi có thể**: Rèn luyện phát âm toàn diện với cảm giác hứng thú như chơi game.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. **Danh mục 3 Chế độ (`PROMPT_CATALOGUE`)**:
   - `READ_ALOUD`: 9 đề bài (3 câu A1, 3 câu A2, 3 đoạn ngắn B1), `maxDurationSeconds = 30`.
   - `TOPIC`: 6 chủ đề nói tự do (Daily Routine, Memorable Trip, Technology in Learning, Favorite Place, Healthy Habits, Future Goals), `maxDurationSeconds = 60`, kèm 3 gợi ý (`hints`) cho mỗi chủ đề.
   - `TONGUE_TWISTER`: 12 câu xoắn lưỡi sắp xếp theo độ khó tăng dần (`sortOrder: 1 → 12`), `maxDurationSeconds = 20`, kèm mẹo phát âm tiếng Việt trong `hints`.
2. **Quy tắc Tính Sao & Mở khóa Màn chơi (`TONGUE_TWISTER`)**:
   - Số sao (`stars`):
     - `overallScore ≥ 90` → `3 sao`
     - `80 ≤ overallScore < 90` → `2 sao`
     - `60 ≤ overallScore < 80` → `1 sao`
     - `overallScore < 60` → `0 sao`
   - Qua màn (`cleared`): `stars ≥ 1` VÀ `completenessScore ≥ 80`.
   - Mở khóa (`unlocked`): Màn 1 luôn mở; màn `N` (`N ≥ 2`) mở khi màn `N - 1` có `cleared = true`.
3. **Âm thanh Giọng mẫu (`speaking-samples.json`)**:
   - Khi khởi động, `SpeakingService` đối chiếu mã băm SHA-256 của văn bản đề bài với manifest `assets/speaking-samples/speaking-samples.json`. Nếu khớp và file tồn tại, trả về đường dẫn `sampleAudioUrl = '/speaking/samples/<file>'`.

---

# 4. State Machine (Sơ đồ Trạng thái Màn chơi `TONGUE_TWISTER`)

```
[LOCKED (Màn trước chưa cleared)]
       │
       ▼ (Màn trước đạt stars >= 1 && completeness >= 80)
[UNLOCKED (cleared = false, stars = 0)]
       │
       ▼ (Nộp bài đạt overall >= 60 && completeness >= 80)
[CLEARED (cleared = true, stars = 1..3, mở khóa màn kế tiếp)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Kỷ lục `stars` và `bestScore` chỉ tăng chứ không bao giờ giảm (`GREATEST`).
- Trạng thái `cleared` một khi đã đạt `true` sẽ luôn giữ là `true` (`cleared OR EXCLUDED.cleared`).

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người học phát âm rất chuẩn vài từ đầu (`overallScore = 65` → 1 sao) nhưng bỏ đọc nửa câu sau (`completenessScore = 50 < 80`): Hệ thống vẫn ghi nhận `stars = 1`, `bestScore = 65` nhưng `cleared = false` (chưa mở khóa màn tiếp theo).

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Màn hình `SpeakingModesPage` và `SpeakingPracticePage` điều phối bởi `SpeakingController` trên Flutter:
  - Cho phép chuyển đổi mượt mà giữa các chế độ luyện nói, hiển thị danh sách đề bài, độ khó, gợi ý phát âm (`hints`), nút nghe giọng mẫu và biểu đồ tiến độ sao cho từng màn `TONGUE_TWISTER`.

---

# 8. API Requirements (Yêu cầu API)

- `GET /speaking/prompts?mode=READ_ALOUD|TOPIC|TONGUE_TWISTER` → `200 OK`
- `GET /speaking/game/progress` → `200 OK`
- `GET /speaking/samples/:file` → `200 OK` (`audio/mpeg` hoặc `audio/wav`)
- `GET /speaking/history` → `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Seed đầy đủ 27 đề bài thuộc 3 chế độ (`READ_ALOUD`, `TOPIC`, `TONGUE_TWISTER`).
- [x] Tính đúng số sao (`60/80/90`) và điều kiện qua màn (`stars ≥ 1 && completeness ≥ 80`).
- [x] Chặn nộp bài ở màn `TONGUE_TWISTER` chưa mở khóa (`403 SPEAKING_LEVEL_LOCKED`).
- [x] Phục vụ đúng file âm thanh mẫu từ manifest `speaking-samples.json`.

# End
