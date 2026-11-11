# Feature Specification: Mock Test Session Lifecycle

## Mission (Sứ mệnh)

Đặc tả chi tiết các quy tắc nghiệp vụ cho máy trạng thái phòng thi, cơ chế tự động nộp bài khi quá giờ, định dạng DTO trao đổi dữ liệu và tiêu chuẩn nghiệm thu cho phiên thi thử 4 kỹ năng.

---

# 1. Feature Overview (Tổng quan Tính năng)

Quản lý toàn bộ quy trình làm bài thi thử chuẩn hóa qua 4 kỹ năng tuần tự: Listening (40p), Reading (60p), Writing (60p), Speaking (12p). Đảm bảo tính trung thực bằng việc kiểm soát thời gian tuyệt đối từ server và tự động thu bài khi hết giờ.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Thí sinh chuẩn bị thi chứng chỉ tiếng Anh.
- **Tôi muốn**: Được thi thử một đề thi hoàn chỉnh với đồng hồ đếm ngược và chuyển phần thi tự động như phòng thi thực tế.
- **Để tôi có thể**: Rèn luyện tâm lý phòng thi, căn chỉnh thời gian làm bài hợp lý cho từng phần.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 3.1. Quy tắc Kiểm soát Thời gian & Grace Period
- Máy chủ tính toán `sectionExpiresAt` theo chuẩn UTC tuyệt đối.
- Cho phép thời gian bù trừ mạng (Network Grace Period) tối đa là **10 giây**.
- Nếu client gửi bài thi sau `sectionExpiresAt + 10s`, hệ thống vẫn lưu lại các câu đã làm trước đó nhưng đánh dấu phần thi là `AUTO_EXPIRED` và từ chối các câu trả lời mới nộp.

### 3.2. Chuyển phần thi tự động (Auto-transition)
- Client chạy timer đếm ngược song song dựa trên `sectionExpiresAt` do server trả về.
- Khi timer về 00:00, client tự động kích hoạt lệnh nộp bài phần hiện tại và chuyển sang nhận đề của phần thi kế tiếp.

---

# 4. Data Contracts (Hợp đồng Dữ liệu)

### 4.1. DTO Bắt đầu phiên thi
```typescript
export interface MockExamSessionResponseDto {
  sessionId: string;
  currentSection: 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING';
  status: string;
  sectionStartedAt: string;
  sectionExpiresAt: string;
  durationSeconds: number;
  items: AssessmentItemGroupDto[];
}
```

### 4.2. DTO Nộp bài từng Section
```typescript
export class SubmitSectionDto {
  answers: Array<{
    itemId: string;
    selectedOption?: string;
    essayText?: string;
    audioUrl?: string;
  }>;
}
```

---

# 5. Acceptance Criteria (Tiêu chuẩn Nghiệm thu)

### Kịch bản 1: Nộp bài đúng giờ và chuyển Section tiếp theo
- **Given**: Thí sinh đang ở phần thi Listening và gửi bài nộp khi còn 2 phút.
- **When**: Gọi API `POST /api/v1/mock-exams/:id/sections/LISTENING/submit`.
- **Then**:
  - Lưu toàn bộ đáp án phần Listening vào `mock_submissions`.
  - Cập nhật trạng thái session sang `IN_PROGRESS_READING`.
  - Trả về danh sách câu hỏi phần Reading kèm `sectionExpiresAt = now() + 60 phút`.

### Kịch bản 2: Tự động thu bài khi quá giờ
- **Given**: Thí sinh làm phần Reading nhưng để hết giờ mà không bấm nộp.
- **When**: Đồng hồ client đếm ngược về 0 và tự động gửi request nộp bài.
- **Then**:
  - Server ghi nhận các câu trả lời đã điền.
  - Chuyển tiếp phiên thi sang phần Writing mà không làm mất bài thi của thí sinh.
