# Request for Comments (RFC) - RBAC & Guard Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thiết kế kỹ thuật của hệ thống kiểm soát truy cập dựa trên vai trò (RBAC), cách hiện thực hóa các Guard trong NestJS (`JwtAuthGuard`, `RolesGuard`), custom decorators (`@Roles`, `@CurrentUser`, `@Public`) và cơ chế kiểm tra quyền truy cập tài nguyên.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Role-Based Access Control (`docs/spec/features/02-authorization-rbac/01-role-guards-access-control/prd.md`).
- Đảm bảo tính bảo mật và nhất quán cho toàn bộ các API endpoint trong backend NestJS.

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để kiểm tra xác thực và phân quyền một cách tự động, sạch sẽ, không lặp lại code kiểm tra vai trò thủ công bên trong từng hàm Service hay Controller?
- Đảm bảo việc kiểm tra quyền chạy cực nhanh từ JWT Payload mà không cần query Database liên tục trên mỗi request.

---

# 3. Goals (Mục tiêu)

- Thiết kế phân quyền khai báo (Declarative RBAC) dễ sử dụng bằng decorators: `@Roles(UserRole.ADMIN)`.
- Chi phí thực thi Guard gần như bằng 0 (in-memory payload check).
- Cung cấp decorator `@CurrentUser()` để lấy thông tin người dùng hiện tại an toàn và có kiểu dữ liệu (strongly typed).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Dynamic permission table lưu trong database (RBAC dựa trên Enum cố định là đủ).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

### Cấu trúc Guard Pipeline trong NestJS (Dual-Mode Auth):
```
HTTP Request
     │
     ▼
[JwtAuthGuard]
     ├── @Public() ──> Cho phép đi tiếp
     ├── Chế độ firebase (mặc định):
     │     └── FirebaseTokenService.verify(bearerToken) -> FirebaseUserService.resolve(decoded) -> gán `req.user`
     └── Chế độ legacy:
           └── Passport JwtStrategy (`src/modules/auth/strategies/jwt.strategy.ts`) -> gán `req.user`
     │
     ▼
[RolesGuard (Reflector)]
     │ ──> Đọc `@Roles(...)` metadata từ handler / class
     │ ──> So sánh `req.user.role` với danh sách roles được phép
     │     ├── Khớp ──> Cho phép thực thi Controller Handler
     │     └── Không khớp ──> Throw ForbiddenException(403, `AUTH_INSUFFICIENT_PERMISSIONS`)
     ▼
Controller Handler (@CurrentUser() user: JwtPayload)
```

### Các Decorators & Guards Cốt lõi:
1. `@Public()` (`src/common/decorators/public.decorator.ts`): Đánh dấu endpoint không cần kiểm tra Bearer token.
2. `@Roles(...roles: UserRole[])` (`src/common/decorators/roles.decorator.ts`): Gắn metadata danh sách quyền yêu cầu.
3. `@CurrentUser(field?: keyof JwtPayload)` (`src/common/decorators/current-user.decorator.ts`): Custom ParamDecorator trích xuất `req.user`.
4. `JwtAuthGuard` (`src/common/guards/jwt-auth.guard.ts`): Kế thừa `AuthGuard('jwt')`, hỗ trợ xác thực kép (`FirebaseTokenService` + `FirebaseUserService` khi `firebase.enabled`, hoặc Passport `JwtStrategy` ở chế độ `legacy`).
5. `RolesGuard` (`src/common/guards/roles.guard.ts`): Triển khai `CanActivate`, dùng `Reflector` lấy metadata và ném `ForbiddenException` (`AUTH_INSUFFICIENT_PERMISSIONS`) khi không đủ quyền.

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Toàn bộ các module (IAM, Learning, Knowledge Tracing, Quests, Admin) sẽ sử dụng các Guard và Decorator dùng chung này.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Sử dụng enum `UserRole` trong Prisma:
```prisma
enum UserRole {
  LEARNER
  ADMIN
}
```

---

# 8. API Design (Thiết kế API)

Ví dụ áp dụng trên Controller:

```typescript
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  @Get()
  async listAllUsers() {
    // Chỉ ADMIN mới vào được đây
  }
}

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: JwtPayload) {
    // Cả LEARNER và ADMIN đều vào được
  }
}
```

---

# 9. Event Design (Thiết kế Sự kiện)

- Không phát sinh sự kiện.

---

# 10. Failure Handling (Xử lý Sự cố)

- Khi không có token hoặc token sai format/hết hạn: `JwtAuthGuard` ném `UnauthorizedException` (401).
- Khi role không đủ đặc quyền: `RolesGuard` ném `ForbiddenException` (403).

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Khóa bí mật ký JWT (`JWT_SECRET`) phải được cấu hình an toàn qua biến môi trường.
- Token payload phải được kiểm tra tính hợp lệ về thời gian (`exp`).

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- `RolesGuard` chỉ xử lý mảng in-memory thông qua `Reflector.getAllAndOverride`, thời gian thực thi < 0.1ms.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- **Lựa chọn A: Query database trên mỗi request để kiểm tra role**: Chậm và gây quá tải database.
- **Lựa chọn B: Đóng gói role vào JWT payload và verify qua Guard in-memory**: Hiệu năng cao, bảo mật tiêu chuẩn (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đóng gói các Guard, Decorator và Interface dùng chung vào `src/common/guards/`, `src/common/decorators/`, `src/common/interfaces/`, và `JwtStrategy` tại `src/modules/auth/strategies/jwt.strategy.ts`.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - `RolesGuard.spec.ts`: Test trường hợp không có metadata `@Roles` (mặc định cho qua nếu đã xác thực), test trường hợp role khớp và không khớp.
  - `@CurrentUser.spec.ts`: Test trích xuất user từ execution context.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng mã lỗi 403 để phát hiện hành vi quét lỗ hổng API từ IP lạ.

---

# 17. Open Questions (Câu hỏi Mở)

- Không còn câu hỏi kỹ thuật tồn đọng.

# End
