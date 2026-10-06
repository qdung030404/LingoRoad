# Deployment & DevOps Skill

## Mission (Sứ mệnh)

LingoRoad deployment must be: (Quá trình triển khai dự án LingoRoad phải:)
- Reliable. (Đáng tin cậy).
- Repeatable. (Có thể lặp lại dễ dàng).
- Automated. (Được tự động hóa cơ bản).

For a graduation project, a clean and automated CI/CD pipeline demonstrates professionalism. (Đối với đồ án tốt nghiệp, một quy trình CI/CD gọn gàng và tự động sẽ thể hiện sự chuyên nghiệp tuyệt đối trước hội đồng).

---

# Environment Strategy (Chiến lược Môi trường)

Minimum environments for graduation project: (Các môi trường tối thiểu cho đồ án):

**Local:**
Developer machine. (Máy tính cá nhân của nhóm phát triển).

**Production (or Demo / Staging):**
The cloud server used for final presentation. (Máy chủ Cloud thực tế dùng để demo hôm bảo vệ đồ án).

---

# Container Strategy (Chiến lược Container)

Every backend service should run inside Docker containers. (Mọi dịch vụ backend nên được chạy trong Docker container thay vì cài cắm thủ công).

Container rules (Quy tắc Container):
- Use `docker-compose` to manage services (NestJS, PostgreSQL, Redis). (Sử dụng `docker-compose` để dễ dàng quản lý đồng bộ các service).
- Small image size. (Sử dụng base image nhỏ gọn như Alpine để tối ưu dung lượng).
- Use `.env` for secrets. (Truyền cấu hình qua biến môi trường, tuyệt đối không hardcode mật khẩu vào Image).

---

# Infrastructure Architecture (Kiến trúc Hạ tầng Cơ bản)

Recommended services for a student project: (Khuyến nghị cấu trúc hạ tầng cho đồ án sinh viên để tiết kiệm chi phí nhưng vẫn chuẩn chỉ):

**Compute (Máy chủ chạy Web/App):**
AWS EC2, DigitalOcean Droplet, hoặc Vultr.

**Database (Cơ sở dữ liệu):**
Self-hosted PostgreSQL via Docker (Tự host qua Docker để tiết kiệm) hoặc dùng AWS RDS (nếu dư giả).

**Storage (Lưu trữ File):**
AWS S3, Cloudinary hoặc Firebase Storage để lưu ảnh avatar, âm thanh bài học.

---

# CI/CD Pipeline (Đường ống Triển khai Liên tục)

Sử dụng GitHub Actions hoặc GitLab CI để tự động hóa.
Every commit should trigger (Mỗi lần đẩy code lên nhánh chính, quy trình sau nên tự động chạy):

Code (Mã nguồn)
 ↓
Lint (Kiểm tra format cú pháp)
 ↓
Unit Tests (Chạy toàn bộ kiểm thử)
 ↓
Build (Build kiểm tra lỗi)
 ↓
Deploy (Tự động kéo code mới về VPS và khởi động lại Docker - *điểm cộng cực lớn*).

---

# Database Migration (Quản lý Phiên bản Cơ sở dữ liệu)

Rules (Quy tắc):
- Migrations must be version controlled using Prisma Migrate. (Sự thay đổi CSDL phải được quản lý phiên bản nghiêm ngặt bằng Prisma Migrate).
- Always verify schema before deploying. (Luôn kiểm tra lại schema trước khi bấm deploy).
- Avoid dropping tables containing mock data for presentation. (Hết sức cẩn thận không dùng lệnh `prisma db push --force-reset` xóa nhầm bảng chứa dữ liệu đã cất công nhập để demo).

---

# Rollback Strategy (Chiến lược Hoàn tác Cứu nguy)

If a deployment fails during presentation prep (Nếu deploy lỗi ngay sát giờ bảo vệ):
- Simply revert the Git commit and redeploy. (Chỉ cần gõ lệnh revert lại commit Git cũ và deploy lại).
- Keep a backup `.sql` dump of the database. (LUÔN LUÔN export sẵn 1 bản backup `.sql` của cơ sở dữ liệu cất ở máy cá nhân phòng khi Server sập).

---

# AI Engineering Rules (Quy tắc Kỹ thuật AI)

Before modifying the `docker-compose.yml` or CI/CD scripts (Trước khi AI tự động sửa các file Docker hay CI/CD):

Ask (Hãy tự đặt câu hỏi):
- Will this break the current local development setup? (Sửa thế này có làm hỏng môi trường code ở máy Local không?)
- Are all environment variables accounted for? (Đã truyền đủ các file `.env` cần thiết vào container chưa?)

A simple, working deployment is much better than a complex, broken one. (Một cấu hình deploy đơn giản nhưng CHẠY MƯỢT MÀ luôn tốt hơn một hệ thống giăng chằng chịt Kubernetes/Kafka nhưng lại bị lỗi).
