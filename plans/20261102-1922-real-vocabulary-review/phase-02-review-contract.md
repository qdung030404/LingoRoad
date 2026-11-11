# 02 — Lượt ôn, chấm đáp án và retry

Ngày 02/11/2026 · P1 · Chưa làm · Phụ thuộc giai đoạn 01.

Nguồn: [models/CRUD](phase-01-data-and-library-api.md), [nguồn kỹ thuật](reports/context-and-decisions.md).

## Luồng và hàng đợi

- Start mặc định NEEDS_REVIEW; lấy các từ đang hoạt động còn Cần ôn của một bộ theo createdAt/id. ALL dùng khi người học chọn Ôn lại tiếp.
- Không có từ phù hợp: trả empty reason `NO_WORDS_TO_REVIEW`, không tạo lượt hoàn thành giả. Bộ rỗng hướng dẫn thêm từ; bộ đã nhớ hết cho chọn ôn tất cả.
- Snapshot bộ và nội dung từ được chốt cùng transaction khi start; tối đa 100 từ/lượt. Nếu lớn hơn, trả selectedCount/remainingEligibleCount và UI ghi rõ số từ trong lượt. Chọn theo lastPresentedAt NULL trước, rồi lastPresentedAt/lastReviewedAt cũ nhất, createdAt/id; ghi lastPresentedAt khi chốt snapshot. Đây là metadata chọn batch, không phải kết quả ôn: kể cả 100 từ đầu bị skip hết, lượt sau vẫn tới được từ chưa xuất hiện.
- Queue chứa item ID duy nhất. Item của cùng từ không được nhân đôi khi vuốt phải. Snapshot không tăng thêm từ nếu thư viện thay đổi giữa lượt.
- Mặt trước tiếng Anh ↔ mặt nghĩa; Tiếp theo vào phần điền từ theo flow hiện có. Chọn độ khó từ flashcard kết thúc item bằng SELF_REPORT, không tạo `isCorrect=true` giả.

| Thao tác | Kết quả server |
| --- | --- |
| SKIP / vuốt trái / Bỏ từ này | Bỏ item khỏi queue hiện tại, state SKIPPED; không sửa nhãn từ, không tính reviewed |
| REQUEUE / vuốt phải | Đưa item đầu xuống cuối, giữ PENDING; không tính reviewed. Chỉ còn một item thì giữ item đó, không nhân bản hoặc tự kết thúc |
| SAVE_PROGRESS | Lưu phase FRONT/MEANING/RECALL và draft; không chấm, không sửa nhãn |
| CHECK_RECALL | Kiểm tra tại server, chốt một câu trả lời cho item, lưu raw/normalized answer, isCorrect, checkedAt và normalizationVersion; giữ item hiện tại để xem phản hồi |
| RATE | Từ flashcard: SELF_REPORT. Từ recall đã check: RECALL_AFTER_REVEAL. Lưu rating/kết quả, cập nhật nhãn nếu contentVersion còn khớp, đánh dấu REVIEWED rồi lấy item tiếp theo |
| ADVANCE | Chỉ cho recall đã check. Đúng dùng mức đã chọn, mặc định MEDIUM; sai bắt buộc HARD. Tác dụng cuối giống RATE |
| SUBMIT | Chỉ khi queue rỗng; lưu kết thúc một lần, trả tổng kết gồm reviewed/skipped/correct/checked |
| ABANDON | Kết thúc sớm chủ động; giữ kết quả đã lưu, đếm riêng từ chưa xử lý, không coi là ôn hết |

CHECK_RECALL chưa cập nhật thống kê toàn thư viện cho tới RATE/ADVANCE xác nhận kết quả; resume vẫn thấy phản hồi đã check. Không cho sửa câu trả lời sau check hoặc chấm lại cùng item. Sau check sai, RATE chỉ chấp nhận HARD; gửi EASY/MEDIUM trả 400 `VOCAB_INVALID_RATING`, còn ADVANCE tự dùng HARD. Sai không thể được đổi thành Đã nhớ bằng request sửa rating.

Trong UI recall đúng có thể chọn độ khó; nếu bấm Tiếp theo dùng Trung bình đang được chọn mặc định. Recall sai hiển thị đáp án và Tiếp theo, kết quả luôn Cần ôn. Nút lùi xem lại item đã xử lý ở trạng thái chỉ đọc; muốn đánh giá lại mở lượt mới. Không rollback kết quả hoặc tăng lại counter bằng thao tác lùi.

Hết queue do skip toàn bộ vẫn kết thúc lượt với reviewed=0, skipped=N; hiển thị “Đã kết thúc lượt”, không “Đã nhớ hết”. Accuracy chỉ tính số recall đã check trong kết quả được xác nhận; denominator=0 hiển thị “Chưa có câu điền từ được chấm”. Khi bỏ lượt, các check chưa được xác nhận vẫn lưu trong chi tiết nhưng không cộng reviewed/accuracy.

## Nhãn từ và bằng chứng

