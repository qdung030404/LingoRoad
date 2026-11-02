# Feature Specification: Google Authentication via Firebase

## Mission (Sứ mệnh)

Đặc tả chi tiết giao diện API, cấu trúc Request/Response, các quy tắc nghiệp vụ biên (Edge Cases), định nghĩa mã lỗi chuẩn hóa, và tiêu chí nghiệm thu kiểm thử cho tính năng Đăng nhập / Đăng ký bằng Google qua Firebase.

---

# 1. Feature Overview (Tổng quan Tính năng)

Tính năng cung cấp cổng API `POST /auth/google` cho phép các ứng dụng Client (Mobile Flutter, Web Next.js) chuyển giao Firebase ID Token đã xác thực từ Google. Backend NestJS sẽ giải mã token qua Firebase Admin SDK, tự động tìm kiếm hoặc khởi tạo User/UserProfile trong cơ sở dữ liệu PostgreSQL, và cấp phát cặp JWT Access Token cùng Refresh Token theo chuẩn phiên của LingoRoad.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học mới tải app LingoRoad về điện thoại.
- **Tôi muốn**: Bấm "Đăng nhập bằng Google" để vào ứng dụng ngay mà không cần gõ form đăng ký mật khẩu.
- **Để tôi có thể**: Bắt đầu làm bài kiểm tra trình độ (Placement Test) và học tập nhanh chóng.

- **Là một**: Người dùng đã từng đăng ký tài khoản bằng email `example@gmail.com`.
- **Tôi muốn**: Sử dụng nút "Đăng nhập bằng Google" với đúng địa chỉ email này.
- **Để tôi có thể**: Truy cập liền mạch vào tài khoản cũ của mình mà không bị tạo thành tài khoản thứ hai bị trùng lặp.

---

# 3. Detailed API Contract (Hợp đồng API Chi tiết)

### Endpoint: `POST /auth/google`
- **Mức độ truy cập**: Public (Không yêu cầu Header `Authorization`)
- **Rate Limit**: 10 requests / 60 seconds / IP

#### Request Headers:
```http
Content-Type: application/json
x-device-id: <uuid-hoặc-chuỗi-định-danh-thiết-bị-client> (Tùy chọn)
```

#### Request Body (`GoogleLoginDto`):
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFkNm...<Firebase_ID_Token>..."
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `idToken` | `string` | Có | Firebase ID Token được tạo từ Firebase Auth Client SDK sau khi đăng nhập Google thành công. |

---

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "Đăng nhập Google thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "4a7f28bc9e31d041a87e50392ad34bb18901c23849...",
    "user": {
      "id": "e4f8d220-410a-4a6c-b362-e61ef0598f82",
      "email": "learner@gmail.com",
      "name": "Nguyen Van A",
      "avatarUrl": "https://lh3.googleusercontent.com/a/ACg8ocL...",
      "role": "LEARNER",
      "status": "ACTIVE",
      "provider": "GOOGLE",
      "profile": {
        "id": "b1a77421-394f-4d01-a1e4-b865584e0302",
        "targetCefr": "B1",
        "dailyGoalMinutes": 15,
        "reminderEnabled": true
      }
    }
  }
}
```

---

#### Error Responses:

- **400 Bad Request** (`AUTH_EMAIL_NOT_VERIFIED`):
  Xảy ra khi tài khoản Google chưa được xác minh email.
  ```json
  {
    "success": false,
    "statusCode": 400,
    "errorCode": "AUTH_EMAIL_NOT_VERIFIED",
    "message": "Email từ tài khoản Google chưa được xác thực"
  }
  ```

- **401 Unauthorized** (`AUTH_FIREBASE_INVALID_TOKEN`):
  Xảy ra khi token hết hạn, giả mạo, hoặc sai Project ID.
  ```json
  {
    "success": false,
    "statusCode": 401,
    "errorCode": "AUTH_FIREBASE_INVALID_TOKEN",
    "message": "Firebase ID Token không hợp lệ hoặc đã hết hạn"
  }
  ```

- **403 Forbidden** (`AUTH_USER_SUSPENDED`):
  Tài khoản người dùng đã bị khóa bởi Quản trị viên.
  ```json
  {
    "success": false,
    "statusCode": 403,
    "errorCode": "AUTH_USER_SUSPENDED",
    "message": "Tài khoản của bạn đã bị khóa hoặc tạm ngừng hoạt động"
  }
  ```

- **403 Forbidden** (`AUTH_ADMIN_GOOGLE_LINK_RESTRICTED`):
  Tài khoản Quản trị viên không được phép tự động liên kết qua Google SSO.
  ```json
  {
    "success": false,
    "statusCode": 403,
    "errorCode": "AUTH_ADMIN_GOOGLE_LINK_RESTRICTED",
    "message": "Tài khoản Quản trị viên không được phép tự động liên kết qua Google SSO."
  }
  ```

- **409 Conflict** (`AUTH_GOOGLE_ACCOUNT_CONFLICT`):
  Tài khoản này đã được liên kết với một tài khoản Google khác.
  ```json
  {
    "success": false,
    "statusCode": 409,
    "errorCode": "AUTH_GOOGLE_ACCOUNT_CONFLICT",
    "message": "Tài khoản này đã được liên kết với một tài khoản Google khác."
  }
  ```

- **503 Service Unavailable** (`AUTH_FIREBASE_NOT_CONFIGURED`):
  Dịch vụ xác thực Google chưa được cấu hình credentials trên máy chủ.
  ```json
  {
    "success": false,
    "statusCode": 503,
    "errorCode": "AUTH_FIREBASE_NOT_CONFIGURED",
    "message": "Dịch vụ xác thực Google chưa được cấu hình trên máy chủ"
  }
  ```

---

# 4. State Machine & Account Linking Logic

```
                    [Nhận idToken từ Client]
                                │
                                ▼
                   [Firebase Admin verifyIdToken]
                                │
             ┌──────────────────┴──────────────────┐
        (Token Hợp lệ)                       (Token Không hợp lệ)
             │                                     │
             ▼                                     ▼
   [Chuẩn hóa Email & UID]                    [Ném Lỗi 401]
             │
             ▼
   [Truy vấn User theo Email hoặc firebaseUid]
             │
     ┌───────┴─────────────────────────────┐
