# /tech-decision Command

## Mission (Sứ mệnh)

Evaluate any proposal to introduce or replace technology within LingoRoad. (Đánh giá đề xuất áp dụng hoặc thay thế công nghệ trong LingoRoad).

As a graduation project, technology decisions must prioritize: (Vì là đồ án tốt nghiệp, các quyết định công nghệ phải ưu tiên):
1. Development speed (Tốc độ phát triển).
2. AI coding productivity (Sự hỗ trợ tốt từ AI).
3. Ease of demonstration (Dễ dàng demo và giải thích trước hội đồng).
4. Academic correctness (Sự chuẩn mực về lý thuyết và kiến trúc).

---

# Phase 1: Understand The Problem (Giai đoạn 1: Hiểu bài toán)

What problem are we trying to solve? (Chúng ta đang cố gắng giải quyết bài toán gì?)
- Current pain points. (Vấn đề hiện tại).
- Expected outcome. (Kết quả mong đợi).

---

# Phase 2: Architecture Compatibility (Giai đoạn 2: Đánh giá Tương thích)

Evaluate (Đánh giá):
- AI Support: Does Claude/GPT generate high-quality code for this? (AI có hỗ trợ tốt không?)
- Learning Curve: Is it easy to learn in a short time? (Có dễ học trong thời gian ngắn không?)
- Setup Complexity: Is it easy to run on localhost? (Có dễ cài đặt chạy trên máy cá nhân không?)

---

# Phase 3: Alternatives Analysis (Giai đoạn 3: So sánh Giải pháp Thay thế)

Analyze at least 2 options (Phân tích ít nhất 2 lựa chọn):
- Benefits. (Ưu điểm).
- Drawbacks. (Nhược điểm).

---

# Phase 4: Final Recommendation (Giai đoạn 4: Đề xuất Cuối cùng)

Provide (Cung cấp):
**Decision (Quyết định):** APPROVE / REJECT (Phê duyệt / Từ chối).
**Reasoning (Lập luận):** Tóm tắt lý do.

---

# LingoRoad Technology Guardrails (Quy chuẩn Công nghệ Đồ án)

**Backend:** NestJS + TypeScript.
**Mobile:** Flutter + Dart.
**Database:** PostgreSQL.
**ORM:** Prisma.

Focus on mastering the current stack instead of adding unnecessary complexity. (Tập trung làm chủ stack công nghệ hiện tại thay vì đưa thêm sự phức tạp không cần thiết).
