# LingoRoad

Ứng dụng di động học tiếng Anh cá nhân hóa theo đề tài **Computerized Adaptive Testing (CAT) và Deep Knowledge Tracing (DKT)**. Dự án gồm backend NestJS, dịch vụ AI/ML FastAPI và ứng dụng Flutter.

## Cập nhật demo — 22/10/2026

Đã có luồng Flutter kết nối API thật: đăng ký/đăng nhập → mục tiêu học → 5 câu Đọc + 5 câu Nghe → kết quả sơ bộ → xem lại/hồ sơ. Ngân hàng demo có40 câu và20 audio cục bộ. Phiên đăng nhập và câu đang làm được lưu; nộp bài kiểm tra quyền sở hữu, chống ghi lặp và xung đột đồng thời.

Giao diện Welcome, tài khoản và assessment đã dựng từ Figma. Các trang Home/Học/Luyện tập/Tiến độ trong **Khám phá giao diện** dùng fixture và lưu cục bộ; chưa phải vòng học cá nhân hóa qua backend. CEFR vẫn sơ bộ theo tỷ lệ đúng; Nói/Viết chưa được đánh giá và DKT chưa tích hợp vào luồng học viên.

Kiểm tra ngày22/10: Prisma và ngân hàng nội dung hợp lệ, backend build đạt, **82 unit tests backend + 5 HTTP E2E + 28 Flutter tests** đạt, `flutter analyze` sạch và APK release x86_64 build thành công. Đây là kiểm tra local; chưa xác nhận lần chạy GitHub Actions từ xa.

Chạy theo [hướng dẫn demo](docs/first-demo.md), [thực nghiệm MuMu](docs/mumu-experiment.md) và [README mobile](apps/mobile/README.md). Xem [giới hạn bản xem trước học tập](docs/figma-learning-preview.md), [báo cáo giao diện](docs/figma-ui-implementation.md) và [đề xuất backend tiếp theo](docs/backend-research-2026-10-22.md).

**Snapshot đối chiếu trước demo: 19/10/2026**, nhánh `main`, commit `a05c456`. Các mục kiểm kê bên dưới giữ lại trạng thái tại snapshot này; những mô tả chưa có mobile Auth/E2E,15 câu hoặc seed12 câu đã được thay thế bởi bản demo nêu trên.

## 1. Trạng thái tại snapshot 19/10/2026

| Thành phần | Đã có trong mã nguồn | Phần còn thiếu hoặc giới hạn |
| --- | --- | --- |
| Xác thực và phiên đăng nhập | Đăng ký, đăng nhập, refresh token rotation, phát hiện token bị thu hồi được dùng lại, logout, logout-all, đổi mật khẩu; unit test cho bốn use case chính. | Chưa có màn hình mobile kết nối API; chưa có bộ kiểm thử HTTP E2E trong `apps/backend/test/`. |
| Hồ sơ học viên | Model `UserProfile`, tạo hồ sơ mặc định khi đăng ký, trả hồ sơ trong kết quả đăng ký/đăng nhập. | Chưa có API và màn hình chỉnh sửa hồ sơ. |
| Placement | Tạo hoặc tiếp tục phiên thi, lưu đáp án, chọn câu bằng CAT/EAP qua ML hoặc fallback trong backend, trả kết quả CEFR. | Phiên thi 15 câu; kết quả hiện chỉ A1–B2 theo tỷ lệ đúng. Seed chỉ có 12 câu, cần bổ sung trước khi thử luồng đủ 15 câu không lặp. |
| Knowledge Tracing | Mã huấn luyện DKT, DKVMN, SAINT+; endpoint ML `/kt/predict`; phương thức `MlClientService.predictKt()`. | Endpoint tải SAINT+, chưa phục vụ DKT; chưa có luồng nghiệp vụ backend gọi KT khi học viên hoàn thành bài học. |
| AI hỗ trợ học | Endpoint advisor/RAG, sinh bài tập, chấm viết và chấm phát âm đọc thành tiếng. | Cần cấu hình Gemini, chỉ mục RAG hoặc mô hình tương ứng; chưa có luồng sử dụng từ mobile qua backend. |
| Tối ưu lộ trình | Mã DQN, DP và mô phỏng trong `apps/ml/lingoroad_ml/rl/`. | Mới có bằng chứng thử nghiệm trên môi trường mô phỏng; chưa tích hợp vào lộ trình học của ứng dụng. |
| Mobile | Design tokens, theme sáng/tối, shared widgets, màn hình showcase; tiện ích cấu hình và ngôn ngữ. | Chưa có luồng đăng nhập → placement → bài học → đề xuất → biểu đồ tiến bộ; chưa tích hợp đầy đủ đa ngôn ngữ. |
| Ôn tập FSRS, gamification, Web Admin | Có tài liệu đặc tả/thiết kế. | Chưa có hiện thực FSRS trong backend/ML hiện tại, module gamification hoặc thư mục `apps/frontend-web/`. |
| CI và hạ tầng | Workflow backend, ML, mobile; Docker Compose cho PostgreSQL, Redis và backend. | Cấu hình CI trong repo không xác nhận lần chạy mới nhất đã thành công; Redis chưa được tích hợp vào logic backend. |

