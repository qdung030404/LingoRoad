# Task: Implement Get and Update Learner Profile Endpoints & UseCases

## Mission (Sứ mệnh)

Xây dựng các endpoint `GET /auth/me` và `PATCH /auth/me`, UseCase quản lý hồ sơ và mục tiêu học tập, kiểm tra ràng buộc dữ liệu và phát sự kiện `UserProfileUpdatedEvent`.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Hồ sơ Người học (`GET /auth/me`, `PATCH /auth/me`) và UseCase cập nhật mục tiêu học tập

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/03-user-profile-preferences/01-learner-profile-goals/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/03-user-profile-preferences/01-learner-profile-goals/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/03-user-profile-preferences/01-learner-profile-goals/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `GetProfileUseCase` để lấy thông tin chi tiết của người dùng hiện tại từ token.
- Xây dựng `UpdateProfileDto` với class-validator (kiểm tra `CefrLevel`, min/max cho `dailyGoalMinutes`).
- Xây dựng `UpdateProfileUseCase` cập nhật bảng `users` và `user_profiles` trong 1 transaction, phát sự kiện `UserProfileUpdatedEvent`.
- Đăng ký các endpoints `GET /auth/me` và `PATCH /auth/me` trong `AuthController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng DTO, UseCases cho GetProfile và UpdateProfile.
- Tích hợp `UserRepository` và `UserProfileRepository`.
- Bắn sự kiện `UserProfileUpdatedEvent`.
- Viết Unit Test và Integration Test.

### NGOÀI PHẠM VI (OUT):
- Upload avatar ảnh đại diện.
- Thay đổi địa chỉ email tài khoản.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/auth/dto/update-profile.dto.ts`
  - `src/modules/auth/use-cases/get-profile.use-case.ts`
  - `src/modules/auth/use-cases/update-profile.use-case.ts`
  - `src/modules/auth/events/user-profile-updated.event.ts`
  - `src/modules/auth/auth.controller.ts`
- **Logic**:
  - `GetProfileUseCase`: `userRepo.findByIdWithProfile(userId)`.
  - `UpdateProfileUseCase`:
    - Cập nhật name trong `users` nếu có.
    - Upsert vào `user_profiles` với `targetCefr`, `dailyGoalMinutes`, `reminderEnabled`.
    - `eventEmitter.emit('user.profile_updated', new UserProfileUpdatedEvent(...))`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `@nestjs/event-emitter`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /auth/me` trả về đúng dữ liệu user và profile (HTTP 200).
- [ ] `PATCH /auth/me` cập nhật đúng các trường thông tin (HTTP 200).
- [ ] Báo lỗi 400 nếu `targetCefr` sai hoặc `dailyGoalMinutes` không nằm trong khoảng 5-120.
- [ ] Sự kiện `user.profile_updated` được phát ra sau khi cập nhật thành công.
- [ ] Unit Test cho `GetProfileUseCase` và `UpdateProfileUseCase` pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Get Profile**: Gửi request hợp lệ -> Nhận thông tin user kèm profile.
2. **Update Profile Valid**: Gửi cập nhật targetCefr = B2, dailyGoalMinutes = 30 -> Nhận 200 OK và DB cập nhật đúng.
3. **Update Profile Invalid CEFR**: Gửi targetCefr = C1 (chưa hỗ trợ) -> Nhận 400 Bad Request.
4. **Update Profile Invalid Minutes**: Gửi dailyGoalMinutes = 200 -> Nhận 400 Bad Request.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
