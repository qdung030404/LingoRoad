# 04 — Thống kê thật và ranh giới kế hoạch ngày

Ngày 02/11/2026 · P1 · Chưa làm · Phụ thuộc 01–03.

Nguồn: [quyết định người dùng](plan.md), [contract kết quả](phase-02-review-contract.md).

## Quy tắc đã khóa

| Chỉ số | Cách tính |
| --- | --- |
| totalWords | Số bản ghi từ đang hoạt động thuộc bộ đang hoạt động của user |
| rememberedWords | Số từ có trạng thái REMEMBERED cho contentVersion hiện tại |
| needsReviewWords | totalWords − rememberedWords; gồm từ chưa ôn |
| reviewedWords | Số từ đang hoạt động đã có ít nhất một kết quả được xác nhận cho contentVersion hiện tại; tách khỏi totalWords |
| completedReviewCount | Số attempt COMPLETED; không đồng nghĩa với đã ôn tất cả nếu có skip |
| reviewed/skipped/unchecked | Chi tiết theo snapshot của mỗi attempt, không lấy số từ hiện tại để sửa lịch sử |
| correctCount/checkedCount | Chỉ recall được xác nhận; quick rating không tạo đúng/sai |

SKIP/REQUEUE không đổi nhãn trước đó. Một từ từng Dễ sau đó Trung bình/Khó hoặc sai sẽ trở về Cần ôn khi kết quả mới được xác nhận; một từ trong nhiều lượt vẫn chỉ tính một lần trong tổng từ. Hai bản ghi cùng text ở hai bộ được tính theo hai wordId.

Đổi tên bộ không reset từ. Sửa nội dung từ → contentVersion mới chưa ôn. Xóa bộ/từ giảm số liệu hiện hành, không xóa kết quả trong lịch sử. Kết quả snapshot cũ không ghi đè phiên bản mới.

## API và hiển thị

- `GET /vocabulary/summary` trả `{totals:{totalWords,rememberedWords,needsReviewWords,reviewedWords,completedReviewCount},decks:[{id,name,version,totalWords,rememberedWords,needsReviewWords,activeAttemptId}],hasMoreDecks}`; Home tối đa hai bộ, endpoint danh sách đầy đủ dùng pagination.
- Danh sách bộ và detail trả cùng tên/công thức đếm. Cùng request phải đọc một snapshot dữ liệu nhất quán để không lệch tổng nếu rating/xóa đồng thời.
- Tâm chart hiện dùng tổng từ nhưng nhãn “Đã học”: đổi thành **Tổng từ** ở nhánh thật để không tính từ chưa ôn như đã học. Giữ vị trí/kích thước chart, các ô Đã nhớ/Cần ôn và các bộ trong một card; Xem tất cả bo viền, căn phải, không thêm viền giữa các phần.
- Nhánh preview tiếp tục biểu thị dữ liệu mẫu; không dùng số liệu preview làm fallback nếu API lỗi. Lỗi mới: loading/empty/retry; cache cũ: ghi chưa đồng bộ thay vì zero giả.
- Sau ACK rating/CRUD/submit: refresh summary và bộ đang mở. Trở lại Home, resume app hoặc mở thiết bị khác tải lại để thấy thay đổi server.
- Không diễn giải tự đánh giá Dễ thành xác suất nhớ, CEFR hoặc mức thành thạo.

## Những phần chủ động giữ ngoài tích hợp

- Không mở activity session, không khởi tạo ActivityCollector cho review từ, không gửi segments.
- Không tạo LearningAttempt/LearningAttemptAnswer cho từ cá nhân; bài học VOCABULARY hiện có vẫn là bài học riêng.
- Không thêm từ cá nhân vào PlanItem hoặc thay policy chooseDailyItems. Thống kê lesson và daily progress giữ contract hiện tại.
- Không cộng reviewCount vào completedLessonCount/completedAttemptCount, không đổi goalMet/hasActivity ngày từ vocabulary.
- Chưa gọi predictKt hoặc trộn wordId cá nhân với ID ngân hàng mô hình.

## File và checklist

Sửa các file mới ở giai đoạn 01–03: VocabularyService/Controller, vocabulary controller/pages; cùng `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/learning/vocabulary_summary.dart` và `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/learning/home_dashboard.dart`.

Tạo:
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/src/modules/vocabulary/vocabulary.service.spec.ts`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/test/vocabulary_statistics_test.dart`

Không sửa PlanningService, daily_pages, activity_collector hoặc các model daily; không xóa file.

- [ ] Summary/deck counts dùng cùng định nghĩa và snapshot nhất quán.
- [ ] Home/chart/card đọc server; có trạng thái empty/loading/error/cache cũ.
- [ ] Test chuỗi chưa học → Dễ → Trung bình → sai → Dễ và reset contentVersion.
- [ ] Test deletion, nhiều attempt, hai thiết bị và số liệu theo account.
- [ ] Regression đo trước/sau review: daily activeSeconds, lesson counts và snapshot plan không đổi.

Đạt khi remembered + needsReview luôn bằng total từ hoạt động và daily không bị tăng do ôn từ. Rủi ro là mang công thức đếm local sang nhãn thật hoặc cộng nhầm vào learning summary; giải quyết bằng contract riêng và assertion HTTP so sánh trước/sau. Tiếp theo: nghiệm thu xuyên suốt.
