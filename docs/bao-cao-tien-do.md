# Báo cáo tiến độ & Khó khăn — LingoRoad

> Cập nhật 20/07/2026. Nguồn sự thật: sổ phiên `src/backend/.superpowers/sdd/progress.md` (ghi theo từng phiên làm việc), bằng chứng đo được trong `src/backend/ml/reports/` (đặc biệt `EVIDENCE.md`). Tài liệu lý thuyết của cả nhóm: [bao-cao-ly-thuyet-nhom.md](bao-cao-ly-thuyet-nhom.md).

## 1. Tiến độ lý thuyết

| Mảng | Người phụ trách | Trạng thái |
| --- | --- | --- |
| 1 — Lý thuyết học tập, Knowledge Tracing, Gamification | Thành viên 1 | **Đã nộp** — toàn văn trong [bao-cao-ly-thuyet-nhom.md](bao-cao-ly-thuyet-nhom.md). Còn thiếu: bảng so sánh DKT/DKVMN/SAINT+ (bản gốc là ảnh, chưa chuyển vào repo; số AUC đo được đã có sẵn trong repo để thay thế) |
| 2 — LLM/RAG, đánh giá CEFR (IRT/CAT), ASR & phát âm | Thành viên 2 | **Đã nộp** — toàn văn trong [bao-cao-ly-thuyet-nhom.md](bao-cao-ly-thuyet-nhom.md). Stack đề xuất khác bản đã xây ở vài điểm (pgvector, Semantic Kernel, Flutter) — đã chú thích đối chiếu trong tài liệu chung |
| 3 — Tối ưu lộ trình học + kiến trúc hệ thống | Chủ repo | **Đã nộp + có số liệu đo**: [learning-path-optimization.md](learning-path-optimization.md), [system-architecture.md](system-architecture.md), bản Việt [bao-cao-mang-3-vn.md](bao-cao-mang-3-vn.md) — tất cả dùng số hiện hành (DQN 0.588) |

Điểm mạnh khi bảo vệ: hầu hết nội dung lý thuyết của cả ba mảng đều có hiện thực chạy được và số liệu đo kèm theo trong repo (bảng liên kết chéo ở cuối [bao-cao-ly-thuyet-nhom.md](bao-cao-ly-thuyet-nhom.md)).

**Lưu ý phiên bản:** bản Mảng 3 lưu hành trong nhóm trước 19/07/2026 dùng kết quả DQN cũ (0.581, 800 episode). Kết quả đã công bố hiện tại là **0.588** (4000 episode + checkpoint selection). Khi ghép báo cáo cuối, lấy số từ repo, không lấy từ bản lưu hành cũ.

## 2. Tiến độ hiện thực

Kế hoạch 16 task đã hoàn tất **16/16** (task cuối đóng ngày 18–19/07/2026). Theo năm module của `.claude/requirement.md`:

| Module | Trạng thái | Số liệu / bằng chứng |
| --- | --- | --- |
| 1.1 Test xếp lớp (IRT 3PL + CAT/EAP) | ✅ Hoàn thành | Ngân hàng 617 câu; luật dừng ≥ 8 câu / SE < 0.35 / trần 30. Mô phỏng: đúng-cấp CEFR 0.750 với TB 18.5 câu, so với 0.672 của form cố định 30 câu (`ml/reports/cat_simulation.md`) |
| 1.2 Knowledge Tracing & mastery | ✅ Hoàn thành | EdNet KT1: 7.504.848 tương tác / 60.000 người dùng. Test AUC: SAINT+ 0.7586 (được serve tại `/kt/predict`) > DKT 0.7565 > DKVMN 0.7558 (`ml/reports/kt_results.md`); mastery EMA 0.3 + suy giảm 0.03/ngày (`MasteryCalc.cs`) |
| 1.3 Lộ trình học + ôn tập + advisor | ✅ Hoàn thành | `PathBuilder` production; FSRS-4.5 (`/reviews/*`); advisor RAG tiếng Việt (Gemini, 12 tài liệu ngữ pháp). PoC tối ưu: DP 0.636 > DQN 0.588 > greedy 0.533 > ngẫu nhiên 0.197 (`ml/reports/dqn_poc.md`) |
| 1.4 Sinh bài tập & chấm Writing (AWE) | ✅ Hoàn thành | Endpoint sinh bài tập + chấm AWE qua Gemini thật; chặn replay khi nộp lại (guard `AnsweredAt`); mẫu sống `ml/reports/samples/{exercises,awe}.md` |
| 1.5 Speaking & phát âm | ✅ Hoàn thành (phạm vi đọc-to) | faster-whisper trên CUDA + chấm `/speech/score`; upload .NET có whitelist định dạng; mẫu `ml/reports/samples/speaking.md`. MFA/WhisperX (nói tự do) chưa tích hợp — đúng khuyến nghị "MVP dùng mô hình có sẵn" của Mảng 2 |
| Demo end-to-end | ✅ Hoàn thành | `e2e_smoke.py` chạy sống SMOKE OK: 617 items, placement 30 câu → C2 (θ 3.47) khi trả lời toàn đúng, 19 dòng mastery, FSRS, advisor/exercises/AWE qua Gemini thật (`ml/reports/EVIDENCE.md`) |

