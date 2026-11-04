# Từ vựng và ôn tập với dữ liệu thật

Ngày lập: 02/11/2026. Cập nhật: 03/11/2026. Trạng thái: **đã triển khai và nghiệm thu Android trong phạm vi local**. Giới hạn kiểm thử được ghi trong tài liệu nghiệm thu.

## Mục tiêu

Tài khoản tạo bộ từ → thêm/sửa/xóa từ → ôn flashcard hoặc điền từ → lưu kết quả → tiếp tục/xem lịch sử trên thiết bị khác. Home và trang Từ của tôi đọc cùng thống kê từ backend.

## Quyết định người dùng đã chốt

- Dễ → Đã nhớ. Trung bình/Khó, trả lời sai hoặc chưa ôn → Cần ôn.
- Lượt ôn chỉ cập nhật thống kê từ vựng: **không cộng thời gian vào mục tiêu ngày, không tăng số bài học hoàn thành**.
- Giữ vuốt trái bỏ qua trong lượt hiện tại; vuốt phải đưa cuối hàng đợi, với hiệu ứng nghiêng và đỏ/xanh.
- Chọn độ khó: nổi bật nút ít nhất 1,5 giây và chuyển có animation; chỉ chuyển khi backend xác nhận lưu thành công.

## Phạm vi đề xuất cho lần triển khai

- Bộ từ riêng theo tài khoản; CRUD bộ/từ, tìm kiếm, thống kê và lịch sử ôn.
- Giữ một luồng mặt trước tiếng Anh → nghĩa → điền lại từ; chọn độ khó ở flashcard có thể chuyển thẳng sang từ kế tiếp.
- Bắt đầu/tiếp tục/kết thúc lượt ôn, snapshot nội dung, kiểm tra đáp án tại server, retry không ghi trùng.
- Giữ dữ liệu mẫu ở nhánh khách. Tài khoản mới bắt đầu với bộ từ thật rỗng; không tự tải ratings/fixture cũ lên server.
- Offline: xem cache, giữ nội dung đang gõ và lệnh chờ; cần kết nối để mở lượt mới và xác nhận thao tác. Chưa triển khai hoàn thành một lượt hoàn toàn offline.
- Phát âm chỉ dùng audio đã gắn đúng với từ. Chưa bổ sung dịch từ, TTS, upload ảnh/audio, nhập CSV, chia sẻ bộ từ, FSRS/SRS, CEFR hay tích hợp DKT.

## Thứ tự triển khai

| Giai đoạn | Đầu ra | Trạng thái |
| --- | --- | --- |
| [01 — Dữ liệu và quản lý bộ từ](phase-01-data-and-library-api.md) | Migration, CRUD, ownership, soft delete | Backend hoàn tất |
| [02 — Lượt ôn và chấm đáp án](phase-02-review-contract.md) | Queue, snapshot, command receipt, kết quả/lịch sử | Backend hoàn tất |
| [03 — Flutter và chịu lỗi mạng](phase-03-mobile-workflow.md) | Nhánh tài khoản gọi API; giữ motion và draft | Hoàn tất; 79 Flutter test + analyze qua |
| [04 — Thống kê và ranh giới tiến độ](phase-04-statistics-and-boundaries.md) | Home/Từ của tôi nhất quán; daily không bị cộng | HTTP và MuMu qua |
| [05 — Kiểm thử và bàn giao](phase-05-verification-and-rollout.md) | HTTP, Flutter, MuMu, APK và tài liệu | 141 unit + 12 vocabulary HTTP + 24 HTTP hồi quy; MuMu qua; release đã cài |

Thứ tự phụ thuộc: 01 → 02 → 03 → 04 → 05. Viết test nghiệp vụ cùng từng giai đoạn; giai đoạn 05 chạy hồi quy và nghiệm thu xuyên suốt. Không gán deadline hoặc assignee mới.

## Các nguyên tắc xuyên suốt

- Firebase chỉ xác thực; dữ liệu học nằm trong PostgreSQL qua NestJS. Không thêm Firestore.
- Tái sử dụng mẫu ownership, revision, snapshot và retry của learning; không ép từ cá nhân vào `LearningLesson`/MCQ năm câu.
- Không sửa pipeline `LearningActivitySession`, activity collector hoặc chính sách DailyPlan trong phạm vi này.
- Không ghi nhận quick rating như đáp án đúng. Điền từ sau khi xem tiếng Anh có `answerExposed=true`, chưa phải bằng chứng nhớ độc lập.
- Mỗi kết quả gắn `wordId + contentVersion`; sửa nội dung không làm thay đổi lịch sử cũ.
- Source hiện có của daily progress đang chưa commit: giữ nguyên, không gộp commit/push trong lượt lập kế hoạch.

## Nghiệm thu tổng thể

1. A tạo bộ và thêm từ; mở lại app/thiết bị khác đọc được dữ liệu đã được server xác nhận.
2. A đánh giá Dễ/Trung bình/Khó và làm điền từ; queue, nhãn và lịch sử đúng sau resume/retry.
3. B không đọc/sửa/ôn bộ từ của A; cache, draft, response đang bay không lọt sang B.
4. Home và Từ của tôi cùng có `Đã nhớ + Cần ôn = Tổng từ` đang hoạt động; skip/requeue không sửa nhãn.
5. Nộp lặp, mất ACK, hai thiết bị và sửa/xóa nội dung giữa lượt không nhân đôi kết quả.
6. Sau khi ôn từ, daily activeSeconds, lesson counts và kế hoạch ngày giữ nguyên.

## Nguồn và điểm còn mở

[Bằng chứng hiện trạng và quyết định thiết kế](reports/context-and-decisions.md).

Bằng chứng nghiệm thu hiện hành: [vocabulary-workflow.md](../../docs/vocabulary-workflow.md). Các checklist trong phase là tiêu chí gốc; trạng thái tổng hợp ở bảng trên và giới hạn kiểm thử trong tài liệu nghiệm thu được ưu tiên khi đánh giá phần đã chạy thực tế. iOS/cloud/hai thiết bị vật lý chưa được nghiệm thu. Không commit/push trong lượt triển khai.

Không còn câu hỏi sản phẩm bắt buộc để bắt đầu triển khai. Các mặc định còn lại được ghi cụ thể trong từng giai đoạn; việc đổi phạm vi sang ôn hoàn toàn offline, lịch SRS hoặc tính phút ngày cần kế hoạch bổ sung.
