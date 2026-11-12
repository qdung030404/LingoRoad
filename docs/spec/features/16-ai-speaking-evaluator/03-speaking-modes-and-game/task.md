# Task: Implement 3-Mode Speaking Catalogue & Tongue Twister Game

## Mission (Sứ mệnh)

Xây dựng danh mục 27 đề bài luyện nói thuộc 3 chế độ (`READ_ALOUD`, `TOPIC`, `TONGUE_TWISTER`), cơ chế tiến độ trò chơi vượt màn (`SpeakingGameProgress`), phục vụ âm thanh mẫu (`speaking-samples.json`) và giao diện `SpeakingModesPage` / `SpeakingController` trên Mobile.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Danh mục Luyện nói 3 Chế độ & Trò chơi Phát âm Xoắn lưỡi (`TONGUE_TWISTER`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/03-speaking-modes-and-game/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/03-speaking-modes-and-game/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/03-speaking-modes-and-game/spec.md)

---

# 3. Description (Mô tả)

- Định nghĩa `PROMPT_CATALOGUE` (9 `READ_ALOUD`, 6 `TOPIC`, 12 `TONGUE_TWISTER`), hàm `calcStars` và `isCleared` trong `apps/backend/src/modules/speaking/speaking-prompts.ts`.
- Triển khai `listPrompts`, `getGameProgress`, `requireUnlocked`, cập nhật `SpeakingGameProgress` bằng SQL `GREATEST`, phân trang `listHistory` và đọc manifest `speaking-samples.json` trong `SpeakingService`.
- Xây dựng `SpeakingModesPage`, `SpeakingPracticePage` và `SpeakingController` trên ứng dụng Flutter.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Model `SpeakingPrompt` và `SpeakingGameProgress`.
- Endpoints `GET /speaking/prompts`, `GET /speaking/game/progress`, `GET /speaking/samples/:file`, `GET /speaking/history`.
- Giao diện Mobile `SpeakingModesPage` và `SpeakingController`.

### NGOÀI PHẠM VI (OUT):
- Hội thoại thời gian thực AI Voice Live (thuộc Task 16-04).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files đã tạo/chỉnh sửa**:
  - `apps/backend/src/modules/speaking/speaking-prompts.ts`
  - `apps/backend/src/modules/speaking/speaking.service.ts`
  - `apps/backend/src/modules/speaking/speaking.controller.ts`
  - `apps/backend/assets/speaking-samples/speaking-samples.json`
  - `apps/mobile/lib/features/speaking/application/speaking_controller.dart`
  - `apps/mobile/lib/features/speaking/presentation/speaking_modes_page.dart`
  - `apps/mobile/lib/features/speaking/presentation/speaking_practice_page.dart`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `GET /speaking/prompts?mode=...` trả về đúng danh sách đề bài theo từng chế độ.
- [x] `GET /speaking/game/progress` trả về 12 màn `TONGUE_TWISTER` với trạng thái `unlocked`, `stars`, `bestScore`, `cleared`.
- [x] Cập nhật kỷ lục nguyên tử qua SQL `GREATEST` và chặn chơi màn chưa mở khóa (`403 Forbidden`).
- [x] Giao diện Mobile hiển thị đầy đủ 3 chế độ và bản đồ màn chơi.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Sequential Unlocking**: Màn 1 đạt 85 điểm (`2 sao`, `completeness = 95`) -> `cleared = true` -> Màn 2 chuyển sang `unlocked = true`.
2. **Best Score Preservation**: Lần 1 đạt 92 điểm (`3 sao`), lần 2 đọc lại đạt 70 điểm (`1 sao`) -> Kỷ lục vẫn giữ `3 sao` và `bestScore = 92`.
3. **Locked Level Protection**: Gửi `POST /speaking/submissions` cho màn 5 khi màn 4 chưa `cleared` -> Nhận lỗi `403 SPEAKING_LEVEL_LOCKED`.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
