# 01 — Dữ liệu và API bộ từ

Ngày 02/11/2026 · Ưu tiên P1 · Chưa làm · Phụ thuộc: auth hiện có.

Nguồn: [hiện trạng](reports/context-and-decisions.md), [tổng kế hoạch](plan.md).

## Thiết kế và yêu cầu

Tạo `VocabularyModule` độc lập. Từ cá nhân không bị ràng buộc cấu trúc MCQ năm câu của learning. Dùng UUID ổn định và thời gian server. Không đổi cấu hình Firebase hoặc ngân hàng bài học.

| Model mới | Nội dung chính và ràng buộc |
| --- | --- |
| `VocabularyDeck` | id, userId, name, version, createdAt, updatedAt, deletedAt; index userId/deletedAt/createdAt/id |
| `VocabularyWord` | id, deckId, english, meaning, phonetic?, partOfSpeech?, example?, translation?, acceptedAnswers, contentVersion, version, learningState, lastPresentedAt?, lastReviewedAt?, lastReviewItemId?, deletedAt; index deckId/deletedAt/createdAt/id |
| `VocabularyReviewAttempt` | userId, deckId, scope NEEDS_REVIEW/ALL, status IN_PROGRESS/COMPLETED/ABANDONED, version, deckSnapshot, queue item IDs, current phase, startedAt, submittedAt? |
| `VocabularyReviewItem` | attemptId, wordId, initialOrdinal, wordContentVersion, wordSnapshot, state PENDING/REVIEWED/SKIPPED, draft?, checkedAnswer?, isCorrect?, checkedAt?, rating?, resultSource?, finalizedAt?; unique attemptId/wordId |
| `VocabularyCommandReceipt` | userId, commandId, action, targetId, canonicalPayloadHash, appliedVersion?, result JSON, createdAt; unique userId/commandId |

- `learningState`: REMEMBERED hoặc NEEDS_REVIEW; mặc định NEEDS_REVIEW. Đây là nhãn của người học/kết quả luyện, không phải mức thành thạo.
- `version` của bộ/từ dùng kiểm soát sửa nội dung và xóa. `contentVersion` tăng khi trường nội dung học/acceptedAnswers thay đổi; rename bộ không đổi phiên bản từ.
- Nội dung từ thay đổi → NEEDS_REVIEW và bỏ liên kết kết quả mới nhất của phiên bản cũ; lịch sử vẫn nguyên.
- Lượt đang chạy dùng snapshot cũ; kết quả snapshot cũ không cập nhật nhãn của contentVersion mới.
- Xóa mềm bộ/từ. Truy vấn đang hoạt động loại cả từ đã xóa và từ thuộc bộ đã xóa; lịch sử và lượt đang chạy vẫn đọc được theo owner. Hoàn thành lượt cũ không khôi phục nội dung đã xóa.
- Một lượt IN_PROGRESS cho mỗi user/deck bằng partial unique index SQL. Start khác command ID trong lúc đã có lượt → trả lại lượt đang chạy; đổi scope chỉ áp dụng cho lượt mới sau kết thúc/bỏ lượt cũ.
- Mỗi từ trong bộ là một bản ghi riêng; cùng tiếng Anh ở hai bộ hoặc hai nghĩa không tự gộp. Retry dùng command ID để tránh tạo trùng, không deduplicate bằng nội dung.
- FK user/deck/word/attempt phải có; hard delete nội dung đã có lịch sử bị chặn, thao tác UI dùng deletedAt. Chọn cascade cho xóa tài khoản theo convention hiện có, không cascade xóa lịch sử khi soft delete bộ/từ.

## Contract CRUD

Envelope giữ `{success:true,data:{...}}`. Mọi mutation có `commandId:UUID`; sửa/xóa có thêm `expectedVersion`.

