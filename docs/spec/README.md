# LingoRoad System Specifications (Đặc tả Hệ thống LingoRoad)

Tài liệu đặc tả toàn diện hệ thống LingoRoad, bao gồm 10 phân hệ nghiệp vụ cốt lõi (Domains) và 29 bộ tính năng chi tiết (Features). Mỗi tính năng tuân thủ chuẩn 4 tài liệu: **PRD** (Product Requirements Document), **RFC** (Request for Comments / Technical Design), **SPEC** (System Specification), và **TASK** (Task Breakdown & Implementation Checklist).

---

## 1. Danh mục Phân hệ Nghiệp vụ Cốt lõi (Domain Specifications)

| Mã Phân hệ | Tên Phân hệ (Domain) | Trọng tâm Nghiệp vụ & Kỹ thuật | Liên kết Tài liệu |
| :--- | :--- | :--- | :--- |
| **Domain 01** | Identity & Access Management | Quản lý danh tính, xác thực Dual-mode (Firebase Auth & Legacy Argon2id), phân quyền RBAC và phiên làm việc | [domain/01-identity-access-management.md](domain/01-identity-access-management.md) |
| **Domain 02** | Placement Assessment | Đánh giá năng lực đầu vào thích ứng 10 câu (5 Reading, 5 Listening), CAT engine per-skill và ước lượng CEFR | [domain/02-placement-assessment.md](domain/02-placement-assessment.md) |
| **Domain 03** | Curriculum & Knowledge Graph | Đồ thị kỹ năng DAG, bài học học thuật (`LearningLesson`), kiến thức vi mô và điều kiện tiên quyết | [domain/03-curriculum-knowledge-graph.md](domain/03-curriculum-knowledge-graph.md) |
| **Domain 04** | Learning Path Sequencing | Thuật toán sinh kế hoạch học tập thích ứng hàng ngày (`baseline-v1`), điều phối bài học và tối ưu hoá lộ trình | [domain/04-learning-path-sequencing.md](domain/04-learning-path-sequencing.md) |
| **Domain 05** | Knowledge Tracing & Mastery | Mô hình Deep Knowledge Tracing (SAINT+, DKTLstm, DKVMN) và theo dõi độ thành thạo kỹ năng thời gian thực | [domain/05-knowledge-tracing-mastery.md](domain/05-knowledge-tracing-mastery.md) |
| **Domain 06** | Spaced Repetition (FSRS) | Ôn tập từ vựng ngắt quãng theo thuật toán FSRS (Free Spaced Repetition Scheduler) và command receipts | [domain/06-spaced-repetition-fsrs.md](domain/06-spaced-repetition-fsrs.md) |
| **Domain 07** | AI Tutoring & Practice | Chấm điểm phát âm in-memory, hội thoại giọng nói WebRTC, chấm viết CEFR, tạo bài tập AI và RAG advisor | [domain/07-ai-tutoring-practice.md](domain/07-ai-tutoring-practice.md) |
| **Domain 08** | Gamification & Engagement | Cơ chế chuỗi ngày học (Streak), điểm kinh nghiệm (XP), nhiệm vụ hàng ngày (Daily Quests) và bảng xếp hạng | [domain/08-gamification-engagement.md](domain/08-gamification-engagement.md) |
| **Domain 09** | Content Admin & CMS | Cổng quản trị CMS, import bài học hàng loạt (Batch CSV/JSON validation) và quản lý kho học liệu | [domain/09-content-admin-cms.md](domain/09-content-admin-cms.md) |
| **Domain 10** | Privacy & Data Governance | Chính sách bảo vệ dữ liệu, quyền lãng quên (GDPR deletion), kiểm toán bảo mật và xử lý audio tạm thời | [domain/10-privacy-data-governance.md](domain/10-privacy-data-governance.md) |

---

## 2. Danh mục Tính năng Chi tiết (Feature Specifications)

Mỗi thư mục tính năng bao gồm bộ tứ tài liệu: `prd.md`, `rfc.md`, `spec.md`, `task.md`.