Trạng thái trên được xác định từ mã nguồn và cấu hình, không phải tỷ lệ hoàn thành đã nghiệm thu. Các báo cáo cũ có nhắc backend .NET, `MasteryCalc.cs`, đường dẫn `src/backend/` hoặc “16/16 hoàn tất” thuộc bối cảnh khác; cần đối chiếu lại trước khi dùng cho checkout NestJS hiện tại.

## 2. Cấu trúc dự án

```text
LingoRoad/
├── apps/
│   ├── backend/                  # NestJS API, Prisma, Auth, Placement, ML client
│   ├── ml/                       # FastAPI, CAT/IRT, KT, LLM/RAG, speech, RL
│   │   ├── lingoroad_ml/          # Thuật toán và HTTP serving
│   │   ├── tests/                 # Kiểm thử Python
│   │   └── reports/               # Báo cáo thực nghiệm và mẫu đầu ra
│   └── mobile/                   # Flutter design system và showcase
│       ├── lib/core/              # Theme, config, tiện ích ngôn ngữ
│       ├── lib/shared/            # Button, card, dialog, input, text field
│       └── test/                  # Widget smoke test
├── docs/                         # Tài liệu kiến trúc, nghiên cứu và đặc tả
│   └── spec/                     # 10 tài liệu domain, 23 nhóm đặc tả tính năng
├── .github/workflows/ci.yml      # Backend, ML và mobile CI
├── docker-compose.yml
├── ProgressReport.md             # Yêu cầu đồ án và các mốc nộp báo cáo
├── implementation_plan.md        # Trạng thái triển khai và công việc tiếp theo
├── run_ml.ps1                    # Launcher ML, yêu cầu virtualenv có sẵn
├── run_mobile.ps1                # Launcher cũ, cần cập nhật đường dẫn và cổng API
└── package.json                  # npm workspaces và script tiện ích
```

`apps/frontend-web/` chưa tồn tại. Các script `frontend:dev`, `frontend:build`, `frontend:start` trong `package.json` đang tham chiếu workspace này và chưa dùng được.

## 3. Kiến trúc và công nghệ

Backend tổ chức theo controller, use case, repository và các dịch vụ dùng chung. Placement gọi ML qua HTTP; nếu gọi CAT thất bại, `MlClientService` dùng bộ CAT/EAP trong tiến trình backend. Dữ liệu người dùng, phiên đăng nhập và placement được lưu trong PostgreSQL qua Prisma.

| Lớp | Công nghệ đang có | Ghi chú |
| --- | --- | --- |
| Backend | NestJS 10, TypeScript, Prisma 5, PostgreSQL 16 | JWT, Argon2id, SHA-256 cho refresh token; chưa có fallback bcrypt. |
| ML | Python, FastAPI, PyTorch, NumPy, SciPy, Faster-Whisper, Gemini API | CI dùng Python 3.12 và PyTorch CPU. |
| Mobile | Flutter, Material 3, `shared_preferences` | Hiện dùng `MaterialApp` và `setState`; chưa có dependency `provider`, `go_router`, `flutter_screenutil`. |
| Hạ tầng | Docker Compose, PostgreSQL 16, Redis 7, GitHub Actions | Redis có service trong Compose, chưa có client/cache/leaderboard dùng Redis trong backend. |

