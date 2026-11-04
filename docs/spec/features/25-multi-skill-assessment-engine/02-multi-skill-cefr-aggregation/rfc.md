# Request for Comments (RFC) - Multi-Skill CEFR Aggregation Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thuật toán quy đổi điểm thô sang thang điểm chuẩn 10, công thức làm tròn CEFR tổng thể và kiến trúc service tổng hợp kết quả thi thử trong NestJS.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Multi-Skill CEFR Aggregation (`docs/spec/features/25-multi-skill-assessment-engine/02-multi-skill-cefr-aggregation/prd.md`).
- Tiếp nhận kết quả từ `MockSubmission` của Feature 25-01.

---

# 2. Problem (Bài toán Kỹ thuật)

- Mỗi kỹ năng có cơ chế chấm điểm và định dạng kết quả riêng: trắc nghiệm (đúng/sai nhị phân), viết luận (JSON điểm 4 tiêu chí), phát âm (WPM, ngữ âm, lưu loát).
- Cần một bộ chuyển đổi thống nhất (Score Converter) biến mọi định dạng này thành điểm số chuẩn 10.0 độc lập trước khi chạy công thức tổng hợp.

---

# 3. Algorithm & Conversion Formulas

### 3.1. Bảng Quy đổi Trắc nghiệm (Listening & Reading)
Công thức nội suy tuyến tính chuẩn hóa:
```typescript
function rawToScale10(correctCount: number, totalQuestions: number): number {
  const percentage = correctCount / totalQuestions;
  const scaled = percentage * 10;
  // Làm tròn đến 0.5 gần nhất
  return Math.round(scaled * 2) / 2;
}
```

### 3.2. Công thức Trọng số Bài Viết (Writing Weighting)
Task 1 (thư 150 từ) chiếm 33%, Task 2 (luận 250 từ) chiếm 67%:
```
Điểm Writing = (Điểm Task 1 × 1 + Điểm Task 2 × 2) ÷ 3
```

### 3.3. Ánh xạ Điểm Trung bình sang Bậc CEFR
```typescript
export function mapScoreToCefr(overallScore: number): CefrLevel {
  if (overallScore < 2.5) return CefrLevel.A1;
  if (overallScore < 4.0) return CefrLevel.A2;
  if (overallScore < 6.0) return CefrLevel.B1;
  if (overallScore < 8.5) return CefrLevel.B2;
  return CefrLevel.C1;
}
```

---

# 4. Service Architecture (`CefrAggregationService`)

```
                 [mock_exam.submitted_for_evaluation]
                                  │
                                  ▼
                     CefrEvaluationEventListener
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      ▼                           ▼                           ▼
Listening/Reading           Writing Evaluator          Speaking Evaluator
Scoring (Local DB)           (via ML AWE)              (via ML Speech)
      │                           │                           │
      └───────────────────────────┼───────────────────────────┘
                                  ▼
                       CefrAggregationService
                                  │
         1. Quy đổi điểm từng kỹ năng về thang 10.0
         2. Tính điểm Overall và xác định Bậc CEFR
         3. Sinh JSON chẩn đoán điểm mạnh/yếu
         4. Cập nhật MockExamSession -> COMPLETED
                                  │
                                  ▼
             Phát sự kiện [mock_exam.completed]
```

---

# 5. Diagnostic JSON Output Structure

Dữ liệu chẩn đoán được lưu trong trường `skillResults` của phiên thi:
```json
{
  "radarChart": {
    "listening": 7.5,
    "reading": 8.0,
    "writing": 6.0,
    "speaking": 6.5
  },
  "overallScore": 7.0,
  "overallCefr": "B2",
  "weakestSkill": "WRITING",
  "strengths": ["Khả năng đọc hiểu văn bản học thuật và suy luận tốt."],
  "weaknesses": ["Vốn từ vựng bài viết còn đơn giản, thiếu từ nối học thuật."],
  "recommendedAction": "Luyện tập thêm dạng bài Opinion Essay trong Practice Mode."
}
```

