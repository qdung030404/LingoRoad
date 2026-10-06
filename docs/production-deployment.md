# Production Deployment Runbook (Hướng dẫn Triển khai Lên Server)

## 1. Yêu cầu đầu vào (Required external inputs)

Trước khi tiến hành deploy, cần chuẩn bị:
- VPS (Máy chủ ảo) đã cài đặt Docker và Docker Compose. Mở cổng (Port) `80, 443, 3000, 5432`.
- Domain/DNS (Tên miền) trỏ về IP của VPS.
- Biến môi trường bảo mật (Secrets): `.env.production` (Tuyệt đối không push file này lên Git).

## 2. CI/CD Pipeline (Đường ống Tự động hóa)

Áp dụng GitHub Actions. Mỗi khi code được push vào nhánh `main`:
1. **Lint & Test:** Kiểm tra lỗi cú pháp (ESLint/Prettier) và chạy Unit Test cho Backend NestJS.
2. **Build Docker:** Tự động build Docker Image cho `backend-nestjs` và `web-admin`.
3. **Database Migration:** Chạy lệnh `npx prisma migrate deploy` để tự động cập nhật CSDL PostgreSQL an toàn.

## 3. Database Migration (Cập nhật Cơ sở dữ liệu)

**Quy tắc:**
- Không bao giờ gõ lệnh `prisma db push` trên môi trường Production vì có thể làm mất dữ liệu.
- Phải luôn backup CSDL ra một file `.sql` trước khi chạy lệnh migrate lớn.

## 4. Rollback Strategy (Chiến lược Hoàn tác)

Nếu việc deploy bị lỗi ngay trước giờ demo đồ án:
- Revert commit trên GitHub về phiên bản chạy tốt gần nhất.
- Pipeline sẽ tự động build lại bản code cũ và khởi động lại Docker container.
- Khôi phục CSDL từ file backup `.sql` (nếu có lỗi liên quan đến thay đổi bảng).
