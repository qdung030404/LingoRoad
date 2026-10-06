# Request for Comments (RFC) - Refresh Token Rotation Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế luồng xử lý Transaction và thuật toán bảo vệ chống tấn công Replay cho cơ chế Xoay vòng Refresh Token (Refresh Token Rotation) trong LingoRoad.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Refresh Token Rotation (`docs/spec/features/01-authentication-session-management/03-refresh-token-rotation/prd.md`).
- Bảo vệ cơ chế cấp lại quyền truy cập cho người dùng mà không cần lưu giữ Access Token dài hạn.

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để phát hiện và ngăn chặn việc token bị đánh cắp và sử dụng lại (Replay Attack)?
- Đảm bảo việc xoay vòng token diễn ra nguyên tử (Atomic), tránh việc cấp token mới nhưng chưa kịp thu hồi token cũ.

---

# 3. Goals (Mục tiêu)

- Đạt thời gian xử lý API `POST /auth/refresh` < 100ms.
- 100% các phiên bị thu hồi lập tức nếu xảy ra Replay Attack.
- Hỗ trợ cơ chế Transaction an toàn trên PostgreSQL qua Prisma.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Triển khai OAuth2 PKCE Flow (chỉ áp dụng cho 3rd-party clients nếu có).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

### Sơ đồ tuần tự xử lý (Sequence Diagram):
```
Client ──POST /auth/refresh (refreshToken)──> AuthController
                                                   │
                                                   ▼
                                          RefreshTokenUseCase
                                                   │
                          (Calculate SHA-256 hash of refreshToken)
                                                   │
                                                   ▼
                                       RefreshSessionRepository
                                                   │
                        [Query: findByTokenHash(hash) with User]
                                                   │
                      ┌────────────────────────────┴───────────────────────────┐
                      ▼ (isRevoked = true OR expired)                          ▼ (Hợp lệ)
            [Phát hiện Replay Attack]                                [Prisma Transaction]
                      │                                                        │
                      ▼                                                        ├── 1. markAsRevoked(oldSessionId)
            SessionRepo.revokeAllUserSessions(userId)                          ├── 2. Generate New Token Pair
                      │                                                        └── 3. createSession(newSessionData)
                      ▼                                                        │
            Throw UnauthorizedException("TokenReused")                         ▼
                      │                                                  Return New Tokens
                      ▼                                                        │
            Client: 401 Force Re-login                                         ▼
                                                                         Client: 200 OK
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **IAM Domain**: Cập nhật trạng thái trong bảng `refresh_sessions`.
- Không tác động tới các domain khác.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Không cần tạo bảng mới, tận dụng bảng `refresh_sessions` với chỉ mục:
```prisma
@@index([userId, isRevoked])
@@index([tokenHash])
```

---

# 8. API Design (Thiết kế API)

### Endpoint: `POST /auth/refresh`
- **Headers**: `Content-Type: application/json`

#### Request Body (`RefreshTokenDto`):
```json
{
  "refreshToken": "d8f7e2c1a8b94f6e1234567890abcdef..."
}
```

#### Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "e9a8f3b2c1d04e5f9876543210fedcba..."
  }
}
```

#### Error Response: `401 Unauthorized`
```json
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_COMPROMISED",
    "message": "Phiên đăng nhập đã bị vô hiệu hóa do phát hiện dấu hiệu bất thường. Vui lòng đăng nhập lại."
  }
}
```

---

# 9. Event Design (Thiết kế Sự kiện)

- Có thể phát sự kiện bảo mật `security.token_replay_detected` gửi tới SIEM hoặc Audit Log.

---

# 10. Failure Handling (Xử lý Sự cố)

- Khi phát hiện token đã thu hồi: Chạy query `UPDATE refresh_sessions SET is_revoked = true WHERE user_id = $1` ngay lập tức để ngắt toàn bộ các thiết bị khác của nạn nhân.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Token hash được tính toán bằng thuật toán SHA-256 (`crypto.createHash('sha256').update(token).digest('hex')`).
- Tuyệt đối không lưu raw Refresh Token trong cơ sở dữ liệu.
- Giới hạn kích thước token gửi lên tối đa 255 ký tự để tránh DoS bộ nhớ băm.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- `tokenHash` được đánh chỉ mục `@unique`, giúp truy vấn tìm kiếm session theo hash chỉ mất O(1).
- Cập nhật và thêm mới thực hiện trong 1 lệnh transaction ngắn trên PostgreSQL.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- **Lựa chọn A: Giữ nguyên Refresh Token không xoay vòng**: Dễ phát triển nhưng cực kỳ nguy hiểm nếu token bị rò rỉ.
- **Lựa chọn B: Refresh Token Rotation + Replay Attack Invalidation**: Tiêu chuẩn vàng theo khuyến nghị OWASP và OAuth 2.0 Security Best Current Practice (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đảm bảo database đã có trường `token_hash` unique index.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test xoay vòng thành công khi gửi token hợp lệ.
  - Test phát hiện Replay Attack khi gửi lại token đã bị thu hồi (`isRevoked = true`) và kiểm tra toàn bộ sessions của user bị set `isRevoked = true`.
  - Test token hết hạn.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Đo lường metric `security_replay_attacks_total` để phát hiện dấu hiệu tấn công diện rộng.

---

# 17. Open Questions (Câu hỏi Mở)

- Không còn câu hỏi kỹ thuật tồn đọng.

# End
