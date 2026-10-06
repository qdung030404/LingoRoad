# LingoRoad Backend Folder Structure (NestJS DDD)

Cấu trúc chuẩn của đồ án trong `src/backend-nestjs/`:

```text
src/
├── main.ts              # Entry point
├── app.module.ts        # Root module
├── common/              # Các thành phần dùng chung (Filters, Guards, Interceptors)
└── modules/             # Các module tính năng (chuẩn DDD)
    ├── auth/            # Module Xác thực
    │   ├── application/ # Use cases, Commands
    │   ├── controller/  # HTTP API endpoints
    │   ├── domain/      # Logic lõi, Interfaces
    │   └── infrastructure/# Prisma Repository
    └── users/           # Module Người dùng
```
*(Cấu trúc này sẽ được mở rộng khi thiết kế thêm các module mới như `lessons`, `courses`...)*
