# Feature Specification: Multi-Skill CEFR Aggregation & Diagnostic Report

## Mission (Sứ mệnh)

Đặc tả chi tiết các quy tắc tính toán điểm tổng hợp, cơ chế xếp loại năng lực ngôn ngữ CEFR, định dạng dữ liệu biểu đồ mạng nhện và tiêu chuẩn nghiệm thu cho báo cáo chẩn đoán kết quả thi.

---

# 1. Feature Overview (Tổng quan Tính năng)

Tự động tổng hợp điểm số từ 4 kỹ năng sau khi AI hoàn tất việc chấm bài thi thử, đưa ra điểm số tổng thể trên thang 10, phân loại Bậc CEFR (A1 - C2), phân tích điểm mạnh/điểm yếu và trả về dữ liệu sẵn sàng cho biểu đồ Radar trên ứng dụng di động.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Học viên vừa hoàn thành bài thi thử 4 kỹ năng.
- **Tôi muốn**: Nhận bảng điểm chi tiết kèm biểu đồ trực quan và nhận xét cụ thể về từng kỹ năng.
- **Để tôi có thể**: Nhận diện rõ trình độ hiện tại của mình và biết chính xác cần tập trung cải thiện kỹ năng nào.

---

# 3. Detailed Behavior & Business Rules (Hành vi & Quy tắc Nghiệp vụ)

### 3.1. Quy tắc Xử lý Điểm Thành phần
- Điểm mỗi kỹ năng nằm trong khoảng từ `0.0` đến `10.0`, bước nhảy `0.5`.
- Nếu có một kỹ năng bị bỏ trắng hoàn toàn hoặc 0 điểm, điểm của kỹ năng đó ghi nhận là `0.0` và vẫn tham gia vào công thức chia đều cho 4.

### 3.2. Quy tắc Xác định Kỹ năng Yếu nhất (Bottleneck Skill)
- Kỹ năng có điểm số thấp nhất được xác định là `weakestSkill`.
- Nếu có 2 kỹ năng bằng điểm thấp nhất, ưu tiên cảnh báo kỹ năng sản sinh (Productive Skills: Writing/Speaking) trước kỹ năng tiếp nhận (Receptive Skills: Listening/Reading).

---

# 4. Data Contracts (Hợp đồng Dữ liệu)

### 4.1. DTO Kết quả Chi tiết Bài thi Thử
```typescript
export interface MockExamResultDto {
  sessionId: string;
  completedAt: string;
  overallScore: number;
  overallCefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  scores: {
    listening: number;
    reading: number;
    writing: number;
    speaking: number;
  };
  radarChartData: Array<{
    skill: string;
    score: number;
    maxScore: number;
  }>;
  diagnostic: {
    weakestSkill: string;
    summaryVi: string;
    recommendations: string[];
  };
}
```

---

# 5. Acceptance Criteria (Tiêu chuẩn Nghiệm thu)

### Kịch bản 1: Tổng hợp điểm đạt bậc B2
- **Given**: Thí sinh có điểm các kỹ năng: Listening = 7.5, Reading = 8.0, Writing = 6.0, Speaking = 6.5.
- **When**: `CefrAggregationService.aggregate(sessionId)` được thực thi.
- **Then**:
  - Điểm trung bình cộng: `(7.5 + 8.0 + 6.0 + 6.5) / 4 = 7.0`.
  - Bậc CEFR xác định: `B2`.
  - Kỹ năng yếu nhất xác định: `WRITING`.
  - Cập nhật `mock_exam_sessions` với trạng thái `COMPLETED`.

### Kịch bản 2: Làm tròn chuẩn 0.5
- **Given**: Thí sinh có tổng điểm 4 kỹ năng là `23.0` (Trung bình = 5.75).
- **When**: Tính điểm làm tròn.
- **Then**: Điểm Overall được làm tròn lên thành `6.0` (Đạt chuẩn B2).
