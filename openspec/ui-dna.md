# Quy tắc giao diện

## Design tokens
- Nền sáng #F4F7FB, bề mặt trắng, nền ô nhập #EDF1F6; chữ chính #1A2029, chữ phụ #5B6574, điểm nhấn xanh #59B070.
- Khoảng cách thường dùng 8, 12, 16 và 24 logical pixel; nhóm nội dung có lề ngang 16.
- Nội dung và điều khiển dùng Inter; tiêu đề học tập dùng Be Vietnam Pro Medium. Cỡ chữ nội dung thường 14–18, tiêu đề 18–28.
- Card bo góc 16; nút và ô nhập một dòng có thể dùng dạng viên thuốc. Ô viết nhiều dòng bo nhẹ 8 và giữ nguyên hình dạng khi đổi trạng thái.

## Component patterns
- Nút chính nền tối, chữ sáng; nút phụ nền sáng có viền. Vùng chạm tối thiểu 48.
- Ô nhập nhiều dòng căn chữ trên, padding 16; khai báo viền thường và focus cùng bán kính để tránh kế thừa kiểu viên thuốc từ theme.
- Focus dùng viền xanh 1,5; thay đổi trạng thái không làm viền lấn vào vùng chữ.

## Interaction and motion
- Chuyển trang và phản hồi thao tác dùng chuyển động ngắn, nhẹ; tôn trọng cài đặt giảm chuyển động.
- Lưu thất bại giữ nội dung và có thao tác thử lại. Không tự chuyển bước khi thao tác lưu chưa thành công.

## Accessibility
- Giữ focus và con trỏ rõ ràng; biểu tượng tương tác có tooltip hoặc nhãn ngữ nghĩa.
- Nội dung dài cuộn được; bàn phím không che hoàn toàn vùng viết và hành động tiếp tục.

## Voice and tone
- Hướng dẫn, trạng thái và lỗi dùng tiếng Việt ngắn, cụ thể; nội dung bài tập tiếng Anh giữ theo giáo trình.
- Phần xem thử ghi rõ dữ liệu mẫu, không trình bày kết quả minh họa như kết quả đánh giá thật.

## Layout and responsive
- Dùng chiều rộng theo vùng chứa, tôn trọng safe area và bàn phím; kiểm tra được ở viewport hẹp 320.
- Năm tab dùng chung thứ tự và thanh điều hướng: lề ngang 24, cao 56, icon 32.

## Anti-patterns
- Không dùng bo tròn viên thuốc cho vùng soạn thảo nhiều dòng.
- Không thay đổi hình học của ô nhập khi focus hoặc báo lỗi.
- Không dùng ảnh chụp toàn màn hình hoặc URL tài nguyên thiết kế tạm làm giao diện runtime.
