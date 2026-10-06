# Báo cáo lý thuyết nhóm — LingoRoad

> Tài liệu dùng chung của nhóm: phân công ba mảng lý thuyết và kết quả của từng thành viên.
>
> - **Mảng 1** và **Mảng 2** được đưa vào nguyên văn (chỉ chuẩn hóa ký hiệu toán về Unicode cho thống nhất với các tài liệu khác trong repo).
> - **Mảng 3** đã có báo cáo đầy đủ trong repo ([bao-cao-mang-3-vn.md](bao-cao-mang-3-vn.md)) nên ở đây chỉ tóm tắt. **Lưu ý:** bản Mảng 3 lưu hành trong nhóm trước 19/07/2026 dùng kết quả DQN cũ (0.581, huấn luyện 800 episode); số đã công bố hiện tại là **0.588** (4000 episode + checkpoint selection) — mọi số liệu dưới đây và trong báo cáo đầy đủ là số hiện hành.
> - Tiến độ hiện thực theo module và nhật ký khó khăn: [bao-cao-tien-do.md](bao-cao-tien-do.md).

## Phân công ba mảng

| Mảng | Trọng tâm | Đầu ra cam kết |
|---|---|---|
| **1 — Lý thuyết học tập & Mô hình hóa năng lực người học** | Nền tảng sư phạm (ZPD, Mastery Learning, SRL, SRS) + Knowledge Tracing (DKT, DKVMN, SAINT+) + Gamification | Tài liệu tổng hợp lý thuyết + bảng so sánh DKT/DKVMN/SAINT+ (ưu nhược điểm, độ phức tạp, dữ liệu cần thiết) làm cơ sở chọn mô hình khi implement |
| **2 — AI ứng dụng: Đánh giá năng lực & Xử lý ngôn ngữ** | LLM & RAG trong giáo dục ngôn ngữ; đánh giá trình độ theo CEFR (IRT, CAT); ASR & đánh giá phát âm (Whisper, MFA) | Tài liệu kỹ thuật pipeline đánh giá (audio/text input → điểm CEFR + phản hồi phát âm), kèm so sánh công cụ/thư viện khả dụng |
| **3 — Tối ưu hóa lộ trình học & Nền tảng công nghệ** | Bài toán tối ưu lộ trình (Greedy / DP / RL) + hạ tầng kỹ thuật (Python + React + PostgreSQL) | Mô tả bài toán tối ưu (input/output/constraints), so sánh 3 phương pháp có số liệu đo, đề xuất kiến trúc hệ thống tích hợp hai mảng còn lại |

---

# MẢNG 1 — Lý thuyết học tập & Mô hình hóa năng lực người học

## 1. Adaptive Learning Theory & Cá nhân hóa giáo dục

Bản chất của Học tập Thích ứng (Adaptive Learning) là biến quá trình giáo dục từ "một cỡ cho tất cả" thành một hệ thống động, tự điều chỉnh dựa trên dữ liệu thời gian thực của người học.

### Zone of Proximal Development (ZPD) — Vùng phát triển gần nhất

- Do Lev Vygotsky đề xuất. ZPD là khoảng không gian giữa những gì người học **có thể tự làm** không cần trợ giúp và những gì họ **chưa thể làm** dù có trợ giúp. Hệ thống adaptive cần giữ người học ở vùng này: nếu bài tập quá dễ sẽ gây nhàm chán, quá khó sẽ gây nản lòng (frustration).
- **Kỹ thuật theo dõi tri thức:** Hệ thống ước lượng năng lực hiện tại (θ) và độ khó bài học (β). Bài học tiếp theo được chọn sao cho xác suất làm đúng nằm trong khoảng tối ưu (thường là P(đúng) ≈ 0.5–0.75), đây chính là ranh giới của ZPD.

### Mastery Learning — Học tập thành thạo

- Do Benjamin Bloom phát triển. Trái với giáo dục truyền thống cố định *thời gian* và biến thiên *kết quả*, Mastery Learning **cố định kết quả (phải thành thạo đạt ≥ 80–90%)** và biến thiên **thời gian**. Người học không được chuyển sang khái niệm B nếu chưa làm chủ khái niệm A.
- **Kỹ thuật theo dõi tri thức:** Tạo ra cơ chế chặn (Gatekeeping). Knowledge Tracing (KT) sẽ liên tục cập nhật trạng thái nắm vững kỹ năng p(L_t). Hệ thống chỉ mở khóa bài học mới khi p(L_t) > ngưỡng (ví dụ: 0.85).

### Self-Regulated Learning (SRL) — Tự điều chỉnh học tập

- Gồm 3 pha tuần hoàn: *Đặt mục tiêu/Lập kế hoạch* → *Thực hiện & Tự giám sát* → *Tự phản hồi/Đánh giá*. Người học có kỹ năng SRL cao sẽ học sâu hơn.
- **Kỹ thuật theo dõi tri thức:** Hệ thống không chỉ cung cấp bài học mà phải cung cấp **Dashboard trực quan hóa năng lực** (Open Learner Models — OLMs). Khi người học nhìn thấy "bản đồ tri thức" của chính mình (chỗ nào xanh, chỗ nào đỏ), họ sẽ tự kích hoạt cơ chế SRL để chọn học bù các phần còn yếu.

