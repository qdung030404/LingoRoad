# Bằng chứng và quyết định cho kế hoạch

Kiểm tra ngày 02/11/2026. Đây là tài liệu lập kế hoạch, không phải kết quả triển khai.

## Nguồn yêu cầu

- User yêu cầu lập plan “Từ vựng và ôn tập với dữ liệu thật”.
- User trả lời trong lượt này: Dễ = Đã nhớ; Trung bình/Khó hoặc sai = Cần ôn; chưa học thuộc Cần ôn.
- User chọn chỉ thống kê từ vựng, chưa cộng mục tiêu ngày.
- Yêu cầu đã chốt trong chat: swipe trái bỏ qua lượt hiện tại; phải đưa cuối queue; thẻ nghiêng và đỏ/xanh; độ khó highlight 1,5 giây rồi animation chuyển.

## Hiện trạng đã đối chiếu

Context Engine `codebase-retrieval` được gọi trước khi đọc source. MCP HTTP đang ở `http://127.0.0.1:6699/mcp`; kết quả có thể từ index đang cập nhật, nên đã đọc lại các file quan trọng. Nếu lần triển khai sau không kết nối, user hướng dẫn chạy `npx vibervn-context-engine@latest` rồi kết nối lại.

| File hiện có dưới `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/` | Bằng chứng |
| --- | --- |
| `apps/mobile/lib/features/learning/word_library.dart` | Sample decks + SharedPreferences; key tách theo account; ratings remember/hard/forgot; addDeck/addWord local; chưa có CRUD API cho bộ cá nhân |
| `apps/mobile/lib/features/learning/srs_review_page.dart` | English front/meaning/recall trong một flow, check text local; skip/requeue local; rating lưu local với delay 1,5 giây và animation; có motion nghiêng/đỏ/xanh |
| `apps/mobile/lib/features/learning/word_collection_pages.dart` | Tạo bộ/thêm từ, tìm bộ, card/danh sách từ; WordListPage còn bọc PreviewSurface |
| `apps/mobile/lib/features/learning/vocabulary_summary.dart` | Tổng từ từ WordLibrary được gắn nhãn Đã học, remembered là nhãn local; cần đổi nguồn/công thức hiển thị thật |
| `apps/mobile/lib/features/learning/learning_preview.dart` | Authenticated và guest cùng khởi tạo WordLibrary; openReview dùng decks.first, cần xử lý bộ rỗng và route thật |
| `apps/backend/prisma/schema.prisma` | Có learning attempts/answers, daily plan/activity; chưa có vocabulary deck/word/review cá nhân |
| `apps/backend/src/modules/learning/learning.types.ts` | Nội dung learning yêu cầu đúng năm MCQ bốn lựa chọn; không phù hợp ép bộ từ cá nhân vào cùng model |
| `apps/backend/src/modules/learning/learning.service.ts` | Ownership, snapshots, expectedVersion, server check/submit và history là pattern để tham khảo |
| `apps/backend/src/modules/planning/planning.service.ts` | Activity session ràng buộc LearningAttempt, union UTC intervals và daily progress; giữ ngoài phạm vi vocabulary theo lựa chọn user |
| `apps/mobile/lib/features/learning/activity_collector.dart` | Collector/outbox phục vụ thời gian học thật; không khởi tạo cho review từ ở tính năng này |
| `docs/next-work-plan-2026-10-30.md` | Bước từ vựng thật đã từng được đề xuất; một số mô tả hiện trạng trong tài liệu cũ đã lỗi thời, không dùng thay source ngày 02/11 |
| `openspec/ui-dna.md` | Card radius16, ô nhập nhiều dòng radius8, navbar chung, error giữ nội dung, reduced motion, preview tách thật |

Các file docs/development-rules.md, codebase-summary.md, code-standards.md, design-guidelines.md được skill gợi ý nhưng hiện không tồn tại. Áp dụng AGENTS.md, ui-dna và mẫu code hiện có; không tạo tài liệu giả để thay thế.

## Lựa chọn kiến trúc

| Phương án | Đánh giá |
| --- | --- |
| Đưa WordLibrary vào API bằng cách kế thừa lớp hiện tại | Ít sửa ban đầu nhưng dễ kế thừa sample defaults/local ratings, lẫn nguồn dữ liệu và queue |
| Ép từ cá nhân thành LearningLesson/MCQ | Tái sử dụng attempts nhưng sai cấu trúc nội dung, đếm nhầm số bài và ảnh hưởng daily policy |
| VocabularyModule/repository/controller riêng, dùng chung widget và pattern receipt | **Chọn**: ranh giới dữ liệu rõ, giữ workflow hiện có; thêm schema/API nhưng không thay cơ chế daily vừa nghiệm thu |

Không cần thư viện/backend service mới. Không thêm hàng đợi job hoặc ML vào mutation quản lý từ.

Snapshot/receipt được giữ bền trong PostgreSQL; EventEmitter2 trong process không được dùng làm nơi duy nhất ghi nhận kết quả. Hai thiết bị cùng sửa dùng revision và transaction; DB constraint là lớp bảo vệ trùng cuối cùng. [Prisma transactions/OCC](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions), [Prisma Client reference — hỗ trợ version filter từ Prisma 5](https://www.prisma.io/docs/orm/v6/reference/prisma-client-reference). Các trang tài liệu mang nhãn v6; repo hiện dùng Prisma5, chỉ tái sử dụng API/version filter đã có, không nâng version theo tài liệu.

Partial unique index cho một active review và các FK/CHECK cần migration SQL được test trên PostgreSQL16. Không dùng CHECK để kiểm tra owner ở bảng khác; owner kiểm tra trong transaction/query. [PostgreSQL16 constraints](https://www.postgresql.org/docs/16/ddl-constraints.html).

NFKC và alias áp dụng cho đáp án so sánh, không viết lại nội dung gốc. [Unicode normalization UAX15](https://www.unicode.org/reports/tr15/). HTTP POST retry cần contract idempotency của ứng dụng; commandId và receipt đáp ứng việc retry sau response bị mất. [RFC9110 idempotent methods](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2).

## Giới hạn và yêu cầu tương lai

- Rating là self-report; điền từ sau khi lộ tiếng Anh không phải bài test nhớ độc lập. Tương lai nếu muốn DKT phải chốt mapping và protocol đo khác.
- Tính thời gian review, đưa từ vào daily plan, SRS/FSRS và học hoàn toàn offline đều là mở rộng chưa nằm trong quyết định lần này.
- Không tự import local fixture/ratings. Có thể lập task import bộ người dùng từng tạo trên máy riêng sau khi xác định nguồn và cách xác nhận.
- Không đọc/ghi private key, token hoặc cấu hình secret trong quá trình lập plan.
- Nhờ hai tác nhân nghiên cứu thiết kế read-only rà soát receipt, snapshot, chuẩn hóa và edge case; các điểm khác quyết định user đã được loại khi tổng hợp.
- Lượt này chỉ viết bộ tài liệu plan; không sửa source, chạy migration, chạy suite test, tạo task Notion, commit hoặc push.
