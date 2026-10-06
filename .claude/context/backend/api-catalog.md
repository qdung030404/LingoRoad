# LingoRoad API Catalog (NestJS)

> Ghi chú: File này sẽ được AI liên tục cập nhật mỗi khi tạo mới API để làm tài liệu tham chiếu (Document) cho dự án.

## Base URL
- Dev: `http://localhost:3000/api`
- Auth: JWT Bearer `Authorization: Bearer <token>`

## 1. Auth & Users (`/api/auth`)
| Verb | Route | Auth | Payload | Response | Notes |
|---|---|---|---|---|---|
| POST | `/auth/login` | None | `{email, password}` | `{ accessToken, user }` | Đăng nhập |
| POST | `/auth/register` | None | `{email, password, name}` | `{ accessToken, user }` | Đăng ký |
| GET | `/auth/me` | JWT | None | `{ user }` | Lấy thông tin cá nhân |

## 2. Lessons (`/api/lessons`)
*(Chưa được triển khai)*
