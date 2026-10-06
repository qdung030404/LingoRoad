# NestJS DDD Skill

## Mission (Sứ mệnh)

This skill defines how LingoRoad implements backend services using NestJS, TypeScript, Domain Driven Design (DDD), and Clean Architecture. (Kỹ năng này định nghĩa cách LingoRoad triển khai các dịch vụ backend sử dụng NestJS, TypeScript, DDD và Clean Architecture).

The goal is to build a highly scalable, maintainable, and testable system. (Mục tiêu là xây dựng một hệ thống dễ bảo trì, dễ kiểm thử và có cấu trúc chuẩn mực - một điểm cộng rất lớn đối với đồ án tốt nghiệp).

---

# Architecture Layers (Các Tầng Kiến trúc)

Every feature module must follow the following layers (Mỗi module tính năng phải tuân theo các tầng sau):

Controller Layer (Tầng Điều khiển)
↓
Application Layer (Tầng Ứng dụng / Service)
↓
Domain Layer (Tầng Nghiệp vụ Lõi)
↓
Infrastructure Layer (Tầng Hạ tầng)

---

## 1. Controller Layer (Tầng Điều khiển)

Responsibilities (Trách nhiệm):
* Handle HTTP requests (Xử lý các request HTTP).
* Validate DTOs (Kiểm tra dữ liệu đầu vào).
* Handle authentication (Xử lý xác thực người dùng).
* Convert HTTP requests into application commands (Chuyển đổi request thành lệnh cho tầng ứng dụng).

Controllers must be thin. (Controller phải cực kỳ mỏng/ngắn gọn).

Forbidden (Nghiêm cấm):
* Business logic (Logic nghiệp vụ).
* Database queries (Gọi trực tiếp query Database).
* Complex calculations (Tính toán phức tạp).

---

## 2. Application Layer (Tầng Ứng dụng)

Responsible for (Chịu trách nhiệm):
* Use Cases (Các ca sử dụng).
* Commands & Queries (Các lệnh và truy vấn).
* Transaction orchestration (Điều phối các thao tác với DB).
* Calling domain services (Gọi các service nghiệp vụ cốt lõi).

Examples (Ví dụ):
`StartLessonUseCase`
`SubmitAnswerUseCase`
`CompleteCourseUseCase`

---

## 3. Domain Layer (Tầng Nghiệp vụ Lõi)

Contains pure business logic. (Chứa logic nghiệp vụ thuần túy).

Includes (Bao gồm):
* Entities (Thực thể).
* Value Objects (Đối tượng giá trị).
* Domain Services (Dịch vụ nghiệp vụ).
* Domain Events (Sự kiện nghiệp vụ).

Domain rules (Quy tắc tầng Domain):
* No framework dependency. (KHÔNG phụ thuộc vào framework NestJS).
* No database dependency. (KHÔNG phụ thuộc vào Database / Prisma).
* No HTTP dependency. (KHÔNG phụ thuộc vào HTTP).

---

## 4. Infrastructure Layer (Tầng Hạ tầng)

Responsible for (Chịu trách nhiệm tương tác hệ thống ngoài):
* Database repositories (Các repository làm việc với Database/Prisma).
* Redis (Bộ nhớ đệm).
* External APIs (Gọi API bên ngoài, ví dụ gọi AI để chấm điểm).

---

# Module Structure (Cấu trúc Thư mục Module)

Example for `lesson` module (Ví dụ với thư mục module `lesson`):

```text
lesson/
  ├── controller/           (HTTP Controllers)
  ├── dto/                  (Data Transfer Objects)
  ├── application/          (Use cases, Commands)
  ├── domain/               (Entities, Business logic, Interfaces)
  └── infrastructure/       (Prisma Repositories)
```

---

# Dependency Direction (Chiều Phụ thuộc)

Allowed (Được phép):
Controller → Application → Domain
Infrastructure → Domain

Forbidden (Nghiêm cấm):
Domain → Infrastructure (Tầng Lõi KHÔNG ĐƯỢC biết về tầng Database).
Domain → NestJS (Tầng Lõi KHÔNG ĐƯỢC import thư viện NestJS).

---

# DTO Rules (Quy tắc DTO)

Every external input must use DTO validation. (Mọi dữ liệu đầu vào đều phải được validate qua DTO).

Always use (Luôn sử dụng):
* `class-validator`
* `class-transformer`

Never expose internal entities directly. (Không bao giờ trả trực tiếp Entity của DB ra ngoài API).

---

# Database Access (Truy cập Cơ sở dữ liệu)

Repositories belong only to Infrastructure Layer. (Các file Repository chỉ nằm ở tầng Hạ tầng).
Application services communicate through repository interfaces. (Tầng Ứng dụng giao tiếp với DB thông qua các Interface của Repository định nghĩa ở tầng Domain).

Example (Ví dụ):
`LessonRepository` Interface (nằm ở tầng Domain)
implemented by (được triển khai bởi):
`PrismaLessonRepository` (nằm ở tầng Infrastructure).

---

# Event Driven Pattern (Mô hình Hướng Sự kiện)

Important business changes must create domain events. (Các thay đổi quan trọng nên sinh ra sự kiện).

Examples (Ví dụ):
`LessonCompletedEvent`
`MasteryLevelUpEvent`

*(Đối với đồ án, có thể dùng `EventEmitter` nội bộ của NestJS thay vì cài đặt hệ thống phức tạp như Kafka).*

---

# Transaction Rules (Quy tắc Giao dịch)

Use transactions only when strong consistency is required. (Chỉ dùng transaction khi thật sự cần tính nhất quán cao, ví dụ: quá trình nộp bài kiểm tra).
Avoid long-running database transactions. (Tránh các transaction chạy quá lâu).

---

# Testing Rules (Quy tắc Kiểm thử)

Unit Test (Kiểm thử Đơn vị):
Test (Nên test):
* Domain entities.
* Domain services.
* Use cases.

Never test (Không test trong Unit Test):
* Database (Nên dùng Mock).

Integration Test (Kiểm thử Tích hợp):
Test (Nên test):
* Repositories.
* External integrations.

---

# AI Engineering Rules (Quy tắc cho Trợ lý AI)

Before creating new code (Trước khi viết code mới):
1. Search for existing modules. (Tìm các module đã có sẵn).
2. Follow existing patterns. (Tuân theo các pattern đang có).
3. Do not create duplicate services. (Đừng tạo ra các service trùng lặp).
4. Keep controllers thin. (Giữ cho Controller luôn mỏng).
5. Put business rules inside domain. (Đẩy logic nghiệp vụ vào tầng Domain).

When uncertain (Khi không chắc chắn):
Choose consistency over theoretical perfection. (Ưu tiên sự đồng nhất của dự án thay vì sự hoàn hảo về mặt lý thuyết).