(Tìm thấy User)                       (Chưa có User)
     │                                     │
     ├─ Trạng thái == SUSPENDED?           ▼
     │  └─ Đúng ──> [Ném Lỗi 403]     [Tạo mới User & UserProfile]
     │                                     │
     ├─ Có firebaseUid chưa?               │
     │  ├─ Chưa có ──> [Liên kết UID]      │
     │  └─ Có rồi  ──> [Bỏ qua]            │
     └─────────────────┬───────────────────┘
                       │
                       ▼
          [Tạo bản ghi RefreshSession mới]
                       │
                       ▼
     [Phát hành Access Token & Refresh Token LingoRoad]
                       │
                       ▼
               [Trả về HTTP 200]
```

---

# 5. Edge Cases & Handling (Xử lý Trường hợp Ngoại lệ)

1. **Người dùng đổi tên hoặc ảnh đại diện trên Google**:
   - Nếu người dùng đăng nhập lại, hệ thống có thể cập nhật lại `avatarUrl` mới nhất nếu URL hiện tại trống hoặc là URL mặc định của Google.
2. **Trùng email giữa tài khoản mật khẩu và tài khoản Google**:
   - Hệ thống tự động liên kết (Account Linking) bằng cách gán `firebaseUid` của Google vào tài khoản hiện tại, người dùng giữ nguyên toàn bộ lịch sử học tập, streak và placement.
3. **Mạng Backend mất kết nối tới Firebase Keyserver**:
   - Thư viện `firebase-admin` tự động cache public keys của Google trong bộ nhớ đệm (thời gian sống thường từ vài giờ đến 24 giờ). Trường hợp mất mạng hoàn toàn kéo dài, throw `503 Service Unavailable` kèm thông báo bảo trì dịch vụ xác thực bên thứ ba.
4. **Trường hợp tài khoản Google không trả về Name**:
   - Nếu `decodedToken.name` rỗng, backend sẽ lấy phần tên từ email trước dấu `@` (ví dụ `john` từ `john@gmail.com`) để đảm bảo không bị lỗi vi phạm ràng buộc `NOT NULL` của cột `name`.
5. **Xung đột ghi đồng thời (Concurrency / Race Condition P2002)**:
   - Khi hai yêu cầu đăng nhập đầu tiên của cùng một tài khoản Google đến gần như đồng thời, cơ sở dữ liệu sẽ ném lỗi trùng khóa duy nhất `P2002`. Hệ thống tự động bắt lỗi này, tra cứu lại bản ghi hiện hữu và liên kết phiên an toàn thay vì trả về HTTP 500.
6. **Bảo vệ tài khoản Quản trị viên (Admin Privilege Protection)**:
   - Tài khoản có `role: ADMIN` không được phép tự động liên kết qua Google SSO. Bất kỳ nỗ lực nào đều bị từ chối với HTTP 403 `AUTH_ADMIN_GOOGLE_LINK_RESTRICTED`.

---

# 6. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Gửi payload chứa Firebase ID Token hợp lệ của một người dùng mới:
  - Database tạo thành công 1 bản ghi `User` (với `provider = 'GOOGLE'`, `passwordHash = null`, có `avatarUrl`, `firebaseUid`).
  - Database tạo thành công 1 bản ghi `UserProfile`.
  - Database tạo thành công 1 bản ghi `RefreshSession` mới có `tokenHash` được băm SHA-256.
  - API trả về HTTP `200 OK` kèm `accessToken`, `refreshToken`, và dữ liệu `user`.
- [x] Gửi token của người dùng đã tồn tại: Không tạo thêm User mới, trả về token hợp lệ và dữ liệu user hiện tại.
- [x] Gửi token giả, chuỗi rác hoặc token đã hết hạn: API phản hồi HTTP `401 Unauthorized` với mã lỗi `AUTH_FIREBASE_INVALID_TOKEN`.
- [x] Gửi request khi tài khoản đang ở trạng thái `SUSPENDED`: API phản hồi HTTP `403 Forbidden` (`AUTH_USER_SUSPENDED`).
- [x] Cố gắng liên kết Google với tài khoản `ADMIN`: API phản hồi HTTP `403 Forbidden` (`AUTH_ADMIN_GOOGLE_LINK_RESTRICTED`).
- [x] Không có bất kỳ dữ liệu nhạy cảm nào của Firebase Credentials bị lộ ra ngoài log console hoặc client response.
- [x] Client Mobile (Flutter) xử lý luồng xác thực trơn tru: có loading indicator, xử lý khi hủy (`canceled`), kiểm tra `idToken` an toàn và điều hướng chính xác.