### Spaced Repetition System (SRS) — Hệ thống lặp lại ngắt quãng

- Dựa trên Forgetting Curve (Đường cong quên lãng) của Hermann Ebbinghaus. Trí nhớ dài hạn được hình thành hiệu quả nhất khi thông tin được ôn tập lại **ngay tại thời điểm nó chuẩn bị bị quên**.
- **Số hóa bằng kỹ thuật:**
  - *Leitner System:* Chia thẻ học thành các hộp (boxes). Trả lời đúng → lên hộp cao hơn (thời gian ôn dài hơn), sai → về hộp 1.
  - *Thuật toán SM-2 (SuperMemo):* Tính toán khoảng cách ngày ôn tập tiếp theo (I) dựa trên hệ số dễ (Easiness Factor — EF):

    I(1) = 1, I(2) = 6, I(n) = I(n−1) × EF

  - Sau mỗi lần học, EF được cập nhật động dựa trên điểm đánh giá chất lượng phản hồi (q) từ 0 đến 5 của người học.

## 2. Knowledge Tracing & Learner Modeling

Knowledge Tracing (Theo dõi Tri thức) là bài toán sequence modeling: Dựa trên lịch sử tương tác của người học X = (x₁, x₂, …, x_t) (trong đó x_t = (q_t, r_t) gồm ID câu hỏi/kỹ năng q_t và kết quả đúng/sai r_t ∈ {0, 1}), hãy dự đoán xác suất người học sẽ trả lời đúng câu hỏi tiếp theo x_{t+1}.

### Deep Knowledge Tracing (DKT)

Là mô hình tiên phong ứng dụng Deep Learning vào KT (Piech et al., 2015). DKT sử dụng mạng RNN hoặc LSTM để nén toàn bộ lịch sử học tập của một học sinh vào một vector trạng thái ẩn (hidden state) h_t.

- **Cơ chế hoạt động:** Tại mỗi bước t, vector đầu vào là sự kết hợp của kỹ năng được tương tác và kết quả đúng/sai (thường được mã hóa dạng one-hot vector có độ dài 2N với N là tổng số kỹ năng). Mạng LSTM cập nhật trạng thái ẩn: h_t = LSTM(x_t, h_{t−1}). Từ h_t, mô hình dùng một lớp Dense với hàm kích hoạt Sigmoid để xuất ra một vector có độ dài N, đại diện cho xác suất làm đúng của **tất cả** các kỹ năng tại thời điểm tiếp theo.
- **Bản chất:** DKT giả định rằng việc học một kỹ năng này có thể tác động gián tiếp đến kỹ năng khác thông qua mạng lưới liên kết ẩn trong vector h_t.

### Dynamic Key-Value Memory Networks for Knowledge Tracing (DKVMN)

Khắc phục nhược điểm lớn của DKT là "hộp đen" (không biết rõ học sinh đang yếu cụ thể khái niệm nào trong trạng thái ẩn h_t). DKVMN (Zhang et al., 2017) mượn kiến trúc Memory Network để phân tách rõ ràng: **Khái niệm tri thức** và **Mức độ thành thạo**.

- **Cơ chế hoạt động:** Mô hình duy trì hai ma trận bộ nhớ:
  1. *Ma trận Key (M_k):* Cố định, lưu trữ embedding của các khái niệm tri thức (Knowledge Components — KCs).
  2. *Ma trận Value (M_v^t):* Thay đổi theo thời gian, lưu trữ mức độ thành thạo của **từng** học sinh đối với các khái niệm tương ứng trong M_k.
- Khi học sinh làm câu hỏi thuộc kỹ năng q_t, mô hình dùng cơ chế Attention để tính độ tương đồng giữa q_t với ma trận Key (M_k) nhằm tìm ra các khái niệm liên quan (gọi là Read Weight w_t). Trạng thái năng lực hiện tại được đọc ra từ ma trận Value dựa trên w_t. Sau khi có kết quả r_t, hệ thống dùng một hàm viết (Write) để cập nhật lại **chỉ các vùng bộ nhớ liên quan** trong ma trận Value M_v^{t+1}.

### SAINT+ (Separable Self-Attention Information Network for Deep Knowledge Tracing)

Tách biệt thông tin về **Nội dung bài học** (tác vụ, kỹ năng) và **Phản hồi của người học** (đúng/sai, thời gian phản hồi — response time, khoảng thời gian trống giữa các lần học — elapsed time) thành hai nhánh Encoder và Decoder riêng biệt.

