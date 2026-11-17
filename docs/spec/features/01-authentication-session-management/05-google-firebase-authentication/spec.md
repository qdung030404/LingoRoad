# Feature Specification: Google Authentication via Firebase

## Mission (Sứ mệnh)

Đặc tả chi tiết giao diện API, cấu trúc Request/Response, các quy tắc nghiệp vụ biên (Edge Cases), định nghĩa mã lỗi chuẩn hóa, và tiêu chí nghiệm thu kiểm thử cho tính năng Đăng nhập / Đăng ký bằng Google qua Firebase.

---

# 1. Feature Overview (Tổng quan Tính năng)

Tính năng cung cấp cổng API `POST /auth/google` và bộ bảo vệ `JwtAuthGuard` cho phép các ứng dụng Client (Mobile Flutter, Web Next.js) xác thực bằng Firebase ID Token từ Google. Backend NestJS giải mã token qua Firebase Admin SDK (`FirebaseTokenService`), tự động tìm kiếm hoặc khởi tạo `User`/`UserProfile` theo `firebaseUid` trong cơ sở dữ liệu PostgreSQL (`FirebaseUserService`), và trả về hồ sơ `{ user }` đồng bộ với phiên Firebase SDK.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học mới tải app LingoRoad về điện thoại.
- **Tôi muốn**: Bấm "Tiếp tục với Google" để vào ứng dụng ngay mà không cần gõ form đăng ký mật khẩu.
- **Để tôi có thể**: Bắt đầu làm bài kiểm tra trình độ (Placement Test) và học tập nhanh chóng.

- **Là một**: Người dùng đã đăng ký tài khoản bằng Google trên LingoRoad.
- **Tôi muốn**: Sử dụng nút "Tiếp tục với Google" trên thiết bị mới để đăng nhập lại vào đúng tài khoản của mình theo `firebaseUid` cố định.
- **Để tôi có thể**: Tiếp tục lộ trình học tập mà không bị mất dữ liệu hay bị chiếm đoạt tài khoản qua email chưa liên kết.

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
| `idToken` | `string` | Có | Firebase ID Token được tạo từ Firebase Auth Client SDK sau khi đăng nhập Google thành công. Giới hạn tối đa 4096 ký tự (`@MaxLength(4096)`). |

