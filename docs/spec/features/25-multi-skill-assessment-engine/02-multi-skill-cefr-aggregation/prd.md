# Product Requirements Document (PRD) - Multi-Skill CEFR Aggregation & Diagnostic Report

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc tổng hợp điểm số từ 4 kỹ năng độc lập, quy đổi sang thang điểm chuẩn, xác định Bậc năng lực CEFR chung cuộc (Overall CEFR Level), sinh biểu đồ mạng nhện (Radar Chart) và xuất báo cáo chẩn đoán năng lực ngôn ngữ kèm lộ trình cải thiện cho học viên.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Sau khi thi thử 4 kỹ năng, thí sinh cần một kết quả tổng thể có ý nghĩa để biết mình đang ở bậc nào trong thang CEFR 6 bậc (từ A1 đến C2) tương tự như chứng chỉ thật.
- Các kỹ năng có số lượng câu hỏi và thang điểm thành phần khác nhau (Listening 35 câu trắc nghiệm, Reading 40 câu trắc nghiệm, Writing 2 bài luận, Speaking 3 phần ghi âm). Cần một công thức chuẩn hóa thống nhất để quy đổi về cùng một hệ quy chiếu.
- Nếu chỉ trả về một con số điểm đơn thuần, thí sinh sẽ không biết điểm mạnh/yếu của mình nằm ở đâu để ôn luyện tiếp.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Chuẩn hóa điểm số theo thang 10 và Bậc CEFR**:
  - Mỗi kỹ năng được quy đổi về thang điểm 10 (làm tròn đến 0.5 điểm).
  - Điểm tổng thể (Overall Score) = Trung bình cộng điểm 4 kỹ năng: `(Điểm Nghe + Điểm Đọc + Điểm Viết + Điểm Nói) ÷ 4`.
  - Quy đổi điểm trung bình ra Bậc CEFR chính thức:
    * Dưới 4.0: Dưới B1 (A1 hoặc A2 tùy điểm thành phần).
    * 4.0 - 5.5: Đạt bậc B1.
    * 6.0 - 8.0: Đạt bậc B2.
    * 8.5 - 10.0: Đạt bậc C1 / C2.
- **Biểu đồ Radar Năng lực (Competency Radar Chart)**: Trực quan hóa điểm số 4 kỹ năng trên đồ thị 4 trục.
- **Báo cáo Chẩn đoán Cá nhân hóa (Diagnostic Report)**: Tự động chỉ ra kỹ năng yếu nhất và gợi ý các bài học khắc phục tương ứng trong LingoRoad.

---

# 3. Non-Goals (Ngoài mục tiêu)

- In ấn chứng chỉ giấy có công chứng pháp lý ngoài đời thực.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learners**: Người học muốn xem kết quả chi tiết sau khi hoàn thành kỳ thi thử.

---

# 5. User Journey (Hành trình Người dùng)

1. Sau khi hoàn thành bài thi Nói, người học nhận thông báo bài thi đã được chấm xong.
2. Mở màn hình "Báo cáo Kết quả Thi thử":
   - Nhìn thấy ngay Bậc CEFR toát yếu (ví dụ: **B2 - Upper Intermediate**).
   - Biểu đồ mạng nhện 4 cánh hiển thị rõ: Nghe: 7.5, Đọc: 8.0, Viết: 6.0, Nói: 6.5 (Điểm Overall: 7.0).
3. Đọc phần "Phân tích điểm mạnh & điểm yếu": Hệ thống ghi nhận kỹ năng Viết đang là điểm nghẽn lớn nhất.
4. Nhấn nút "Tạo lộ trình khắc phục": Hệ thống tự động tạo các bài luyện tập Viết chuyên sâu trong mục Luyện tập.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

### 6.1. Thuật toán Quy đổi Điểm Thô sang Thang 10
- **Listening (35 câu)**: Quy đổi số câu đúng trên 35 sang thang 10.
- **Reading (40 câu)**: Quy đổi số câu đúng trên 40 sang thang 10.
- **Writing**: Tính điểm trung bình có trọng số giữa Task 1 (tỉ trọng 1/3) và Task 2 (tỉ trọng 2/3).
- **Speaking**: Tính điểm trung bình của 3 phần nói theo rubric.

### 6.2. Tính Bậc CEFR Tổng Thể
- Điểm trung bình cộng: `overall = (listening + reading + writing + speaking) / 4`.
- Quy tắc làm tròn chuẩn: Làm tròn đến 0.5 gần nhất (ví dụ: 5.75 làm tròn thành 6.0; 5.25 làm tròn thành 5.5).

### 6.3. Tự động liên kết Lộ trình học (Curriculum Bridge)
- Khi xác định được kỹ năng yếu nhất, phát sự kiện `cefr.assessment_completed` để Curriculum Engine điều chỉnh trọng số các bài học trong `LearningPath`.