**Kiểm thử & môi trường:** .NET 41 passed, ml 47 passed; schema DB tới migration `AddSpeakingAttempts`; GPU RTX 4060 dùng cho huấn luyện KT và Whisper.

**Chưa làm (ngoài phạm vi hiện tại):** frontend React (mới có đề xuất kiến trúc ở B.6), toàn bộ gamification (XP/badge/streak — mới có lý thuyết Mảng 1), MFA/WhisperX cho nói tự do, fine-tune Whisper cho giọng Việt.

## 3. Khó khăn trong quá trình hiện thực

Ghi lại từ sổ phiên — mỗi mục kèm cách giải quyết, vì đây là phần đáng trình bày khi bảo vệ.

### 3.1. Khó khăn chặn tiến độ (blocker thật sự)

- **Hết credit Gemini API (13→18/07, ~5 ngày).** `429 RESOURCE_EXHAUSTED` chặn toàn bộ phần cần LLM: bước cuối task 12 (build chỉ mục RAG + kiểm tra advisor sống) và các task 13/14. *Giải quyết:* nạp thêm credit; trước khi chạy pipeline lớn, xác minh bằng một lệnh embedding 1 chuỗi rẻ tiền để không đốt credit vào lần chạy hỏng. *Bài học:* các task phụ thuộc dịch vụ trả phí cần được xếp lịch quanh rủi ro hết hạn mức; trong thời gian bị chặn, nhóm chuyển sang task 15 (RL PoC — không cần LLM) nên không mất tiến độ tổng thể.

### 3.2. Khó khăn thuật toán / thực nghiệm

- **Rời rạc hóa DP bị suy biến — DP đo được *thấp hơn* greedy.** Phép làm tròn về nút lưới gần nhất (k = 11) nuốt mất lợi ích luyện tập ở vùng mastery cao (0.7 → 0.74 tròn về 0.7), khiến mục tiêu không thể đạt trong chuỗi đã làm tròn và phần thưởng +1 biến mất — mốc "cận trên lý thuyết" trở nên vô nghĩa. *Giải quyết:* thay bằng nội suy đa tuyến trên 2⁵ nút lân cận (xấp xỉ Kushner–Dupuis) + gắn thưởng mục tiêu tại thời điểm đi vào tập mục tiêu. Sau sửa, thứ tự kỳ vọng DP ≥ DQN ≥ greedy > ngẫu nhiên giữ đúng.
- **Giả định đăng ký trước sai: mục tiêu không thể đạt trong trần 60 bước** với *mọi* chính sách ở n = 5 (suy giảm 0.025/bước vượt lợi ích cận biên giai đoạn cuối; cần ~80–90 bước). Hai chỉ số dự kiến (thời-gian-tới-mục-tiêu, tỉ lệ đạt) suy biến thành 60.0/0.00 mọi hàng. *Giải quyết:* phép so sánh chuyển sang hiệu suất tăng trưởng mastery (return trung bình) — và chính điều này làm lộ phát hiện giá trị nhất: greedy thứ tự cố định **không còn gần tối ưu khi có sự quên**.
- **Huấn luyện DQN dài hơn cho kết quả tệ hơn (kết quả âm, 18/07).** 4000 episode với hai lịch ε khác nhau đều rớt cổng chất lượng (0.559 và 0.449 < 0.581), dù đường cong huấn luyện giữa chừng đạt ~0.62–0.63: mạng *cuối cùng* không phải mạng *tốt nhất* (trôi dạt cuối kỳ trên buffer 10k; return khi ε = 0.05 không dự báo return khi ε = 0). *Giải quyết (19/07):* checkpoint selection — cứ 100 episode đánh giá greedy 20 episode trên seed kiểm định 42 (tách khỏi seed test 123), giữ mạng tốt nhất → chọn tại episode 2800, test 0.588 ≥ 0.581, **cổng vượt qua**. Điểm cộng: quỹ đạo lần chạy này xấu suốt ~1800 episode đầu mà selection vẫn cứu được — minh chứng độ bền của phương pháp.

