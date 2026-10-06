# API ↔ Frontend Gap Analysis (Phân tích chênh lệch API và Frontend)

**Scope (Phạm vi):** LingoRoad's `NestJS` backend API (`src/backend-nestjs`) compared against the needs of its two frontends: the Flutter mobile app (`src/mobile`) and the React admin web app (`src/web-admin`). 
*(So sánh độ bao phủ của Backend NestJS so với nhu cầu thực tế của Mobile App và Web Admin).*

## 1. Phương pháp đánh giá (Method)
- API được kiểm tra chéo (cross-checked) thông qua `src/backend-nestjs/src/modules/` và OpenAPI/Swagger tại `/api/docs`.
- Frontend được đánh giá dựa trên UI/UX Figma và yêu cầu hệ thống.

Mỗi tiêu chí được phân loại (Classification):
- ✅ **Fulfilled (Đã đáp ứng):** Backend đã có API, Frontend chỉ việc gọi.
- ⚠️ **Partial (Đáp ứng một phần):** Đã có API nhưng thiếu trường dữ liệu hoặc chưa đúng format.
- ❌ **Missing (Thiếu hoàn toàn):** Chưa có API.

## 2. API Inventory (Danh sách API hiện trạng)

*(Sẽ được AI liên tục cập nhật khi code tính năng mới)*

| Nhóm Tính Năng (Feature Group) | Trạng Thái Mobile | Trạng Thái Web Admin | Ghi chú (Notes) |
|---|---|---|---|
| Xác thực (Auth) | ⚠️ Partial | ❌ Missing | Cần bổ sung phân quyền Role cho Admin |
| Người dùng (Users) | ✅ Fulfilled | ❌ Missing | Admin cần API CRUD User |
| Khóa học (Courses) | ❌ Missing | ❌ Missing | Đang thiết kế CSDL |
| Bài học (Lessons) | ❌ Missing | ❌ Missing | Đang thiết kế CSDL |
| Lịch sử học (Progress) | ❌ Missing | ❌ Missing | Phụ thuộc vào tính năng Lesson |
| AI Placement Test | ❌ Missing | Không cần (N/A) | Giao tiếp với service AI (Python) |