- **Cơ chế hoạt động:**
  - *Encoder:* Nhận đầu vào là chuỗi các bài tập/kỹ năng, áp dụng cơ chế Self-Attention để bắt lấy mối quan hệ ngữ nghĩa giữa các bài tập (ví dụ: bài tập 5 và bài tập 10 đều liên quan đến giải phương trình bậc 2).
  - *Decoder:* Nhận đầu vào là chuỗi kết quả tương tác kết hợp với các đặc trưng thời gian (thời gian làm bài, thời gian giãn cách). Decoder thực hiện Self-Attention trên lịch sử phản hồi và Cross-Attention với đầu ra của Encoder để đưa ra dự đoán chính xác cho bước tiếp theo.
- **Bản chất sư phạm:** SAINT+ nắm bắt hoàn hảo yếu tố **thời gian**. Một học sinh làm đúng câu hỏi sau 5 ngày không học sẽ có trạng thái tri thức khác với một học sinh vừa làm đúng câu hỏi đó cách đây 5 phút.

**Bảng so sánh các mô hình Knowledge Tracing** — bảng trong tài liệu gốc của Mảng 1 (chưa chuyển vào repo). Số liệu AUC đo được của cả ba mô hình trên EdNet trong repo này có tại [ai-theory-and-algorithms.md](ai-theory-and-algorithms.md) và `src/backend/ml/reports/kt_results.md` (test AUC: DKT 0.7565, DKVMN 0.7558, SAINT+ 0.7586 — SAINT+ là mô hình được serve).

## 3. Gamification trong giáo dục

Gamification (Trò chơi hóa) không phải là biến bài học thành trò chơi điện tử, mà là mang các **cơ chế nguyên bản của trò chơi** vào môi trường học tập nhằm thúc đẩy động lực nội tại (Intrinsic Motivation) và ngoại tại (Extrinsic Motivation).

### Cơ sở tâm lý học hành vi

- **Operant Conditioning (Thuyết điều kiện hóa từ kết quả — B.F. Skinner):** Hành vi được củng cố thông qua phần thưởng hoặc hình phạt. Việc tặng điểm (XP), bật hiệu ứng chúc mừng ngay khi làm đúng câu hỏi khó chính là cơ chế **Củng cố tích cực (Positive Reinforcement)**, kích thích não bộ tiết Dopamine, khiến người học muốn lặp lại hành vi học tập đó.
- **Self-Determination Theory (Thuyết tự quyết — Deci & Ryan):** Chỉ ra 3 nhu cầu cốt lõi giúp con người đạt trạng thái động lực tự thân cao nhất:
  1. *Autonomy (Sự tự chủ):* Người học được quyền chọn lộ trình, chọn bài học (hệ thống adaptive gợi ý 3 lựa chọn thay vì bắt buộc 1).
  2. *Competence (Năng lực):* Cảm giác mình đang giỏi lên. Đây là lý do hệ thống bài tập phải đi từ dễ đến khó (ZPD). Nếu thiết kế quá khó, nhu cầu Competence sụp đổ, người học từ bỏ.
  3. *Relatedness (Sự gắn kết):* Cảm giác thuộc về một cộng đồng (thể hiện qua bảng xếp hạng nhóm, thách đấu bạn bè).

### Thiết kế các thành phần Gamification dài hạn (PBL Triad & Streaks)

Để tránh việc người học không còn cảm thấy hào hứng, thích thú hay có động lực với những phần thưởng mà hệ thống đưa ra, hệ thống cần kết hợp nhuần nhuyễn các yếu tố:

- **Points (Điểm số — XP):** Dùng để định lượng nỗ lực ngắn hạn. **Quy tắc kỹ thuật:** Không bao giờ trừ điểm XP khi làm sai (tránh tâm lý sợ hãi), chỉ cộng điểm khi có nỗ lực. Làm bài trong ZPD (bài khó) nhận được nhiều XP hơn bài dễ.
- **Badges (Huy hiệu):** Đại diện cho các cột mốc ý nghĩa hoặc minh chứng cho một năng lực đặc biệt (ví dụ: huy hiệu "Cú đêm" khi học sau 12h đêm, huy hiệu "Nhà thông thái" khi đạt Mastery 5 kỹ năng khó liên tiếp). Badges đánh vào nhu cầu tự thể hiện mình.
- **Leaderboards (Bảng xếp hạng):** Áp dụng **xếp hạng động theo phân hạng**: gom 30 người có cùng tốc độ học và mức XP vào một League hàng tuần. Chỉ top 10 được thăng hạng, bottom 5 bị xuống hạng. Điều này tạo ra sự cạnh tranh vừa sức (cũng là một dạng ZPD trong thi đấu). (**Lưu ý thiết kế:** Không bao giờ dùng một bảng xếp hạng toàn cầu (Global Leaderboard) vì người mới vào nhìn thấy top 1 có 1.000.000 XP sẽ nản lòng ngay lập tức.)
- **Streaks (Chuỗi ngày học liên tục):** Đây là công cụ mạnh mẽ nhất để xây dựng **thói quen**. Con người có tâm lý "sợ mất mát" (Loss Aversion). Khi một học sinh có chuỗi Streak 50 ngày, họ sẽ cố gắng học ít nhất 5 phút mỗi ngày chỉ để bảo vệ con số 50 đó không bị reset về 0.