### 3.3. Lỗi được review bắt trước khi thành lỗi thật

- **Nộp lại bài tập làm tăng mastery vô hạn** — replay không bị chặn; sửa bằng guard `AnsweredAt` (task 13).
- **Whisper ghi "2" thay vì "two"** — bài đọc hoàn hảo chỉ được 0.857; sửa bằng chuẩn hóa chữ số/dạng viết tắt trước khi so khớp (task 14).
- **Một trục trặc Gemini có thể vứt bỏ cả bản ghi âm đã nhận dạng xong** — tách phần phản hồi LLM thành bước suy giảm được (degradation), transcription vẫn được giữ (task 14).
- **Kiểm thử không thể thỏa mãn trong kế hoạch task 13** — bài test đòi đáp án đúng *không xuất hiện* trong đề, nhưng đáp án đúng hợp lệ vẫn nằm trong các lựa chọn; thay bằng kiểm tra rò rỉ theo tên trường, được review đặc tả phân xử.

### 3.4. Khó khăn môi trường (Windows / CUDA / phiên bản)

- **PyTorch cu121 không có wheel cho Python 3.13** → cài từ index cu128 (torch 2.11.0+cu128), xác minh trên RTX 4060.
- **AMP hỏng vì bug dtype thật:** đặc trưng lag bị đẩy lên float64 do phép chia vô hướng `np.log1p(1440.0)` → sửa + thêm test hồi quy dtype.
- **Whisper khởi động nguội ~34 s > timeout 30 s của MlClient** → khi demo phải gọi nóng `/speech/score` trực tiếp trước khi đi qua đường API.
- **Console Windows cp1252 vs tiếng Việt UTF-8:** script e2e cần shim stdout UTF-8; `Tee-Object` của PowerShell phá hỏng UTF-8 (bắt output qua bash redirection); JSON tiếng Việt truyền inline qua `curl -d` bị hỏng — phải ghi ra file UTF-8 rồi `--data-binary @file`.
- **`dotnet run --no-launch-profile` làm API chết** vì JWT secret + connection string nằm trong `appsettings.Development.json` — luôn chạy `dotnet run --launch-profile http`.

### 3.5. Nợ kỹ thuật còn lại (đã ghi nhận, chấp nhận có ý thức)

- Nhánh suy giảm 503 của các endpoint mới (exercise/writing/speaking) chưa có test tự động.
- Chỉ số completeness của speaking thưởng cho nói dài dòng; số câu sinh trên route nội bộ và kích thước upload chưa bị chặn trần.
- Cảnh báo NuGet NU1903 (Microsoft.OpenApi 2.0.0, SQLitePCLRaw 2.1.11 có lỗ hổng đã biết) — nâng cấp khi thuận tiện.
- Demo sống tái lập kết quả DQN nay mất ~9 phút (466 s huấn luyện + 53 s DP + đánh giá); bản demo nhanh 2,5 phút của kết quả 800-episode cũ **không còn khớp số đã công bố** — nếu bị yêu cầu tái lập tại chỗ, chạy script đầy đủ.