### Nhóm Xác thực, Phân quyền & Hồ sơ Người dùng (Features 01 – 03)
- **Feature 01: Authentication & Session Management**
  - [01-01 User Registration](features/01-authentication-session-management/01-user-registration/spec.md) - Đăng ký tài khoản mật khẩu, mã hóa Argon2id
  - [01-02 User Login](features/01-authentication-session-management/02-user-login/spec.md) - Xác thực đăng nhập email/password & cấp JWT tokens
  - [01-03 Refresh Token Rotation](features/01-authentication-session-management/03-refresh-token-rotation/spec.md) - Xoay vòng Refresh Token bảo mật và phát hiện tái sử dụng
  - [01-04 Session Revocation & Logout](features/01-authentication-session-management/04-session-revocation-logout/spec.md) - Đăng xuất và thu hồi phiên người dùng
  - [01-05 Google Firebase Authentication](features/01-authentication-session-management/05-google-firebase-authentication/spec.md) - Xác thực Firebase ID Token & Dual Auth provider
- **Feature 02: Authorization & RBAC**
  - [02-01 Role Guards & Access Control](features/02-authorization-rbac/01-role-guards-access-control/spec.md) - Phân quyền vai trò (`STUDENT`, `TEACHER`, `ADMIN`) qua RolesGuard
- **Feature 03: User Profile & Preferences**
  - [03-01 Learner Profile & Goals](features/03-user-profile-preferences/01-learner-profile-goals/spec.md) - Thiết lập mục tiêu học tập, thời lượng mỗi ngày và hồ sơ cá nhân

### Nhóm Kiểm tra Đầu vào & Đánh giá Năng lực (Features 04 – 05, 24 – 25)
- **Feature 04: Placement Session Engine**
  - [04-01 Start Assessment Session](features/04-placement-session-engine/01-start-assessment-session/spec.md) - Khởi tạo phiên kiểm tra CAT 10 câu (Reading & Listening)
  - [04-02 Submit Answer & Adaptive Next Item](features/04-placement-session-engine/02-submit-answer-adaptive/spec.md) - Ghi nhận câu trả lời, cập nhật năng lực per-skill thích ứng
- **Feature 05: Placement Scoring & Completion**
  - [05-01 CEFR Estimation & Completion](features/05-placement-scoring-completion/01-cefr-estimation-completion/spec.md) - Tổng hợp điểm CEFR theo kỹ năng và hoàn tất phiên
  - [05-02 Placement Status & Review](features/05-placement-scoring-completion/02-placement-status-result/spec.md) - Truy vấn trạng thái, kết quả và xem lại toàn bộ bài làm
- **Feature 24: CEFR Exam Framework**
  - [24-01 CEFR Exam Matrix Descriptors](features/24-cefr-exam-framework/01-cefr-exam-matrix-descriptors/spec.md) - Ma trận 24 mô tả chuẩn CEFR đa kỹ năng
- **Feature 25: Multi-Skill Assessment Engine**
  - [25-01 Mock Test Session Lifecycle](features/25-multi-skill-assessment-engine/01-mock-test-session-lifecycle/spec.md) - Vòng đời bài thi thử tổng hợp đa kỹ năng
  - [25-02 Multi-Skill CEFR Aggregation](features/25-multi-skill-assessment-engine/02-multi-skill-cefr-aggregation/spec.md) - Tổng hợp điểm đánh giá CEFR toàn diện

### Nhóm Chương trình Học, Lộ trình & KT (Features 06 – 13)
- **Feature 06: Curriculum & Skill DAG**
  - [06-01 Skill Registry & DAG Management](features/06-curriculum-skill-dag/01-skill-registry-dag-management/spec.md) - Quản lý cấu trúc kỹ năng phân cấp DAG
- **Feature 07: Lesson Flow & Content Presentation**
  - [07-01 Lesson Content Delivery](features/07-lesson-flow-content-presentation/01-lesson-content-delivery/spec.md) - Phân phối nội dung bài học theo khối (`LearningLesson`)
