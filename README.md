# 🌟 LingoRoad - Adaptive & Personalized English Learning Platform

> **Đồ án Tốt nghiệp (Graduation Thesis)**  
> Nền tảng học tiếng Anh thích ứng thông minh ứng dụng **Học máy (Machine Learning)**, **Lý thuyết Khảo thí Hiện đại (Item Response Theory)** và **Mô hình Sư phạm Cá nhân hóa**.

---

## 📌 Mục lục

- [1. Giới thiệu tổng quan (Overview)](#1-giới-thiệu-tổng-quan-overview)
- [2. Tính năng cốt lõi (Key Features)](#2-tính-năng-cốt-lõi-key-features)
- [3. Nền tảng Lý thuyết & Thuật toán AI (AI & Pedagogical Models)](#3-nền-tảng-lý-thuyết--thuật-toán-ai-ai--pedagogical-models)
- [4. Kiến trúc Hệ thống (System Architecture)](#4-kiến-trúc-hệ-thống-system-architecture)
- [5. Cấu trúc Dự án (Project Structure)](#5-cấu-trúc-dự-án-project-structure)
- [6. Công nghệ Sử dụng (Tech Stack)](#6-công-nghệ-sử-dụng-tech-stack)
- [7. Hướng dẫn Cài đặt & Chạy cục bộ (Local Development)](#7-hướng-dẫn-cài-đặt--chạy-cục-bộ-local-development)
- [8. Quy chuẩn Phát triển (Conventions & Guidelines)](#8-quy-chuẩn-phát-triển-conventions--guidelines)
- [9. Tài liệu Kỹ thuật Chi tiết (Documentation)](#9-tài-liệu-kỹ-thuật-chi-tiết-documentation)

---

## 1. Giới thiệu tổng quan (Overview)

**LingoRoad** là giải pháp học tiếng Anh thích ứng toàn diện, giải quyết triệt để vấn đề "một giáo trình cho tất cả mọi người" (*one-size-fits-all*). Hệ thống liên tục đo lường năng lực tiềm ẩn của học viên, theo dõi trạng thái tiếp thu từng đơn vị kiến thức theo thời gian thực và cá nhân hóa lộ trình học tập tối ưu nhằm đạt hiệu quả ghi nhớ cao nhất trong thời gian ngắn nhất.

### 🎯 Mục tiêu cốt lõi:
- **Đánh giá chính xác năng lực đầu vào:** Sử dụng bài thi thích ứng thông minh (CAT) dựa trên mô hình IRT 3PL chuẩn CEFR (A1 → C2) chỉ với 15–20 câu hỏi.
- **Tối ưu hóa khả năng ghi nhớ:** Tích hợp thuật toán lặp lại ngắt quãng thế hệ mới **FSRS-4.5** (Free Spaced Repetition Scheduler).
- **Mô hình hóa năng lực theo thời gian thực:** Ứng dụng Bayesian Knowledge Tracing (BKT) và Deep Knowledge Tracing (SAINT+) để theo dõi sự thành thạo từng kỹ năng trên đồ thị tri thức DAG.
- **Lộ trình cá nhân hóa linh hoạt:** Sinh lộ trình học tập tối ưu theo mục tiêu thời gian và năng lực thực tế.
- **Trợ lý AI đồng hành:** Ứng dụng LLM kết hợp RAG để giải đáp thắc mắc, phân tích lỗi ngữ pháp và chấm điểm bài nói/viết chi tiết.

---

## 2. Tính năng cốt lõi (Key Features)

| Phân hệ / Module | Mô tả tính năng |
|---|---|
| 🎯 **Placement Test (CAT & IRT)** | Kiểm tra trình độ thích ứng máy tính, tự động điều chỉnh độ khó từng câu hỏi theo năng lực thời gian thực của học viên. |
| 🗺️ **Learning Path & DAG Curriculum** | Cây kỹ năng có định hướng (Directed Acyclic Graph) với cơ chế mở khóa cổng thành thạo (Mastery Gatekeeping). |
| 🧠 **Knowledge Tracing & Mastery Analytics** | Bảng điều khiển năng lực trực quan (Open Learner Model), biểu đồ nhiệt thành thạo kỹ năng và dự đoán xác suất trả lời đúng. |
| 🔄 **FSRS Spaced Repetition Notebook** | Sổ tay từ vựng thông minh, lập lịch ôn tập ngắt quãng dựa trên độ ổn định (Stability) và độ khó (Difficulty) của ký ức. |
| 🤖 **AI Learning Advisor & Tutoring** | Trợ lý học tập thông minh (LLM + RAG) hỗ trợ giải thích ngữ pháp, phản hồi lỗi sai theo ngữ cảnh bài học. |
| ✍️ **AI Writing & Speaking Evaluator** | Đánh giá bài viết tự động (AWE) và chấm phát âm qua công nghệ nhận diện giọng nói (ASR). |
| 🏆 **Gamification & Daily Quests** | Hệ thống duy trì động lực: Chuỗi học tập (Streak), Điểm kinh nghiệm (XP), Bảng xếp hạng tuần (Leaderboards) và Nhiệm vụ hàng ngày. |
| ⚙️ **Admin CMS & Audit Portal** | Cổng quản trị phân hệ học liệu, import ngân hàng câu hỏi hàng loạt, kiểm toán log và phân tích hiệu suất hệ thống. |

---

## 3. Nền tảng Lý thuyết & Thuật toán AI (AI & Pedagogical Models)

Hệ thống được xây dựng trên nền tảng vững chắc kết hợp giữa **Khoa học Sư phạm** và **Trí tuệ nhân tạo**:

```
+-----------------------------------------------------------------------------------+
|                           LINGOROAD AI & PEDAGOGY CORE                            |
+-----------------------------------------------------------------------------------+
|  [ Sư phạm ]         ZPD (Vygotsky)  -->  Mastery Learning  -->  SRL Dashboard     |
|  [ Đánh giá ]        IRT 3PL Model   -->  EAP Estimation    -->  Adaptive CAT     |
|  [ Tri thức ]        Curriculum DAG  -->  BKT / SAINT+      -->  EMA Decay Score  |
|  [ Ghi nhớ ]         Forgetting Curve-->  FSRS-4.5 Engine   -->  Optimal Interval |
|  [ Tối ưu ]          Dynamic Prog    -->  Deep Q-Learning   -->  Topological Path |
|  [ Tạo sinh ]        RAG Engine      -->  Gemini Pro / LLM  -->  Writing/ASR Eval |
+-----------------------------------------------------------------------------------+
```

1. **Mô hình Khảo thí 3PL (Three-Parameter Logistic IRT):**
   - Mô hình hóa xác suất trả lời đúng dựa trên độ phân biệt (a), độ khó (b) và độ đoán mò (c).
   - Ước lượng năng lực θ qua thuật toán **EAP (Expected A Posteriori)** với lưới tích phân Bayes.
2. **Computerized Adaptive Testing (CAT):**
   - Chọn câu hỏi tối đa hóa hàm thông tin Fisher I(θ), dừng sớm khi sai số chuẩn SE(θ) < 0.35.
3. **Knowledge Tracing (BKT & SAINT+):**
   - Theo dõi trạng thái ẩn p(L_t) của từng kỹ năng ngữ pháp/từ vựng qua chuỗi tương tác.
4. **Free Spaced Repetition Scheduler (FSRS-4.5):**
   - Mô hình hóa 2 thành phần trí nhớ: Độ ổn định S (Stability) và Độ khó D (Difficulty) để tính khoảng cách ôn tập tối ưu.

---

## 4. Kiến trúc Hệ thống (System Architecture)

Hệ thống được thiết kế theo mô hình **Domain-Driven Design (DDD)** và **Clean Architecture** phân tầng:

```
                      +-----------------------------+
                      |       Mobile Learner        |
                      |      (Flutter App)          |
                      +--------------+--------------+
                                     |
                                     | HTTPS / REST
                                     v
+---------------------+       +------+------+       +---------------------+
|   Web Admin Portal  | ----> |  NestJS API | <---> |    Python AI / ML   |
|     (Next.js)       |       |  (Backend)  |       | (CAT/FSRS/RAG/Eval) |
+---------------------+       +------+------+       +---------------------+
                                     |
                         +-----------+-----------+
                         |                       |
                         v                       v
               +-------------------+   +-------------------+
               |   PostgreSQL 16   |   |   Redis (Cache &  |
               | (Prisma Client)   |   |   Leaderboards)   |
               +-------------------+   +-------------------+
```

- **Mobile Client:** Flutter App theo kiến trúc **MVVM** (`Screen -> ViewModel -> Repository -> ApiClient`).
- **Web Admin Portal:** Ứng dụng Next.js (App Router, Server Components, Quản lý CMS & Analytics).
- **Backend Core:** NestJS (TypeScript), kiến trúc 4 tầng (Controller → Application → Domain → Infrastructure).
- **Data & Cache Layer:** PostgreSQL 16 quản lý qua Prisma ORM, Redis phục vụ Leaderboard và Session/Cache.

---

## 5. Cấu trúc Dự án (Project Structure)

```text
LingoRoad/
├── apps/
│   ├── backend/              # NestJS API Backend (TypeScript, Prisma, Domain Modules)
│   ├── frontend-web/         # Web Admin Management Portal (Next.js, TailwindCSS)
│   └── mobile/               # Mobile Application (Flutter, Provider, ScreenUtil)
├── docs/                     # Toàn bộ tài liệu kỹ thuật, báo cáo và đặc tả
│   ├── spec/
│   │   ├── domain/           # 10 Tài liệu phân tích nghiệp vụ miền (Domain Specs)
│   │   └── features/         # 23 Tài liệu đặc tả tính năng chi tiết (PRD, RFC, Task)
│   ├── ai-theory-and-algorithms.md   # Lý thuyết & công thức thuật toán AI
│   ├── learning-path-optimization.md # Bài toán tối ưu lộ trình (Greedy, DP, RL)
│   ├── system-architecture.md        # Kiến trúc hạ tầng & luồng dữ liệu
│   ├── Development Conventions.md    # Quy chuẩn coding & tiêu chuẩn chất lượng
│   └── README.md                     # Mục lục tài liệu tổng quan
├── run_mobile.ps1            # Script tự động quét LAN IP, config & khởi chạy Mobile
├── package.json              # Cấu hình Monorepo Workspaces & Root Custom Scripts
└── README.md                 # Tài liệu giới thiệu dự án (File này)
```

---

## 6. Công nghệ Sử dụng (Tech Stack)

### Mobile Client (Learner Application)
- **Framework:** Flutter (Dart SDK ^3.x)
- **State Management:** `provider` kết hợp `ChangeNotifier` (MVVM)
- **Navigation:** `GoRouter`
- **UI & Responsiveness:** `flutter_screenutil` (Design base: 390 × 844)
- **Localization:** JSON-based song ngữ Việt - Anh (`vi.json`, `en.json`)

### Web Admin Portal
- **Framework:** Next.js (React 18+, App Router)
- **Styling:** Vanilla CSS / TailwindCSS theo chuẩn UI Design System
- **Components:** Server Components kết hợp `<GlobalPagination />`

### Backend API Services
- **Runtime & Framework:** Node.js + NestJS (TypeScript)
- **ORM / Database Access:** Prisma Client
- **Database:** PostgreSQL 16
- **Caching & High-speed Queues:** Redis
- **Authentication & Security:** Stateless JWT, Argon2/Bcrypt, Role-based Access Control (RBAC)

### AI & Machine Learning Engine
- **Languages / Frameworks:** Python 3.10+, PyTorch, NumPy, Scipy
- **Models:** IRT 3PL, EAP Bayesian Integration, FSRS-4.5, BKT / SAINT+
- **LLM Integration:** Google Gemini API (RAG architecture cho AI Tutor & Feedback)

---

## 7. Hướng dẫn Cài đặt & Chạy cục bộ (Local Development)

### Yêu cầu Tiên quyết (Prerequisites)
- [Node.js](https://nodejs.org/) (>= v18.x)
- [Flutter SDK](https://flutter.dev/) (>= v3.12.x)
- [PostgreSQL](https://www.postgresql.org/) (>= v16.x) & [Redis](https://redis.io/)
- [Docker & Docker Compose](https://www.docker.com/) (Tùy chọn nhưng khuyến nghị)

---

### 🚀 Khởi chạy Nhanh từ Root (Root Monorepo Scripts - Khuyến nghị)

Sau khi clone repo, chỉ cần cài đặt dependency tại thư mục gốc:

```powershell
# Cài đặt toàn bộ dependencies cho Monorepo
npm install
```

Sau đó sử dụng các script tiện ích trực tiếp từ thư mục gốc:

| Thành phần | Lệnh phát triển (Dev) | Lệnh đóng gói (Build) |
|---|---|---|
| **Backend API (NestJS)** | `npm run backend:dev` | `npm run backend:build` |
| **Web Admin (Next.js)** | `npm run frontend:dev` | `npm run frontend:build` |
| **Mobile App (Flutter)** | `.\run_mobile.ps1 -emu` | `cd apps/mobile && flutter build apk` |

---

### 🛠️ Chi tiết từng bước Khởi chạy Cục bộ

#### 1. Khởi chạy Cơ sở dữ liệu & Cache với Docker Compose (Khuyến nghị)

```powershell
# Khởi chạy PostgreSQL & Redis ở chế độ ngầm:
docker compose up -d postgres redis
```
> 💡 **Thông số kết nối:**
> - **PostgreSQL:** `localhost:5432` (User: `postgres`, Password: `postgrespassword`, Database: `lingoroad`)
> - **Redis:** `localhost:6380` (Port host `6380` -> container `6379`)

#### 2. Cấu hình & Chạy Backend API (NestJS)

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
> 🚀 Backend API hoạt động tại: `http://localhost:3000`  
> 🧪 **Kiểm thử API:** Nhập file `LingoRoad_Auth_API.postman_collection.json` (tại thư mục gốc) vào **Postman** để test ngay các luồng `Register`, `Login`, `Refresh Token`, `Logout`, `Change Password`.

#### 3. Cấu hình & Chạy Web Admin Portal (Next.js)

```powershell
cd apps/frontend-web
npm install
npm run dev
```
> Web Admin Portal chạy tại: `http://localhost:3001`

#### 4. Khởi chạy Ứng dụng Mobile (Flutter)

```powershell
# Cách 1: Chạy tự động với launcher script (Khuyến nghị - tự động quét IP LAN & config)
.\run_mobile.ps1

# Mở kèm giả lập Android Emulator
.\run_mobile.ps1 -emu

# Cách 2: Chạy thủ công truyền thống
cd apps/mobile
flutter pub get
flutter run
```

---

## 8. Quy chuẩn Phát triển (Conventions & Guidelines)

Dự án tuân thủ nghiêm ngặt các quy tắc kỹ thuật sau:

1. **Zero Hardcoded Parameters (Flutter):**
   - Không gõ magic numbers trực tiếp trong Widget.
   - Bắt buộc dùng Design Tokens: `AppRadius` (`buttonRadius`, `cardRadius`), `AppSpacing` (`horizontal`, `item`, `section`), `AppShadows`, và `AppTextStyles`.
2. **Localization Policy:**
   - 100% văn bản giao diện phải được trích xuất vào `assets/translations/vi.json` và `en.json`.
   - Cấm hardcode chuỗi text trực tiếp trong file Dart.
3. **Database & Timezone Safety:**
   - Mốc thời gian lưu trữ cơ sở dữ liệu luôn ở định dạng **UTC tuyệt đối**.
   - Hiển thị người dùng được định dạng theo múi giờ `Asia/Ho_Chi_Minh` (GMT+7).
   - Tuyệt đối không dùng các cờ phá hủy dữ liệu (`--force-reset`, `migrate reset`).
4. **File Length Limits:**
   - Soft limit: **800 dòng** (Lên kế hoạch refactor/tách component).
   - Hard limit: **1000 dòng** (Không được phép vượt quá).

---

## 9. Tài liệu Kỹ thuật Chi tiết (Documentation)

Mọi chi tiết kiến trúc, nghiên cứu lý thuyết và đặc tả kỹ thuật được lưu trữ đầy đủ trong thư mục `docs/`:

- 📘 [Tài liệu Kiến trúc Toàn Hệ thống (`docs/system-architecture.md`)](docs/system-architecture.md)
- 🧠 [Lý thuyết AI & Mô hình Toán học (`docs/ai-theory-and-algorithms.md`)](docs/ai-theory-and-algorithms.md)
- 📈 [Tối ưu hóa Lộ trình Học tập (`docs/learning-path-optimization.md`)](docs/learning-path-optimization.md)
- 📋 [Quy chuẩn Phát triển (`docs/Development Conventions.md`)](docs/Development%20Conventions.md)
- 📂 [Đặc tả Miền Nghiệp vụ (`docs/spec/domain/`)](docs/spec/domain/)
- 📑 [Đặc tả 23 Tính năng Chi tiết (`docs/spec/features/`)](docs/spec/features/)

---

## 👥 Đội ngũ Phát triển

- **Đề tài:** Hệ thống Học tiếng Anh Thích ứng Cá nhân hóa - LingoRoad
- **Loại hình:** Đồ án Tốt nghiệp Đại học (DATN)
