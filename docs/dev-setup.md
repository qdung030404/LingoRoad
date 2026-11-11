# 🛠️ Hướng dẫn Cài đặt & Khởi chạy Nhanh (Developer Setup Guide)

> Tài liệu hướng dẫn thiết lập môi trường phát triển và khởi chạy toàn bộ các dịch vụ trong hệ thống monorepo LingoRoad.

---

## 📌 Yêu cầu Tiên quyết (Prerequisites)

- [Node.js](https://nodejs.org/) (>= v18.x, khuyến nghị v20.x)
- [Flutter SDK](https://flutter.dev/) (>= v3.12.x) & Dart SDK
- [Python](https://www.python.org/) (>= 3.10+, khuyến nghị 3.12)
- [PostgreSQL](https://www.postgresql.org/) (>= v16.x) & [Redis](https://redis.io/)
- [Docker & Docker Compose](https://www.docker.com/) (Khuyến nghị)

---

## 🚀 Khởi chạy Nhanh từ Root (Root Monorepo Scripts)

Sau khi clone repo, cài đặt toàn bộ dependencies cho monorepo tại thư mục gốc:

```powershell
npm install
```

Sử dụng các script tiện ích trực tiếp từ thư mục gốc:

| Thành phần | Lệnh phát triển (Dev) | Lệnh đóng gói (Build) |
|---|---|---|
| **Backend API (NestJS)** | `npm run backend:dev` | `npm run backend:build` |
| **AI/ML Service (FastAPI)** | `npm run ml:dev` *(hoặc `.\run_ml.ps1`)* | — |
| **Web Admin (Next.js)** | `npm run frontend:dev` | `npm run frontend:build` |
| **Mobile App (Flutter)** | `.\run_mobile.ps1 -emu` | `cd apps/mobile && flutter build apk` |

---

## 🛠️ Chi tiết từng bước Khởi chạy Cục bộ

### 1. Khởi chạy Cơ sở dữ liệu & Cache với Docker Compose (Khuyến nghị)

```powershell
# Khởi chạy PostgreSQL & Redis ở chế độ ngầm:
docker compose up -d postgres redis
```

> 💡 **Thông số kết nối mặc định:**
> - **PostgreSQL:** `localhost:5432` (User: `postgres`, Password: `postgrespassword`, Database: `lingoroad`)
> - **Redis:** `localhost:6380` (Port host `6380` → container `6379`)

---

### 2. Cấu hình & Chạy Backend API (NestJS)

```powershell
# Bước 1: Tạo file .env từ template (trong apps/backend)
cd apps/backend
cp .env.example .env   # (hoặc: Copy-Item .env.example .env trên PowerShell)

# Bước 2: Đồng bộ cấu trúc Database qua Prisma
npx prisma generate
npx prisma db push

# Bước 3: Khởi chạy ứng dụng Backend:
# Cách A - Từ thư mục apps/backend:
npm run start:dev

# Cách B - Từ thư mục gốc Monorepo:
npm run backend:dev
```

> 🚀 **Backend API hoạt động tại:** `http://localhost:3000`
> 🧪 **Kiểm thử API với Postman Collection (tại thư mục gốc repo):**
> - **Xác thực & Quản lý phiên:** Nhập file `LingoRoad_Auth_API.postman_collection.json` để test `Register`, `Login`, `Refresh Token`, `Logout`, `Change Password`.
> - **Kiểm tra trình độ thích ứng (Placement Test):** Nhập file `LingoRoad_Placement_API.postman_collection.json` để test `GET /placement/status`, `POST /placement/start`, `POST /placement/:sessionId/answer` (thuật toán CAT IRT), `GET /placement/:sessionId/result`.

---

### 3. Khởi chạy AI/ML Microservice (Python FastAPI)

Chạy trực tiếp từ thư mục gốc monorepo bằng một trong 2 cách:

```powershell
# Cách A - Dùng NPM script từ thư mục gốc:
npm run ml:dev

# Cách B - Dùng PowerShell launcher script:
.\run_ml.ps1
```

Hoặc thiết lập thủ công từ thư mục `apps/ml`:
```powershell
cd apps/ml
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m nltk.downloader wordnet
.\.venv\Scripts\python.exe -m uvicorn lingoroad_ml.serving.app:app --host 0.0.0.0 --port 8001 --reload
```

> 🧠 **AI/ML Service hoạt động tại:** `http://localhost:8001`
> 📖 **Swagger API Docs:** `http://localhost:8001/docs`

---

### 4. Cấu hình & Chạy Web Admin Portal (Next.js)

```powershell
cd apps/frontend-web
npm install
npm run dev
```

> 🌐 **Web Admin Portal chạy tại:** `http://localhost:3001`

---

### 5. Khởi chạy Ứng dụng Mobile (Flutter)

#### 5.1. Thiết lập Cấu hình Firebase (`google-services.json`) cho Android

Ứng dụng Flutter tích hợp dịch vụ Firebase Authentication & Google Sign-In trên Android, yêu cầu tệp cấu hình `google-services.json` đặt đúng vị trí:
`apps/mobile/android/app/google-services.json`

> ⚠️ **Lưu ý bảo mật:** Tệp `google-services.json` chứa API key và client ID dự án nên đã được đưa vào `.gitignore` để tránh rò rỉ mã nguồn. Dự án cung cấp sẵn tệp mẫu an toàn `google-services.json.example`.

Tùy theo nhu cầu phát triển, chọn một trong hai phương án sau:

- **Phương án A: Chạy nhanh (Mặc định cho môi trường dev cục bộ & CI)**
  - Gradle của dự án (`apps/mobile/android/app/build.gradle.kts`) đã tích hợp cơ chế tự động: nếu chưa tìm thấy `google-services.json`, bản build sẽ tự động sao chép từ `google-services.json.example` sang `google-services.json`.
  - Bạn cũng có thể chủ động sao chép thủ công trước khi build:
    ```powershell
    Copy-Item apps/mobile/android/app/google-services.json.example apps/mobile/android/app/google-services.json
    ```
  - *Kết quả:* Ứng dụng build và chạy mượt mà toàn bộ các màn hình và tính năng (Học, Luyện tập, Đăng nhập Email/Mật khẩu), ngoại trừ tính năng Đăng nhập bằng Google sẽ không gọi được Firebase thật.

- **Phương án B: Thiết lập đầy đủ (Để kiểm thử tính năng Đăng nhập Google thật)**
  1. **Lấy mã băm SHA-1 của Debug Keystore trên máy:**
     ```powershell
     cd apps/mobile/android
     ./gradlew signingReport
     ```
     *(Hoặc dùng lệnh keytool: `keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android`)*. Copy giá trị `SHA1` của biến thể `debug` (ví dụ: `2D:97:52:0F:...`).
  2. **Tạo / Đăng ký ứng dụng trên Firebase Console:**
     - Truy cập [Firebase Console](https://console.firebase.google.com/) và mở/tạo project (ví dụ: `lingoroad-7fb29`).
     - Thêm ứng dụng Android với **Package name**: `com.example.mobile` (khớp với `applicationId` và `namespace` trong `apps/mobile/android/app/build.gradle.kts`).
     - Dán mã **SHA-1** vừa lấy ở bước 1 vào mục cấu hình chứng chỉ ký của ứng dụng.
  3. **Bật Google Sign-In trên Firebase Console:**
     - Vào menu **Build** > **Authentication** > thẻ **Sign-in method** > bật **Google**.
     - Điền email hỗ trợ dự án và lưu lại. Ghi nhớ mã **Web SDK configuration / Web client ID** (chuỗi có dạng `...apps.googleusercontent.com`).
  4. **Tải tệp và đặt vào đúng vị trí:**
     - Tải tệp `google-services.json` từ mục **Project settings** > **Your apps** > **Android app**.
     - Đặt tệp vào: `apps/mobile/android/app/google-services.json` (ghi đè nếu tệp đã tồn tại).
  5. **Cấu hình Backend & Khởi chạy:**
     - Cấu hình Firebase Admin trong `apps/backend/.env` (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) để backend NestJS xác thực Google ID Token.
     - Khi chạy mobile, truyền Web Client ID qua biến `--dart-define=GOOGLE_SERVER_CLIENT_ID=<WEB_CLIENT_ID>` (hoặc dùng tham số `-GoogleServerClientId` trong launcher script `run_mobile.ps1`).

---

#### 5.2. Khởi chạy Ứng dụng Mobile

```powershell
# Cách 1: Chạy tự động với launcher script (Khuyến nghị - tự động quét IP LAN & config)
.\run_mobile.ps1

# Mở kèm giả lập Android Emulator
.\run_mobile.ps1 -emu

# Khởi chạy kèm Web Client ID tùy chỉnh cho Google Sign-In
.\run_mobile.ps1 -emu -GoogleServerClientId "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"

# Cách 2: Chạy thủ công truyền thống
cd apps/mobile
flutter pub get
flutter run --dart-define=APP_ENV=dev --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

---

## 📋 Tài liệu liên quan

- 📘 [Tài liệu Kiến trúc Toàn Hệ thống](system-architecture.md)
- 📱 [Hướng dẫn phát triển Mobile trên máy Local](mobile-local-development.md)
- 🚀 [Hướng dẫn Deploy môi trường thực tế](production-deployment.md)
- 🔍 [Báo cáo Trạng thái First Demo & Audit](demo-status-and-audit.md)
