# Task: Implement Web Marketing Landing & Interactive CAT/FSRS Simulator

## Mission (Sứ mệnh)

Xây dựng hoàn chỉnh cổng thông tin giới thiệu và mô phỏng tương tác thuật toán LingoRoad trong `apps/web-frontend` với 10 phân khu giao diện, dữ liệu định kiểu chặt chẽ và chuẩn tương phản WCAG AA.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Trang Đích Giới thiệu & Mô phỏng Tương tác CAT/FSRS (`apps/web-frontend`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/28-web-landing-interactive-simulator/01-marketing-landing-cat-fsrs-simulator/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/28-web-landing-interactive-simulator/01-marketing-landing-cat-fsrs-simulator/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/28-web-landing-interactive-simulator/01-marketing-landing-cat-fsrs-simulator/spec.md)

---

# 3. Description (Mô tả)

- Định nghĩa các kiểu dữ liệu trong `apps/web-frontend/src/types/landing.ts` và nội dung tĩnh trong `apps/web-frontend/src/data/landing-content.ts`.
- Xây dựng 10 components trong `apps/web-frontend/src/components/landing/`:
  - `Navbar.tsx`, `HeroSection.tsx`, `StatsSection.tsx`, `FeaturesSection.tsx`, `AdaptiveSimulator.tsx`, `MethodologySection.tsx`, `ComparisonSection.tsx`, `FaqSection.tsx`, `CtaBanner.tsx`, `Footer.tsx`.
- Lắp ghép trang chủ tại `apps/web-frontend/src/app/page.tsx` và cấu hình style chuẩn WCAG AA tại `apps/web-frontend/src/app/globals.css`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Toàn bộ giao diện và logic mô phỏng tương tác trên `apps/web-frontend`.
- Tối ưu hóa responsive trên Desktop, Tablet và Mobile.

### NGOÀI PHẠM VI (OUT):
- Trang quản trị CMS nội bộ (Phase 2).

---

# 5. Implementation Checklist (Danh mục Triển khai)

- [x] Tạo `apps/web-frontend/src/types/landing.ts` và `apps/web-frontend/src/data/landing-content.ts`.
- [x] Triển khai `Navbar.tsx`, `HeroSection.tsx`, `StatsSection.tsx`, `FeaturesSection.tsx`.
- [x] Triển khai `AdaptiveSimulator.tsx` với 2 tab tương tác CAT 3PL và FSRS-4.5.
- [x] Triển khai `MethodologySection.tsx` với bộ chuyển đổi góc nhìn `learner` / `academic`.
- [x] Triển khai `ComparisonSection.tsx`, `FaqSection.tsx`, `CtaBanner.tsx`, `Footer.tsx`.
- [x] Cấu hình `globals.css` đảm bảo màu chữ trắng tương phản cao trên `.btn-primary` khi hover/active.

---

# 6. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End

