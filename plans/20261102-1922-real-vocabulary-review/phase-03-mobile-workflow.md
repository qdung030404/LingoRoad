# 03 — Flutter, phản hồi thao tác và lỗi mạng

Ngày 02/11/2026 · P1 · Chưa làm · Phụ thuộc API 01–02.

Nguồn: [contract review](phase-02-review-contract.md), `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/openspec/ui-dna.md`.

## Kiến trúc

- Nhánh có tài khoản dùng `ApiVocabularyRepository`, `VocabularyController` và `VocabularyReviewController`. API qua ApiClient hiện có, không dùng Firebase trực tiếp để lưu bộ từ.
- `WordLibrary` tiếp tục chỉ là nguồn preview. Không cho controller API kế thừa WordLibrary vì constructor hiện nạp sampleWordDecks và cơ chế persistence local.
- Tách DTO hiển thị thống kê/card khỏi nguồn lưu trữ. Card, biểu đồ và các phần trình bày flashcard có thể dùng chung cho preview/API; controller/state machine và hàng đợi thực thuộc backend.
- Giữ SrsReviewPage cho preview. Trang review theo tài khoản dùng controller API; trích các widget thuần hiển thị/motion hiện có khi cần, không sao chép một queue local thứ hai làm nguồn chính thức.
- Cache và pending namespace theo UUID tài khoản backend, không theo email; kiểm tra account generation khi nhận response. Đăng xuất dispose controller, bỏ dữ liệu đang hiển thị; pending riêng của A chỉ gửi lại khi A xác thực lại.

## Các màn và thao tác

1. Từ của tôi: danh sách bộ thật, tìm kiếm, tạo bộ; loading/empty/error/retry/cache cũ hiển thị rõ.
2. Chi tiết bộ: từ và nhãn thật; thêm/sửa/xóa từ, đổi tên/xóa bộ. Form lỗi vẫn giữ input; xác nhận trước xóa mềm. Không báo thành công trước ACK.
3. Nút Ôn từ vựng trên Home: mở active review gần nhất nếu có; nếu chưa có, chọn bộ còn Cần ôn theo thứ tự ổn định. Nhiều bộ thì dùng danh sách bộ để chọn, không hard-code `decks.first`.
4. Nút Tiếp tục học của từng bộ: resume active attempt trước khi start mới. NEEDS_REVIEW rỗng → thông báo và cho Ôn tất cả. Tối đa 100 từ/lượt, hiển thị phạm vi nếu bộ lớn.
5. Review: khôi phục current item, phase, draft, checked feedback. Mặt trước tiếng Anh → nghĩa → điền từ vẫn giữ; không thêm mode picker.
6. Sau check đúng, cho chọn độ khó dùng component hiện có; mặc định Trung bình nếu bấm Tiếp theo. Sau check sai, hiển thị đáp án server và Tiếp theo, không cho đổi thành Dễ.
7. Hết queue: tự gửi SUBMIT bằng command bền vững; chỉ hiển thị tổng kết sau ACK và feedback của thẻ cuối đã xong. “Ôn lại tiếp” mở attempt ALL mới; “Quay về trang từ vựng” trở đúng tab.
8. Thêm lịch sử ôn từ riêng trong Từ của tôi/chi tiết bộ; mở lại kết quả read-only, phân biệt từ đã ôn, đã bỏ qua và câu điền đúng/sai. Thoát giữa chừng lưu tiến trình, không tự ABANDON; bỏ lượt chỉ khi người học chủ động chọn.

## Motion và trạng thái chờ

- Giữ swipe nghiêng, trái đỏ Bỏ qua, phải xanh Ôn lại sau; threshold/semantics/giảm chuyển động dùng quy tắc hiện có.
- Gesture hoàn tất tạo SKIP/REQUEUE command. Có thể giữ thẻ nghiêng ở trạng thái đang lưu; chỉ đổi queue khi ACK. Lỗi thì trả thẻ về vị trí cũ, giữ nội dung và có Thử lại.
- Khi chọn độ khó: khóa thao tác cạnh tranh, highlight ngay; lưu pending trước khi gửi. Thời điểm chuyển là khi **đã ACK và đã qua ít nhất 1,5 giây kể từ chọn**, sau đó mới chạy transition. Mạng chậm giữ trạng thái đang lưu.
- CHECK_RECALL chờ server mới hiện Chính xác/Chưa đúng; không so sánh text local rồi coi là kết quả thật.
- Sau timeout, chưa biết server đã commit hay chưa: giữ thẻ, highlight/draft và commandId; không tự tạo command mới hoặc lấy thẻ tiếp theo từ cache.
- Tôn trọng disableAnimations. Khi pending đã được ACK nhưng app bị kill trong highlight, khôi phục trạng thái server và không gửi rating lần nữa hoặc phát lại toàn bộ animation cũ.
- Item đã xử lý khi bấm lùi là read-only. Không dùng index-- để tự mở lại đáp án đã lưu như một lượt ôn mới.