## 4. Hướng tiếp cận khi implement hệ thống

Đối với MVP (Minimum Viable Product): Ứng dụng **DKT** để dựng pipeline xử lý dữ liệu sequence trước vì nó đơn giản nhất. Về mặt sư phạm, ứng dụng **Mastery Learning** với một ngưỡng cứng (ví dụ p(L_t) > 0.8) để kiểm soát luồng bài học.

Nếu **cần Dashboard báo cáo năng lực chi tiết cho người dùng:** Áp dụng kiến trúc **DKVMN** để có thể bóc tách chính xác điểm số của từng ô nhớ để vẽ lên màn hình đồ thị mạng nhện (Radar Chart) về năng lực của học sinh.

Nếu tập trung vào Micro-learning (như học ngoại ngữ, từ vựng, toán phân mảnh): Tích hợp chặt chẽ cấu trúc dữ liệu chuỗi thời gian của **SAINT+** kết hợp với bộ lọc thời gian của thuật toán **SRS (SM-2)** để tính toán chính xác ngày/giờ đẩy thông báo (Push Notification) nhắc nhở học sinh vào cứu chuỗi Streak, tối ưu hóa tỷ lệ giữ chân (Retention Rate).

---

# MẢNG 2 — AI ứng dụng: Đánh giá năng lực & Xử lý ngôn ngữ

## 1. LLM và RAG trong giáo dục ngôn ngữ

### 1.1. LLM là gì?

**LLM — Large Language Model** là mô hình AI có khả năng hiểu và sinh ngôn ngữ tự nhiên. Trong LingoRoad, LLM có thể được dùng để:

- Giải thích lỗi ngữ pháp bằng tiếng Việt.
- Sinh ví dụ và bài tập.
- Tạo nội dung học theo trình độ.
- Diễn giải lý do hệ thống đề xuất một bài học.
- Chấm và nhận xét nội dung Writing hoặc Speaking theo rubric.

LLM không nên trực tiếp quyết định người học đạt A2 hay B1 vì kết quả có thể thiếu ổn định. Điểm số cần được tính bởi IRT, các mô hình đánh giá kỹ năng hoặc rubric trước.

### 1.2. RAG là gì?

**RAG — Retrieval-Augmented Generation** là kỹ thuật tìm tài liệu liên quan trước, sau đó cung cấp tài liệu đó cho LLM để tạo câu trả lời.

Ví dụ, khi người học dùng sai thì hiện tại hoàn thành:

```
Câu trả lời của người học
→ Xác định lỗi Present Perfect
→ Tìm quy tắc trong kho ngữ pháp
→ Đưa quy tắc và ví dụ vào LLM
→ Sinh lời giải thích bằng tiếng Việt
```

Kho RAG có thể chứa:

- Quy tắc ngữ pháp.
- CEFR descriptors.
- Ví dụ đúng và sai.
- Lỗi phổ biến của người Việt.
- Hướng dẫn phát âm.
- Nội dung bài học.
- Rubric Speaking và Writing.

Có thể lưu tài liệu bằng **PostgreSQL kết hợp pgvector**. `pgvector` giúp tìm tài liệu có ý nghĩa gần với câu hỏi, kể cả khi từ ngữ không hoàn toàn giống nhau.

### 1.3. Sinh lộ trình học cá nhân hóa

**Personalized Learning Path Generation** là quá trình tạo lộ trình riêng cho từng người dựa trên:

- CEFR hiện tại và mục tiêu.
- Điểm mastery của từng kỹ năng.
- Các kỹ năng còn yếu.
- Quan hệ tiên quyết giữa các kỹ năng.
- Thời gian học mỗi ngày.
- Lịch sử làm bài.
- Nội dung đến hạn ôn tập.

Pipeline:

```
Hồ sơ người học
→ Lấy các kỹ năng cần đạt
→ Loại kỹ năng đã thành thạo
→ Kiểm tra kỹ năng tiên quyết
→ Ưu tiên kỹ năng yếu
→ Chèn nội dung cần ôn
→ Chia thành kế hoạch theo ngày
→ LLM diễn giải lộ trình
```

Phần lựa chọn kỹ năng nên dựa trên thuật toán và dữ liệu. LLM chủ yếu giúp trình bày lộ trình rõ ràng, tự nhiên và phù hợp mục tiêu học.

### 1.4. Sinh bài tập thích ứng

**Adaptive Exercise Generation** là sinh bài tập theo trình độ và lỗi của từng người.

Ví dụ, hai người cùng học Present Perfect nhưng:

- Người thứ nhất thường quên `have/has`.
- Người thứ hai thường dùng sai quá khứ phân từ.

Hệ thống sẽ tạo hai nhóm bài tập khác nhau.

```
Kỹ năng + CEFR + lỗi gần đây
→ LLM sinh nhiều câu hỏi
→ Kiểm tra đáp án
→ Kiểm tra độ khó
→ Loại câu mơ hồ
→ Chọn bài phù hợp nhất
```

