# Request for Comments (RFC) - Web Landing & Interactive CAT/FSRS Simulator Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật của ứng dụng Web Frontend (`apps/web-frontend`) xây dựng trên Next.js 14 App Router, TypeScript nghiêm ngặt và Tailwind CSS, cung cấp trang giới thiệu sản phẩm và trình mô phỏng tương tác thuật toán CAT 3PL & FSRS-4.5 phía client.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Web Marketing Landing & Interactive Simulator (`docs/spec/features/28-web-landing-interactive-simulator/01-marketing-landing-cat-fsrs-simulator/prd.md`).
- Triển khai tại workspace `apps/web-frontend`.

---

# 2. Problem (Bài toán Kỹ thuật)

- Làm thế nào để xây dựng một trang đích tốc độ tải tức thì (Static/SSR friendly), không phụ thuộc vào kết nối database khi demo thuật toán, nhưng vẫn phản ánh trung thực cơ chế phân nhánh câu hỏi của CAT và cập nhật tham số trí nhớ `Stability (S)` / `Difficulty (D)` của FSRS-4.5?
- Đảm bảo khả năng đọc tốt trên mọi kích thước màn hình và giữ nguyên độ tương phản chữ trắng trên nền nút bấm chính (`.btn-primary`) khi hover/active theo đúng quy chuẩn Web UI của LingoRoad.

---

# 3. Proposed Architecture (Kiến trúc Đề xuất)

```
apps/web-frontend/src/
├── app/
│   ├── globals.css              # Hệ thống màu sắc, utility .btn-primary (!important white text), WCAG AA
│   ├── layout.tsx               # Root Layout, Metadata SEO & Font chữ
│   └── page.tsx                 # Lắp ghép 10 sections của Landing Page
├── components/landing/
│   ├── Navbar.tsx               # Client Component: điều hướng & mobile drawer
│   ├── HeroSection.tsx          # Server/Static Component: giới thiệu & preview card
│   ├── StatsSection.tsx         # Hiển thị 4 thẻ số liệu thống kê
│   ├── FeaturesSection.tsx      # Hiển thị 6 tính năng cốt lõi
│   ├── AdaptiveSimulator.tsx    # Client Component: State machine mô phỏng CAT & FSRS
│   ├── MethodologySection.tsx   # Client Component: Mode switcher ('learner' | 'academic')
│   ├── ComparisonSection.tsx    # Bảng đối chiếu phương pháp truyền thống vs LingoRoad
│   ├── FaqSection.tsx           # Client Component: Accordion câu hỏi thường gặp
│   ├── CtaBanner.tsx            # Khối kêu gọi hành động cuối trang
│   └── Footer.tsx               # Chân trang
├── data/
│   └── landing-content.ts       # Dữ liệu chuẩn hóa: NAV_ITEMS, STATS_DATA, FEATURES_DATA, SIMULATION_QUESTIONS...
└── types/
    └── landing.ts               # Interfaces: NavItem, StatItem, FeatureItem, ModelComparison, FaqItem, CatQuestionSimulation
```

---

# 4. Interactive Simulator State Design (`AdaptiveSimulator.tsx`)

### 4.1. Mô phỏng Phân nhánh Thích ứng CAT (`activeTab === 'cat'`)
- Trạng thái: `questionIndex`, `selectedOption`, `isAnswerSubmitted`, `thetaScore` (khởi tạo `0.0`), `accuracyProgress` (khởi tạo `55%`), `historyAnswers`.
- Khi nộp câu trả lời (`handleCatSubmit`):
  - Nếu đúng (`selectedOption === currentQuestion.correctAnswerIndex`): `thetaScore` tăng `+0.65`.
  - Nếu sai: `thetaScore` giảm `-0.55`.
  - `accuracyProgress = Math.min(95, prev + 20)`.
- Khi chuyển câu (`handleNextCatQuestion`):
  - Từ câu gốc B1 (`questionIndex === 0`), nếu trả lời đúng chuyển sang câu khó B2 (`index = 1`), nếu trả lời sai chuyển sang câu cơ bản A2 (`index = 2`).
- Ánh xạ huy hiệu CEFR trực tiếp từ `thetaScore` (`getCefrBadge`): `A1` (< -0.8), `A2` (≥ -0.8), `B1` (≥ 0.0), `B2` (≥ 0.5), `C1` (≥ 1.2).

### 4.2. Mô phỏng Nhắc ôn Từ vựng FSRS (`activeTab === 'fsrs'`)
- Trạng thái: `fsrsRating` (`'again' | 'hard' | 'good' | 'easy' | null`), `stabilityDays` (khởi tạo `3.2` ngày), `difficultyScore` (khởi tạo `4.8 / 10`).
- Khi người dùng chọn mức độ nhớ (`handleFsrsReview`):
  - `again`: `stabilityDays = 0.2`, `difficultyScore = min(10, prev + 1.2)`.
  - `hard`: `stabilityDays = 1.5`, `difficultyScore = min(10, prev + 0.5)`.
  - `good`: `stabilityDays = 4.8`, `difficultyScore = max(1, prev - 0.2)`.
  - `easy`: `stabilityDays = 11.4`, `difficultyScore = max(1, prev - 0.8)`.

---

# 5. Styling & Accessibility Standards (`globals.css`)

- Sử dụng bảng màu `brand` (xanh lá chủ đạo) và `slateDark` đồng bộ với nhận diện thương hiệu LingoRoad.
- Class `.btn-primary` sử dụng `color: #ffffff !important` ở cả trạng thái bình thường, `:hover`, `:focus` và `:active` để đảm bảo độ tương phản WCAG AA tuyệt đối.

# End

