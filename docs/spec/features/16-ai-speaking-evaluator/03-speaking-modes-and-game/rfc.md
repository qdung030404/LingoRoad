# Request for Comments (RFC) - 3-Mode Speaking Catalogue & Tongue Twister Game Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc dữ liệu và thuật toán cho Danh mục Luyện nói 3 Chế độ (`SpeakingPrompt`), Tiến độ Trò chơi Xoắn lưỡi (`SpeakingGameProgress`), cơ chế kiểm tra mở khóa tuần tự (`requireUnlocked`), cập nhật kỷ lục nguyên tử bằng SQL `GREATEST` và phục vụ tệp âm thanh mẫu (`speaking-samples.json`).

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD 3-Mode Speaking Catalogue & Tongue Twister Game (`docs/spec/features/16-ai-speaking-evaluator/03-speaking-modes-and-game/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để cập nhật kỷ lục điểm số (`bestScore`), số sao (`stars`) và trạng thái qua màn (`cleared`) một cách nguyên tử (atomic) mà không bị race condition khi người dùng nộp bài liên tiếp?
- Làm thế nào để phục vụ tệp âm thanh giọng đọc mẫu (`sampleAudioUrl`) an toàn và đồng bộ với phiên bản nội dung đề bài?

---

# 3. Goals (Mục tiêu)

- Sử dụng truy vấn SQL nguyên tử `INSERT ... ON CONFLICT ("user_id", "prompt_id", "content_version") DO UPDATE SET stars = GREATEST(...)` trong PostgreSQL.
- Xác thực chặt chẽ manifest `speaking-samples.json` lúc khởi động module (`onModuleInit`) bằng mã băm SHA-256 của văn bản đề bài.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Sinh giọng nói TTS động theo thời gian thực cho các câu mẫu cố định (sử dụng file mẫu đã tạo sẵn để đạt độ trễ bằng 0).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Mobile (SpeakingModesPage / SpeakingController)
  │
  ├── GET /speaking/prompts?mode=READ_ALOUD | TOPIC
  ├── GET /speaking/game/progress (TONGUE_TWISTER 12 levels + unlocked state)
  ├── GET /speaking/samples/:file (Static sample MP3/WAV from manifest)
  └── GET /speaking/history?limit=20&cursor=...
        │
        ▼
SpeakingController ──> SpeakingService
                         ├── Upsert 27 prompts from PROMPT_CATALOGUE onModuleInit
                         ├── requireUnlocked(): Verify previous sortOrder is cleared
                         ├── calcStars(overall): >=90 -> 3, >=80 -> 2, >=60 -> 1, else 0
                         └── Atomic SQL upsert on speaking_game_progress (GREATEST)
```

### Công thức Tính Sao & Qua Màn (`speaking-prompts.ts`)
```typescript
export function calcStars(overall: number): number {
  if (overall >= 90) return 3;
  if (overall >= 80) return 2;
  if (overall >= 60) return 1;
  return 0;
}

export function isCleared(stars: number, completeness: number | null): boolean {
  return stars >= 1 && (completeness === null || completeness >= 80);
}
```

### Cập nhật Kỷ lục Nguyên tử (Atomic Upsert)
```sql
INSERT INTO "speaking_game_progress"
  ("user_id", "prompt_id", "content_version", "stars", "best_score", "cleared", "updated_at")
VALUES
  ($1::uuid, $2::uuid, $3, $4, $5, $6, NOW())
ON CONFLICT ("user_id", "prompt_id", "content_version") DO UPDATE SET
  "stars" = GREATEST("speaking_game_progress"."stars", EXCLUDED."stars"),
  "best_score" = GREATEST("speaking_game_progress"."best_score", EXCLUDED."best_score"),
  "cleared" = "speaking_game_progress"."cleared" OR EXCLUDED."cleared",
  "updated_at" = NOW()
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Quản lý bảng `speaking_prompts` và `speaking_game_progress`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

- Bảng `speaking_prompts`: `id`, `code` (`unique`), `mode` (`READ_ALOUD` | `TOPIC` | `TONGUE_TWISTER`), `title`, `text`, `difficulty`, `maxDurationSeconds`, `hints` (`Json`), `sampleAsset`, `contentVersion`, `sortOrder`, `published`.
- Bảng `speaking_game_progress`: Khóa chính phức hợp `@@id([userId, promptId, contentVersion])`, `stars`, `bestScore`, `cleared`, `updatedAt`.

---

# 8. API Design (Thiết kế API)

### 1. `GET /speaking/prompts?mode=READ_ALOUD`
- **Response**: `200 OK` (Danh sách `SpeakingPromptView` đã sắp xếp theo `sortOrder ASC`).

### 2. `GET /speaking/game/progress`
- **Response**: `200 OK`
  ```json
  [
    {
      "prompt": {
        "id": "c1d2e3f4-1111-2222-3333-444455556666",
        "code": "twister-1",
        "mode": "TONGUE_TWISTER",
        "title": "She Sells Seashells",
        "text": "She sells seashells by the seashore.",
        "difficulty": 1,
        "maxDurationSeconds": 20,
        "hints": ["Chú ý phân biệt âm /ʃ/ (she, shells, shore) và âm /s/ (sells, sea)."],
        "sampleAudioUrl": "/speaking/samples/twister-1.mp3",
        "contentVersion": 2
      },
      "stars": 3,
      "bestScore": 92,
      "cleared": true,
      "unlocked": true
    }
  ]
  ```

### 3. `GET /speaking/history?limit=20&cursor=...`
- **Response**: `200 OK` (`{ items: SpeakingSubmissionView[], nextCursor: string | null }`).

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Chơi màn `TONGUE_TWISTER` chưa mở khóa: Ném lỗi `403 Forbidden` (`SPEAKING_LEVEL_LOCKED`).
- Tệp âm thanh mẫu không hợp lệ hoặc chứa đường dẫn tương đối (`..`): Ném lỗi `404 Not Found`.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Endpoint `GET /speaking/samples/:file` kiểm tra regex `/^[a-z0-9-]+\.(mp3|wav)$/i` và đối chiếu `path.resolve` nằm gọn trong thư mục `assets/speaking-samples` để chống Path Traversal.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Index `@@index([mode, sortOrder])` trên `speaking_prompts` và `@@index([userId, createdAt, id])` trên `speaking_submissions` giúp truy vấn danh sách đề bài và lịch sử trong < 10ms.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Đọc bản ghi `SpeakingGameProgress` lên bộ nhớ ứng dụng rồi mới `update`: Dễ xảy ra Lost Update khi 2 request hoàn thành gần nhau. Dùng `ON CONFLICT DO UPDATE ... GREATEST` ở tầng DB đảm bảo tính đúng đắn tuyệt đối (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã hoàn tất trong Prisma schema và `SpeakingService.onModuleInit()`.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit & Integration Tests**:
  - Kiểm thử `calcStars` và `isCleared` tại các biên điểm `59, 60, 79, 80, 89, 90` và `completeness` tại `79, 80`.
  - Kiểm thử mở khóa tuần tự `requireUnlocked` và bảo toàn kỷ lục cao nhất qua SQL `GREATEST`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi tỷ lệ vượt màn ở từng cấp độ của `TONGUE_TWISTER`.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
