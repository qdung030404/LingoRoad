# Ngân hàng demo Đọc–Nghe v1

`items.json` gồm 40 câu tự soạn cho LingoRoad: 20 Đọc, 20 Nghe; mỗi kỹ năng có 5 câu A1, 5 A2, 5 B1 và 5 B2. Mỗi câu có bốn lựa chọn, một đáp án đúng và giải thích tiếng Việt. Các nhãn CEFR và tham số IRT là giả định cho demo, chưa được hiệu chuẩn bằng dữ liệu học viên.

Đây là dữ liệu quản trị offline có đáp án và bản thoại. Không phục vụ thư mục `prisma` qua HTTP. Seed chỉ ghi các trường cho phép vào database; bản thoại Nghe không được ghi vào item hoặc gửi cho mobile. Chỉ phục vụ WAV trong `apps/backend/media/placement` qua `/media/placement/`.

20 WAV được tạo bằng Windows `Microsoft Zira Desktop` (en-US), tốc độ -1, PCM mono 16-bit, 22050 Hz. Bản thoại do dự án tự soạn; không sao chép audio bên ngoài. TTS chỉ dùng khi tạo lại tài nguyên; bản demo phát tệp có sẵn.

Chạy từ thư mục gốc repository:

```powershell
powershell -NoProfile -File scripts/generate-demo-audio.ps1
node apps/backend/node_modules/ts-node/dist/bin.js --project apps/backend/tsconfig.json apps/backend/prisma/demo-content/validate.ts
node apps/backend/node_modules/ts-node/dist/bin.js --project apps/backend/tsconfig.json apps/backend/prisma/demo-content/validate.spec.ts
```

Script tạo lại chỉ ghi đè 20 đường dẫn WAV xác định trong manifest, không xóa tệp. Phải có giọng Windows nêu trên trước khi chạy. Validator kiểm tra số lượng, độ phủ, ID, câu trả lời và cấu trúc/thời lượng WAV (15–45 giây).

`seedDemoContent(prisma)` trong `../seed-placement.ts` dùng transaction và upsert theo `externalId`; chạy lại không thêm bản sao. Hàm có thể import trong E2E với PrismaClient của database kiểm thử. CLI seed chỉ cho phép tên database `lingoroad_demo` hoặc `lingoroad_test`; chưa tạo hoặc kết nối database khi chỉ import.