MVVM, Web Admin Next.js, JSON localization và các quy tắc design system là định hướng/quy chuẩn phát triển. Việc có tài liệu hoặc lớp tiện ích chưa đồng nghĩa các luồng ứng dụng đã áp dụng đầy đủ.

## 4. API hiện có

### Backend NestJS

Mặc định chạy tại `http://localhost:3000`, không có tiền tố `/api` toàn cục.

| Phương thức | Đường dẫn | Xác thực |
| --- | --- | --- |
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/refresh` | Public, nhận refresh token |
| POST | `/auth/logout` | Public, nhận refresh token |
| POST | `/auth/logout-all` | Bearer JWT |
| POST | `/auth/change-password` | Bearer JWT |
| POST | `/placement/start` | Bearer JWT |
| GET | `/placement/status` | Bearer JWT |
| POST | `/placement/:sessionId/answer` | Bearer JWT |
| GET | `/placement/:sessionId/result` | Bearer JWT |

Nộp đáp án dùng các trường `itemId`, `itemIndex`, `selectedOption`, tùy chọn `responseTimeMs`. Chưa có route `/placement/submit`, `/placement/result` hoặc controller import câu hỏi. `InternalAuthGuard` đã có mã nguồn và test nhưng chưa được gắn vào route import.

Placement bắt đầu từ câu A2 nếu có, hoàn tất sau 15 đáp án. `CefrScoringService` ánh xạ tỷ lệ đúng: dưới 40% → A1, từ 40% → A2, từ 65% → B1, từ 85% → B2. `confidenceScore` là tỷ lệ số câu đã trả lời trên tổng số câu, chưa phải độ tin cậy thống kê từ EAP. Enum CEFR có C1/C2 nhưng bộ chấm kết quả hiện chưa trả hai mức này.

### Dịch vụ FastAPI

Mặc định chạy tại `http://localhost:8001`.

| Phương thức | Đường dẫn | Chức năng |
| --- | --- | --- |
| GET | `/health` | Kiểm tra tiến trình dịch vụ. |
| GET | `/ready` | Kiểm tra cấu hình/artifact của các thành phần được yêu cầu. |
| POST | `/cat/select` | Ước lượng theta, sai số chuẩn bằng EAP và chọn câu theo thông tin Fisher. |
| POST | `/kt/predict` | Suy luận SAINT+ từ chuỗi tương tác; trả 503 nếu thiếu checkpoint. |
| POST | `/llm/advisor` | Tư vấn học tập, truy xuất RAG khi có chỉ mục. |
| POST | `/llm/exercises` | Sinh bài tập qua Gemini. |
| POST | `/llm/awe` | Đánh giá bài viết qua Gemini. |
| POST | `/speech/score` | Nhận bản ghi âm và văn bản mẫu để chấm phát âm đọc thành tiếng. |

`/health` thành công không có nghĩa mọi mô hình đã sẵn sàng. Các endpoint ML ngoài CAT chưa có controller nghiệp vụ tương ứng để mobile sử dụng qua NestJS.

## 5. Kết quả thực nghiệm và giới hạn

Các giá trị dưới đây lấy từ báo cáo đang lưu trong repo; chưa được chạy lại trong lần cập nhật tài liệu này.

| Thực nghiệm | Kết quả ghi trong báo cáo | Phạm vi |
| --- | --- | --- |
| [CAT simulation](apps/ml/reports/cat_simulation.md) | Ngân hàng 312 câu, 1.000 lượt mô phỏng; exact CEFR accuracy CAT 0.671, Fixed-30 0.618; trung bình CAT 30 câu. | Mô phỏng độc lập, khác phiên placement 15 câu của NestJS. |
| [Knowledge Tracing](apps/ml/reports/kt_results.md) | EdNet: 60.000 người dùng, 7.504.848 tương tác; Test AUC DKT 0.7565, DKVMN 0.7558, SAINT+ 0.7586. Báo cáo còn một dòng SAINT+ 0.7516, cần làm rõ lần chạy khi trích dẫn. | Kết quả trên EdNet, chưa đánh giá KT trên dữ liệu học viên LingoRoad. |
| [DQN và DP](apps/ml/reports/dqn_poc.md) | Mean return: DP 0.636, DQN 0.588, Greedy 0.533, Random 0.197. | ToyLearnerEnv; mọi chính sách có goal-reach rate 0 trong giới hạn 60 bước của thiết lập này. |