| Endpoint đề xuất | Hành vi |
| --- | --- |
| `GET /vocabulary/decks?query&cursor&limit` | Tìm theo tên, phân trang ổn định createdAt/id; limit mặc định 20, tối đa 100 |
| `POST /vocabulary/decks` | `{commandId,name}` → deck và receipt |
| `GET /vocabulary/decks/:deckId` | Chi tiết, thống kê và activeAttemptId |
| `PATCH /vocabulary/decks/:deckId` | `{commandId,expectedVersion,name}` |
| `DELETE /vocabulary/decks/:deckId` | Body `{commandId,expectedVersion}`; soft delete |
| `GET /vocabulary/decks/:deckId/words?query&cursor&limit` | Tìm tiếng Anh/nghĩa, kèm nhãn hiện tại |
| `POST /vocabulary/decks/:deckId/words` | Tạo từ, trả word và receipt |
| `PATCH /vocabulary/words/:wordId` | Sửa nội dung theo revision |
| `DELETE /vocabulary/words/:wordId` | Soft delete theo revision |
| `GET /vocabulary/summary` | Thống kê tổng và các bộ phục vụ Home; chi tiết ở giai đoạn 04 |

Validation: tên bộ 1–60 ký tự; english 1–100; meaning 1–500; phonetic 0–100; partOfSpeech 0–50; example/translation 0–1000. acceptedAnswers gồm english chuẩn và tối đa 10 biến thể khai báo riêng, mỗi biến thể 1–100 ký tự. Trim, từ chối chuỗi chỉ có whitespace; giới hạn request body. Không tách alias theo dấu phẩy hoặc `/`.

Trả 401 khi chưa xác thực; 404 nhất quán cho bản ghi không thuộc user hoặc nội dung hoạt động đã xóa; 409 cho revision/lệnh xung đột; 400 cho dữ liệu sai. Không nhận owner hoặc learningState/isCorrect từ body quản lý nội dung. Các query word kiểm tra cả deck owner, không chỉ wordId.

## File chịu ảnh hưởng

Root viết đầy đủ: `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad`.

| Thao tác | Đường dẫn tuyệt đối | Nội dung |
| --- | --- | --- |
| Sửa | `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/prisma/schema.prisma` | Model, enum, quan hệ và index |
| Tạo | `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/prisma/migrations/<timestamp>_vocabulary_review/migration.sql` | Additive migration, CHECK/FK và partial unique index |
| Tạo | `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/modules/vocabulary/vocabulary.module.ts` | Đăng ký module/service |
| Tạo | `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/modules/vocabulary/vocabulary.controller.ts` | Routes, guard, UUID/DTO validation |
| Tạo | `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/modules/vocabulary/vocabulary.dto.ts` | Giới hạn và input contract |
| Tạo | `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/modules/vocabulary/vocabulary.service.ts` | CRUD, ownership, summary |
| Tạo | `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/modules/vocabulary/vocabulary-command.service.ts` | Receipt và transaction helper dùng chung CRUD/review |
| Sửa | `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/app.module.ts` | Import VocabularyModule |

Không xóa file. Model mới không liên kết với LearningActivitySession hoặc DailyPlan.

## Các bước và tiêu chí đạt

- [ ] Thêm schema/migration, kiểm tra FK/unique/index; migrate trên database `_test` còn dữ liệu daily/learning.
- [ ] Implement receipt helper theo giai đoạn 02; CRUD phải an toàn cả khi server commit rồi client mất response.
- [ ] Implement danh sách/chi tiết/CRUD/validation/ownership, stable pagination.
- [ ] Sửa từ cùng revision từ hai thiết bị: một cập nhật thắng, một nhận 409; không silent overwrite.
- [ ] Test soft delete, sửa nội dung reset nhãn; không mất lịch sử hoặc sửa kết quả snapshot cũ.

Đạt khi CRUD qua API theo đúng tài khoản, retry không tạo bản ghi trùng và migration giữ nguyên dữ liệu hiện hữu. Không seed tự động bộ mẫu vào tài khoản thật.

Rủi ro chính: nhầm ownership qua deck, mất lịch sử khi xóa, index Prisma chưa biểu diễn hết. Khắc phục bằng predicate owner trong query, soft delete, migration SQL có kiểm thử PostgreSQL thật. Sau đó thực hiện giai đoạn 02.
