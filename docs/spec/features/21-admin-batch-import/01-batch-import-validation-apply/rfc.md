# Request for Comments (RFC) - Batch Content Import Pipeline Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, cấu trúc JSON Bundle Schema và chiến lược thực thi Interactive Transaction trên PostgreSQL cho việc nhập dữ liệu hàng loạt.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Batch Content Import (`docs/spec/features/21-admin-batch-import/01-batch-import-validation-apply/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để upsert hàng trăm bản ghi phụ thuộc lẫn nhau (`Skill -> Lesson -> LessonItem -> Item`) trong một transaction nguyên tử mà không bị lỗi vi phạm ràng buộc khóa ngoại?

---

# 3. Goals (Mục tiêu)

- Tự động phân giải thứ tự phụ thuộc: `Skills` trước -> `Items` -> `Lessons` -> `LessonItems`.
- Toàn bộ giao dịch hoàn tất trong < 3 giây cho 200 bản ghi.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Xử lý background queue phân tán cho các gói dữ liệu khổng lồ hàng chục ngàn câu (gói tiêu chuẩn < 5MB).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Admin ──POST /admin/imports/apply (Bundle JSON)──> AdminImportController
                                                       │
                                                [RolesGuard: ADMIN]
                                                       │
                                                       ▼
                                            ApplyContentImportUseCase
                                                       │
                                             [Prisma.$transaction]
                                          (timeout: 10000ms, maxWait: 5000ms)
                                                       │
                             ├── 1. Upsert All Skills (Map code to UUID)
                             ├── 2. Upsert All Items (Attach skill UUID)
                             ├── 3. Upsert All Lessons (Attach skill UUID)
                             ├── 4. Delete & Re-insert LessonItems
                             └── 5. Insert AuditLog ('BATCH_IMPORT')
                                                       │
                                                       ▼
                                            Return { createdCount, updatedCount }
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cập nhật đồng loạt các bảng trong Curriculum Domain.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
enum ImportStatus {
  PENDING
  VALIDATED
  APPLIED
  FAILED
}

model ContentImportJob {
  id               String       @id @default(uuid()) @db.Uuid
  adminUserId      String       @map("admin_user_id") @db.Uuid
  status           ImportStatus @default(PENDING)
  totalRecords     Int          @default(0) @map("total_records")
  createdCount     Int          @default(0) @map("created_count")
  updatedCount     Int          @default(0) @map("updated_count")
  validationErrors Json?        @map("validation_errors") @db.JsonB
  createdAt        DateTime     @default(now()) @map("created_at")
  completedAt      DateTime?    @map("completed_at")

  adminUser        User         @relation(fields: [adminUserId], references: [id], onDelete: Restrict)

  @@map("content_import_jobs")
}
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `POST /admin/imports/validate` -> `200 OK`
- **Endpoint**: `POST /admin/imports/apply` -> `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "totalRecords": 45,
      "createdCount": 40,
      "updatedCount": 5,
      "appliedAt": "2026-10-06T10:00:00.000Z"
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- `curriculum.bulk_updated`: Invalidate toàn bộ cache đồ thị kỹ năng.

---

# 10. Failure Handling (Xử lý Sự cố)

- Prisma `$transaction` tự động rollback hoàn toàn nếu ném bất kỳ ngoại lệ nào.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Yêu cầu quyền `Role.ADMIN`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Sử dụng Map cấu trúc in-memory để resolve `skillCode` sang `skillId` thay vì query DB nhiều lần.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Import từng API đơn lẻ: Tốn hàng trăm request HTTP và dễ bị đứt đoạn dở dang (Bị loại bỏ).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test validate cú pháp JSON bundle.
  - Test rollback khi có 1 item lỗi trong mảng.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi lịch sử import trong `content_import_jobs`.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
