# Kế hoạch triển khai LingoRoad

## Cập nhật demo — 22/10/2026

Đã hoàn thành demo tài khoản, onboarding, hồ sơ và placement10 câu (5 Đọc + 5 Nghe) trên ngân hàng40 câu; Flutter gọi API thật, giữ phiên và bài đang làm. Kiểm tra local:82 unit tests backend,5 HTTP E2E và28 Flutter tests đạt; analyze sạch và APK release build thành công. Chi tiết và lệnh chạy tại [hướng dẫn demo](docs/first-demo.md).

Home/Học/Luyện tập/Tiến độ và phản hồi Nói/Viết hiện là [bản xem trước dùng fixture](docs/figma-learning-preview.md). Công việc tiếp theo là nối bài học, kế hoạch, lịch sử tương tác và tiến độ theo tài khoản, sau đó tích hợp/đánh giá CAT–DKT theo yêu cầu. [Nghiên cứu backend ngày22/10](docs/backend-research-2026-10-22.md) phân biệt rõ API hiện có và đề xuất. Yêu cầu và lịch trong `ProgressReport.md` được giữ nguyên.

**Kế hoạch nền: 19/10/2026.** Các mục chi tiết bên dưới ghi lại snapshot nhánh `main`, commit `a05c456`, trước khi làm demo; không dùng các ô công việc cũ để phủ nhận phần đã hoàn thành nêu trên. Kế hoạch nền đối chiếu với [yêu cầu đồ án](ProgressReport.md).

Trong snapshot19/10, các mục “đã có” xác nhận sự hiện diện và luồng xử lý trong mã nguồn; chưa chạy lại kiểm thử khi lập snapshot đó. Kết quả kiểm tra ngày22/10 được ghi riêng ở đầu tài liệu; các kiểm tra local không thay thế nghiệm thu hoặc đánh giá với người học.

## 1. Mục tiêu và phạm vi

Ứng dụng cần có đăng ký/đăng nhập, quản lý hồ sơ, đánh giá đầu vào, nội dung học phù hợp trình độ, theo dõi bốn kỹ năng và biểu đồ tiến bộ. Lõi học thích ứng phải thể hiện được vai trò của CAT và DKT bằng dữ liệu và kết quả đánh giá.

[Yêu cầu thầy giao](ProgressReport.md) đang mô tả DKT cho ước lượng đầu vào và CAT cho đề xuất nội dung. Mã nguồn hiện dùng CAT cho placement và SAINT+ cho endpoint Knowledge Tracing độc lập. Cần thống nhất cách diễn giải và thiết kế kết hợp CAT–DKT với giảng viên trước khi nghiệm thu; giữ nguyên nội dung yêu cầu gốc cho đến khi có thống nhất.

FSRS, DQN/DP, trợ lý AI, gamification và Web Admin là các hạng mục mở rộng. Xếp sau luồng ứng dụng và yêu cầu CAT–DKT cốt lõi nếu nguồn lực có hạn.

## 2. Hiện trạng và bằng chứng

