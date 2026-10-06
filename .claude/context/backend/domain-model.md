# LingoRoad Domain Model (Prisma / PostgreSQL)

> Ghi chú: File này đại diện cho thiết kế CSDL thực tế. Sẽ được AI tự động cập nhật khi chạy lệnh /design để thay đổi schema.

## Core Entities (Thực thể cốt lõi)

### 1. User
- `id` (UUID, PK)
- `email` (String, Unique)
- `password_hash` (String)
- `name` (String)
- `role` (Enum: LEARNER, ADMIN)
- `created_at`, `updated_at` (DateTime)

### 2. Course
- `id` (UUID, PK)
- `title` (String)
- `description` (String)
- `status` (Enum: DRAFT, PUBLISHED)

### 3. Lesson
- `id` (UUID, PK)
- `course_id` (UUID, FK -> Course)
- `title` (String)
- `order_index` (Int)

### 4. UserProgress
- `id` (UUID, PK)
- `user_id` (UUID, FK -> User)
- `lesson_id` (UUID, FK -> Lesson)
- `status` (Enum: IN_PROGRESS, COMPLETED)
- `score` (Int)

## Database Relationships (Quan hệ cơ bản)
- Một `User` có nhiều `UserProgress` (1-N).
- Một `Course` có nhiều `Lesson` (1-N).
- Một `Lesson` có nhiều `UserProgress` (1-N).
