# Request for Comments (RFC) - Admin Action Audit Logging Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế `AuditLogInterceptor` trong NestJS để tự động ghi vết hành động bất đồng bộ vào cơ sở dữ liệu.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Audit Logging (`docs/spec/features/22-admin-audit-analytics/01-audit-logging-interceptor/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để ghi nhật ký kiểm toán tự động mà không phải lặp lại code gọi hàm log trong từng UseCase hay Controller Handler?

---

# 3. Goals (Mục tiêu)

- Tự động hóa hoàn toàn bằng NestJS Interceptor.
- Ghi log bất đồng bộ (Non-blocking I/O).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Không log mật khẩu hoặc access token.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
HTTP Request ──> [RolesGuard: ADMIN]
                      │
                      ▼
             [AuditLogInterceptor]
             - Capture: adminUserId, Method, URL, IP, RequestBody
                      │
                      ▼
             Execute Controller Handler
                      │
                      ▼
             [On Success: RxJS tap()]
             - Capture: Response Data
             - Insert into audit_logs table (Async)
                      │
                      ▼
             Return Response to Client
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Ghi dữ liệu vào bảng `audit_logs`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
model AuditLog {
  id           String   @id @default(uuid()) @db.Uuid
  adminUserId  String   @map("admin_user_id") @db.Uuid
  action       String   @db.VarChar(100)
  resourceType String   @map("resource_type") @db.VarChar(100)
  resourceId   String?  @map("resource_id") @db.VarChar(100)
  beforeState  Json?    @map("before_state") @db.JsonB
  afterState   Json?    @map("after_state") @db.JsonB
  ipAddress    String?  @map("ip_address") @db.VarChar(45)
  createdAt    DateTime @default(now()) @map("created_at")

  adminUser    User     @relation(fields: [adminUserId], references: [id], onDelete: Restrict)

  @@index([adminUserId, resourceType, createdAt])
  @@map("audit_logs")
}
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `GET /admin/audit-logs?page=1&limit=20&adminUserId=uuid`
- **Response**: `200 OK`

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Lỗi khi ghi audit log không được làm sập request chính của Admin; bắt lỗi và log error ra console.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Tự động mask/loại bỏ các trường nhạy cảm (`password`, `token`, `secret`) trước khi lưu `beforeState`/`afterState`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Index kết hợp `[adminUserId, resourceType, createdAt]` giúp tìm kiếm audit log nhanh chóng.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Dùng trigger trong PostgreSQL: Khó lấy thông tin ngữ cảnh IP và JWT userId từ tầng ứng dụng. NestJS Interceptor là giải pháp phù hợp nhất (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test Interceptor bắt đúng hành động POST/PUT/DELETE.
  - Test bỏ qua GET request.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng bản ghi audit log được tạo mỗi ngày.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