| Hạng mục | Đã có | Cần hoàn thiện |
| --- | --- | --- |
| Backend nền tảng | NestJS, Prisma, cấu hình môi trường, validation, filter lỗi, JWT/roles guard, event emitter. | Kiểm tra việc áp dụng guard, tích hợp thực tế và cấu hình triển khai. |
| Authentication | Sáu endpoint Auth, use case, repository và unit test cho đăng ký/đăng nhập/refresh/đổi mật khẩu. | Kiểm thử HTTP E2E; hoàn thiện rate limiting thực thi; tích hợp mobile. |
| Hồ sơ | Model và hồ sơ mặc định được tạo khi đăng ký. | API xem/sửa hồ sơ, mục tiêu học tập và màn hình tương ứng. |
| Placement | Controller, phiên thi, lưu đáp án, CAT qua ML hoặc fallback, chấm kết quả, sự kiện hoàn tất. | Bổ sung ngân hàng câu hỏi, kiểm tra quyền sở hữu khi nộp đáp án, tính hợp lệ câu được trả lời và chuẩn hóa cách chấm. |
| AI/ML | CAT/IRT/EAP; mô hình KT; LLM/RAG, AWE, speech; DQN/DP trong môi trường mô phỏng. | Tích hợp theo vòng đời học tập và đánh giá trên dữ liệu ứng dụng. |
| Mobile | Design system, shared widgets, showcase, lớp cấu hình và tiện ích ngôn ngữ. | Màn hình nghiệp vụ, navigation, API client, quản lý phiên và các trạng thái lỗi/tải. |
| CI | Ba job backend, ML và mobile trong workflow. | Xác nhận kết quả chạy cụ thể; thêm bằng chứng cho luồng tích hợp khi triển khai. |
| FSRS, gamification, Web Admin | Đặc tả và tài liệu thiết kế. | Hiện thực backend/UI; chưa có workspace `apps/frontend-web/`. |

Nguồn đối chiếu chính:

- [Backend AppModule](apps/backend/src/app.module.ts), [schema Prisma](apps/backend/prisma/schema.prisma).
- [AuthController](apps/backend/src/modules/auth/auth.controller.ts), [PlacementController](apps/backend/src/modules/placement/placement.controller.ts).
- [ML client](apps/backend/src/modules/ml/ml-client.service.ts), [FastAPI entrypoint](apps/ml/lingoroad_ml/serving/app.py), [KT serving](apps/ml/lingoroad_ml/serving/kt_routes.py).
- [Mobile entrypoint](apps/mobile/lib/main.dart), [pubspec](apps/mobile/pubspec.yaml), [workflow CI](.github/workflows/ci.yml).

## 3. Phân hệ Authentication và quản lý phiên

Tham chiếu đặc tả: [Authentication & Session Management](docs/spec/features/01-authentication-session-management/).

### 3.1. Các phần đã triển khai

- [x] Khởi tạo backend, cấu hình TypeScript/NestJS và Prisma.
- [x] Định nghĩa `User`, `UserProfile`, `RefreshSession`.
- [x] Băm mật khẩu bằng Argon2id; xác thực giả lập khi không tìm thấy email ở luồng đăng nhập.
- [x] Sinh JWT access token và refresh token ngẫu nhiên 32 byte; lưu SHA-256 của refresh token.
- [x] Đăng ký trong transaction: tạo user, hồ sơ mặc định và refresh session.
- [x] Đăng nhập, xoay vòng refresh token, phát hiện dùng lại token đã thu hồi và thu hồi các refresh session của tài khoản.
- [x] Logout, logout-all, đổi mật khẩu trong transaction và thu hồi refresh session.
- [x] Phát sự kiện `user.registered`, `user.password_changed`.
- [x] Unit test cho register, login, refresh và change-password.

### 3.2. API và hành vi hiện tại

| API | Hành vi | Xác thực |
| --- | --- | --- |
| `POST /auth/register` | Chuẩn hóa email, kiểm tra mật khẩu, tạo tài khoản/hồ sơ/phiên; trả token và thông tin user. | Public |
| `POST /auth/login` | Xác thực mật khẩu và trạng thái tài khoản, tạo refresh session mới. | Public |
| `POST /auth/refresh` | Kiểm tra phiên, trạng thái thu hồi, hạn dùng và tài khoản; thay refresh token. | Public, nhận refresh token |
| `POST /auth/logout` | Thu hồi phiên theo refresh token; thao tác idempotent. | Public, nhận refresh token |
| `POST /auth/logout-all` | Thu hồi các refresh session của user. | Bearer JWT |
| `POST /auth/change-password` | Kiểm tra mật khẩu cũ, cập nhật mật khẩu mới và thu hồi refresh session. | Bearer JWT |

