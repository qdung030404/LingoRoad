# API Design Skill

## Mission (Sứ mệnh)

API is the contract between LingoRoad backend and mobile app. (API là cầu nối giao tiếp giữa backend và ứng dụng di động).

For a graduation project, API design must prioritize: (Đới với đồ án tốt nghiệp, thiết kế API phải ưu tiên):
* Consistency (Tính nhất quán - điểm cộng rất lớn khi bảo vệ).
* Clear structure (Cấu trúc rõ ràng, dễ hiểu).
* Proper HTTP Methods (Dùng đúng chuẩn RESTful).

---

# 1. Resource-Oriented Design (Thiết kế Hướng Tài nguyên)

Use nouns instead of verbs. (Sử dụng danh từ thay vì động từ).

**Correct (Đúng):**
`GET /lessons/{id}`
`POST /lessons`

**Incorrect (Sai):**
`POST /createLesson`
`POST /updateUser`

---

# 2. HTTP Method Convention (Quy chuẩn HTTP)

**GET:** Read data (Đọc dữ liệu).
**POST:** Create resources (Tạo dữ liệu mới).
**PUT:** Replace an entire resource (Thay thế toàn bộ).
**PATCH:** Update partial data (Cập nhật một phần).
**DELETE:** Remove resources (Xóa dữ liệu).

---

# 3. Response Format (Định dạng Phản hồi)

Tất cả API bắt buộc phải trả về chung một cấu trúc chuẩn. Tránh tình trạng mỗi API trả về một kiểu.

**Success (Thành công):**
```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

**Error (Lỗi):**
```json
{
  "success": false,
  "error": {
    "code": "LESSON_NOT_FOUND",
    "message": "Lesson does not exist"
  }
}
```

---

# 4. Error Rules (Quy tắc Lỗi)

Sử dụng mã lỗi (Error Code) thay vì chỉ dùng chuỗi văn bản thông báo.
Ví dụ: `USER_NOT_FOUND`, `INVALID_PASSWORD`, `INSUFFICIENT_MASTERY`.

---

# 5. Pagination (Phân trang)

Các danh sách (như danh sách bài học, lịch sử làm bài) nên được phân trang để tránh tải dữ liệu quá lớn gây lag app.
Sử dụng tham số: `?page=1&limit=20`.

---

# 6. API Security (Bảo mật cơ bản)

* Validate DTOs (Kiểm tra dữ liệu đầu vào chặt chẽ qua Class Validator).
* Check JWT (Kiểm tra token đăng nhập).
* Check permissions (Kiểm tra xem User có quyền truy cập dữ liệu này không, ví dụ user A không được sửa profile của user B).