---

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "message": "Đăng nhập Google thành công",
  "data": {
    "user": {
      "id": "e4f8d220-410a-4a6c-b362-e61ef0598f82",
      "email": "learner@gmail.com",
      "name": "Nguyen Van A",
      "avatarUrl": "https://lh3.googleusercontent.com/a/ACg8ocL...",
      "role": "LEARNER",
      "status": "ACTIVE",
      "provider": "GOOGLE",
      "createdAt": "2026-10-06T09:00:00.000Z",
      "profile": {
        "id": "b1a77421-394f-4d01-a1e4-b865584e0302",
        "targetCefr": "B1",
        "dailyGoalMinutes": 10,
        "reminderEnabled": true
      }
    }
  }
}
```

---

#### Error Responses:

- **400 Bad Request** (`AUTH_FIREBASE_DISABLED` / `AUTH_GOOGLE_REQUIRED` / `AUTH_EMAIL_NOT_VERIFIED`):
  Xảy ra khi chế độ Firebase bị tắt, provider không phải `google.com`, hoặc tài khoản Google chưa được xác minh email.
  ```json
  {
    "success": false,
    "statusCode": 400,
    "errorCode": "AUTH_EMAIL_NOT_VERIFIED",
    "message": "Tài khoản Google cần có email đã xác thực."
  }
  ```

- **401 Unauthorized** (`AUTH_FIREBASE_INVALID_TOKEN` / `AUTH_INVALID_TOKEN` / `AUTH_UNAUTHORIZED`):
  Xảy ra khi token hết hạn, giả mạo, sai định dạng Bearer, vượt quá 4096 ký tự hoặc sai Project ID.
  ```json
  {
    "success": false,
    "statusCode": 401,
    "errorCode": "AUTH_INVALID_TOKEN",
    "message": "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại."
  }
  ```

- **403 Forbidden** (`AUTH_USER_SUSPENDED` / `AUTH_USER_DELETED` / `AUTH_ADMIN_GOOGLE_LINK_RESTRICTED`):
  Tài khoản người dùng đã bị khóa/xóa hoặc là tài khoản Quản trị viên (`ADMIN`) không được phép đăng nhập qua Google SSO.
  ```json
  {
    "success": false,
    "statusCode": 403,
    "errorCode": "AUTH_USER_SUSPENDED",
    "message": "Tài khoản đã bị tạm khóa hoặc không còn hoạt động."
  }
  ```

- **409 Conflict** (`AUTH_ACCOUNT_LINK_REQUIRED`):
  Email của tài khoản Google đã thuộc về một tài khoản cũ trong hệ thống (chính sách bảo mật: không tự động gộp theo email).
  ```json
  {
    "success": false,
    "statusCode": 409,
    "errorCode": "AUTH_ACCOUNT_LINK_REQUIRED",
    "message": "Email đã thuộc tài khoản cũ. Cần chuyển đổi tài khoản trước khi đăng nhập bằng Firebase."
  }
  ```

- **503 Service Unavailable** (`AUTH_FIREBASE_NOT_CONFIGURED` / `AUTH_NOT_CONFIGURED` / `AUTH_SERVICE_UNAVAILABLE`):
  Dịch vụ xác thực Firebase chưa được cấu hình credentials hoặc thiếu cặp biến môi trường `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` trên máy chủ.
  ```json
  {
    "success": false,
    "statusCode": 503,
    "errorCode": "AUTH_NOT_CONFIGURED",
    "message": "Máy chủ chưa được cấu hình Firebase."
  }
  ```

---

# 4. State Machine & Account Resolution Logic

- **Bước 1**: Nhận `idToken` từ Client (kiểm tra độ dài ≤ 4096 ký tự).
- **Bước 2**: Giải mã và xác thực chữ ký qua `FirebaseTokenService.verify()` (`401 AUTH_INVALID_TOKEN` nếu không hợp lệ).
- **Bước 3**: Chuẩn hóa `uid` và `email`, kiểm tra `email_verified === true` đối với provider `google.com`.
- **Bước 4**: Truy vấn `User` theo `firebaseUid`:
  - Nếu chưa có: Tạo mới `User` (`provider = GOOGLE`) kèm `UserProfile` mặc định (`targetCefr = B1`, `dailyGoalMinutes = 10`). Nếu gặp xung đột `P2002`, truy vấn lại theo `firebaseUid`; nếu vẫn không tìm thấy (trùng email với tài khoản cũ), ném `409 AUTH_ACCOUNT_LINK_REQUIRED`.
- **Bước 5**: Kiểm tra bảo vệ tài khoản Quản trị viên (`role === ADMIN && provider === 'google.com'` → `403 AUTH_ADMIN_GOOGLE_LINK_RESTRICTED`) và trạng thái hoạt động (`status !== ACTIVE` → `403 AUTH_USER_SUSPENDED` / `AUTH_USER_DELETED`).
- **Bước 6**: Trả về `{ user }` (`HTTP 200 OK`) từ `ProfileService.get(principal.sub)`.

---

# 5. Edge Cases & Handling (Xử lý Trường hợp Ngoại lệ)

1. **Người dùng đổi tên hoặc ảnh đại diện trên Google**:
   - Nếu người dùng đăng nhập lại, hệ thống có thể cập nhật lại `avatarUrl` mới nhất nếu URL hiện tại trống hoặc là URL mặc định của Google.
2. **Trùng email giữa tài khoản mật khẩu và tài khoản Google**:
   - Tuân thủ nghiêm ngặt chính sách chống chiếm đoạt tài khoản (No Auto-Link by Email alone): Hệ thống từ chối tự động liên kết và ném `409 Conflict` (`AUTH_ACCOUNT_LINK_REQUIRED`). Người dùng phải thực hiện quy trình chuyển đổi/liên kết tài khoản có xác thực thay vì tự động gán UID vào tài khoản cũ.
3. **Mạng Backend mất kết nối tới Firebase Keyserver**:
   - Thư viện `firebase-admin` tự động cache public keys của Google trong bộ nhớ đệm (thời gian sống thường từ vài giờ đến 24 giờ). Trường hợp mất mạng hoàn toàn kéo dài, throw `503 Service Unavailable` kèm thông báo bảo trì dịch vụ xác thực bên thứ ba.
4. **Trường hợp tài khoản Google không trả về Name hoặc Name rỗng/chỉ chứa khoảng trắng**:
   - Backend sử dụng `token.name.trim()`. Nếu rỗng hoặc chỉ chứa khoảng trắng, hệ thống tự động lấy phần tên từ email trước dấu `@` (ví dụ `learner` từ `learner@gmail.com`) để đảm bảo không bị lỗi vi phạm ràng buộc `NOT NULL` của cột `name`.
5. **Xung đột ghi đồng thời (Concurrency / Race Condition P2002)**:
   - Khi hai yêu cầu đăng nhập đầu tiên của cùng một tài khoản Google đến gần như đồng thời, cơ sở dữ liệu sẽ ném lỗi trùng khóa duy nhất `P2002`. Hệ thống tự động bắt lỗi này, tra cứu lại bản ghi hiện hữu và liên kết phiên an toàn thay vì trả về HTTP 500.
6. **Bảo vệ tài khoản Quản trị viên (Admin Privilege Protection)**:
   - Tài khoản có `role: ADMIN` không được phép tự động liên kết qua Google SSO. Bất kỳ nỗ lực nào đều bị từ chối với HTTP 403 `AUTH_ADMIN_GOOGLE_LINK_RESTRICTED`.

---

# 6. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Gửi payload chứa Firebase ID Token hợp lệ của một người dùng mới:
  - Database tạo thành công 1 bản ghi `User` (với `provider = 'GOOGLE'`, `passwordHash = null`, có `avatarUrl`, `firebaseUid`).
  - Database tạo thành công 1 bản ghi `UserProfile` (`dailyGoalMinutes = 10`).
  - API trả về HTTP `200 OK` kèm dữ liệu `{ user }` từ `ProfileService`.
- [x] Gửi token của người dùng đã tồn tại (`firebaseUid`): Không tạo thêm User mới, trả về dữ liệu `{ user }` hiện tại.
- [x] Gửi token có email trùng với tài khoản cũ khác `firebaseUid`: API phản hồi HTTP `409 Conflict` (`AUTH_ACCOUNT_LINK_REQUIRED`), tuyệt đối không tự động liên kết theo email.
- [x] Gửi token giả, chuỗi rác hoặc token đã hết hạn: API phản hồi HTTP `401 Unauthorized` với mã lỗi `AUTH_FIREBASE_INVALID_TOKEN` / `AUTH_INVALID_TOKEN`.
- [x] Gửi request khi tài khoản đang ở trạng thái `SUSPENDED`: API phản hồi HTTP `403 Forbidden` (`AUTH_USER_SUSPENDED`).
- [x] Không có bất kỳ dữ liệu nhạy cảm nào của Firebase Credentials bị lộ ra ngoài log console hoặc client response.
- [x] Client Mobile (Flutter `FirebaseIdentity` & `SessionController`) xử lý luồng xác thực trơn tru: có loading indicator, xử lý khi hủy (`canceled`), kiểm tra `idToken` an toàn và điều hướng chính xác.