Với câu hỏi trắc nghiệm, hệ thống còn phải tạo **distractor**, tức các phương án sai nhưng hợp lý. Trong MVP, bài tập AI sinh nên được lưu ở trạng thái nháp để quản trị viên duyệt.

### 1.5. Giải thích ngữ pháp cá nhân hóa

Pipeline giải thích lỗi:

```
Câu trả lời
→ Phát hiện đoạn sai
→ Phân loại loại lỗi
→ Truy xuất quy tắc bằng RAG
→ LLM giải thích bằng tiếng Việt
→ Đưa ví dụ
→ Sinh bài luyện tiếp theo
```

Ví dụ:

```json
{
  "error": "I have went to school.",
  "correctedText": "I have gone to school.",
  "errorType": "past_participle",
  "explanation": "Sau have/has cần dùng quá khứ phân từ. Quá khứ phân từ của go là gone."
}
```

## 2. Đánh giá trình độ tự động theo CEFR

### 2.1. CEFR là gì?

**CEFR — Common European Framework of Reference for Languages** là Khung tham chiếu trình độ ngôn ngữ chung Châu Âu, gồm sáu mức:

| Mức | Ý nghĩa |
| --- | --- |
| A1 | Mới bắt đầu |
| A2 | Giao tiếp cơ bản |
| B1 | Sử dụng độc lập trong tình huống quen thuộc |
| B2 | Giao tiếp khá lưu loát trong học tập và công việc |
| C1 | Sử dụng ngôn ngữ linh hoạt |
| C2 | Thành thạo ở mức rất cao |

Người học có thể có mức khác nhau ở từng kỹ năng, ví dụ Reading B1 nhưng Speaking A2. Vì vậy, hệ thống không nên chỉ lưu một mức CEFR tổng.

### 2.2. IRT là gì?

**IRT — Item Response Theory** là mô hình toán học ước lượng năng lực người học dựa trên:

- Người học trả lời đúng hay sai.
- Câu hỏi dễ hay khó.
- Câu hỏi phân biệt người mạnh và yếu tốt đến đâu.
- Khả năng đoán đúng của câu hỏi trắc nghiệm.

Năng lực người học được ký hiệu là **θ — theta**.

#### Các mô hình IRT

| Mô hình | Tham số | Ý nghĩa |
| --- | --- | --- |
| 1PL | Độ khó `b` | Đơn giản, phù hợp khi dữ liệu còn ít |
| 2PL | Độ khó `b`, độ phân biệt `a` | Phản ánh chất lượng khác nhau của câu hỏi |
| 3PL | `a`, `b`, xác suất đoán đúng `c` | Phù hợp câu hỏi trắc nghiệm nhưng cần nhiều dữ liệu |

- **Độ khó `b`:** câu hỏi có mức độ khó như thế nào.
- **Độ phân biệt `a`:** câu hỏi có phân biệt tốt người học mạnh và yếu hay không.
- **Xác suất đoán `c`:** người không biết bài vẫn có thể chọn đúng ngẫu nhiên.

Trong MVP có thể bắt đầu với 1PL hoặc 2PL. Khi có nhiều dữ liệu người học hơn, hệ thống có thể hiệu chỉnh 3PL.

### 2.3. CAT là gì?

**CAT — Computerized Adaptive Testing** là bài kiểm tra thích ứng. Sau mỗi câu trả lời, hệ thống cập nhật năng lực và chọn câu tiếp theo phù hợp hơn.

```
Khởi tạo θ
→ Chọn câu hỏi
→ Người học trả lời
→ Cập nhật θ
→ Tính sai số
→ Chọn câu hỏi tiếp theo
→ Dừng khi đủ độ tin cậy
```

Nếu trả lời đúng, hệ thống có thể chọn câu khó hơn. Nếu trả lời sai, câu tiếp theo sẽ gần hơn với năng lực hiện tại.

**EAP — Expected A Posteriori** là phương pháp cập nhật theta bằng xác suất Bayes. EAP phù hợp với bài kiểm tra ngắn và vẫn hoạt động ổn định khi người học trả lời toàn đúng hoặc toàn sai ở những câu đầu.

Điều kiện dừng tham khảo:

- Tối thiểu 8 câu.
- Tối đa 30 câu.
- Dừng khi sai số chuẩn nhỏ hơn ngưỡng.
- Hoặc khi xác suất thuộc một mức CEFR đã đủ cao.

### 2.4. Phân loại theo từng kỹ năng

Hệ thống cần đánh giá riêng:

- **Listening:** khả năng nghe hiểu.
- **Speaking:** nội dung nói, phát âm và độ trôi chảy.
- **Reading:** khả năng đọc hiểu.
- **Writing:** nội dung, từ vựng, ngữ pháp và tính mạch lạc.
- **Grammar:** khả năng sử dụng cấu trúc.
- **Vocabulary:** vốn từ và khả năng dùng từ trong ngữ cảnh.

Ví dụ kết quả:

