# Request for Comments (RFC) - FSRS Spaced Repetition & Vocabulary State Engine Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật cho bộ chuẩn hóa đáp án từ vựng (`vocabulary-normalization.ts`), thuật toán chọn hàng đợi ưu tiên theo thời점 xuất hiện (`lastPresentedAt`) và cơ chế chuyển đổi trạng thái ghi nhớ trong `VocabularyReviewService`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD FSRS & Flashcard Learning State Engine (`docs/spec/features/14-fsrs-review-engine/01-fsrs-spaced-scheduler/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để so khớp đáp án gõ lại của người học một cách chính xác bất kể khác biệt chữ hoa/thường, khoảng trắng thừa hay dấu nháy cong trên bàn phím di động?
- Làm thế nào để chọn ra đúng 20 từ cần ưu tiên ôn tập nhất và cập nhật trạng thái `learningState` an toàn khi có nhiều phiên ôn tập?

---

# 3. Goals (Mục tiêu)

- Đóng gói hàm chuẩn hóa `normalizeVocabularyAnswer` và `buildAcceptedAnswers` độc lập, đạt 100% tính tất định (deterministic).
- Đảm bảo thứ tự chọn thẻ ôn tập công bằng, ưu tiên các từ chưa từng xuất hiện hoặc lâu nhất chưa được ôn.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Tự động huấn luyện lại trọng số bằng dịch vụ Python ML bên ngoài.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```typescript
export const NORMALIZATION_VERSION = 'v1';

export function normalizeVocabularyAnswer(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function buildAcceptedAnswers(english: string, extra?: string[]): string[] {
  const result: string[] = [];
  const primary = normalizeVocabularyAnswer(english);
  if (primary) result.push(primary);
  for (const item of extra ?? []) {
    const normalized = normalizeVocabularyAnswer(item);
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
}
```

### Quy tắc Chọn Hàng đợi Ôn tập (`REVIEW_SESSION_SIZE = 20`)
- Lọc các từ trong `VocabularyDeck` có `deletedAt IS NULL` và (nếu `scope === 'NEEDS_REVIEW'`) có `learningState === 'NEEDS_REVIEW'`.
- Sắp xếp theo:
  1. `lastPresentedAt === null` lên trước (`NULLS FIRST`), sau đó tăng dần theo `lastPresentedAt`.
  2. `createdAt` tăng dần.
  3. `id` tăng dần.
- Lấy 20 từ đầu tiên đưa vào `queue` và cập nhật ngay `lastPresentedAt = now()` cho các từ được chọn.

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp nền tảng chuẩn hóa và xếp lịch cho `VocabularyService` và `VocabularyReviewService`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

- Sử dụng các trường `acceptedAnswers`, `contentVersion`, `learningState`, `lastPresentedAt`, `lastReviewedAt`, `lastReviewItemId` trên bảng `vocabulary_words`.

---

# 8. API Design (Thiết kế API)

- Được gọi nội bộ bởi các API của `VocabularyController`.

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu từ tiếng Anh sau khi chuẩn hóa bị rỗng: Ném lỗi `400 Bad Request` (`VOCAB_VALIDATION_ERROR`).
- Nếu vượt quá 10 đáp án chấp nhận (`MAX_ACCEPTED_ANSWERS = 10`): Ném lỗi `400 Bad Request` (`VOCAB_VALIDATION_ERROR`).

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Chuẩn hóa chuỗi Unicode NFKC ngăn chặn các biến thể ký tự đồng형 (homoglyphs) gây sai lệch kết quả kiểm tra.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Thực thi chuẩn hóa chuỗi và sắp xếp trong bộ nhớ với độ trễ < 1ms.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- So sánh chuỗi trực tiếp bằng toán tử `===` không chuẩn hóa: Gây lỗi sai oan khi bàn phím iOS/Android tự động chèn dấu nháy cong `’` hoặc viết hoa chữ cái đầu (Bị loại bỏ).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã hoàn tất trong Prisma schema của `VocabularyModule`.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Kiểm thử `normalizeVocabularyAnswer` với dấu nháy cong, khoảng trắng kép, chữ hoa/thường.
  - Kiểm thử chuyển đổi `learningState` khi `SUBMIT` phiên ôn tập với các mức `EASY`, `MEDIUM`, `HARD`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi tỷ lệ từ đạt trạng thái `REMEMBERED` trên tổng số từ trong các bộ thẻ.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
