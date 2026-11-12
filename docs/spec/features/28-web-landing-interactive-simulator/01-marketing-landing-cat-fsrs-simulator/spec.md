# Feature Specification: Web Marketing Landing & Interactive CAT/FSRS Simulator

## Mission (Sứ mệnh)

Đặc tả chi tiết cấu trúc dữ liệu, hành vi tương tác của từng phân khu trên trang đích `apps/web-frontend` và các tiêu chí nghiệm thu kỹ thuật.

---

# 1. Feature Overview (Tổng quan Tính năng)

Trang web giới thiệu và mô phỏng tương tác của LingoRoad gồm 10 phân khu nối tiếp, tích hợp bộ mô phỏng thuật toán CAT & FSRS trực quan cùng bộ chuyển đổi chế độ xem Học viên / Học thuật.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học truy cập website LingoRoad.
- **Tôi muốn**: Dùng thử ngay bài kiểm tra thích ứng và tính năng thẻ từ vựng thông minh ngay trên trang chủ.
- **Để tôi có thể**: Hiểu rõ cách LingoRoad cá nhân hóa lộ trình học trước khi bắt đầu.

---

# 3. Data Contracts (`src/types/landing.ts`)

```typescript
export interface NavItem {
  label: string;
  href: string;
}

export interface StatItem {
  id: string;
  value: string;
  label: string;
  description: string;
  badge?: string;
}

export interface FeatureItem {
  id: string;
  iconName: 'target' | 'gitBranch' | 'repeat' | 'bot' | 'award' | 'mic';
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  tag: string;
}

export interface ModelComparison {
  feature: string;
  traditional: string;
  lingoRoad: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface CatQuestionSimulation {
  id: string;
  question: string;
  cefrLevel: 'A2' | 'B1' | 'B2' | 'C1';
  thetaDifficulty: number;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}
```

---

# 4. Detailed UI/UX Behavior (Hành vi Chi tiết)

1. **`AdaptiveSimulator` (`#simulator`)**:
   - Chuyển đổi mượt mà giữa 2 tab: `1. Thử làm bài kiểm tra thích ứng` (`cat`) và `2. Thử tính năng nhắc ôn từ vựng` (`fsrs`).
   - Ở tab `cat`: Chọn phương án → bấm `Xác nhận câu trả lời` → hiển thị trạng thái đúng/sai kèm hộp giải thích `Gia sư AI giải thích` và cập nhật bảng `Đo lường năng lực trực tiếp` (`Trình độ dự đoán`, thanh tiến độ `Độ tin cậy của bài thi`).
   - Ở tab `fsrs`: Hiển thị thẻ từ `Serendipity` (`/ˌser.ənˈdɪp.ə.ti/`, bậc C1) và 4 nút đánh giá mức độ nhớ; cập nhật ngay 3 chỉ số: `Thời gian duy trì trí nhớ`, `Mức độ khó của từ`, và `Khả năng nhớ khi được nhắc lại (90% tối ưu)`.
2. **`MethodologySection` (`#methodology`)**:
   - Nút chuyển đổi `viewMode` giữa `'learner'` (*Dành cho người học*) và `'academic'` (*Chuyên sâu Đồ án & Thuật toán AI*).
   - Chế độ `'academic'` trình bày 4 thẻ thuật toán (IRT 3PL & EAP Bayes, FSRS-4.5, Curriculum DAG & BKT, AI Learning Advisor LLM + RAG) bằng ký tự Unicode và khối mã rõ ràng, hoàn toàn không dùng cú pháp LaTeX.

---

# 5. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Hiển thị đầy đủ 10 sections (`Navbar`, `HeroSection`, `StatsSection`, `FeaturesSection`, `AdaptiveSimulator`, `MethodologySection`, `ComparisonSection`, `FaqSection`, `CtaBanner`, `Footer`).
- [x] Trình mô phỏng CAT phân nhánh đúng câu hỏi khó hơn (B2) khi trả lời đúng và câu dễ hơn (A2) khi trả lời sai.
- [x] Trình mô phỏng FSRS cập nhật đúng `stabilityDays` và `difficultyScore` cho cả 4 mức đánh giá.
- [x] Khai báo kiểu TypeScript tường minh 100%, không sử dụng `any`, không có lỗi linter/build.

# End

