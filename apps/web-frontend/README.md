# 🌐 LingoRoad Web Frontend (Landing Page)

Ứng dụng Web Landing Page chính thức cho nền tảng học tiếng Anh thích ứng **LingoRoad** (Đồ án Tốt nghiệp).

## 🚀 Tính năng nổi bật của Landing Page

1. **Hero & Giá trị cốt lõi:**
   - Giới thiệu tổng quan định vị năng lực thích ứng với giao diện chuẩn Figma Design System của LingoRoad.
   - Thẻ dự đoán năng lực trực quan thời gian thực (CEFR B2, FSRS retention 94.8%).
2. **Hệ sinh thái tính năng (Features Showcase):**
   - Computerized Adaptive Testing (CAT & IRT 3PL).
   - Curriculum DAG & Mastery Gatekeeping.
   - Sổ tay từ vựng FSRS-4.5 Spaced Repetition.
   - Trợ lý sư phạm AI (LLM + RAG) & Đánh giá phát âm ASR.
   - Gamification, Streak & Bảng xếp hạng.
3. **Bộ mô phỏng trực tiếp (Interactive Simulator):**
   - Trải nghiệm bài thi thích ứng CAT thời gian thực với phân nhánh câu hỏi theo độ khó và thuật toán ước lượng EAP Bayes.
   - Mô phỏng tính toán chu kỳ trí nhớ FSRS-4.5 theo 4 cấp độ đánh giá (Again, Hard, Good, Easy).
4. **Nền tảng Khoa học & Thuật toán AI:**
   - Giới thiệu chi tiết các mô hình: IRT 3PL, FSRS-4.5, Curriculum DAG, RAG.
5. **So sánh ưu việt & FAQ:**
   - Đối chiếu LingoRoad với phương pháp truyền thống và giải đáp câu hỏi thường gặp.

## 🛠️ Công nghệ sử dụng

- **Framework:** Next.js 14 (App Router)
- **UI & Styling:** TailwindCSS, Lucide Icons
- **Design Tokens:** Hệ thống màu chuẩn từ `AppColors` (Primary `#59B070`, Primary Dark `#1E713B`, `#418A54`)
- **TypeScript:** Nghiêm ngặt (Strict typing, 0 `any`)

## 📦 Hướng dẫn khởi chạy

Chạy trực tiếp từ thư mục `apps/web-frontend`:

```bash
# Cài đặt dependencies
npm install

# Khởi chạy chế độ phát triển
npm run dev
```

Hoặc chạy từ thư mục gốc của dự án LingoRoad:

```bash
npm run web:dev
```

Mở trình duyệt tại địa chỉ: `http://localhost:3001`