Access token có thời hạn mặc định 15 phút; refresh token mặc định 30 ngày, có thể cấu hình. Hồ sơ mặc định có mục tiêu B1, 15 phút/ngày và bật nhắc học. Đăng ký yêu cầu mật khẩu 8–64 ký tự, có ít nhất một chữ thường và một chữ số.

Luồng refresh kiểm tra token bị thu hồi trước kiểm tra hết hạn. Token bị thu hồi được gửi lại dẫn đến mã `AUTH_TOKEN_COMPROMISED`; token không tồn tại hoặc phiên hết hạn dẫn đến `AUTH_INVALID_REFRESH_TOKEN`.

### 3.3. Khoảng trống cần xử lý

- [ ] Có `ThrottlerModule` nhưng chưa có `ThrottlerGuard` được gắn vào route hoặc toàn cục. Cần triển khai và kiểm chứng phản hồi 429 trước khi coi rate limiting đã hoạt động.
- [ ] Chưa có `apps/backend/test/auth.e2e-spec.ts` và `test/jest-e2e.json`; script `test:e2e` hiện tham chiếu cấu hình chưa tồn tại.
- [ ] Chưa có API chỉnh sửa hồ sơ học viên và tích hợp Auth trên mobile.
- [ ] Kiểm chứng trường hợp hai yêu cầu refresh đồng thời cùng dùng một token; transaction hiện có chưa phải bằng chứng đã xử lý an toàn tình huống này.

`PasswordService` hiện chỉ dùng Argon2id. Redis chưa tham gia lưu phiên hoặc throttler store; không ghi nhận bcrypt fallback hay Redis session store là chức năng đã triển khai.

## 4. Phân hệ Placement

### 4.1. Các phần đã triển khai

- [x] Model `PlacementSession`, `AssessmentItem`, `AssessmentResponse` và các repository tương ứng.
- [x] `POST /placement/start`: tiếp tục phiên đang làm hoặc tạo phiên 15 câu; câu đầu ưu tiên A2.
- [x] `GET /placement/status`: trả trạng thái và tiến độ phiên.
- [x] `POST /placement/:sessionId/answer`: nhận đáp án, ghi response và tăng tiến độ trong transaction.
- [x] Chọn câu chưa trả lời qua CAT/EAP từ ML; có fallback CAT trong tiến trình backend và lựa chọn tuần tự nếu bước chọn thích ứng vẫn lỗi.
- [x] Hoàn tất phiên, lưu kết quả và phát `placement.completed`.
- [x] `GET /placement/:sessionId/result`: lấy kết quả có kiểm tra user sở hữu phiên.
- [x] Unit test cho start, submit, status, result và ML client; collection Postman cho placement.

### 4.2. Giới hạn cần ghi nhận đúng

[Seed hiện tại](apps/backend/prisma/seed-placement.ts) có **12 câu**, mỗi mức A1, A2, B1, B2 có ba câu. Script dùng `create`, không có upsert; chạy lại thêm dữ liệu trùng nội dung. Đây chưa phải ngân hàng 100+ câu hoặc đủ cho 15 câu khác nhau trong một phiên.

[CefrScoringService](apps/backend/src/modules/placement/services/cefr-scoring.service.ts) chốt kết quả theo tỷ lệ đúng: dưới 40% → A1, từ 40% → A2, từ 65% → B1, từ 85% → B2. `confidenceScore = min(1, số câu đã trả lời / tổng số câu)`. Theta và sai số chuẩn EAP được dùng khi chọn câu nhưng chưa dùng để chốt CEFR, chưa lưu trong schema phiên thi; chưa có điểm riêng bốn kỹ năng.

`InternalAuthGuard` xác thực `x-internal-token` theo `ML_INTERNAL_TOKEN`, nhưng chưa có controller/route import được gắn guard này. Không ghi nhận API import nội bộ là đã hoàn thành.

### 4.3. Việc cần làm trước khi demo tích hợp