## Persistence và offline được hỗ trợ

- Trước mọi mutation: ghi bền vững `{accountId,commandId,targetId,itemId?,expectedVersion,action,payload}`; chỉ gửi sau khi persist thành công. Kiểm tra kết quả ghi local, không coi SharedPreferences write thành công nếu chưa xác nhận.
- Một mutation đang chờ trên mỗi controller/target; tuần tự hóa SAVE_PROGRESS, RATE, SKIP, REQUEUE và SUBMIT. Không để autosave draft đổi revision trong lúc rating đang bay.
- Debounce lưu draft local khoảng 300 ms; flush khi mất focus/thoát/background. SAVE_PROGRESS checkpoint lên server khi có mạng trước ranh giới hành động. Nội dung đã ACK khôi phục được ở thiết bị khác; draft chưa sync chỉ được đảm bảo trên thiết bị hiện tại.
- Sau reconnect/mở lại: phục hồi pending cùng account, replay cùng payload, lấy state server hiện tại rồi mới mở khóa hành động. Không dùng receipt cũ làm lùi revision.
- 409: giữ bản nháp để người dùng đọc/copy, tải state mới; không âm thầm gửi lại lựa chọn với revision mới. 401: đi qua session recovery hiện có. 404: thông báo nội dung không còn khả dụng, refresh danh sách; không xóa pending của tài khoản khác.
- Cache offline chỉ đọc. Tạo/sửa/xóa và tiến sang thẻ mới cần ACK; hỗ trợ mạng gián đoạn, chưa phải full offline-first review. Không tự đẩy ratings/fixture từ WordLibrary lên API.

## File chịu ảnh hưởng

Tạo:
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/vocabulary/vocabulary_models.dart`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/vocabulary/vocabulary_repository.dart`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/vocabulary/vocabulary_controller.dart`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/vocabulary/vocabulary_review_controller.dart`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/vocabulary/vocabulary_pending_store.dart`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/vocabulary/vocabulary_pages.dart`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/vocabulary/vocabulary_review_page.dart`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/learning/word_review_widgets.dart` — tách card/form/motion để tái sử dụng khi cần.

Sửa:
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/learning/learning_preview.dart` — tạo/dispose controller theo account, routing, mô tả profile, nhánh guest/API.
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/learning/home_dashboard.dart` — nguồn summary thật và callback route.
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/learning/word_collection_pages.dart` — tách props hiển thị WordDeckCard để dùng summary DTO; preview vẫn hoạt động.
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/learning/srs_review_page.dart` — dùng widget thuần được tách ra, giữ hành vi preview.
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/lib/features/learning/vocabulary_summary.dart` — nhận dữ liệu thống kê thay vì đọc trực tiếp storage.

Không xóa file; không đổi auth, navbar, native clock hoặc bố cục Home đã được thống nhất. Phonetic/example/translation là optional; không lấy metadata fixture chỉ vì từ mới trùng text. Nút loa chỉ dùng audio có mapping đúng đã xác thực; nếu chưa có, báo Chưa có phát âm, không phát file của từ khác.

## Checklist và tiêu chí đạt

- [ ] API models/repository và controllers tách khỏi WordLibrary.
- [ ] CRUD có giữ input, loading, conflict và soft-delete confirmation.
- [ ] Review resume/queue/check/rate/submit/history chạy bằng API.
- [ ] Pending/draft tồn tại qua restart, không lọt dữ liệu khi đổi account.
- [ ] Delay/animation/swipe đúng, không chuyển khi lưu thất bại; thẻ cuối không mất kết quả.
- [ ] Preview vẫn có nhãn dữ liệu mẫu; các màn từ thật không còn bị bọc PreviewSurface sai.

Đạt khi cùng một lượt có thể dừng/tiếp tục và đọc lại trên thiết bị khác sau ACK; mất mạng giữ input và không giả kết quả. Rủi ro chính là hai nguồn queue, autosave race và response của account cũ; kiểm thử bằng fake repository và MuMu. Tiếp theo: thống kê.
