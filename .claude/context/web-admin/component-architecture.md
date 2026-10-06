# LingoRoad Web Admin Component Architecture (Next.js)

## 1. Server vs Client Components
- Tận dụng tối đa **Server Components** mặc định của Next.js (App Router) để tăng tốc độ load trang và giảm dung lượng tải xuống của trình duyệt.
- Chỉ đặt `'use client'` ở đầu các file thực sự cần tương tác UI (như Form nhập liệu, nút bấm, bảng có tính năng Sort/Filter, hoặc khi dùng Hooks).

## 2. Table & Pagination (Bảng dữ liệu & Phân trang)
- Bắt buộc sử dụng component phân trang chung (ví dụ: `<GlobalPagination />`) cho tất cả các trang danh sách (List Pages) trong Admin Portal.
- Các bảng dữ liệu (như bảng danh sách Users, Courses) phải thiết kế đồng nhất: viền mỏng, tiêu đề in hoa chữ nhỏ, có trạng thái hover rõ ràng.

## 3. Theming (Giao diện chuẩn)
- Web Admin cần tuân thủ thiết kế Sidebar bên trái, Navbar hoặc Breadcrumbs bên trên để dễ điều hướng.
- Đảm bảo độ tương phản màu sắc (ví dụ: nút bấm chính (Primary Button) bắt buộc phải có chữ trắng nổi bật trên nền màu chủ đạo) tuân thủ đúng luật lệ đã đề ra trong `AGENTS.md`.