- [ ] Bổ sung tối thiểu 15 câu khác nhau để chạy được phiên hiện tại; mở rộng độ phủ kỹ năng, mức độ khó và chuẩn hóa nhãn theo mục tiêu đánh giá.
- [ ] Đổi seed/import sang cơ chế có định danh ổn định, kiểm tra dữ liệu và tránh trùng nội dung khi chạy lại.
- [ ] Khi nộp đáp án, truyền user hiện tại vào use case và kiểm tra quyền sở hữu phiên; controller hiện chỉ truyền `sessionId` và DTO.
- [ ] Kiểm tra đáp án thuộc câu đang được giao, không cho trả lời lại cùng câu ở index khác; lưu/xác thực trạng thái câu hiện tại khi cần.
- [ ] Xử lý rõ khi hết câu trước khi đủ 15 đáp án, thay vì để mobile nhận `nextItem = null` trong phiên chưa hoàn tất.
- [ ] Thống nhất chấm theo tỷ lệ hay theta; nếu chuyển sang theta, lưu/ánh xạ kết quả và đánh giá ngưỡng CEFR bằng dữ liệu.
- [ ] Nếu cần confidence thống kê, thiết kế dựa trên sai số của mô hình; phân biệt với tỷ lệ hoàn thành hiện tại.
- [ ] Kiểm tra retry và yêu cầu nộp đáp án đồng thời, phiên đã hoàn tất và trường hợp ML không sẵn sàng.

## 5. AI/ML và yêu cầu CAT–DKT

### 5.1. Những thành phần đã có

- CAT/IRT 3PL: tính EAP và chọn câu theo thông tin Fisher tại `/cat/select`.
- Mô hình DKT LSTM, DKVMN, SAINT+ và mã huấn luyện trên EdNet.
- `/kt/predict` tải **SAINT+** từ `QG_KT_CHECKPOINT`, mặc định `checkpoints/saint_plus.pt`; thiếu checkpoint trả 503.
- Advisor/RAG, sinh bài tập, AWE và speech scoring có endpoint FastAPI; backend có phương thức client nhưng chưa có controller nghiệp vụ công khai cho các luồng này.
- DQN và DP có mã mô phỏng và báo cáo; chưa có lộ trình học tích hợp trên NestJS/mobile.

### 5.2. Phần cần bổ sung để đáp ứng đề tài

- [ ] Chốt vai trò CAT và DKT trong luồng đánh giá/học tập theo yêu cầu giảng viên.
- [ ] Thiết kế dữ liệu bài học, kỹ năng và tương tác học tập xuyên suốt; `AssessmentResponse` hiện chỉ lưu đáp án placement.
- [ ] Xác định đầu vào cho người mới chưa có lịch sử và cách sử dụng dữ liệu placement để khởi tạo mô hình phù hợp.
- [ ] Xây ánh xạ câu hỏi/kỹ năng ứng dụng sang đầu vào của mô hình; không dùng UUID câu hỏi như `q_idx` EdNet khi chưa có ánh xạ hợp lệ.
- [ ] Triển khai serving DKT, quản lý checkpoint, phiên bản và chuẩn hóa đầu vào nếu giữ DKT là mô hình chính của đề tài.
- [ ] Gọi KT sau khi ghi tương tác, lưu dự đoán/trạng thái cần thiết và sử dụng kết quả trong đề xuất nội dung.
- [ ] Đánh giá trên dữ liệu phù hợp ứng dụng; tách train/validation/test, so sánh baseline và báo cáo giới hạn khi chưa có dữ liệu người học thực.

### 5.3. Bằng chứng thực nghiệm đang lưu