DKT là mô hình LSTM riêng trong `kt/dkt.py`; SAINT+ là mô hình Transformer riêng trong `kt/saint_plus.py`. Endpoint KT hiện tải `checkpoints/saint_plus.pt`, không tải DKT. Việc đáp ứng đề tài CAT–DKT còn cần tích hợp mô hình phù hợp, ánh xạ câu hỏi/kỹ năng, lưu tương tác học tập và đánh giá trên dữ liệu ứng dụng.

## 6. Cài đặt và chạy cục bộ

Các nhóm lệnh dưới đây bắt đầu từ thư mục gốc repo, trừ khi có ghi chú. Dùng các terminal riêng cho từng dịch vụ.

### 6.1. Yêu cầu môi trường

- Node.js 20 và npm, theo cấu hình backend CI.
- Python 3.12, theo cấu hình ML CI và môi trường freeze trong `apps/ml/`.
- Flutter SDK kèm Dart thỏa ràng buộc `^3.12.0-273.0.dev` trong `apps/mobile/pubspec.yaml`; không suy ra phiên bản Flutter tối thiểu từ số phiên bản Dart.
- Android SDK và thiết bị/giả lập để chạy mobile hoặc build APK.
- Docker Compose để chạy PostgreSQL/Redis, hoặc các dịch vụ tương đương trên máy.

### 6.2. Backend và cơ sở dữ liệu

```powershell
# Cài dependency JavaScript cho npm workspaces
npm ci

# Chạy PostgreSQL và Redis
docker compose up -d postgres redis

Set-Location apps/backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# Chạy các lệnh Prisma bên trong apps/backend
npx prisma generate
npx prisma db push

# Seed một lần trên DB phát triển mới, nếu cần dữ liệu mẫu
npx ts-node prisma/seed-placement.ts

npm run start:dev
```

`prisma db push` dành cho DB phát triển: kiểm tra thay đổi schema trước khi áp dụng lên DB có dữ liệu. Seed thêm **12 câu trắc nghiệm A1–B2** bằng `create`; chạy lại sẽ thêm bản ghi, không cập nhật dữ liệu cũ. Cần bổ sung câu hỏi khác nhau trước khi kiểm thử trọn phiên placement 15 câu.

Theo Compose và `.env.example`, PostgreSQL ở `localhost:5432`, database `lingoroad`, user `postgres`, mật khẩu phát triển `postgrespassword`; Redis ở `localhost:6380`. Backend mặc định cổng 3000. Các biến chính: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_DAYS`, `ML_SERVICE_URL`, `ML_INTERNAL_TOKEN`, `ML_SERVICE_TIMEOUT_MS`.

Sau khi cài đặt, có thể dùng `npm run backend:dev` hoặc `npm run backend:build` từ thư mục gốc. Hai collection Postman ở thư mục gốc phục vụ Auth và Placement.

### 6.3. Dịch vụ AI/ML

```powershell
Set-Location apps/ml
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m nltk.downloader wordnet
.\.venv\Scripts\python.exe -m uvicorn lingoroad_ml.serving.app:app --host 0.0.0.0 --port 8001 --reload
```

Lệnh chạy từ `apps/ml/` để đường dẫn checkpoint và dữ liệu mặc định được giải đúng. Sau khi đã có virtualenv, có thể chạy `.\run_ml.ps1` từ thư mục gốc; script chỉ kiểm tra virtualenv rồi khởi chạy, không tự cài môi trường.

Cấu hình qua biến môi trường hoặc tệp `apps/ml/.env` tự tạo; repo chưa có `.env.example` cho ML:

| Biến phía ML | Mục đích |
| --- | --- |
| `LINGOROAD_ML_INTERNAL_TOKEN` | Token dùng chung với `ML_INTERNAL_TOKEN` phía backend, truyền bằng header `x-internal-token`. |
| `LINGOROAD_ENVIRONMENT` | Khi đặt `production`, token nội bộ phải dài ít nhất 32 ký tự. |
| `LINGOROAD_ML_REQUIRED_MODELS` | Danh sách thành phần mà `/ready` yêu cầu, mặc định `cat`. |
| `QG_KT_CHECKPOINT` | Đường dẫn checkpoint, mặc định `checkpoints/saint_plus.pt`. |
| `GEMINI_API_KEY` | Khóa API cho các chức năng LLM và embedding. |
| `QG_RAG_INDEX` | Đường dẫn chỉ mục RAG, mặc định `data/corpus_index.npz`. |

CAT có thể chạy mà không cần khóa Gemini hoặc checkpoint KT. Khi đã cấu hình token nội bộ, truy cập `/docs` cũng cần header này; `/health` và `/ready` được miễn xác thực. `npm run ml:dev` giả định virtualenv và tệp `apps/ml/.env` đã tồn tại; khi chạy từ gốc, cần cấu hình đường dẫn artifact phù hợp, ưu tiên đường dẫn tuyệt đối.

### 6.4. Mobile Flutter

```powershell
Set-Location apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