- **Feature 08: In-Lesson Interaction & Formative Assessment**
  - [08-01 In-Lesson Practice](features/08-in-lesson-interaction-formative-assessment/01-in-lesson-practice/spec.md) - Thực hành tương tác và ghi nhận kết quả bài học (`LearningAttempt`)
- **Feature 09: Daily Adaptive Plan**
  - [09-01 Daily Plan Generator](features/09-daily-adaptive-plan/01-daily-plan-generator/spec.md) - Thuật toán sinh kế hoạch học tập hàng ngày (`chooseDailyItems`)
- **Feature 10: Learning Path Optimization**
  - [10-01 Reinforcement Learning Path Optimizer](features/10-learning-path-optimization/01-rl-path-optimizer/spec.md) - Tối ưu hóa lộ trình học tập bằng mô hình RL
- **Feature 11: Deep Knowledge Tracing (SAINT+)**
  - [11-01 SAINT+ Model Architecture](features/11-deep-knowledge-tracing-saint/01-saint-model-architecture/spec.md) - Kiến trúc Transformer SAINT+ dự đoán xác suất trả lời đúng
  - [11-02 PyTorch Microservice Serving](features/11-deep-knowledge-tracing-saint/02-pytorch-serving-inference/spec.md) - Dịch vụ suy luận FastAPI KT (`/kt/predict`, `/kt/batch-predict`)
- **Feature 12: Knowledge State Tracking**
  - [12-01 Student Knowledge Vector Tracker](features/12-knowledge-state-tracking/01-knowledge-state-evolution/spec.md) - Tiến hóa vector năng lực học viên theo chuỗi thời gian
- **Feature 13: Knowledge Mastery Analytics**
  - [13-01 Mastery Overview & Radar](features/13-knowledge-mastery-analytics/01-mastery-overview-radar/spec.md) - Biểu đồ Radar năng lực và tiến độ 7 ngày (`PlanningModule`)

### Nhóm Từ vựng & Lặp lại Ngắt quãng (Features 14 – 15)
- **Feature 14: Vocabulary Deck Management**
  - [14-01 Deck & Word Card Operations](features/14-vocabulary-deck-management/01-deck-word-crud/spec.md) - Quản lý bộ thẻ từ vựng và tra cứu từ vựng
- **Feature 15: Spaced Repetition Review (FSRS)**
  - [15-01 FSRS Review Engine](features/15-spaced-repetition-review-fsrs/01-fsrs-review-engine/spec.md) - Lịch ôn tập ngắt quãng FSRS và đồng bộ offline receipts

### Nhóm Trợ lý AI, Luyện Nói, Viết & Thực hành (Features 16 – 18, 26)
- **Feature 16: AI Speaking Evaluator**
  - [16-01 Audio Ingestion & Phoneme Alignment](features/16-ai-speaking-evaluator/01-audio-ingestion-phoneme-alignment/spec.md) - Đọc đoạn văn (Read-Aloud v1/v2) và phân tích âm vị in-memory
  - [16-02 Multi-Dimensional Pronunciation Scoring](features/16-ai-speaking-evaluator/02-multi-dimensional-pronunciation-scoring/spec.md) - Chấm điểm nói theo chủ đề 2 giai đoạn (Acoustic + LLM rubric)
  - [16-03 Speaking Modes & Gamified Flow](features/16-ai-speaking-evaluator/03-speaking-modes-and-game/spec.md) - 3 chế độ luyện nói (Read Aloud, Topic, Tongue Twister) và mở khóa màn
  - [16-04 AI Voice Live Conversation](features/16-ai-speaking-evaluator/04-ai-voice-live-conversation/spec.md) - Đàm thoại trực tiếp thời gian thực WebRTC, WebSocket relay và VAD feedback
- **Feature 17: AI Writing Evaluator**
  - [17-01 Automated Writing Evaluation (AWE)](features/17-ai-writing-evaluator/01-automated-writing-evaluation/spec.md) - Chấm bài viết tự động theo câu (`/llm/awe`) với nhận xét tiếng Việt
  - [17-02 CEFR Writing Rubric Evaluator](features/17-ai-writing-evaluator/02-cefr-writing-rubric-evaluator/spec.md) - Đánh giá bài viết theo tiêu chí CEFR và phòng chống prompt injection