| Báo cáo | Kết quả có thể trích dẫn với phạm vi tương ứng |
| --- | --- |
| [CAT simulation](apps/ml/reports/cat_simulation.md) | 312 câu, 1.000 lượt mô phỏng; CAT exact CEFR accuracy 0.671, Fixed-30 0.618; trung bình 30 câu. Khác phiên NestJS 15 câu. |
| [KT results](apps/ml/reports/kt_results.md) | EdNet 60.000 user, 7.504.848 tương tác; Test AUC DKT 0.7565, DKVMN 0.7558, SAINT+ 0.7586. Cần xác định lần chạy khi dùng thêm dòng SAINT+ 0.7516 trong cùng báo cáo. |
| [DQN PoC](apps/ml/reports/dqn_poc.md) | DP 0.636, DQN 0.588, Greedy 0.533, Random 0.197 trên ToyLearnerEnv; mọi goal-reach rate bằng 0 trong trần 60 bước của thiết lập báo cáo. |

Không sử dụng số “CAT 0.750, trung bình 18.5 câu, ngân hàng 617 câu” thay cho nội dung `cat_simulation.md` hiện tại. Các ghi chép .NET, FSRS, mastery EMA hoặc E2E smoke cũ trong tài liệu chưa xác nhận các chức năng tương ứng đã tồn tại trong backend NestJS.

## 6. Thứ tự triển khai đề xuất

### Giai đoạn 1. Củng cố nền tảng và chuẩn bị demo đầu tiên

1. Chốt cách kết hợp CAT–DKT và phạm vi bốn kỹ năng với giảng viên.
2. Hoàn thiện các kiểm tra quyền sở hữu, câu đang giao, hết ngân hàng và tính nhất quán của placement.
3. Bổ sung ngân hàng câu hỏi đủ cho luồng 15 câu; ghi nhận nguồn, nhãn kỹ năng và cách đặt tham số IRT.
4. Sửa `run_mobile.ps1` từ `src/mobile` sang `apps/mobile`, cổng API từ 5000 sang 3000; nối `AppConfig` vào API client.
5. Xây mobile đăng ký, đăng nhập, khôi phục phiên, đăng xuất và placement bằng shared widgets đã có.

**Tiêu chí hoàn thành:** demo từ tài khoản mới đến kết quả placement trên mobile; dữ liệu lưu trong PostgreSQL; không truy cập phiên của user khác; xử lý được token hết hạn, lỗi mạng và ML offline. Có minh chứng của lần demo cụ thể.

### Giai đoạn 2. Hoàn thiện hồ sơ và vòng đời bài học

1. Thêm API/màn hình xem và sửa hồ sơ, mục tiêu CEFR và thời lượng học.
2. Xây danh mục chủ đề, bài học, câu hỏi và quan hệ kỹ năng.
3. Lưu lịch sử trả lời theo học viên, câu hỏi, thời gian, kết quả và phiên bản nội dung.
4. Ngăn nộp lại gây tăng tiến độ/thành thạo nhiều lần; định nghĩa cách xử lý retry.

**Tiêu chí hoàn thành:** học viên mở và hoàn thành bài học trên mobile, có tương tác bền vững trong DB và truy vấn lại được lịch sử để tạo đầu vào KT.

### Giai đoạn 3. Tích hợp DKT và đề xuất nội dung

1. Hoàn thiện pipeline dữ liệu, ánh xạ và serving mô hình DKT theo phạm vi đã thống nhất.
2. Kết hợp kết quả placement, lịch sử tương tác và dự đoán KT để chọn nội dung/độ khó/kỹ năng cần cải thiện.
3. Bổ sung phương án xử lý khi mô hình chưa sẵn sàng hoặc dữ liệu đầu vào chưa đủ; giải thích được lý do đề xuất.
4. So sánh dự đoán và đề xuất với baseline, lưu cấu hình và kết quả đánh giá có thể tái lập.

**Tiêu chí hoàn thành:** chuỗi bài học thực sự cập nhật trạng thái mô hình và thay đổi đề xuất; mô hình đang tải được xác nhận là DKT; báo cáo tách kết quả EdNet, mô phỏng và dữ liệu ứng dụng.