```json
{
  "overallCefr": "B1",
  "skills": {
    "listening": "A2",
    "speaking": "A2",
    "reading": "B1",
    "writing": "A2",
    "grammar": "B1",
    "vocabulary": "A2"
  }
}
```

Grammar, Vocabulary, Reading và Listening có thể đánh giá bằng câu hỏi IRT/CAT. Writing và Speaking cần thêm rubric và mô hình xử lý ngôn ngữ.

### 2.5. Ánh xạ điểm sang CEFR

Không nên tự đặt các ngưỡng theta rồi coi đó là chuẩn chung. Việc chuyển điểm thành CEFR cần quy trình **standard setting**, gồm:

1. Gắn nhãn CEFR cho câu hỏi.
2. Mời chuyên gia đánh giá.
3. Thu thập dữ liệu người học.
4. Hiệu chỉnh tham số IRT.
5. So sánh với đánh giá giáo viên hoặc bài thi chuẩn.
6. Xác định các điểm cắt A1/A2, A2/B1...
7. Kiểm tra tỷ lệ phân loại sai.

Trong MVP, kết quả nên được gọi là **ước lượng trình độ CEFR**, không phải chứng nhận CEFR chính thức.

## 3. ASR và đánh giá phát âm

### 3.1. ASR và Whisper

**ASR — Automatic Speech Recognition** là công nghệ chuyển giọng nói thành văn bản.

**Whisper** là mô hình ASR có thể dùng để:

- Tạo transcript từ audio.
- Xác định người học đã nói gì.
- Phân tích nội dung Speaking.
- Phát hiện từ bị thiếu.
- Lấy timestamp của từng từ.

**Fine-tuning Whisper** là tiếp tục huấn luyện mô hình bằng dữ liệu chuyên biệt, chẳng hạn audio người Việt nói tiếng Anh. Việc này có thể giúp nhận diện accent Việt tốt hơn nhưng cần:

- Nhiều audio có transcript chính xác.
- GPU.
- Bộ train, validation và test.
- Đánh giá bằng WER — tỷ lệ nhận dạng sai từ.

Trong MVP nên sử dụng mô hình có sẵn trước, chưa cần fine-tune.

#### So sánh các lựa chọn Whisper

| Công cụ | Điểm mạnh | Phù hợp |
| --- | --- | --- |
| `small.en` | Nhẹ, khá chính xác với tiếng Anh | MVP |
| `medium.en` | Chính xác hơn | Server có GPU |
| `large-v3` | Độ chính xác cao | Giai đoạn mở rộng |
| `faster-whisper` | Nhanh, ít bộ nhớ | API server |
| `WhisperX` | Timestamp cấp từ tốt | Speaking tự do |
| `whisper.cpp` | Chạy offline | Mobile hoặc thiết bị yếu |

Whisper chỉ cho biết người học đã nói gì, không đủ để kết luận phát âm có chính xác hay không.

### 3.2. Montreal Forced Aligner

**MFA — Montreal Forced Aligner** là công cụ căn chỉnh audio với câu mẫu để xác định thời gian của từng từ và âm vị.

Đầu vào:

- Audio người học.
- Transcript chuẩn.
- Từ điển phát âm.
- Acoustic model.

Đầu ra:

```
book: 0,83–1,15 giây
B:    0,83–0,91
UH:   0,91–1,05
K:    1,05–1,15
```

MFA phù hợp với:

- Read-aloud.
- Shadowing.
- Đọc từ hoặc câu.
- Minimal pairs.
- Luyện âm và trọng âm.

MFA không phù hợp trực tiếp với Speaking tự do vì không có câu mẫu cố định. Với nói tự do, có thể dùng WhisperX để tạo transcript và timestamp.

#### Thiết lập MFA cơ bản

```
Audio WAV 16 kHz, mono
+ File transcript
+ Từ điển phát âm tiếng Anh
+ Acoustic model tiếng Anh
→ MFA align
→ Xuất TextGrid hoặc JSON
```

### 3.3. Các tiêu chí phát âm

#### Phoneme accuracy

**Phoneme** là đơn vị âm thanh nhỏ nhất. Phoneme accuracy đo người học phát đúng từng âm hay không.

Ví dụ, `/θ/` trong "think" có thể bị phát thành `/t/`. Hệ thống cần phát hiện lỗi và đưa hướng dẫn đặt lưỡi, luồng hơi hoặc khẩu hình.

#### Word stress

**Word stress** là trọng âm trong một từ. Hệ thống phân tích:

- Thời lượng âm tiết.
- Cường độ.
- Cao độ.
- Độ rõ của nguyên âm.

#### Sentence stress

**Sentence stress** là việc nhấn các từ quan trọng trong câu. Trong tiếng Anh, danh từ, động từ chính, tính từ và trạng từ thường được nhấn mạnh hơn các từ chức năng.

#### Intonation

**Intonation** là sự lên xuống của giọng nói. Nó giúp biểu đạt:

- Câu hỏi.
- Câu kể.
- Thái độ.
- Cảm xúc.
- Ý nhấn mạnh.

