## Why

LingoRoad đã có lượt luyện nghe lưu trên máy chủ nhưng trải nghiệm chữa bài còn thiếu: player bị tạo lại theo câu hỏi và màn kết quả chưa cho nghe đối chiếu transcript. Cần đặc tả một vòng luyện nghe hoàn chỉnh cho người học củng cố nền tảng trước khi mở rộng kho bài và cá nhân hóa.

## What Changes

- Lập ngày 17/11/2026; luồng nay đã được triển khai cục bộ. Xem [bằng chứng và giới hạn nghiệm thu](implementation.md); nội dung bên dưới ghi phạm vi của thay đổi.
- Hoàn thiện danh sách Nghe, chuẩn bị ngắn, player xuyên suốt lượt học, phản hồi từng câu và chữa bài sau khi nộp.
- Bổ sung hợp đồng nội dung có phân đoạn transcript, mốc thời gian và mã kỹ năng Listening; giữ mô hình LearningLesson/LearningAttempt.
- Giữ transcript và thông tin đoạn bằng chứng ở máy chủ đến khi hoàn tất lượt; giữ chấm điểm, khóa đáp án và bảo vệ phiên bản hiện hành.
- Quy định lỗi audio, mất phản hồi mạng, thoát/hủy bài, đổi tài khoản và tương thích bài cũ.
- Nghiệm thu v1 bằng một bài A1 riêng với 5 câu trắc nghiệm và audio 30–90 giây. Bộ 6 bài A1–A2 là giai đoạn sau.
- Ngoài phạm vi: lưu để tiếp tục bài chưa nộp, chép chính tả tự nhập, AI giải thích Listening, thay đổi CEFR, DKT và phiên PracticeSession mới.

## Capabilities

### New Capabilities

- `listening-practice`: vòng luyện nghe có chuẩn bị, phát audio liên tục giữa các câu, chấm từng câu, chữa bài bằng transcript có timestamp và lưu kết quả.

### Modified Capabilities

Không có capability đã tồn tại trong `openspec/specs` cần delta. Các mô tả Learning trong `docs/spec` là tài liệu nền; đặc tả này bổ sung phạm vi Listening v1, không tuyên bố các yêu cầu mới đã triển khai.

## Impact

- Flutter: LearningCatalogue, LearningLessonIntroPage, LearningAttemptPage, LearningAudio, LearningAttemptController và LearningRepository.
- NestJS: LearningContent, LearningQuestion, validateLearningContent, publicContent, publicAttempt và seed validation.
- Nội dung: một bài A1 mới, audio có phiên bản, transcript, mốc thời gian, câu hỏi và giải thích tiếng Việt được rà soát.
- Giữ các endpoint `/learning/*`, envelope `{ success: true, data: object }`, bảng Learning hiện có và PlanningService hiện hành. Không thêm dependency hoặc migration làm điều kiện mặc định.
- Tài liệu chi tiết: [spec](specs/listening-practice/spec.md), [thiết kế](design.md), [checklist](tasks.md).