### Giai đoạn 4. Trực quan hóa và hoàn thiện báo cáo

1. Xây API và màn hình tiến độ, lịch sử học, biểu đồ tiến bộ theo thời gian.
2. Thiết kế dữ liệu đánh giá và cách chấm riêng bốn kỹ năng; không suy ra bốn kỹ năng từ một điểm tổng.
3. Hoàn thiện luồng mobile, nội dung song ngữ và các trạng thái lỗi/tải/rỗng.
4. Kiểm thử tích hợp, đối chiếu từng yêu cầu trong `ProgressReport.md`, chuẩn bị demo và báo cáo.

**Tiêu chí hoàn thành:** các biểu đồ lấy dữ liệu thực từ backend, bốn kỹ năng có nguồn đánh giá rõ ràng; mỗi yêu cầu có minh chứng mã nguồn, kiểm thử hoặc demo phù hợp.

### Giai đoạn 5. Các hạng mục mở rộng

Tùy thời gian sau khi hoàn thành các yêu cầu cốt lõi: tích hợp FSRS, đưa advisor/AWE/speech vào bài học, xây gamification, khởi tạo Web Admin hoặc thử nghiệm DQN trên môi trường gần dữ liệu ứng dụng hơn. Các mục này chưa được coi là đã hoàn thành chỉ vì có đặc tả hoặc mã mô phỏng.

## 7. Các mốc theo yêu cầu đồ án

| Mốc | Thời gian theo yêu cầu | Nội dung chuẩn bị đề xuất |
| --- | --- | --- |
| Báo cáo định kỳ lần 1 | 24–25/10/2026 | Trạng thái backend/ML/mobile, sơ đồ tích hợp, phạm vi CAT–DKT đã thống nhất, minh chứng hiện có và khoảng trống. |
| Báo cáo định kỳ lần 2 | 21–22/11/2026 | Tiến độ luồng học, dữ liệu tương tác, tích hợp mô hình và kết quả kiểm thử/đánh giá tại thời điểm báo cáo. |
| Kết thúc thực hiện | 06/12/2026 | Hoàn thiện chức năng thuộc phạm vi, bằng chứng đánh giá và bản demo. |
| Nộp báo cáo đồ án | 08–09/12/2026 | Báo cáo cuối cùng đối chiếu yêu cầu và kết quả thực tế. |
| Phản biện | 10–20/12/2026 | Giải trình thuật toán, dữ liệu, kết quả và giới hạn. |
| Bảo vệ | 21–27/12/2026 | Demo hệ thống và trình bày kết quả. |

Thời gian bắt đầu theo yêu cầu là 28/09/2026. Các nội dung chuẩn bị trong bảng là đề xuất tổ chức công việc, không phải kết quả đã đạt.

## 8. Kiểm chứng và duy trì tài liệu

- Cập nhật [README](README.md) khi thay đổi API, workspace, dependency, đường dẫn hoặc lệnh chạy.
- Đánh dấu công việc hoàn tất khi có mã nguồn và bằng chứng đúng phạm vi; ghi lần chạy khi công bố kết quả test/CI.
- Dùng báo cáo thực nghiệm trong `apps/ml/reports/` với đúng tập dữ liệu và thiết lập; làm rõ các dòng kết quả khác nhau trước khi tổng hợp.
- Backend hiện có unit test; kiểm thử HTTP E2E là công việc còn thiếu. Mobile hiện chỉ có widget smoke test cho bộ đếm, chưa chứng minh Auth/Placement hoạt động.
- Chạy các lệnh kiểm thử/build trong [README](README.md) khi có thay đổi triển khai tương ứng. Kiểm thử với PostgreSQL thật và dịch vụ ML để xác nhận các luồng tích hợp.
- Tuân thủ [hướng dẫn dự án](.agents/AGENTS.md), bảo toàn dữ liệu khi đổi schema và giữ các thay đổi để review trước khi commit/push.