Có thể phân tích đường cao độ F0 để đánh giá xu hướng lên hoặc xuống giọng.

#### Fluency

**Fluency** là độ trôi chảy. Các chỉ số gồm:

- Số từ hoặc âm tiết mỗi phút.
- Độ dài khoảng nghỉ.
- Số lần ngập ngừng.
- Số lần lặp hoặc tự sửa.
- Độ dài trung bình của một mạch nói.
- Tỷ lệ thời gian thực sự phát âm.

Fluency không đồng nghĩa với nói thật nhanh. Người nói chậm nhưng đều, rõ và ít ngập ngừng vẫn có thể được đánh giá tốt.

## 4. Pipeline đánh giá tổng thể

```
Text Input
├── Trắc nghiệm
│   → IRT/CAT
│   → Điểm Grammar, Vocabulary, Reading, Listening
└── Bài viết
    → Phân tích Grammar, Vocabulary, Coherence
    → Writing score

Audio Input
→ Chuẩn hóa audio và loại khoảng im lặng
├── Read-aloud
│   → Whisper kiểm tra transcript
│   → MFA căn chỉnh phoneme
│   → Phoneme, stress, intonation, fluency
└── Speaking tự do
    → WhisperX tạo transcript và timestamp
    → Phân tích nội dung, grammar, vocabulary, fluency

Kết quả
→ Điểm theo từng kỹ năng
→ Ước lượng CEFR
→ Cập nhật hồ sơ người học
→ RAG tìm tài liệu
→ LLM tạo phản hồi, bài tập và lộ trình
```

## 5. Công nghệ đề xuất

| Thành phần | Công nghệ |
| --- | --- |
| Mobile | Flutter |
| Admin Web | React |
| Backend | ASP.NET Core |
| Database | PostgreSQL |
| Vector database | pgvector |
| IRT/CAT | Python, NumPy, SciPy, FastAPI |
| ASR | faster-whisper |
| Timestamp cấp từ | WhisperX |
| Căn chỉnh âm vị | Montreal Forced Aligner |
| Phân tích audio | FFmpeg, librosa, Parselmouth |
| LLM/RAG | LLM API và Semantic Kernel |
| Lưu audio | S3-compatible storage |

> **Ghi chú đối chiếu (Mảng 3):** bảng trên là đề xuất của Mảng 2 tại thời điểm viết. Stack *như đã xây* trùng ở phần lõi (ASP.NET Core + PostgreSQL + Python/FastAPI cho IRT/CAT, faster-whisper cho ASR) nhưng khác vài điểm: chỉ mục RAG hiện là tệp embedding `.npz` + cosine similarity (chưa dùng pgvector), LLM là Gemini SDK (không qua Semantic Kernel), và frontend đề xuất trong repo là React SPA. Chi tiết: [system-architecture.md](system-architecture.md).

---

# MẢNG 3 — Tối ưu hóa lộ trình học & Nền tảng công nghệ (tóm tắt)

> **Báo cáo đầy đủ:** [bao-cao-mang-3-vn.md](bao-cao-mang-3-vn.md) (tiếng Việt) — tổng hợp từ [learning-path-optimization.md](learning-path-optimization.md) (Phần A) và [system-architecture.md](system-architecture.md) (Phần B). Không sao chép lại ở đây để tránh hai bản lệch nhau; phần dưới chỉ là tóm tắt điều hành.

## Phần A — Bài toán tối ưu hóa lộ trình học

156 kỹ năng vi mô trên một DAG tiên quyết; mỗi người học có vector độ thành thạo ∈ [0, 1] và một CEFR mục tiêu; cần sinh thứ tự học tối thiểu hóa thời gian đạt mục tiêu. Bài toán khó vì: (1) ràng buộc tiên quyết cứng, (2) lợi ích phụ thuộc thứ tự — biến thể tĩnh tương đương xếp lịch 1|prec|Σ wⱼCⱼ, **NP-khó mạnh**, (3) sự quên (mastery suy giảm theo thời gian), (4) tính ngẫu nhiên — dẫn đến phát biểu chuẩn tắc dạng **MDP** (trạng thái = vector mastery, hành động = kỹ năng, phần thưởng = mức tăng mastery trung bình).

Ba phương pháp được so sánh **trên cùng một động lực học** (`ToyLearnerEnv`, n = 5 kỹ năng nối chuỗi; đánh giá 100 episode, seed 123):

| Chính sách | Return trung bình | Chi phí ngoại tuyến (s) | Độ trễ (ms/quyết định) |
| --- | --- | --- | --- |
| DP (value iteration, 11⁵ trạng thái) | **0.636** | 53.3 | 0.142 |
| DQN (4000 ep + checkpoint selection, chọn tại ep 2800) | 0.588 | 466.2 | 0.067 |
| Greedy (thứ tự cố định) | 0.533 | 0.0 | 0.003 |
| Ngẫu nhiên | 0.197 | 0.0 | 0.002 |