- EASY → REMEMBERED; MEDIUM/HARD → NEEDS_REVIEW. Recall sai luôn NEEDS_REVIEW; recall đúng không tự thay thế lựa chọn độ khó.
- Lấy kết quả được server chấp nhận gần nhất cho wordId/contentVersion hiện tại. Serialize cập nhật trạng thái của cùng word bằng row lock; không lấy thời gian client để chọn kết quả mới nhất.
- Snapshot cũ/deleted word vẫn có lịch sử, nhưng không cập nhật projection hiện hành. State và receipt được commit cùng kết quả.
- Phân biệt resultSource SELF_REPORT / RECALL_AFTER_REVEAL, isCorrect nullable và answerExposed=true cho flow điền sau khi xem tiếng Anh. Không gọi các kết quả này là điểm CEFR/mastery hoặc đưa vào predictKt.

## Chuẩn hóa đáp án `v1`

Chỉ chuẩn hóa chuỗi dùng so sánh: NFKC → đổi `’`/`‘` thành `'` → trim/collapse Unicode whitespace → lowercase không theo locale. So với english và acceptedAnswers trong snapshot; lưu raw để hiển thị.

- `  APPLE ` và `ａｐｐｌｅ` khớp apple; `don’t` khớp don't.
- Không bỏ dấu phụ, apostrophe, dấu câu hoặc gạch nối: dont khác don't; resume khác résumé; apple. khác apple; ice-cream khác ice cream nếu không có alias khai báo.
- Không fuzzy match, tự sửa chính tả, tự suy từ đồng nghĩa hoặc đáp án đúng bằng LLM.

## API lượt ôn

| Endpoint | Input/đầu ra chính |
| --- | --- |
| `POST /vocabulary/decks/:deckId/reviews` | `{commandId,scope}`; start hoặc resume lượt đang chạy |
| `GET /vocabulary/reviews/:attemptId` | Snapshot public, queue/current item/phase, checked feedback, version, counts; luôn kiểm tra owner |
| `POST /vocabulary/reviews/:attemptId/commands` | `{commandId,expectedVersion,itemId?,action,...payload}`; DTO theo từng action, không nhận isCorrect/learningState |
| `GET /vocabulary/history?deckId&cursor&limit` | Lịch sử ổn định startedAt/id; trạng thái active/completed/abandoned, summary |

Actions SUBMIT/ABANDON cũng đi qua commands để dùng cùng receipt. Những bước chưa check không trả bảng acceptedAnswers dưới dạng kết quả chấm; nội dung tiếng Anh vốn được phép hiện ở flashcard nên không tuyên bố đây là ngân hàng đáp án bí mật.

## Transaction/idempotency

1. Xác thực user và validate envelope; request không truyền userId.
2. Tra receipt `(userId,commandId)` trước kiểm tra expectedVersion hoặc bộ lọc nội dung còn hoạt động. Hash canonical gồm target/action/payload và expectedVersion, không phụ thuộc thứ tự key JSON.
3. Cùng ID/cùng payload → không chạy mutation lần hai; cùng ID/khác payload → `VOCAB_COMMAND_CONFLICT` 409. Replay delete/command đã ACK vẫn trả receipt khi nội dung đã bị xóa mềm; entity hiện tại có thể là tombstone, không khôi phục row. Receipt luôn scoped theo user.
4. Với command mới: kiểm tra ownership target, khóa attempt, kiểm tra revision và current item, khóa word nếu cập nhật projection; thay đổi state + projection + receipt trong transaction ngắn, không gọi mạng trong transaction.
5. Hai request cùng commandID chạy song song phải hội tụ bằng unique constraint và xử lý conflict đọc lại receipt; không trả lỗi 500 hoặc để transaction đã rollback tiếp tục query.
6. Trả `{receipt:{commandId,targetId,appliedVersion,result},attempt}`. Receipt là kết quả bất biến; attempt là trạng thái hiện tại đọc lại. Client không dùng receipt cũ để lùi state sau khi thiết bị khác đã tiến lên.
7. Command mới dùng revision cũ → `VOCAB_REVIEW_CONFLICT` 409 và cho tải lại; mutation không có hiệu lực. Retry lost ACK luôn giữ nguyên commandId và payload.

Ràng buộc một thứ tự khóa thống nhất khi cần nhiều row, tránh deadlock; rollback toàn bộ khi cập nhật nhãn hoặc receipt thất bại. Command đã ACK không hết hiệu lực chỉ vì attempt hoàn tất/word bị xóa sau đó. Không tự xóa receipt khi history vẫn tồn tại.

## File và checklist

Tạo:
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/modules/vocabulary/vocabulary-review.service.ts`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/modules/vocabulary/vocabulary.types.ts`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/modules/vocabulary/vocabulary-review.service.spec.ts`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/modules/vocabulary/vocabulary-normalization.spec.ts`

Sửa các file vocabulary module/controller/DTO/command helper mới ở giai đoạn 01 để nối routes và inject service. Không xóa file.

- [ ] Implement start/resume, snapshot/batch, state machine và commands.
- [ ] Implement normalize v1, CHECK/RATE/ADVANCE và contentVersion gate.
- [ ] Implement receipt race/optimistic concurrency/consistent locking.
- [ ] Implement submit/abandon, kết quả/lịch sử, trường hợp all skipped/one word requeue.
- [ ] Unit tests state transitions/normalization; HTTP concurrency và ownership ở giai đoạn 05.

Đạt khi cùng một lượt resume đúng queue/feedback, retry không tăng reviewed hai lần, API không chấp nhận state transition sai. Rủi ro chính là nhầm tự đánh giá với đúng/sai, replay lùi queue và projection snapshot cũ; các bất biến trên phải có test. Tiếp theo: Flutter.
