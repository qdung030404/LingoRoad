# Product Requirements Document (PRD) - Web Marketing Landing & Interactive CAT/FSRS Simulator

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho Cổng thông tin Giới thiệu & Mô phỏng Tương tác Trực quan của LingoRoad (`apps/web-frontend`), giúp người học mới và hội đồng chuyên môn trải nghiệm trực tiếp thuật toán Kiểm tra Thích ứng (CAT 3PL) và Lặp lại Ngắt quãng (FSRS-4.5) ngay trên trình duyệt mà không cần cài đặt ứng dụng.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Các thuật toán cốt lõi của LingoRoad (IRT 3PL CAT, FSRS-4.5, Curriculum DAG, AI Learning Advisor RAG) mang tính học thuật cao; nếu chỉ mô tả bằng văn bản tĩnh, người học phổ thông sẽ khó hình dung giá trị thực tế trong khi hội đồng đánh giá lại cần xem cơ sở toán học rõ ràng.
- Cần một trang đích (Landing Page) hiện đại, chuẩn tương phản WCAG AA, vừa có trình mô phỏng tương tác trực tiếp (Interactive Simulator) vừa có bộ chuyển đổi góc nhìn linh hoạt giữa **Dành cho người học** (`learner`) và **Chuyên sâu Đồ án & Thuật toán AI** (`academic`).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Trải nghiệm tương tác trực tiếp (Zero-Signup Sandbox)**: Cho phép người truy cập làm thử câu hỏi thích ứng CAT (nhánh câu hỏi tự động tăng/giảm độ khó theo kết quả Đúng/Sai) và bấm thử 4 mức đánh giá thẻ từ vựng FSRS (`Quên mất rồi`, `Hơi khó nhớ`, `Nhớ tốt`, `Rất dễ nhớ`).
- **Song hành 2 góc nhìn (`learner` vs `academic`)**: Cung cấp nút chuyển đổi tức thì giữa ngôn ngữ bình dân dễ hiểu và bảng công thức định lượng chuyên sâu trong `MethodologySection`.
- **Tuân thủ chuẩn thiết kế Web UI**: Đạt chuẩn tương phản WCAG AA, nút bấm chính (`.btn-primary`) luôn giữ chữ trắng (`!text-white`) kể cả khi hover/active.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Thay thế ứng dụng học tập chính thức trên Mobile Flutter.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Prospective Learners**: Người học tìm hiểu tính năng và tải ứng dụng LingoRoad.
- **Academic Reviewers / Advisors**: Giảng viên hướng dẫn và hội đồng chấm đồ án tốt nghiệp thẩm định kiến trúc thuật toán của hệ thống.

---

# 5. User Journey (Hành trình Người dùng)

1. Người dùng truy cập trang chủ `apps/web-frontend` và xem tổng quan giá trị cốt lõi tại `HeroSection`, `StatsSection` và `FeaturesSection`.
2. Cuộn xuống khu vực **Trải nghiệm tính năng trực tiếp** (`AdaptiveSimulator`):
   - **Tab 1 (CAT Simulator)**: Chọn đáp án cho câu hỏi B1; nếu trả lời đúng, năng lực dự đoán `thetaScore` tăng lên và câu tiếp theo tự động phân nhánh sang câu khó hơn (B2); nếu trả lời sai, phân nhánh sang câu cơ bản hơn (A2) kèm giải thích chi tiết từ Gia sư AI.
   - **Tab 2 (FSRS Simulator)**: Đánh giá mức độ nhớ thẻ từ C1 (*"Serendipity"*) và quan sát sự thay đổi tức thì của Độ bền trí nhớ (`stabilityDays`) và Độ khó (`difficultyScore`).
3. Tại `MethodologySection`, bấm chuyển đổi giữa chế độ **Dành cho người học** và **Chuyên sâu Đồ án & Thuật toán AI** để xem chi tiết mô hình IRT 3PL, FSRS-4.5, Curriculum DAG + BKT và LLM + RAG.
4. Xem bảng đối chiếu truyền thống vs LingoRoad (`ComparisonSection`), câu hỏi thường gặp (`FaqSection`) và kêu gọi hành động (`CtaBanner`).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- **10 Phân khu Giao diện Hoàn chỉnh (`src/components/landing/`)**:
  1. `Navbar`: Thanh điều hướng cố định có menu neo (anchor links) và menu responsive trên di động.
  2. `HeroSection`: Khối tiêu đề chính, huy hiệu công nghệ và thẻ mô phỏng giao diện học tập.
  3. `StatsSection`: 4 chỉ số định lượng nổi bật (`15 câu`, `90%`, `CEFR A1–C2`, `24/7`).
  4. `FeaturesSection`: Lưới 6 tính năng cốt lõi của hệ sinh thái LingoRoad.
  5. `AdaptiveSimulator`: Trình mô phỏng tương tác 2 tab (`cat` và `fsrs`).
  6. `MethodologySection`: Chuyển đổi 2 chế độ hiển thị `learner` và `academic` (hiển thị công thức bằng plain text/Unicode chuẩn, không dùng LaTeX).
  7. `ComparisonSection`: Bảng so sánh 6 tiêu chí giữa cách học truyền thống và LingoRoad.
  8. `FaqSection`: Accordion giải đáp các câu hỏi thường gặp.
  9. `CtaBanner`: Biểu ngữ kêu gọi trải nghiệm ứng dụng.
  10. `Footer`: Thông tin đồ án, liên kết điều hướng và bản quyền.

---

# 7. Business Rules & Design Constraints (Quy tắc & Ràng buộc Thiết kế)

- Toàn bộ dữ liệu tĩnh và kịch bản câu hỏi mô phỏng được định nghĩa tập trung có kiểu dữ liệu tường minh tại `src/data/landing-content.ts` và `src/types/landing.ts` (không dùng `any`).
- Mỗi component có độ dài gọn gàng (< 500 dòng), tuân thủ nghiêm ngặt giới hạn độ dài tệp của dự án.

# End