- **Feature 18: AI Learning Advisor**
  - [18-01 AI Advisor Insights & Exercises](features/18-ai-learning-advisor/01-ai-advisor-insights/spec.md) - Trợ lý RAG giải đáp lộ trình (`/llm/advisor`) và sinh bài tập (`/llm/exercises`)
- **Feature 26: Skill Practice Engine**
  - [26-01 Instant Feedback Practice](features/26-skill-practice-engine/01-instant-feedback-practice/spec.md) - Chế độ luyện tập phản hồi tức thì
  - [26-02 Interactive AI Scaffolding](features/26-skill-practice-engine/02-interactive-ai-scaffolding/spec.md) - Giàn giáo hỗ trợ học tập thích ứng AI

### Nhóm Gamification, Admin & Bảo mật Dữ liệu (Features 19 – 23)
- **Feature 19: Gamification Streak & Rewards**
  - [19-01 Streak & XP Ledger](features/19-gamification-streak-rewards/01-streak-xp-ledger/spec.md) - Sổ cái điểm thưởng kinh nghiệm và duy trì chuỗi học tập
- **Feature 20: Gamification Daily Quests**
  - [20-01 Daily Quests Lifecycle](features/20-gamification-daily-quests/01-daily-quests-lifecycle/spec.md) - Vòng đời nhiệm vụ hàng ngày và phần thưởng hoàn thành
- **Feature 21: Admin Batch Import**
  - [21-01 Batch Import Validation & Apply](features/21-admin-batch-import/01-batch-import-validation-apply/spec.md) - Kiểm thử và nhập học liệu hàng loạt (JSON/CSV)
- **Feature 22: Admin Audit & Analytics**
  - [22-01 Audit Logging Interceptor](features/22-admin-audit-analytics/01-audit-logging-interceptor/spec.md) - Ghi nhật ký thao tác quản trị viên
  - [22-02 System Metrics & Analytics](features/22-admin-audit-analytics/02-system-metrics-analytics/spec.md) - Thống kê số liệu hoạt động và sức khỏe hệ thống
- **Feature 23: Privacy & Data Retention**
  - [23-01 Account Deletion & GDPR Compliance](features/23-privacy-data-retention/01-account-deletion-gdpr/spec.md) - Quy trình xóa tài khoản vĩnh viễn bảo vệ dữ liệu người dùng
  - [23-02 Audio Ephemeral Cleanup Worker](features/23-privacy-data-retention/02-audio-ephemeral-cleanup-worker/spec.md) - Cơ chế xử lý audio in-memory và dọn dẹp bộ đệm tạm thời

### Nhóm Tính năng Nâng cấp & Mở rộng Mới (Features 27 – 29)
- **Feature 27: Learning Activity Time Tracking**
  - [27-01 Activity Session Segment Sync](features/27-learning-activity-time-tracking/01-activity-session-segment-sync/spec.md) - Đồng hồ theo dõi thời gian học đơn điệu, phân đoạn 15s và hợp nhất phiên đa thiết bị
- **Feature 28: Web Landing & Interactive Simulator**
  - [28-01 Marketing Landing CAT & FSRS Simulator](features/28-web-landing-interactive-simulator/01-marketing-landing-cat-fsrs-simulator/spec.md) - Trang giới thiệu sản phẩm Next.js App Router, mô phỏng trực quan CAT và FSRS
- **Feature 29: Mobile Design System & Adaptive UI**
  - [29-01 Design Tokens & Shared Components](features/29-mobile-design-system-adaptive-ui/01-design-tokens-shared-components/spec.md) - Quy chuẩn Design Tokens (`AppColors`, `AppRadius`, `AppSpacing`, `AppShadows`, `AppTypography`) và bộ widget dùng chung đáp ứng đa màn hình