`10.0.2.2` dùng để trỏ về máy host từ Android Emulator. Với thiết bị thật, thay bằng IP LAN của máy chạy backend.

Hiện ứng dụng mở màn hình showcase và chưa gọi backend. `AppConfig` có hỗ trợ `API_BASE_URL` nhưng chưa được nối vào luồng ứng dụng, giá trị mặc định trong lớp vẫn là `http://localhost:5000`. `run_mobile.ps1` còn trỏ đến `src/mobile` và cổng 5000, cần sửa trước khi dùng; hiện hãy chạy Flutter trực tiếp trong `apps/mobile/`.

## 7. Kiểm thử và CI

```powershell
# Backend, từ thư mục gốc
npm run test --workspace=apps/backend -- --runInBand
npm run backend:build

# ML, từ apps/ml, sau khi cài dependency
.\.venv\Scripts\python.exe -m pytest tests/ -v

# Mobile, từ apps/mobile
flutter analyze
flutter test
flutter build apk --debug
```

Workflow [ci.yml](.github/workflows/ci.yml) chạy ba job khi push hoặc tạo pull request vào `main`/`develop`: backend generate/build/unit test; ML pytest; mobile analyze/test/build APK và upload artifact `app-debug-apk`.

Mobile hiện có một widget smoke test tăng bộ đếm. Backend có script `test:e2e` nhưng chưa có thư mục/cấu hình `test/` mà script tham chiếu. Kiểm tra lịch sử GitHub Actions hoặc chạy lệnh tương ứng để xác nhận kết quả; tài liệu này không xác nhận CI mới nhất đã xanh.

## 8. Tài liệu và công việc tiếp theo

Ưu tiên hoàn thiện mobile Auth/Placement, mở rộng ngân hàng câu hỏi, củng cố luồng placement, xây vòng đời bài học và dữ liệu tương tác, tích hợp DKT theo đề tài, rồi hiển thị tiến độ và bốn kỹ năng. Chi tiết công việc và tiêu chí hoàn thành nằm trong kế hoạch triển khai.

- [Yêu cầu đồ án và lịch báo cáo](ProgressReport.md).
- [Kế hoạch triển khai](implementation_plan.md).
- [Mục lục tài liệu](docs/README.md).
- [Đặc tả domain](docs/spec/domain/) và [đặc tả tính năng](docs/spec/features/).
- [Kiến trúc hệ thống](docs/system-architecture.md).
- [Lý thuyết AI](docs/ai-theory-and-algorithms.md) và [tối ưu lộ trình](docs/learning-path-optimization.md).
- [Quy chuẩn phát triển](docs/Development%20Conventions.md) và [hướng dẫn dự án](.agents/AGENTS.md).

Các tài liệu kiến trúc/đặc tả mô tả cả mục tiêu tương lai. Khi xác định chức năng đang có, đối chiếu thêm controller, use case, schema, entrypoint mobile và báo cáo thực nghiệm trong checkout hiện tại.