Thứ tự kỳ vọng DP ≥ DQN ≥ greedy > ngẫu nhiên được xác nhận bằng số. Hai phát hiện chính: (1) với sự quên, greedy thứ tự cố định **không còn gần tối ưu** — DQN vượt +10%, DP vượt +19% return; (2) DP không bao giờ mở rộng được tới 156 kỹ năng (11¹⁵⁶ ≈ 10¹⁶² trạng thái) — vai trò của nó là mốc neo đo lường trên môi trường toy.

**Đề xuất phân tầng:** production giữ pipeline greedy dựa trên luật (`PathBuilder.cs` — ràng buộc bảo đảm theo cấu trúc, giải thích được, zero dữ liệu); DP làm cận trên lý thuyết ở quy mô toy; RL (PPO + action masking ở 156 kỹ năng) là hướng nghiên cứu, chỉ triển khai sau một cổng đánh giá thắng greedy trong mô phỏng. Báo cáo thí nghiệm: `src/backend/ml/reports/dqn_poc.md`; bằng chứng tổng hợp: `src/backend/ml/reports/EVIDENCE.md`.

## Phần B — Kiến trúc hệ thống

Bốn tầng: React SPA (đề xuất) → ASP.NET Core minimal API (.NET 10, đã xây) → FastAPI ML service (Python/PyTorch/Gemini, đã xây, **stateless** + fail-soft 503) → PostgreSQL 16 (đã xây, EF Core migrations). Backend tách đôi có chủ đích: miền quan hệ hưởng lợi từ kiểu mạnh của .NET, miền ML bắt buộc là Python; ranh giới HTTP cô lập tiến trình GPU để nó có thể sập/khởi động lại mà không kéo đổ tính năng lõi. Lược đồ PostgreSQL được thiết kế cho chính truy vấn của các mô hình (CAT, KT, path, FSRS) — chi tiết bảng/chỉ mục và năm vòng lặp dữ liệu lõi trong báo cáo đầy đủ.

---

# Liên kết chéo: lý thuyết ↔ hiện thực trong repo

| Lý thuyết | Mảng | Trạng thái trong repo | Bằng chứng |
| --- | --- | --- | --- |
| ZPD — giữ bài học ở biên năng lực | 1 | CAT chọn câu max-information quanh θ | `ml/lingoroad_ml/` (`irt.py`, `cat.py`); `ml/reports/cat_simulation.md` — đúng-cấp 0.750, TB 18.5 câu (so với 0.672 của form cố định 30 câu) |
| Mastery Learning — ngưỡng thành thạo | 1 | τ = 0.8 lọc lộ trình; mastery EMA 0.3 + suy giảm 0.03/ngày về 0.5 | `LingoRoad/Domain/MasteryCalc.cs`, `PathBuilder.cs` |
| SRS — lặp lại ngắt quãng | 1 | **FSRS-4.5** (thế hệ kế tiếp của SM-2/Leitner mà Mảng 1 trình bày) | `LingoRoad/Domain/Fsrs.cs`, bảng `ReviewCards`, endpoints `/reviews/*` |
| Knowledge Tracing (DKT/DKVMN/SAINT+) | 1 | SAINT+ được serve; DKT/DKVMN là baseline đo cùng | `ml/lingoroad_ml/kt/`, `/kt/predict`; test AUC: SAINT+ 0.7586, DKT 0.7565, DKVMN 0.7558 (`ml/reports/kt_results.md`) |
| Gamification (XP, badges, leaderboard, streak) | 1 | Chưa hiện thực — thuộc phạm vi frontend/giai đoạn sau | — |
| IRT/CAT/EAP — placement | 2 | 3PL + CAT + cập nhật EAP; luật dừng ≥ 8 câu, SE < 0.35, trần 30 | `irt.py`, `cat.py`, `PlacementEndpoints.cs`; mô phỏng ở `ml/reports/cat_simulation.md` |
| LLM/RAG — advisor, sinh bài tập, AWE | 2 | Đã xây: advisor tiếng Việt (Gemini + embedding index), sinh bài tập + chấm Writing | `/path/advisor`, task 13 hoàn thành; mẫu sống ở `ml/reports/samples/` (`advisor.md`, `exercises.md`, `awe.md`) |
| ASR & đánh giá phát âm | 2 | Đã xây phần đọc-to: Whisper (faster-whisper, CUDA) + chấm điểm `/speech/score`; MFA/WhisperX chưa tích hợp | task 14 hoàn thành; `ml/reports/samples/speaking.md` |
| Tối ưu lộ trình (Greedy/DP/RL) | 3 | Greedy production; DP + DQN đo trên toy env | `PathBuilder.cs`, `ml/lingoroad_ml/rl/`, `ml/reports/dqn_poc.md` |
| Nền tảng công nghệ | 3 | ASP.NET Core + FastAPI + PostgreSQL 16 đã chạy end-to-end (React đề xuất) | [system-architecture.md](system-architecture.md); smoke e2e trong `ml/reports/EVIDENCE.md` |
